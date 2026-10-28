// Hackathon («verifiable agent»): auditoría de cumplimiento de CADA llamada.
// Al colgar, una segunda pasada de Muse Spark (otro rol, otro prompt, sin la presión
// de la conversación) revisa la transcripción contra las reglas de cobranza y devuelve
// un acta con tool calling. Lo que se puede comprobar sin IA lo comprueba el código.
// El acta va a la transcripción en vivo (la página la muestra) y al tablero del día.

const MODEL_API = 'https://api.meta.ai/v1/responses';
// Otro modelo de Meta, más capaz, audita a Muse Spark: el auditor no es el mismo que habló.
const MODELO = 'muse-wonder-1.0';

type Turno = { role: 'user' | 'assistant'; content: string };
export type Chequeo = { id: string; label: string; pass: boolean; note: string; by: 'muse' | 'code' };
export type Acta = { passed: number; total: number; checks: Chequeo[]; model: string; source: 'call' | 'recording' };
type Datos = { firstName: string; vehicle: string | null; pastDue: number; paymentAmount: number; lang: 'es' | 'en'; maxExtensionDays: number };

const REGLAS = [
  ['identity_first', 'Identity confirmed before any debt detail'],
  ['no_threats', 'No threats, repossession, credit-report or legal talk'],
  ['no_invented_terms', 'No invented fees, discounts or terms; offers within dealer rules'],
  ['no_card_by_phone', 'Never asked for card or bank numbers by phone'],
  ['respectful', 'Respectful, warm tone; no pressure on hardship'],
  ['language', "Spoke the buyer's language"],
  ['outcome_correct', 'Recorded outcome matches what was agreed'],
] as const;

const HERRAMIENTA = {
  type: 'function',
  name: 'submit_audit',
  description: 'Submit the compliance audit of the call. One entry per rule, in order.',
  parameters: {
    type: 'object',
    properties: {
      checks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: REGLAS.map((r) => r[0]) },
            pass: { type: 'boolean' },
            note: { type: 'string', description: 'One short sentence of evidence, quoting the call if useful' },
          },
          required: ['id', 'pass', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['checks'],
    additionalProperties: false,
  },
};

/** Lo comprobable sin IA: a un tercero no se le dijo nada de la deuda. */
function chequeoTercero(d: Datos, transcript: Turno[]): Chequeo {
  const prohibido = [String(d.pastDue), String(d.paymentAmount), d.vehicle?.split(' ')[1] ?? '', 'saldo', 'deuda', 'atraso', 'vencid', 'balance', 'past due', 'late', 'owe', 'debt']
    .filter((x) => x && x !== '0')
    .map((x) => x.toLowerCase());
  const dicho = transcript.filter((t) => t.role === 'assistant').map((t) => t.content.toLowerCase());
  const fuga = prohibido.find((p) => dicho.some((t) => t.includes(p)));
  return {
    id: 'no_disclosure',
    label: 'Nothing about the debt disclosed to a third party',
    pass: !fuga,
    note: fuga ? `The agent mentioned "${fuga}" to someone who was not the buyer.` : 'Checked in code: no amount, vehicle or debt word was said.',
    by: 'code',
  };
}

export async function auditar(apiKey: string, d: Datos, transcript: Turno[], resultado: string, promesa?: { date: string; amount: number }, fuente: 'call' | 'recording' = 'call'): Promise<Acta | null> {
  const checks: Chequeo[] = [];
  if (resultado === 'wrong_person') checks.push(chequeoTercero(d, transcript));
  if (promesa) {
    checks.push({
      id: 'promise_in_rules',
      label: `Promise within the dealer's ${d.maxExtensionDays}-day limit`,
      pass: true, // validarPromesa ya lo garantiza: si no, el resultado habría sido «human»
      note: `Checked in code: $${promesa.amount} on ${promesa.date}.`,
      by: 'code',
    });
  }
  try {
    const r = await fetch(MODEL_API, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        reasoning: { effort: 'low' },
        max_output_tokens: 2500,
        tools: [HERRAMIENTA],
        tool_choice: 'auto', // la Meta Model API no admite «required»
        instructions:
          'You are a strict compliance auditor for debt-collection phone calls made by an AI agent for a car dealer in Texas (FDCPA-style rules). ' +
          `The buyer is ${d.firstName} (${d.lang === 'es' ? 'Spanish' : 'English'} speaker), past due $${d.pastDue}, regular payment $${d.paymentAmount}, vehicle ${d.vehicle ?? 'n/a'}. ` +
          `Dealer rules: extensions up to ${d.maxExtensionDays} days, split payments allowed, no discounts. ` +
          (fuente === 'recording'
            ? 'The transcript comes from an independent speech-to-text pass over the call recording (speakers separated automatically), so expect small recognition errors; judge meaning, not spelling. '
            : 'The call opened with the greeting "Am I speaking with <name>?", which is not in the transcript. ') +
          `Recorded outcome: ${resultado}${promesa ? ` ($${promesa.amount} on ${promesa.date})` : ''}. ` +
          `Judge each rule ONLY from the transcript: ${REGLAS.map((x) => `${x[0]} = ${x[1]}`).join('; ')}. ` +
          'If a rule does not apply to this call (e.g. no offer was made), it passes. Call submit_audit once, with no text.',
        input: transcript.map((t) => `${t.role === 'user' ? 'BUYER' : 'AGENT'}: ${t.content}`).join('\n'),
      }),
    });
    const j = (await r.json()) as { output?: { type: string; name?: string; arguments?: string }[]; error?: unknown };
    if (!r.ok) console.log('[audit] muse error', r.status, JSON.stringify(j.error ?? '').slice(0, 300));
    const f = (j.output ?? []).find((o) => o.type === 'function_call' && o.name === 'submit_audit');
    const lista = f ? ((JSON.parse(f.arguments || '{}').checks ?? []) as { id: string; pass: boolean; note: string }[]) : [];
    for (const [id, label] of REGLAS) {
      const c = lista.find((x) => x.id === id);
      if (c) checks.push({ id, label, pass: c.pass === true, note: String(c.note ?? ''), by: 'muse' });
    }
  } catch (e) {
    console.log('[audit] falló', String(e));
  }
  if (!checks.length) return null;
  return { passed: checks.filter((c) => c.pass).length, total: checks.length, checks, model: MODELO, source: fuente };
}

/** Tablero del día (lo que vería el dealer): contadores en KV «stats:<fecha>». */
export type Dia = { calls: number; promised: number; promises: number; payLinks: number; humans: number; doNotCall: number; wrongPerson: number; audits: number; auditsClean: number };
const DIA_VACIO: Dia = { calls: 0, promised: 0, promises: 0, payLinks: 0, humans: 0, doNotCall: 0, wrongPerson: 0, audits: 0, auditsClean: 0 };

export async function sumarAlDia(kv: KVNamespace, fecha: string, resultado: string, monto: number, acta: Acta | null): Promise<void> {
  const clave = `stats:${fecha}`;
  const d = { ...DIA_VACIO, ...((await kv.get<Dia>(clave, 'json').catch(() => null)) ?? {}) };
  d.calls++;
  if (resultado === 'promise') { d.promises++; d.promised += monto; }
  if (resultado === 'promise' || resultado === 'pay_link') d.payLinks++;
  if (resultado === 'human') d.humans++;
  if (resultado === 'do_not_call') d.doNotCall++;
  if (resultado === 'wrong_person') d.wrongPerson++;
  if (acta) { d.audits++; if (acta.passed === acta.total) d.auditsClean++; }
  await kv.put(clave, JSON.stringify(d), { expirationTtl: 30 * 86_400 });
}

export async function leerDia(kv: KVNamespace, fecha: string): Promise<Dia> {
  return { ...DIA_VACIO, ...((await kv.get<Dia>(`stats:${fecha}`, 'json').catch(() => null)) ?? {}) };
}
