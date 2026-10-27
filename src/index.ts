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
// El modelo marca el resultado con etiquetas [[…]] al final de su respuesta;
// el código las quita antes de hablar y las convierte en el resultado.

import { LOGO_BMP_B64 } from './logo';

interface Env {
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  VOICE_KEY: string;
  PAYMIND_URL: string;
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
};
type Resultado = 'promise' | 'pay_link' | 'human' | 'do_not_call' | 'wrong_person' | 'done' | 'no_answer';

const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_TURNOS = 14;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
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
    this.ctxDatos = fetch(`${env.PAYMIND_URL}/api/collection/voice/context?c=${encodeURIComponent(callId)}`, {
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
    this.transcript.push({ role: 'assistant', content: saludo, ts: new Date().toISOString() });
  }

  private async responder(texto: string) {
    if (this.cerrada || this.resultado) return;
    const c = await this.ctxDatos;
    if (!c) return;
    const miGeneracion = this.generacion;
    this.turnos++;
    this.transcript.push({ role: 'user', content: texto, ts: new Date().toISOString() });
    this.mensajes.push({ role: 'user', content: texto });
    if (this.turnos >= MAX_TURNOS) {
      this.mensajes.push({ role: 'system', content: 'La llamada ya es muy larga: despídete amablemente, di que alguien del equipo le llamará, y termina con [[HUMANO]].' });
    }

    let completo = '';
    let pendiente = '';
    let dicho = '';
    const decir = (frase: string, last: boolean) => {
      const limpia = frase.replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+/g, ' ');
      if (miGeneracion !== this.generacion) return; // el comprador ya habló encima
      if (limpia.trim() || last) this.enviar({ type: 'text', token: limpia, last });
      dicho += limpia;
    };

    try {
      const flujo = (await this.env.AI.run(MODELO, {
        messages: this.mensajes,
        stream: true,
        max_tokens: 260,
        temperature: 0.4,
      })) as ReadableStream<Uint8Array>;
      const lector = flujo.pipeThrough(new TextDecoderStream()).getReader();
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
            const j = JSON.parse(dato) as { response?: string; choices?: { delta?: { content?: string } }[] };
            token = j.response ?? j.choices?.[0]?.delta?.content ?? '';
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
    decir(pendiente, true);

    this.mensajes.push({ role: 'assistant', content: completo });
    this.transcript.push({ role: 'assistant', content: dicho.trim(), ts: new Date().toISOString() });

    const fin = leerEtiquetas(completo, c);
    if (fin) {
      this.resultado = fin.resultado;
      this.promesa = fin.promesa;
      // Se deja terminar la última frase antes de colgar (~65 ms por carácter).
      await dormir(Math.min(15000, dicho.length * 65 + 900));
      this.colgar();
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

  private terminar() {
    if (this.cerrada) return;
    this.cerrada = true;
    // Contestó pero colgó sin llegar a nada: «done» (o «no_answer» si nunca habló).
    const resultado: Resultado = this.resultado ?? (this.turnos > 0 ? 'done' : 'no_answer');
    const cuerpo = JSON.stringify({
      callId: this.callId,
      outcome: resultado,
      promisedDate: this.promesa?.date,
      promisedAmount: this.promesa?.amount,
      transcript: this.transcript,
    });
    const mandar = async () => {
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

/** Convierte las etiquetas finales del modelo en el resultado de la llamada. */
function leerEtiquetas(texto: string, c: Contexto): { resultado: Resultado; promesa: { date: string; amount: number } | null } | null {
  const p = texto.match(/\[\[PROMESA:(\d{4}-\d{2}-\d{2}):([\d.]+)\]\]/);
  if (p) {
    const dias = (Date.parse(`${p[1]}T12:00:00Z`) - Date.parse(`${c.today}T12:00:00Z`)) / 86_400_000;
    const monto = Number(p[2]);
    // Fuera de las reglas del dealer: no se acepta como promesa, pasa a un humano.
    if (dias >= 0 && dias <= c.rules.maxExtensionDays && monto > 0) return { resultado: 'promise', promesa: { date: p[1], amount: monto } };
    return { resultado: 'human', promesa: null };
  }
  if (/\[\[NO_LLAMAR\]\]/.test(texto)) return { resultado: 'do_not_call', promesa: null };
  if (/\[\[NO_ES_EL\]\]/.test(texto)) return { resultado: 'wrong_person', promesa: null };
  if (/\[\[HUMANO\]\]/.test(texto)) return { resultado: 'human', promesa: null };
  if (/\[\[PAGO_LINK\]\]/.test(texto)) return { resultado: 'pay_link', promesa: null };
  if (/\[\[FIN\]\]/.test(texto)) return { resultado: 'done', promesa: null };
  return null;
}

function instrucciones(c: Contexto): string {
  const dinero = (n: number) => `$${n.toFixed(2)}`;
  const limite = new Date(Date.parse(`${c.today}T12:00:00Z`) + c.rules.maxExtensionDays * 86_400_000).toISOString().slice(0, 10);
  const situacion =
    c.pastDue > 0
      ? `Tiene un saldo vencido de ${dinero(c.pastDue)} (${c.daysPastDue} días de atraso). Su pago normal es de ${dinero(c.paymentAmount)}.`
      : `No tiene atraso; su próximo pago es de ${dinero(c.paymentAmount)}${c.nextPaymentDate ? ` el ${c.nextPaymentDate}` : ''}. La llamada es solo un recordatorio amable.`;
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

REGLAS OBLIGATORIAS:
1. Ya preguntaste "¿Hablo con ${c.firstName}?". Si la persona NO lo confirma claramente (dice que no, que no está, que es otra persona, o no sabe), NO digas por qué llamas: nada de pagos, montos, cuentas, deudas ni del vehículo, aunque te pregunte. Responde EXACTAMENTE: "Gracias. ¿Le puede pedir a ${c.firstName} que nos llame a ${c.dealerName}${c.dealerPhone ? ` al ${c.dealerPhone}` : ''}? Que tenga buen día." y termina con [[NO_ES_EL]].
2. Si confirma que es ${c.firstName}: explica brevemente el motivo de la llamada con los DATOS y pregunta cuándo puede pagar.
3. Opciones que puedes ofrecer:
   - Pagar hoy: dile que le mandas ahora mismo por mensaje un enlace seguro para pagar con tarjeta. Termina con [[PAGO_LINK]].
   - Prometer una fecha: solo entre hoy (${c.today}) y ${limite}, usando el calendario de arriba. Si el cliente no dijo cuánto pagará, PREGÚNTASELO (nunca lo supongas). Cuando ya tengas fecha y monto dichos por el cliente, repítelos en voz alta, dile que le mandas el enlace de pago y termina con [[PROMESA:AAAA-MM-DD:MONTO]] (ej. [[PROMESA:${c.today}:${c.paymentAmount.toFixed(2)}]]).
   - Si pide más tiempo del permitido, no puede pagar, tiene una disputa, un problema serio, o quiere hablar con una persona: dile con empatía que alguien del equipo le llamará hoy. Termina con [[HUMANO]].
   - Si pide que no lo vuelvan a llamar: discúlpate, confirma que no recibirá más llamadas automáticas y termina con [[NO_LLAMAR]].
   - Si ya pagó o todo quedó claro sin acuerdo: agradece, despídete y termina con [[FIN]].
4. PROHIBIDO: amenazar, mencionar embargo, recuperación del auto, abogados, cortes o reportes de crédito; inventar descuentos, multas o acuerdos; pedir números de tarjeta o datos bancarios por teléfono; decir que eres una persona.
5. Habla como en una llamada: frases cortas, máximo 2 oraciones por turno, cálido y respetuoso. Llama al cliente por su nombre (${c.firstName}); no uses "señor" ni "señora". Di los montos con naturalidad ("cuatrocientos cincuenta dólares"). Sin listas, sin emojis, sin markdown.
6. Las etiquetas [[…]] van SOLO al final de tu último mensaje, nunca en medio, y solo una.`;
}
