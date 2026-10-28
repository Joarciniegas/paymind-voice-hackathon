// Hackathon: demo pública. Quien abre la página elige un comprador ficticio,
// escribe su teléfono (solo EE. UU.) y recibe la llamada real desde la línea de
// Twilio; la transcripción se ve en vivo (Durable Object «CallLog» por llamada).
//
// Límites para que nadie abuse: 3 llamadas por teléfono al día y un tope global
// diario (DEMO_DAILY_CAP). Los contadores viven en el KV MEMORY («rate:…»).

import { DEUDORES_DEMO, DEALER_DEMO } from './demo-data';
import { PAGINA } from './demo-page';
import { planificar } from './planner';
import { leerDia, type Acta } from './audit';
import { grabacionLista } from './recording';

export interface DemoEnv {
  MEMORY: KVNamespace;
  CALLS: DurableObjectNamespace;
  VOICE_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM: string;
  MODEL_API_KEY: string;
  STRIPE_TEST_KEY: string; // sandbox: los enlaces de la demo nunca cobran dinero real
  DEMO_DAILY_CAP?: string;
}

export type Evento =
  | { kind: 'turn'; role: 'user' | 'assistant'; content: string; ts: string }
  | { kind: 'status'; status: string; ts: string }
  | { kind: 'end'; outcome: string; promisedDate?: string; promisedAmount?: number; ts: string }
  | { kind: 'sms'; url: string; amount: number; ts: string }
  | ({ kind: 'audit'; ts: string } & Acta)
  | { kind: 'voice'; model: string; turns: { who: 'agent' | 'buyer'; text: string; startMs: number }[]; ts: string };

const POR_TELEFONO = 3;
const PLANES_POR_DIA = 200; // cada plan son 1-2 peticiones a Muse
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const hoy = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function firmar(clave: string, texto: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)));
  return [...f].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normaliza a +1XXXXXXXXXX; solo números de EE. UU. que no sean de cobro especial. */
function telefonoUS(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d) || /^(800|833|844|855|866|877|888|900|976)/.test(d)) return null;
  return `+1${d}`;
}

/** Suma 1 a un contador diario; false si ya llegó al tope. */
async function contar(env: DemoEnv, clave: string, tope: number): Promise<boolean> {
  const n = Number((await env.MEMORY.get(clave)) || 0);
  if (n >= tope) return false;
  await env.MEMORY.put(clave, String(n + 1), { expirationTtl: 2 * 86_400 });
  return true;
}

/** Rutas de la demo. null = no es de la demo (sigue el Worker normal). */
export async function rutaDemo(req: Request, env: DemoEnv, url: URL, ctx: ExecutionContext): Promise<Response | null> {
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/demo')) {
    return new Response(PAGINA, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (req.method === 'GET' && url.pathname === '/api/buyers') {
    return json({ dealer: DEALER_DEMO, buyers: DEUDORES_DEMO });
  }
  if (req.method === 'GET' && url.pathname === '/api/memory') {
    const d = DEUDORES_DEMO.find((x) => x.id === url.searchParams.get('d'));
    if (!d) return json({ error: 'unknown buyer' }, 404);
    return json({ memory: (await env.MEMORY.get(`memory:${d.id}`, 'json')) ?? [] });
  }
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    const { buyer } = (await req.json().catch(() => ({}))) as { buyer?: string };
    const d = DEUDORES_DEMO.find((x) => x.id === buyer);
    if (!d) return json({ error: 'unknown buyer' }, 404);
    await Promise.all([env.MEMORY.delete(`memory:${d.id}`), env.MEMORY.delete(`plan:${d.id}`)]);
    return json({ ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/transcript') {
    const c = url.searchParams.get('c') || '';
    if (!/^demo-[a-z]+-[0-9a-f]{16}$/.test(c)) return json({ error: 'bad call id' }, 400);
    return env.CALLS.get(env.CALLS.idFromName(c)).fetch('https://log/read');
  }
  // Twilio: la grabación de una llamada de la demo está lista (URL firmada por nosotros).
  if (req.method === 'POST' && url.pathname === '/twilio/recording') {
    const c = url.searchParams.get('c') || '';
    if (!/^demo-[a-z]+-[0-9a-f]{16}$/.test(c) || url.searchParams.get('t') !== (await firmar(env.VOICE_KEY, `rec:${c}`))) return new Response('forbidden', { status: 403 });
    const form = await req.formData();
    if (form.get('RecordingStatus') === 'completed') ctx.waitUntil(grabacionLista(env, c, form));
    return new Response('ok');
  }
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    return json({ date: hoy(), stats: await leerDia(env.MEMORY, hoy()) });
  }
  if (req.method === 'GET' && url.pathname === '/api/plan') {
    return json({ plan: await env.MEMORY.get('plan:last', 'json') });
  }
  if (req.method === 'POST' && url.pathname === '/api/plan') {
    if (!(await contar(env, `rate:plan:${hoy()}`, PLANES_POR_DIA))) return json({ error: 'The planner hit its daily limit. Please try again tomorrow.' }, 429);
    return json({ plan: await planificar(env.MODEL_API_KEY, env.MEMORY) });
  }
  if (req.method === 'POST' && url.pathname === '/api/call') return llamar(req, env, url);
  return null;
}

async function llamar(req: Request, env: DemoEnv, url: URL): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { buyer?: string; phone?: string; consent?: boolean };
  const d = DEUDORES_DEMO.find((x) => x.id === b.buyer);
  if (!d) return json({ error: 'Pick a buyer.' }, 400);
  if (!b.consent) return json({ error: 'Please confirm you agree to receive the automated demo call.' }, 400);
  // Cumplimiento: quien pidió no ser llamado no vuelve a recibir llamadas (hasta «Reset» en la demo).
  const memoria = ((await env.MEMORY.get<{ outcome: string }[]>(`memory:${d.id}`, 'json')) ?? []) as { outcome: string }[];
  if (memoria.some((m) => m.outcome === 'do_not_call')) return json({ error: `${d.firstName} asked not to be called again, so the agent won't dial. Press Reset in Memory to try again.` }, 409);
  const to = telefonoUS(b.phone || '');
  if (!to) return json({ error: 'Enter a valid US phone number (10 digits).' }, 400);
  if (!(await contar(env, `rate:global:${hoy()}`, Number(env.DEMO_DAILY_CAP || 60)))) return json({ error: 'The demo hit its daily call limit. Please try again tomorrow.' }, 429);
  if (!(await contar(env, `rate:${to}:${hoy()}`, POR_TELEFONO))) return json({ error: `This number already got ${POR_TELEFONO} demo calls today.` }, 429);

  const rnd = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const callId = `demo-${d.id}-${rnd}`;
  const ws = `wss://${url.host}/ws?c=${callId}&t=${await firmar(env.VOICE_KEY, callId)}`;
  const es = d.lang === 'es';
  const saludo = es
    ? `Hola, le habla el asistente virtual de ${DEALER_DEMO.dealerName}; esta llamada se graba. ¿Hablo con ${d.firstName}?`
    : `Hi, this is the virtual assistant from ${DEALER_DEMO.dealerName}; this call is recorded. Am I speaking with ${d.firstName}?`;
  const twiml =
    `<Response><Connect><ConversationRelay url="${xml(ws)}" language="${es ? 'es-US' : 'en-US'}" ` +
    `welcomeGreeting="${xml(saludo)}" interruptible="speech" dtmfDetection="false"/></Connect></Response>`;

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      To: to, From: env.TWILIO_FROM, Twiml: twiml, Timeout: '25',
      // Grabación solo para la transcripción independiente y la auditoría; se borra al transcribirla.
      Record: 'true',
      RecordingStatusCallback: `https://${url.host}/twilio/recording?c=${callId}&t=${await firmar(env.VOICE_KEY, `rec:${callId}`)}`,
      RecordingStatusCallbackEvent: 'completed',
    }),
  });
  if (!r.ok) {
    console.log('[demo] twilio error', r.status, (await r.text()).slice(0, 300));
    return json({ error: 'We could not place the call right now. Please try again in a minute.' }, 502);
  }
  // El teléfono solo se guarda 2 h: para mandar el enlace de pago al terminar la llamada.
  await env.MEMORY.put(`call:${callId}`, JSON.stringify({ to, host: url.host }), { expirationTtl: 7200 });
  await registrar(env.CALLS, callId, { kind: 'status', status: 'ringing', ts: new Date().toISOString() });
  return json({ callId });
}

/**
 * Crea un Stripe Checkout en modo TEST por el monto acordado y lo manda por SMS al
 * teléfono que contestó. Devuelve la URL (la página la muestra) o null si falló.
 */
export async function enviarEnlacePago(
  env: DemoEnv,
  callId: string,
  c: { firstName: string; vehicle: string | null; dealerName: string; lang: 'es' | 'en' },
  monto: number,
): Promise<string | null> {
  const llamada = (await env.MEMORY.get<{ to: string; host: string }>(`call:${callId}`, 'json').catch(() => null)) ?? null;
  if (!llamada || !env.STRIPE_TEST_KEY?.startsWith('sk_test_')) return null; // nunca con una clave live
  const es = c.lang === 'es';
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_TEST_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(monto * 100)),
      'line_items[0][price_data][product_data][name]': `${c.dealerName} · ${c.vehicle ?? 'vehicle'} payment (DEMO)`,
      'line_items[0][price_data][product_data][description]': 'PayMind Voice hackathon demo. Test mode: use card 4242 4242 4242 4242.',
      success_url: `https://${llamada.host}/?paid=1`,
      cancel_url: `https://${llamada.host}/`,
      'metadata[call_id]': callId,
    }),
  });
  const sesion = (await r.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!r.ok || !sesion.url) {
    console.log('[demo] stripe error', r.status, sesion.error?.message);
    return null;
  }
  const texto = es
    ? `${c.dealerName} (DEMO PayMind Voice): ${c.firstName}, aquí está su enlace seguro para pagar $${monto.toFixed(2)}: ${sesion.url} — Demo de prueba, no hay deuda real.`
    : `${c.dealerName} (DEMO PayMind Voice): ${c.firstName}, here is your secure link to pay $${monto.toFixed(2)}: ${sesion.url} — Test demo, no real debt.`;
  const sms = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: llamada.to, From: env.TWILIO_FROM, Body: texto }),
  });
  if (!sms.ok) console.log('[demo] sms error', sms.status, (await sms.text()).slice(0, 300));
  return sesion.url;
}

/** Añade un evento al log de la llamada (lo lee la página cada segundo). */
export function registrar(calls: DurableObjectNamespace, callId: string, ev: Evento): Promise<unknown> {
  return calls
    .get(calls.idFromName(callId))
    .fetch('https://log/append', { method: 'POST', body: JSON.stringify(ev) })
    .catch(() => null);
}

/** Log de una llamada: eventos en orden de llegada (una instancia por callId). */
export class CallLog {
  constructor(private state: DurableObjectState) {}
  async fetch(req: Request): Promise<Response> {
    const eventos = ((await this.state.storage.get<Evento[]>('events')) ?? []) as Evento[];
    if (new URL(req.url).pathname === '/append') {
      eventos.push((await req.json()) as Evento);
      await this.state.storage.put('events', eventos);
      return json({ ok: true });
    }
    return json({ events: eventos });
  }
}
