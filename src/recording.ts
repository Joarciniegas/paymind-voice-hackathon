// Hackathon: transcripción independiente de la llamada con Muse Voice Transcribe (Meta).
// Twilio graba la llamada de la demo (el saludo lo avisa) y, al terminar, avisa aquí.
// Bajamos el WAV, lo pasamos a 16 kHz (Twilio graba a 8 kHz; el modelo pide 16 o 24 kHz),
// Muse Voice Transcribe lo transcribe separando a los hablantes y Muse Wonder audita ESA
// versión, no la del reconocimiento de voz que usó la llamada. Después se borra la grabación.

import { auditar, sumarAlDia, type Acta } from './audit';
import { registrar, type DemoEnv } from './demo';

const ASR = 'https://api.meta.ai/v1/asr/transcribe';
export const MODELO_VOZ = 'muse-voice-transcribe-1.0';

type Turno = { role: 'user' | 'assistant'; content: string };
type Datos = Parameters<typeof auditar>[1];
/** Lo que deja la llamada para auditar cuando llegue la grabación (KV «auditctx:<callId>»). */
export type Pendiente = { datos: Datos; resultado: string; promesa?: { date: string; amount: number }; transcript: Turno[]; fecha: string };

/** WAV (PCM 16 bits o μ-law, mono o estéreo, cualquier frecuencia) → WAV PCM 16 bits mono a 16 kHz. */
export function a16k(wav: ArrayBuffer): Uint8Array {
  const v = new DataView(wav);
  let p = 12, formato = 1, canales = 1, hz = 8000, bits = 16, ini = 0, largo = 0;
  while (p + 8 <= v.byteLength) {
    const id = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
    const tam = v.getUint32(p + 4, true);
    if (id === 'fmt ') {
      formato = v.getUint16(p + 8, true);
      canales = v.getUint16(p + 10, true);
      hz = v.getUint32(p + 12, true);
      bits = v.getUint16(p + 22, true);
    } else if (id === 'data') {
      ini = p + 8;
      largo = Math.min(tam, v.byteLength - ini);
      break;
    }
    p += 8 + tam + (tam & 1);
  }
  const bytes = bits / 8;
  const n = Math.floor(largo / (bytes * canales));
  const muestra = (i: number, c: number) => {
    const o = ini + (i * canales + c) * bytes;
    if (formato === 7) {
      const u = ~v.getUint8(o) & 0xff; // μ-law → PCM lineal
      const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
      return u & 0x80 ? 0x84 - t : t - 0x84;
    }
    return v.getInt16(o, true);
  };
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < canales; c++) s += muestra(i, c);
    mono[i] = s / canales;
  }
  const salida = Math.floor((n * 16000) / hz);
  const out = new Uint8Array(44 + salida * 2);
  const w = new DataView(out.buffer);
  const txt = (o: number, s: string) => [...s].forEach((ch, i) => w.setUint8(o + i, ch.charCodeAt(0)));
  txt(0, 'RIFF'); w.setUint32(4, 36 + salida * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); w.setUint32(16, 16, true); w.setUint16(20, 1, true); w.setUint16(22, 1, true);
  w.setUint32(24, 16000, true); w.setUint32(28, 32000, true); w.setUint16(32, 2, true); w.setUint16(34, 16, true);
  txt(36, 'data'); w.setUint32(40, salida * 2, true);
  for (let i = 0; i < salida; i++) {
    const x = (i * hz) / 16000, a = Math.floor(x), f = x - a;
    const s = (mono[a] ?? 0) * (1 - f) + (mono[a + 1] ?? mono[a] ?? 0) * f;
    w.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(s))), true);
  }
  return out;
}

/** Muse Voice Transcribe con diarización. Devuelve los turnos con «quién» ya resuelto. */
export async function transcribir(apiKey: string, wav16k: Uint8Array): Promise<{ who: 'agent' | 'buyer'; text: string; startMs: number }[]> {
  const f = new FormData();
  f.append('request', JSON.stringify({ mode: 'DIARIZATION', model: MODELO_VOZ, audioEncoding: 'WAV', languageBias: ['Spanish', 'English'], keywords: ['Lone Star Motors', 'PayMind'] }));
  f.append('audio', new Blob([wav16k], { type: 'audio/wav' }), 'call.wav');
  const r = await fetch(ASR, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: f });
  const j = (await r.json().catch(() => ({}))) as { turns?: { transcript: string; speaker?: string; startMs: number }[]; error?: unknown };
  if (!r.ok) throw new Error(`asr ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  const turnos = (j.turns ?? []).filter((t) => t.transcript?.trim());
  // Un turno sin etiqueta hereda la del siguiente (o la del anterior).
  turnos.forEach((t, i) => { t.speaker ??= turnos.slice(i + 1).find((x) => x.speaker)?.speaker ?? turnos.slice(0, i).reverse().find((x) => x.speaker)?.speaker; });
  // El agente es quien dice el saludo; las etiquetas A/B no traen nombres.
  const agente = turnos.find((t) => /asistente virtual|virtual assistant|lone star/i.test(t.transcript))?.speaker ?? turnos[0]?.speaker;
  const out: { who: 'agent' | 'buyer'; text: string; startMs: number }[] = [];
  for (const t of turnos) {
    const who = t.speaker === agente ? 'agent' : 'buyer';
    const ultimo = out[out.length - 1];
    if (ultimo?.who === who) ultimo.text += ' ' + t.transcript.trim();
    else out.push({ who, text: t.transcript.trim(), startMs: t.startMs });
  }
  return out;
}

/** Twilio avisa que la grabación está lista: transcribir, auditar, borrar la grabación. */
export async function grabacionLista(env: DemoEnv & { MODEL_API_KEY: string }, callId: string, form: FormData): Promise<void> {
  const recUrl = String(form.get('RecordingUrl') || '');
  const recSid = String(form.get('RecordingSid') || '');
  const twilio = `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`;
  // El contexto lo deja la llamada al colgar; puede tardar unos segundos más que Twilio.
  let pendiente: Pendiente | null = null;
  for (let i = 0; i < 10 && !pendiente; i++) {
    pendiente = await env.MEMORY.get<Pendiente>(`auditctx:${callId}`, 'json');
    if (!pendiente) await new Promise((r) => setTimeout(r, 2000));
  }
  let transcript = pendiente?.transcript ?? [];
  let fuente = 'call';
  try {
    if (!/^https:\/\/api\.twilio\.com\//.test(recUrl)) throw new Error('recording url');
    const wav = await fetch(`${recUrl}.wav`, { headers: { authorization: twilio } });
    if (!wav.ok) throw new Error(`recording ${wav.status}`);
    const turnos = await transcribir(env.MODEL_API_KEY, a16k(await wav.arrayBuffer()));
    if (turnos.length) {
      await registrar(env.CALLS, callId, { kind: 'voice', model: MODELO_VOZ, turns: turnos, ts: new Date().toISOString() });
      transcript = turnos.map((t) => ({ role: t.who === 'agent' ? 'assistant' : 'user', content: t.text }));
      fuente = 'recording';
    }
  } catch (e) {
    console.log('[voz] transcripción falló', String(e));
  } finally {
    // Privacidad: la grabación solo vive lo que tarda en transcribirse.
    if (recSid) await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Recordings/${recSid}.json`, { method: 'DELETE', headers: { authorization: twilio } }).catch(() => null);
  }
  if (!pendiente) return;
  await env.MEMORY.delete(`auditctx:${callId}`);
  const acta: Acta | null = await auditar(env.MODEL_API_KEY, pendiente.datos, transcript, pendiente.resultado, pendiente.promesa, fuente);
  if (acta) await registrar(env.CALLS, callId, { kind: 'audit', ...acta, ts: new Date().toISOString() });
  await sumarAlDia(env.MEMORY, pendiente.fecha, pendiente.resultado, pendiente.promesa?.amount ?? 0, acta);
}
