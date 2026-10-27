// paymind-voice — conversación de las llamadas de cobranza con IA.
//
// Twilio ConversationRelay ↔ este Worker (WebSocket):
//   Twilio → { type: 'setup' | 'prompt' | 'interrupt' | 'dtmf' | 'error' }
//   Worker → { type: 'text', token, last } (Twilio lo dice en voz) | { type: 'end' }
//
// Reglas que el modelo NO puede saltarse (van en el prompt y en el código):
//   - Identidad primero: hasta que la persona confirme que es el comprador no se
//     habla de deuda, montos ni vehículo (lo exige la ley de cobranza).
//   - Nada de amenazas, embargo, reportes de crédito ni descuentos inventados.
//   - Frases cortas: es una llamada, no un chat.
// El resultado lo marca el modelo llamando a una función (tool calling de Muse Spark);
// las etiquetas [[…]] de la versión anterior quedan como respaldo.

import { LOGO_BMP_B64 } from './logo';
import { DEALER_DEMO, DEUDORES_DEMO } from './demo-data';
import { CallLog, enviarEnlacePago, registrar, rutaDemo, type DemoEnv, type Evento } from './demo';

export { CallLog };

interface Env extends DemoEnv {
  MODEL_API_KEY: string; // Meta Model API (wrangler secret put MODEL_API_KEY)
  VOICE_KEY: string;
  PAYMIND_URL?: string; // sin él (o con DEMO=1) se usan los datos ficticios de demo-data.ts
  DEMO?: string;
}

type Turno = { role: 'user' | 'assistant'; content: string; ts: string };
type Mensaje = { role: 'system' | 'user' | 'assistant'; content: string };
type Contexto = {
  lang: 'es' | 'en';
  firstName: string;
  dealerName: string;
  dealerPhone: string | null;
  vehicle: string | null;
  pastDue: number;
  daysPastDue: number;
  paymentAmount: number;
  nextPaymentDate: string | null;
  today: string;
  rules: { freeExtensionDays: number; maxExtensionDays: number; allowSplitPayment: boolean; tone: string };
  memory?: Recuerdo[]; // llamadas anteriores, la más reciente al final
};
/** Lo que queda de una llamada para la siguiente (hackathon: memoria por deudor). */
type Recuerdo = { date: string; outcome: Resultado; promisedDate?: string; promisedAmount?: number; summary: string };
type Resultado = 'promise' | 'pay_link' | 'human' | 'do_not_call' | 'wrong_person' | 'done' | 'no_answer';

// Hackathon: Muse Spark por la Meta Model API (Responses API, streaming).
// Effort «minimal»: primer token en ~1 s, lo justo para una llamada.
const MODEL_API = 'https://api.meta.ai/v1/responses';
const MODELO = 'muse-spark-1.3';
const ESFUERZO = 'minimal';
const MAX_TURNOS = 14;

const modoDemo = (env: Env) => env.DEMO === '1' || !env.PAYMIND_URL;

const MAX_RECUERDOS = 5;
const claveMemoria = (deudor: string) => `memory:${deudor}`;
const deudorDemo = (callId: string) => DEUDORES_DEMO.find((x) => callId.startsWith(`demo-${x.id}`));

/** Contexto de la llamada en modo demo: callId = «demo-<deudor>-<lo que sea>», con su memoria. */
async function contextoDemo(callId: string, env: Env): Promise<Contexto | null> {
  const d = deudorDemo(callId);
  if (!d) return null;
  const today = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10); // Houston (CDT/CST ≈ UTC-5)
  const memory = (await env.MEMORY.get<Recuerdo[]>(claveMemoria(d.id), 'json').catch(() => null)) ?? [];
  return { ...d, ...DEALER_DEMO, today, memory };
}

/** Muse Spark resume la llamada en 1-2 frases para la próxima vez (sin streaming, fuera de la llamada). */
async function resumir(env: Env, c: Contexto, transcript: Turno[], resultado: Resultado): Promise<string> {
  const texto = transcript.map((t) => `${t.role === 'user' ? c.firstName : 'Agente'}: ${t.content}`).join('\n');
  try {
    const r = await fetch(MODEL_API, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MODEL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        reasoning: { effort: 'minimal' },
        max_output_tokens: 1200,
        instructions:
          'Resume esta llamada de cobranza en máximo 2 frases, en español, para que el agente la recuerde en la próxima llamada: ' +
          'qué dijo el cliente (motivo del atraso, situación, compromisos, tono) y cómo terminó. Sin saludos ni datos inventados.',
        input: `Resultado: ${resultado}\n\n${texto}`,
      }),
    });
    const j = (await r.json()) as { status?: string; error?: unknown; output?: { type: string; content?: { text?: string }[] }[] };
    const resumen = j.output?.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).map((x) => x.text ?? '').join(' ').trim();
    if (!resumen) console.log('[demo] resumen vacío', r.status, j.status, JSON.stringify(j.error ?? '').slice(0, 300));
    return resumen || `Llamada terminada: ${resultado}.`;
  } catch (e) {
    console.log('[demo] resumen falló', String(e));
    return `Llamada terminada: ${resultado}.`;
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    // Hackathon: página pública de la demo y su API.
    const demo = modoDemo(env) ? await rutaDemo(req, env, url) : null;
    if (demo) return demo;
    // Logo público para Twilio Branded Calling (piden URL https que termine en .bmp).
    if (url.pathname === '/brand/bizmind-logo-256.bmp') {
      const bytes = Uint8Array.from(atob(LOGO_BMP_B64), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'content-type': 'image/bmp', 'cache-control': 'public, max-age=86400' } });
    }
    if (url.pathname !== '/ws') return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });

    const callId = url.searchParams.get('c') || '';
    const firma = url.searchParams.get('t') || '';
    if (!callId || !(await firmaValida(env.VOICE_KEY, callId, firma))) return new Response('forbidden', { status: 403 });

    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    new Sesion(servidor, callId, env, ctx).iniciar();
    return new Response(null, { status: 101, webSocket: cliente });
  },
};

async function firmaValida(clave: string, texto: string, firmaHex: string): Promise<boolean> {
  if (!clave || !/^[0-9a-f]{64}$/.test(firmaHex)) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(firmaHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', k, bytes, new TextEncoder().encode(texto));
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Sesion {
  private ctxDatos: Promise<Contexto | null>;
  private mensajes: Mensaje[] = [];
  private transcript: Turno[] = [];
  private generacion = 0;
  private turnos = 0;
  private resultado: Resultado | null = null;
  private promesa: { date: string; amount: number } | null = null;
  private cerrada = false;
  private cola: Promise<void> = Promise.resolve();

  constructor(
    private ws: WebSocket,
    private callId: string,
    private env: Env,
    private ctx: ExecutionContext,
  ) {
    // El contexto se pide en cuanto se abre el socket (no hay que esperar al setup).
    this.ctxDatos = modoDemo(env) ? contextoDemo(callId, env) : fetch(`${env.PAYMIND_URL}/api/collection/voice/context?c=${encodeURIComponent(callId)}`, {
      headers: { 'x-voice-key': env.VOICE_KEY },
    })
      .then((r) => (r.ok ? (r.json() as Promise<Contexto>) : null))
      .catch(() => null);
  }

  iniciar() {
    this.ws.addEventListener('message', (ev) => {
      let m: { type?: string; voicePrompt?: string; last?: boolean; utteranceUntilInterrupt?: string };
      try {
        m = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (m.type === 'setup') {
        this.cola = this.cola.then(() => this.preparar());
      } else if (m.type === 'prompt' && m.last !== false && m.voicePrompt?.trim()) {
        const texto = m.voicePrompt.trim();
        this.generacion++; // lo que se estuviera diciendo queda viejo
        this.cola = this.cola.then(() => this.responder(texto));
      } else if (m.type === 'interrupt') {
        this.generacion++;
        // Lo que de verdad oyó el comprador: se recorta el último turno de la IA.
        const ultimo = this.transcript[this.transcript.length - 1];
        if (ultimo?.role === 'assistant' && m.utteranceUntilInterrupt) ultimo.content = `${m.utteranceUntilInterrupt}…`;
      }
    });
    this.ws.addEventListener('close', () => this.terminar());
    this.ws.addEventListener('error', () => this.terminar());
  }

  private async preparar() {
    const c = await this.ctxDatos;
    if (!c) {
      this.enviar({ type: 'text', token: 'Lo siento, tenemos un problema técnico. Le llamaremos más tarde.', last: true });
      this.resultado = 'done';
      await dormir(3500);
      this.colgar();
      return;
    }
    this.mensajes = [{ role: 'system', content: instrucciones(c) }];
    // El saludo lo dijo Twilio (welcomeGreeting): se registra igual en el historial.
    const saludo =
      c.lang === 'es'
        ? `Hola, le habla el asistente virtual de ${c.dealerName}. ¿Hablo con ${c.firstName}?`
        : `Hi, this is the virtual assistant from ${c.dealerName}. Am I speaking with ${c.firstName}?`;
    this.mensajes.push({ role: 'assistant', content: saludo });
    this.anotar({ role: 'assistant', content: saludo, ts: new Date().toISOString() });
  }

  private async responder(texto: string) {
    if (this.cerrada || this.resultado) return;
    const c = await this.ctxDatos;
    if (!c) return;
    const miGeneracion = this.generacion;
    this.turnos++;
    this.anotar({ role: 'user', content: texto, ts: new Date().toISOString() });
    this.mensajes.push({ role: 'user', content: texto });
    if (this.turnos >= MAX_TURNOS) {
      this.mensajes.push({ role: 'system', content: 'La llamada ya es muy larga: despídete amablemente, di que alguien del equipo le llamará, y llama a transfer_to_human.' });
    }

    let completo = '';
    let pendiente = '';
    let dicho = '';
    let mensajeHablado: number | null = null; // output_index del mensaje que se dice (a veces Muse manda dos)
    const llamadas: Funcion[] = [];
    const decir = (frase: string, last: boolean) => {
      const limpia = frase.replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+/g, ' ');
      if (miGeneracion !== this.generacion) return; // el comprador ya habló encima
      if (limpia.trim() || last) this.enviar({ type: 'text', token: limpia, last });
      dicho += limpia;
    };

    try {
      // Responses API: los mensaje(s) de sistema van en «instructions», el resto en «input».
      const r = await fetch(MODEL_API, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.env.MODEL_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODELO,
          stream: true,
          reasoning: { effort: ESFUERZO },
          max_output_tokens: 700, // incluye los tokens de razonamiento (~100 con «minimal»)
          tools: HERRAMIENTAS,
          instructions: this.mensajes.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'),
          input: this.mensajes.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!r.ok || !r.body) throw new Error(`model api ${r.status}`);
      const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += value;
        const lineas = resto.split('\n');
        resto = lineas.pop() || '';
        for (const l of lineas) {
          if (!l.startsWith('data:')) continue;
          const dato = l.slice(5).trim();
          if (dato === '[DONE]') continue;
          let token = '';
          try {
            const j = JSON.parse(dato) as { type?: string; delta?: string; output_index?: number; item?: { type?: string; name?: string; arguments?: string } };
            if (j.type === 'response.output_item.done' && j.item?.type === 'function_call' && j.item.name) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(j.item.arguments || '{}');
              } catch {}
              llamadas.push({ name: j.item.name, args });
              continue;
            }
            if (j.type !== 'response.output_text.delta') continue; // razonamiento y eventos de control no se dicen
            mensajeHablado ??= j.output_index ?? 0;
            if ((j.output_index ?? 0) !== mensajeHablado) continue; // segundo mensaje = repetición
            token = j.delta ?? '';
          } catch {
            continue;
          }
          completo += token;
          pendiente += token;
          // Se habla por frases completas y nunca a mitad de una etiqueta [[…]].
          const abierta = pendiente.lastIndexOf('[[') > pendiente.lastIndexOf(']]');
          const corte = pendiente.search(/[.!?…](\s|$)/);
          if (!abierta && corte >= 0) {
            decir(pendiente.slice(0, corte + 1) + ' ', false);
            pendiente = pendiente.slice(corte + 1);
          }
        }
      }
    } catch {
      completo ||= c.lang === 'es' ? 'Perdón, ¿me lo puede repetir?' : 'Sorry, could you repeat that?';
      pendiente ||= completo;
    }
    // Llamó a una función sin decir nada: una despedida corta para no colgar en silencio.
    if (!completo.trim() && llamadas.length) pendiente = c.lang === 'es' ? 'Muchas gracias, que tenga buen día.' : 'Thank you, have a great day.';
    decir(pendiente, true);

    this.mensajes.push({ role: 'assistant', content: completo || dicho });
    this.anotar({ role: 'assistant', content: dicho.trim(), ts: new Date().toISOString() });

    let fin = leerFunciones(llamadas, c) ?? leerEtiquetas(completo, c);
    // Sonó a cierre pero no llamó a ninguna función: Muse decide aparte si la llamada terminó.
    if (!fin && PARECE_CIERRE.test(dicho)) {
      fin = await this.verificarCierre(c);
      if (miGeneracion !== this.generacion) fin = null; // el comprador siguió hablando: la llamada sigue
    }
    if (fin) {
      this.resultado = fin.resultado;
      this.promesa = fin.promesa;
      // Nunca se cuelga sin despedirse.
      if (!SE_DESPIDIO.test(dicho)) {
        const adios = despedida(fin.resultado, c.lang);
        this.enviar({ type: 'text', token: adios, last: true });
        dicho += ` ${adios}`;
        this.anotar({ role: 'assistant', content: adios, ts: new Date().toISOString() });
      }
      // Se deja terminar la última frase antes de colgar (~65 ms por carácter).
      await dormir(Math.min(15000, dicho.length * 65 + 900));
      this.colgar();
    }
  }

  /** Segunda opinión de Muse con tool_choice «required»: ¿terminó la llamada y cómo? */
  private async verificarCierre(c: Contexto): Promise<Fin | null> {
    try {
      const r = await fetch(MODEL_API, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.env.MODEL_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODELO,
          reasoning: { effort: ESFUERZO },
          max_output_tokens: 700,
          tools: [...HERRAMIENTAS, CONTINUAR],
          tool_choice: 'required',
          instructions:
            this.mensajes.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') +
            '\n\nREVISIÓN: el agente acaba de hablar. Si la llamada ya llegó a su fin según las reglas (p. ej. fecha y monto confirmados), llama a la función de ese desenlace con sus datos; si falta algo por acordar o preguntar, llama a continue_conversation.',
          input: this.mensajes.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const j = (await r.json()) as { output?: { type: string; name?: string; arguments?: string }[] };
      const llamadas: Funcion[] = (j.output ?? [])
        .filter((o) => o.type === 'function_call' && o.name && o.name !== 'continue_conversation')
        .map((o) => {
          try {
            return { name: o.name!, args: JSON.parse(o.arguments || '{}') };
          } catch {
            return { name: o.name!, args: {} };
          }
        });
      return leerFunciones(llamadas, c);
    } catch {
      return null;
    }
  }

  private enviar(m: unknown) {
    if (this.cerrada) return;
    try {
      this.ws.send(JSON.stringify(m));
    } catch {}
  }

  private colgar() {
    this.enviar({ type: 'end', handoffData: JSON.stringify({ outcome: this.resultado }) });
    this.terminar();
  }

  /** Turno al historial; en la demo, también a la transcripción en vivo de la página. */
  private anotar(t: Turno) {
    this.transcript.push(t);
    this.evento({ kind: 'turn', ...t });
  }

  private evento(ev: Evento) {
    if (modoDemo(this.env) && this.env.CALLS) this.ctx.waitUntil(registrar(this.env.CALLS, this.callId, ev));
  }

  private terminar() {
    if (this.cerrada) return;
    this.cerrada = true;
    // Contestó pero colgó sin llegar a nada: «done» (o «no_answer» si nunca habló).
    const resultado: Resultado = this.resultado ?? (this.turnos > 0 ? 'done' : 'no_answer');
    this.evento({ kind: 'end', outcome: resultado, promisedDate: this.promesa?.date, promisedAmount: this.promesa?.amount, ts: new Date().toISOString() });
    const cuerpo = JSON.stringify({
      callId: this.callId,
      outcome: resultado,
      promisedDate: this.promesa?.date,
      promisedAmount: this.promesa?.amount,
      transcript: this.transcript,
    });
    const mandar = async () => {
      if (modoDemo(this.env)) {
        console.log('[demo] resultado', cuerpo); // en demo no hay backend: queda en los logs del Worker
        const c = await this.ctxDatos;
        const d = deudorDemo(this.callId);
        if (!c || !d || this.turnos === 0) return; // sin conversación no hay nada que recordar
        // Promesa o «pagar hoy»: enlace de Stripe (modo TEST) por SMS al teléfono que contestó.
        if (resultado === 'promise' || resultado === 'pay_link') {
          const monto = this.promesa?.amount ?? (c.pastDue > 0 ? c.pastDue : c.paymentAmount);
          const url = await enviarEnlacePago(this.env, this.callId, { firstName: c.firstName, vehicle: c.vehicle, dealerName: c.dealerName, lang: c.lang }, monto);
          if (url) this.evento({ kind: 'sms', url, amount: monto, ts: new Date().toISOString() });
        }
        const recuerdo: Recuerdo = {
          date: c.today,
          outcome: resultado,
          promisedDate: this.promesa?.date,
          promisedAmount: this.promesa?.amount,
          summary: await resumir(this.env, c, this.transcript, resultado),
        };
        const memoria = [...(c.memory ?? []), recuerdo].slice(-MAX_RECUERDOS);
        await this.env.MEMORY.put(claveMemoria(d.id), JSON.stringify(memoria));
        return;
      }
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(`${this.env.PAYMIND_URL}/api/collection/voice/result`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-voice-key': this.env.VOICE_KEY },
            body: cuerpo,
          });
          if (r.ok) return;
        } catch {}
        await dormir(1500 * (i + 1));
      }
    };
    this.ctx.waitUntil(mandar());
    try {
      this.ws.close(1000, 'fin');
    } catch {}
  }
}

type Funcion = { name: string; args: Record<string, unknown> };
type Fin = { resultado: Resultado; promesa: { date: string; amount: number } | null };

// Hackathon: el resultado de la llamada sale de tool calling de Muse Spark (más fiable que
// las etiquetas [[…]], que quedan solo de respaldo). Todas cierran la llamada.
const HERRAMIENTAS = [
  {
    type: 'function',
    name: 'record_promise',
    description: 'The buyer stated BOTH a payment date and an amount. Say the confirmation out loud first, then call this.',
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, from the calendar in the instructions' }, amount: { type: 'number', description: 'US dollars' } },
      required: ['date', 'amount'],
      additionalProperties: false,
    },
  },
  { type: 'function', name: 'send_pay_link', description: 'The buyer wants to pay today: tell them a secure card-payment link is on its way by text, then call this.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  {
    type: 'function',
    name: 'transfer_to_human',
    description: 'Needs more time than allowed, cannot pay, disputes the debt, has a serious problem, asks for a person, or the call is too long. Tell them someone from the team will call today, then call this.',
    parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'], additionalProperties: false },
  },
  { type: 'function', name: 'do_not_call', description: 'The person asked not to be called again. Apologize, confirm, then call this.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'wrong_person', description: 'The person did not clearly confirm being the buyer. Say the exact wrong-person sentence from the instructions, then call this.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'end_call', description: 'Already paid, or everything is clear with no agreement needed. Thank them, say goodbye, then call this.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
];

const CONTINUAR = {
  type: 'function',
  name: 'continue_conversation',
  description: 'The call is not over yet: something still needs to be agreed or asked.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

// Frases que suelen cerrar una llamada (disparan la revisión) y despedidas (para no colgar sin una).
const PARECE_CIERRE = /confirm|registr|agend|queda|le (mando|env[ií]o|enviar[ée])|enlace|alguien del equipo|no (lo|la) volver|scheduled|recorded|send you|link|someone from|won't call/i;
const SE_DESPIDIO = /buen d[ií]a|buena tarde|buenas noches|adi[oó]s|hasta luego|cu[ií]dese|have a (great|good|nice)|goodbye|bye|take care/i;

function despedida(r: Resultado, lang: 'es' | 'en'): string {
  if (lang === 'es') {
    if (r === 'promise' || r === 'pay_link') return 'Le mando el enlace de pago por mensaje. ¡Gracias, que tenga buen día!';
    if (r === 'human') return 'Alguien del equipo le llamará hoy. Gracias, que tenga buen día.';
    return 'Gracias, que tenga buen día.';
  }
  if (r === 'promise' || r === 'pay_link') return "I'll text you the payment link. Thank you, have a great day!";
  if (r === 'human') return 'Someone from our team will call you today. Thank you, have a great day.';
  return 'Thank you, have a great day.';
}

/** Promesa dentro de las reglas del dealer; si no, pasa a un humano. */
function validarPromesa(fecha: string, monto: number, c: Contexto): Fin {
  const dias = (Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${c.today}T12:00:00Z`)) / 86_400_000;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && dias >= 0 && dias <= c.rules.maxExtensionDays && monto > 0) return { resultado: 'promise', promesa: { date: fecha, amount: monto } };
  return { resultado: 'human', promesa: null };
}

/** Convierte las funciones que llamó el modelo en el resultado de la llamada. */
function leerFunciones(llamadas: Funcion[], c: Contexto): Fin | null {
  const f = llamadas[0];
  if (!f) return null;
  switch (f.name) {
    case 'record_promise':
      return validarPromesa(String(f.args.date ?? ''), Number(f.args.amount), c);
    case 'send_pay_link':
      return { resultado: 'pay_link', promesa: null };
    case 'transfer_to_human':
      return { resultado: 'human', promesa: null };
    case 'do_not_call':
      return { resultado: 'do_not_call', promesa: null };
    case 'wrong_person':
      return { resultado: 'wrong_person', promesa: null };
    case 'end_call':
      return { resultado: 'done', promesa: null };
  }
  return null;
}

/** Respaldo: las etiquetas finales del modelo (formato previo al hackathon). */
function leerEtiquetas(texto: string, c: Contexto): Fin | null {
  const p = texto.match(/\[\[PROMESA:(\d{4}-\d{2}-\d{2}):([\d.]+)\]\]/);
  if (p) return validarPromesa(p[1], Number(p[2]), c);
  // Dijo la frase de «no es el comprador» pero no llamó a la función: se cierra igual.
  if (texto.includes(fraseNoEsEl(c).split('?')[0])) return { resultado: 'wrong_person', promesa: null };
  if (/\[\[NO_LLAMAR\]\]/.test(texto)) return { resultado: 'do_not_call', promesa: null };
  if (/\[\[NO_ES_EL\]\]/.test(texto)) return { resultado: 'wrong_person', promesa: null };
  if (/\[\[HUMANO\]\]/.test(texto)) return { resultado: 'human', promesa: null };
  if (/\[\[PAGO_LINK\]\]/.test(texto)) return { resultado: 'pay_link', promesa: null };
  if (/\[\[FIN\]\]/.test(texto)) return { resultado: 'done', promesa: null };
  return null;
}

/** Frase fija para quien no es el comprador (no revela nada de la deuda). */
function fraseNoEsEl(c: Contexto): string {
  return c.lang === 'es'
    ? `Gracias. ¿Le puede pedir a ${c.firstName} que nos llame a ${c.dealerName}${c.dealerPhone ? ` al ${c.dealerPhone}` : ''}? Que tenga buen día.`
    : `Thank you. Could you ask ${c.firstName} to call ${c.dealerName}${c.dealerPhone ? ` at ${c.dealerPhone}` : ''}? Have a great day.`;
}

function instrucciones(c: Contexto): string {
  const dinero = (n: number) => `$${n.toFixed(2)}`;
  const limite = new Date(Date.parse(`${c.today}T12:00:00Z`) + c.rules.maxExtensionDays * 86_400_000).toISOString().slice(0, 10);
  const situacion =
    c.pastDue > 0
      ? `Tiene un saldo vencido de ${dinero(c.pastDue)} (${c.daysPastDue} días de atraso). Su pago normal es de ${dinero(c.paymentAmount)}.`
      : `No tiene atraso; su próximo pago es de ${dinero(c.paymentAmount)}${c.nextPaymentDate ? ` el ${c.nextPaymentDate}` : ''}. La llamada es solo un recordatorio amable.`;
  const noEsEl = fraseNoEsEl(c);
  // Hackathon: memoria por deudor. Solo se usa DESPUÉS de confirmar la identidad (regla 1).
  const memoria = c.memory?.length
    ? `
LLAMADAS ANTERIORES (lo que recuerdas de este cliente; la última al final):
${c.memory.map((m) => `- ${m.date}: ${m.summary}${m.promisedDate ? ` Prometió pagar $${m.promisedAmount} el ${m.promisedDate}.` : ''}`).join('\n')}
Cómo usarlas: una vez confirmada la identidad, menciónalo con naturalidad en tu primera explicación ("la última vez me dijo que…"). Si había una promesa y la fecha ya pasó sin pago (sigue el saldo vencido), recuérdasela con empatía, sin regañar, y busca una nueva fecha. No repitas preguntas que ya respondió antes.
`
    : '';
  const idioma = c.lang === 'es' ? 'Habla SIEMPRE en español neutro (de EE. UU.), de usted.' : 'Always speak English.';
  // Calendario de los próximos días: el modelo se equivoca al calcular «el viernes».
  const dias = c.lang === 'es' ? ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const calendario = Array.from({ length: c.rules.maxExtensionDays + 1 }, (_, i) => {
    const f = new Date(Date.parse(`${c.today}T12:00:00Z`) + i * 86_400_000);
    return `${dias[f.getUTCDay()]} ${f.toISOString().slice(0, 10)}${i === 0 ? ' (hoy)' : i === 1 ? ' (mañana)' : ''}`;
  }).join('; ');
  return `Eres el asistente virtual de cobranza de ${c.dealerName}, un concesionario de autos en Texas. Estás en una LLAMADA TELEFÓNICA con un cliente que compró ${c.vehicle ? `un ${c.vehicle}` : 'un vehículo'} financiado por el concesionario. ${idioma}
Hoy es ${c.today}. Fechas válidas para una promesa (usa EXACTAMENTE estas): ${calendario}.

DATOS (solo para el cliente, nunca para terceros):
- Nombre: ${c.firstName}
- ${situacion}
- Teléfono del concesionario: ${c.dealerPhone || 'el de siempre'}
${memoria}
REGLAS OBLIGATORIAS:
1. Ya preguntaste "¿Hablo con ${c.firstName}?". Si la persona NO lo confirma claramente (dice que no, que no está, que es otra persona, o no sabe), NO digas por qué llamas: nada de pagos, montos, cuentas, deudas ni del vehículo, aunque te pregunte. Responde EXACTAMENTE: "${noEsEl}" y llama a wrong_person.
2. Si confirma que es ${c.firstName}: explica brevemente el motivo de la llamada con los DATOS y pregunta cuándo puede pagar.
3. Opciones que puedes ofrecer:
   - Pagar hoy: dile que le mandas ahora mismo por mensaje un enlace seguro para pagar con tarjeta. Luego llama a send_pay_link.
   - Prometer una fecha: solo entre hoy (${c.today}) y ${limite}, usando el calendario de arriba. Si el cliente no dijo cuánto pagará, PREGÚNTASELO (nunca lo supongas). Cuando ya tengas fecha y monto dichos por el cliente, repítelos en voz alta, dile que le mandas el enlace de pago y llama a record_promise con esa fecha (AAAA-MM-DD) y monto.
   - Si pide más tiempo del permitido, no puede pagar, tiene una disputa, un problema serio, o quiere hablar con una persona: dile con empatía que alguien del equipo le llamará hoy. Luego llama a transfer_to_human.
   - Si pide que no lo vuelvan a llamar: discúlpate, confirma que no recibirá más llamadas automáticas y llama a do_not_call.
   - Si ya pagó o todo quedó claro sin acuerdo: agradece, despídete y llama a end_call.
4. PROHIBIDO: amenazar, mencionar embargo, recuperación del auto, abogados, cortes o reportes de crédito; inventar descuentos, multas o acuerdos; pedir números de tarjeta o datos bancarios por teléfono; decir que eres una persona.
5. Habla como en una llamada: frases cortas, máximo 2 oraciones por turno, cálido y respetuoso. Llama al cliente por su nombre (${c.firstName}); no uses "señor" ni "señora". Di los montos con naturalidad ("cuatrocientos cincuenta dólares"). Sin listas, sin emojis, sin markdown.
6. Para terminar la llamada SIEMPRE dices tu frase y llamas a UNA sola función; nunca escribas los nombres de las funciones en voz alta.`;
}
