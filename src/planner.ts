// Hackathon (Best Agentic): el agente que PLANEA las llamadas del día.
// Muse Spark mira la cartera (saldo, atraso, memoria de cada comprador, reglas del
// dealer) y decide, con tool calling, a quién llamar, a qué hora y con qué oferta.
// Lo que no se negocia lo impone el código después, aunque el modelo diga otra cosa:
//   - horario legal de cobranza (8 AM–9 PM, hora del comprador; FDCPA),
//   - nadie marcado «do not call» vuelve a recibir llamada,
//   - no se llama antes de que venza una promesa vigente, ni dos veces el mismo día,
//   - la prórroga nunca pasa de maxExtensionDays y solo hay pago dividido si el dealer lo permite.
// El plan se guarda en KV («plan:<comprador>») y la llamada lo usa como guion.

import { DEALER_DEMO, DEUDORES_DEMO, type Deudor } from './demo-data';

const MODEL_API = 'https://api.meta.ai/v1/responses';
const MODELO = 'muse-spark-1.3';
const HORA_MIN = 8;
const HORA_MAX = 21;

type Recuerdo = { date: string; outcome: string; promisedDate?: string; promisedAmount?: number; summary: string };
export type Paso = {
  buyerId: string;
  action: 'call' | 'skip';
  callAt?: string; // AAAA-MM-DDTHH:MM, hora de Houston
  goal: string;
  offer?: { extensionDays: number; splitPayment: boolean; note: string };
  reason: string;
  guardrails: string[]; // lo que el código corrigió o impuso
};
export type Plan = { createdAt: string; now: string; steps: Paso[]; model: string };

const HERRAMIENTAS = [
  {
    type: 'function',
    name: 'schedule_call',
    description: 'Schedule today\'s collection call for one buyer, with the goal and the opening offer the voice agent should lead with.',
    parameters: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', enum: DEUDORES_DEMO.map((d) => d.id) },
        call_at: { type: 'string', description: 'Local Houston time, YYYY-MM-DDTHH:MM, no timezone suffix' },
        goal: { type: 'string', description: 'One sentence: what this call must achieve' },
        extension_days: { type: 'integer', description: 'Most days of extension the agent may offer (0 = pay today)' },
        split_payment: { type: 'boolean', description: 'Offer to split the past-due amount into two payments' },
        offer_note: { type: 'string', description: 'One sentence the voice agent uses as its opening offer' },
        reason: { type: 'string', description: 'Why this buyer, this time and this offer (1-2 sentences, cite the memory if any)' },
      },
      required: ['buyer_id', 'call_at', 'goal', 'extension_days', 'split_payment', 'offer_note', 'reason'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'skip_buyer',
    description: 'Do not call this buyer today.',
    parameters: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', enum: DEUDORES_DEMO.map((d) => d.id) },
        reason: { type: 'string', description: 'Why not today (1 sentence)' },
      },
      required: ['buyer_id', 'reason'],
      additionalProperties: false,
    },
  },
];

const ahoraHouston = () => new Date(Date.now() - 5 * 3_600_000); // CDT/CST ≈ UTC-5, como el resto del Worker
const iso = (d: Date) => d.toISOString().slice(0, 16);
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Pide el plan a Muse Spark. Devuelve las llamadas a funciones tal cual. */
async function pedirPlan(apiKey: string, cartera: string, hora: string, faltan?: string[]): Promise<{ name: string; arguments: string }[]> {
  const r = await fetch(MODEL_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      reasoning: { effort: 'low' },
      max_output_tokens: 2500,
      tools: HERRAMIENTAS,
      tool_choice: 'auto', // la Meta Model API no admite «required»
      parallel_tool_calls: true,
      instructions:
        `You plan today's collection calls for ${DEALER_DEMO.dealerName}, a Buy-Here-Pay-Here car dealer in Houston, TX. It is now ${hora} (Houston). ` +
        `Dealer rules: up to ${DEALER_DEMO.rules.maxExtensionDays} days of extension (${DEALER_DEMO.rules.freeExtensionDays} without asking a manager), split payments ${DEALER_DEMO.rules.allowSplitPayment ? 'allowed' : 'not allowed'}, warm tone. ` +
        `Legal calling hours are ${HORA_MIN}:00 to ${HORA_MAX}:00 local time. Never call someone who asked not to be called. Do not call before an active promise date has passed. ` +
        `Prioritize by days late and amount; read each buyer's past calls and adapt the time and the offer to what they said (e.g. payday, work shift, broken promises). ` +
        `Call exactly ONE function per buyer (${(faltan ?? DEUDORES_DEMO.map((d) => d.id)).join(', ')}), all in this response. Use the function calls only; no text needed.`,
      input: cartera,
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { output?: { type: string; name?: string; arguments?: string }[]; error?: unknown };
  if (!r.ok) console.log('[plan] muse error', r.status, JSON.stringify(j.error ?? '').slice(0, 300));
  return (j.output ?? []).filter((o) => o.type === 'function_call' && o.name).map((o) => ({ name: o.name!, arguments: o.arguments ?? '{}' }));
}

function describir(d: Deudor, mem: Recuerdo[]): string {
  const estado = d.pastDue > 0 ? `$${d.pastDue} past due, ${d.daysPastDue} days late, regular payment $${d.paymentAmount}` : `up to date, next payment $${d.paymentAmount} on ${d.nextPaymentDate}`;
  const historia = mem.length
    ? mem.map((m) => `  - ${m.date}: ${m.outcome}${m.promisedDate ? ` (promised $${m.promisedAmount} on ${m.promisedDate})` : ''}. ${m.summary}`).join('\n')
    : '  - no previous calls';
  return `${d.id} (${d.firstName}, ${d.lang === 'es' ? 'Spanish' : 'English'}, ${d.vehicle}): ${estado}\n${historia}`;
}

/** Ajusta una hora propuesta al horario legal y a «no antes de ahora». */
function horaLegal(propuesta: string | undefined, ahora: Date, notas: string[]): string {
  let t = propuesta && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(propuesta) ? new Date(`${propuesta.slice(0, 16)}:00Z`) : new Date(ahora.getTime() + 15 * 60_000);
  if (t.getTime() < ahora.getTime() + 10 * 60_000) {
    t = new Date(ahora.getTime() + 15 * 60_000);
    notas.push('Moved to the next free slot: the proposed time had already passed.');
  }
  t.setUTCMinutes(Math.ceil(t.getUTCMinutes() / 15) * 15, 0, 0);
  if (t.getUTCHours() < HORA_MIN) {
    t.setUTCHours(HORA_MIN + 1, 0);
    notas.push(`Moved to ${HORA_MIN + 1}:00 AM: calls before ${HORA_MIN} AM are not allowed.`);
  } else if (t.getUTCHours() >= HORA_MAX - 1) {
    t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1, HORA_MIN + 1, 0));
    notas.push(`Moved to tomorrow ${HORA_MIN + 1}:00 AM: too close to the ${HORA_MAX - 12} PM calling cutoff.`);
  }
  return iso(t);
}

/** Planea el día: Muse decide, el código pone los límites. */
export async function planificar(apiKey: string, kv: KVNamespace): Promise<Plan> {
  const ahora = ahoraHouston();
  const hoy = dia(ahora);
  const memorias = await Promise.all(DEUDORES_DEMO.map((d) => kv.get<Recuerdo[]>(`memory:${d.id}`, 'json').catch(() => null)));
  const mem = new Map(DEUDORES_DEMO.map((d, i) => [d.id, memorias[i] ?? []]));
  const cartera = DEUDORES_DEMO.map((d) => describir(d, mem.get(d.id)!)).join('\n\n');
  const hora = `${hoy} ${iso(ahora).slice(11)}`;

  let llamadas = await pedirPlan(apiKey, cartera, hora);
  const ids = (ls: typeof llamadas) => new Set(ls.map((l) => { try { return JSON.parse(l.arguments).buyer_id as string; } catch { return ''; } }));
  const faltan = DEUDORES_DEMO.map((d) => d.id).filter((id) => !ids(llamadas).has(id));
  if (faltan.length) llamadas = [...llamadas, ...(await pedirPlan(apiKey, cartera, hora, faltan))]; // Muse a veces se salta alguno

  const pasos: Paso[] = [];
  for (const d of DEUDORES_DEMO) {
    const m = mem.get(d.id)!;
    const ultima = m[m.length - 1];
    const llamada = llamadas.find((l) => { try { return JSON.parse(l.arguments).buyer_id === d.id; } catch { return false; } });
    const a = (llamada ? JSON.parse(llamada.arguments) : {}) as Record<string, unknown>;
    const notas: string[] = [];

    // Reglas duras: van antes que cualquier cosa que haya dicho el modelo.
    let bloqueo: string | null = null;
    if (m.some((x) => x.outcome === 'do_not_call')) bloqueo = 'Asked not to be called again. Do-not-call is permanent.';
    else if (ultima?.promisedDate && ultima.promisedDate >= hoy) bloqueo = `Has an active promise ($${ultima.promisedAmount} on ${ultima.promisedDate}). Wait until it is due.`;
    else if (ultima?.date === hoy && ultima.outcome !== 'no_answer') bloqueo = 'Already spoke with this buyer today.';
    if (bloqueo) {
      if (llamada?.name === 'schedule_call') notas.push('Muse wanted to call; blocked by a compliance rule.');
      pasos.push({ buyerId: d.id, action: 'skip', goal: 'No call today', reason: bloqueo, guardrails: notas });
      continue;
    }
    if (!llamada) {
      notas.push('Muse skipped this buyer; planned by the default rule.');
      pasos.push({ buyerId: d.id, action: 'call', callAt: horaLegal(undefined, ahora, notas), goal: d.pastDue > 0 ? 'Get a payment date for the past-due amount' : 'Friendly reminder of the next payment', offer: { extensionDays: Math.min(DEALER_DEMO.rules.freeExtensionDays, DEALER_DEMO.rules.maxExtensionDays), splitPayment: false, note: '' }, reason: 'Default plan.', guardrails: notas });
      continue;
    }
    if (llamada.name === 'skip_buyer') {
      pasos.push({ buyerId: d.id, action: 'skip', goal: 'No call today', reason: String(a.reason ?? ''), guardrails: notas });
      continue;
    }
    let ext = Math.max(0, Math.round(Number(a.extension_days) || 0));
    if (ext > DEALER_DEMO.rules.maxExtensionDays) {
      notas.push(`Extension capped at ${DEALER_DEMO.rules.maxExtensionDays} days (Muse proposed ${ext}).`);
      ext = DEALER_DEMO.rules.maxExtensionDays;
    }
    let split = a.split_payment === true;
    if (split && !DEALER_DEMO.rules.allowSplitPayment) {
      notas.push('Split payment removed: the dealer does not allow it.');
      split = false;
    }
    if (split && d.pastDue <= 0) split = false;
    pasos.push({
      buyerId: d.id,
      action: 'call',
      callAt: horaLegal(String(a.call_at ?? ''), ahora, notas),
      goal: String(a.goal ?? ''),
      offer: { extensionDays: ext, splitPayment: split, note: String(a.offer_note ?? '') },
      reason: String(a.reason ?? ''),
      guardrails: notas,
    });
  }
  pasos.sort((x, y) => (x.action === y.action ? (x.callAt ?? '').localeCompare(y.callAt ?? '') : x.action === 'call' ? -1 : 1));

  const plan: Plan = { createdAt: new Date().toISOString(), now: hora, steps: pasos, model: MODELO };
  await kv.put('plan:last', JSON.stringify(plan), { expirationTtl: 2 * 86_400 });
  await Promise.all(pasos.map((p) => kv.put(`plan:${p.buyerId}`, JSON.stringify(p), { expirationTtl: 2 * 86_400 })));
  return plan;
}

/** Bloque del prompt de la llamada: el guion que dejó el planificador (si llama hoy). */
export function guionDelPlan(p: Paso | null, lang: 'es' | 'en'): string {
  if (!p || p.action !== 'call' || !p.offer) return '';
  const partes = [
    `Objetivo: ${p.goal}`,
    `Oferta inicial: ${p.offer.note || (p.offer.extensionDays ? `hasta ${p.offer.extensionDays} días de plazo` : 'pagar hoy')}`,
    `Plazo máximo que puedes ofrecer en ESTA llamada: ${p.offer.extensionDays} días`,
    p.offer.splitPayment ? 'Puedes ofrecer dividir el saldo vencido en dos pagos dentro de ese plazo.' : 'No ofrezcas dividir el pago.',
  ];
  return `
PLAN DE ESTA LLAMADA (lo decidió el agente planificador; úsalo después de confirmar la identidad${lang === 'en' ? ', in English' : ''}):
${partes.map((x) => `- ${x}`).join('\n')}
`;
}
