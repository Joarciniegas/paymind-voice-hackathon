// Página pública de la demo (inglés, para el jurado). HTML autocontenido.
export const PAGINA = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PayMind Voice — live demo</title>
<meta name="description" content="Bilingual AI collections calls for Buy-Here-Pay-Here car dealers, powered by Muse Spark.">
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --ink: #14171c; --muted: #5b6472; --line: #e3e6eb;
    --accent: #0866ff; --accent-ink: #ffffff; --ok: #0f8a4b; --warn: #b4540a; --bubble-ai: #eef3ff; --bubble-me: #f1f2f4;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1015; --card: #161a21; --ink: #e9edf2; --muted: #9aa4b2; --line: #262c36;
      --accent: #4c8dff; --accent-ink: #0b0d11; --ok: #3ccf86; --warn: #f0a254; --bubble-ai: #1b2638; --bubble-me: #20252e;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }
  header h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--muted); max-width: 680px; }
  .tag { display: inline-block; font-size: 12px; font-weight: 600; color: var(--accent); margin-bottom: 10px; letter-spacing: .04em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 28px; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
  .card h2 { font-size: 15px; margin: 0 0 14px; }
  .step { color: var(--muted); font-weight: 500; }
  .buyers { display: grid; gap: 8px; }
  .buyer { display: flex; gap: 12px; align-items: flex-start; text-align: left; width: 100%; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .buyer[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .buyer b { display: block; }
  .buyer small { color: var(--muted); }
  .lang { font-size: 11px; font-weight: 700; border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; color: var(--muted); }
  label { display: block; font-size: 14px; font-weight: 600; margin: 16px 0 6px; }
  input[type=tel] { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: inherit; font: inherit; }
  .consent { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; font-size: 13px; color: var(--muted); margin-top: 12px; }
  button.go { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font: 600 15px/1 inherit; cursor: pointer; }
  button.go:disabled { opacity: .5; cursor: default; }
  .msg { min-height: 20px; margin-top: 10px; font-size: 14px; color: var(--warn); }
  .status { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
  .status b { color: var(--ink); }
  .chat { display: flex; flex-direction: column; gap: 8px; min-height: 220px; max-height: 420px; overflow-y: auto; }
  .bubble { padding: 9px 12px; border-radius: 12px; max-width: 88%; font-size: 15px; }
  .bubble.ai { background: var(--bubble-ai); align-self: flex-start; }
  .bubble.me { background: var(--bubble-me); align-self: flex-end; }
  .bubble .who { display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 2px; }
  .outcome { margin-top: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--ok); color: var(--ok); font-weight: 600; font-size: 14px; }
  .empty { color: var(--muted); font-size: 14px; }
  .mem { display: grid; gap: 8px; }
  .mem div { font-size: 14px; border-left: 3px solid var(--accent); padding: 4px 10px; }
  .mem small { color: var(--muted); display: block; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .link { background: none; border: 0; color: var(--accent); font: inherit; font-size: 13px; cursor: pointer; padding: 0; }
  footer { margin-top: 28px; color: var(--muted); font-size: 13px; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <span class="tag">Meta Global AI Developer Hackathon · Live demo</span>
    <h1>PayMind Voice: the AI that makes the payment call, in English or Spanish</h1>
    <p>Buy-Here-Pay-Here car dealers finance their own cars, so someone on the lot has to call every late buyer. PayMind Voice makes that call with <b>Muse Spark</b>: it confirms who picked up, agrees on a payment date within the dealer's rules, and remembers what each buyer said last time.</p>
  </header>

  <div class="grid">
    <section class="card">
      <h2><span class="step">1.</span> Pick a buyer to role-play</h2>
      <div class="buyers" id="buyers"></div>

      <label for="phone"><span class="step">2.</span> Your phone number (US only)</label>
      <input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(713) 555-0123">
      <label class="consent"><input id="consent" type="checkbox"> I agree to receive one automated demo call from PayMind Voice at this number. No real debt is involved; all names and amounts are fictitious.</label>
      <button class="go" id="go">Call me</button>
      <div class="msg" id="msg" role="status"></div>
    </section>

    <section class="card">
      <h2>Live transcript</h2>
      <div class="status" id="status">Pick a buyer and press <b>Call me</b>. Answer, and play along as that buyer.</div>
      <div class="chat" id="chat" aria-live="polite"></div>
      <div id="outcome"></div>
    </section>

    <section class="card">
      <div class="row"><h2>What the agent remembers about <span id="memName">this buyer</span></h2><button class="link" id="reset">Reset memory</button></div>
      <div class="mem" id="mem"><p class="empty">Nothing yet. After your first call, Muse Spark writes a short summary here, and the next call picks up from it.</p></div>
    </section>

    <section class="card">
      <h2>Try this</h2>
      <p class="empty" style="margin:0">Call once and promise to pay on Friday. Then call again: the agent brings up your promise. Or say you're not the buyer: it won't reveal anything about the debt. Or say you lost your job: it hands you to a person.</p>
    </section>
  </div>

  <footer>Fictitious dealer (Lone Star Motors) and buyers. Built by <a href="https://bizmind.us">BizMind AI Agency</a> · <a href="https://github.com/Joarciniegas/paymind-voice-hackathon">Source code</a></footer>
</main>
<script>
const $ = (id) => document.getElementById(id);
const OUTCOMES = { promise: 'Payment promise recorded', pay_link: 'Pay link sent', human: 'Handed off to a person', do_not_call: 'Marked as do-not-call', wrong_person: 'Not the buyer: nothing disclosed', done: 'Call completed', no_answer: 'No conversation' };
let buyer = null, buyers = [], poll = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (n) => '$' + Number(n).toFixed(0);

async function init() {
  const r = await fetch('/api/buyers').then((x) => x.json());
  buyers = r.buyers;
  $('buyers').innerHTML = buyers.map((b) =>
    '<button class="buyer" aria-pressed="false" data-id="' + b.id + '"><span class="lang">' + b.lang.toUpperCase() + '</span><span><b>' + esc(b.firstName) + ' · ' + esc(b.vehicle) + '</b><small>' +
    (b.pastDue > 0 ? money(b.pastDue) + ' past due, ' + b.daysPastDue + ' days late' : 'Up to date · next payment ' + money(b.paymentAmount)) + '</small></span></button>').join('');
  document.querySelectorAll('.buyer').forEach((el) => el.addEventListener('click', () => pick(el.dataset.id)));
  pick(buyers[0].id);
}

function pick(id) {
  buyer = buyers.find((b) => b.id === id);
  document.querySelectorAll('.buyer').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.id === id)));
  $('memName').textContent = buyer.firstName;
  loadMemory();
}

async function loadMemory() {
  const r = await fetch('/api/memory?d=' + buyer.id).then((x) => x.json());
  $('mem').innerHTML = r.memory.length
    ? r.memory.map((m) => '<div><small>' + esc(m.date) + ' · ' + esc(OUTCOMES[m.outcome] || m.outcome) + (m.promisedDate ? ' · ' + money(m.promisedAmount) + ' on ' + esc(m.promisedDate) : '') + '</small>' + esc(m.summary) + '</div>').join('')
    : '<p class="empty">Nothing yet. After your first call, Muse Spark writes a short summary here, and the next call picks up from it.</p>';
}

$('reset').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyer: buyer.id }) });
  loadMemory();
});

$('go').addEventListener('click', async () => {
  $('msg').textContent = '';
  $('go').disabled = true;
  try {
    const r = await fetch('/api/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyer: buyer.id, phone: $('phone').value, consent: $('consent').checked }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Something went wrong.');
    $('chat').innerHTML = ''; $('outcome').innerHTML = '';
    $('status').innerHTML = 'Calling you now as <b>' + esc(buyer.firstName) + '</b>. Pick up!';
    clearInterval(poll);
    poll = setInterval(() => follow(j.callId), 1000);
    setTimeout(() => { clearInterval(poll); $('go').disabled = false; }, 6 * 60 * 1000);
  } catch (e) {
    $('msg').textContent = e.message;
    $('go').disabled = false;
  }
});

async function follow(callId) {
  const r = await fetch('/api/transcript?c=' + callId).then((x) => x.json()).catch(() => null);
  if (!r) return;
  const turns = r.events.filter((e) => e.kind === 'turn');
  $('chat').innerHTML = turns.map((t) => '<div class="bubble ' + (t.role === 'assistant' ? 'ai' : 'me') + '"><span class="who">' + (t.role === 'assistant' ? 'PayMind Voice' : esc(buyer.firstName) + ' (you)') + '</span>' + esc(t.content) + '</div>').join('');
  $('chat').scrollTop = $('chat').scrollHeight;
  if (turns.length) $('status').innerHTML = 'On the call with <b>PayMind Voice</b>…';
  const end = r.events.find((e) => e.kind === 'end');
  if (end) {
    clearInterval(poll);
    $('status').innerHTML = 'Call ended.';
    $('outcome').innerHTML = '<div class="outcome">' + esc(OUTCOMES[end.outcome] || end.outcome) + (end.promisedDate ? ': ' + money(end.promisedAmount) + ' on ' + esc(end.promisedDate) : '') + '</div>';
    $('go').disabled = false;
    setTimeout(loadMemory, 6000); // el resumen de Muse tarda unos segundos
  }
}

init();
</script>
</body>
</html>`;
