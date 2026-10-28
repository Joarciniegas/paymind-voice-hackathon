// Página pública de la demo (inglés, para el jurado). HTML autocontenido.
// Dirección visual: consola de llamadas en vivo — tinta nocturna, grano, acento ámbar
// (atardecer de Texas), tipografía Bricolage Grotesque + JetBrains Mono.
export const PAGINA = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PayMind Voice — live demo</title>
<meta name="description" content="Bilingual AI collections calls for Buy-Here-Pay-Here car dealers, powered by Muse Spark.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0b0f17; --ink-2: #111827; --panel: rgba(255,255,255,.035); --panel-2: rgba(255,255,255,.06);
    --line: rgba(255,255,255,.09); --line-2: rgba(255,255,255,.16);
    --text: #eef1f6; --muted: #8b95a7; --dim: #5d6779;
    --amber: #ffad42; --amber-2: #ff7a2f; --amber-ink: #1a0f02; --teal: #3fd6b4; --red: #ff6b6b;
    --display: "Bricolage Grotesque", ui-sans-serif, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; min-height: 100vh; color: var(--text); background: var(--ink);
    font: 16px/1.55 var(--display); overflow-x: hidden;
  }
  /* atmósfera: resplandor ámbar + rejilla tenue + grano */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -2; pointer-events: none;
    background:
      radial-gradient(900px 520px at 85% -10%, rgba(255,140,50,.20), transparent 60%),
      radial-gradient(700px 500px at -10% 30%, rgba(63,214,180,.08), transparent 60%),
      linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 100% 72px,
      var(--ink);
    mask-image: linear-gradient(#000 0%, #000 70%, transparent 100%);
  }
  body::after {
    content: ""; position: fixed; inset: -50%; z-index: -1; pointer-events: none; opacity: .07;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  main { max-width: 1180px; margin: 0 auto; padding: 28px 16px 72px; }
  a { color: var(--amber); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* barra superior */
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; font: 500 12px/1 var(--mono); color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
  .brand { display: flex; align-items: center; gap: 10px; color: var(--text); }
  .logo { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, var(--amber), var(--amber-2)); color: var(--amber-ink); font: 800 13px/1 var(--display); }
  .live-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 11px; border: 1px solid var(--line-2); border-radius: 999px; }
  .live-pill i { width: 7px; height: 7px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 0 rgba(63,214,180,.6); animation: ping 2s infinite; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 rgba(63,214,180,.55); } 80%,100% { box-shadow: 0 0 0 9px rgba(63,214,180,0); } }

  /* hero */
  .hero { display: grid; grid-template-columns: 1.15fr .85fr; gap: 40px; align-items: start; margin-top: 56px; }
  @media (max-width: 900px) { .hero { grid-template-columns: 1fr; gap: 28px; margin-top: 36px; } }
  .eyebrow { font: 500 12px/1 var(--mono); color: var(--amber); letter-spacing: .12em; text-transform: uppercase; }
  h1 { font: 800 clamp(38px, 6.2vw, 74px)/.95 var(--display); letter-spacing: -.035em; margin: 18px 0 22px; }
  h1 em { font-style: normal; background: linear-gradient(100deg, var(--amber) 10%, var(--amber-2) 90%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .lede { color: var(--muted); font-size: 18px; max-width: 560px; margin: 0; }
  .lede b { color: var(--text); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
  .chip { font: 500 12px/1 var(--mono); color: var(--text); padding: 8px 11px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel); }
  .chip b { color: var(--amber); font-weight: 500; }
  .stats { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: 34px; margin-top: 34px; }
  .stat strong { display: block; font: 800 30px/1 var(--display); letter-spacing: -.02em; }
  .stat span { font: 400 12px/1.4 var(--mono); color: var(--muted); }
  @media (max-width: 520px) { .stats { gap: 20px; } .stat strong { font-size: 24px; } }

  /* consola de marcado */
  .console { position: relative; border: 1px solid var(--line-2); border-radius: 22px; padding: 22px; background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); backdrop-filter: blur(10px); box-shadow: 0 30px 80px -30px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.08); }
  .console-h { display: flex; justify-content: space-between; align-items: center; font: 500 11px/1 var(--mono); color: var(--muted); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 16px; }
  .wave { display: flex; align-items: center; gap: 3px; height: 18px; }
  .wave span { width: 3px; height: 4px; border-radius: 2px; background: var(--dim); transition: background .3s; }
  body.live .wave span { background: var(--amber); animation: wv 1s ease-in-out infinite; }
  .wave span:nth-child(2) { animation-delay: -.8s; } .wave span:nth-child(3) { animation-delay: -.6s; } .wave span:nth-child(4) { animation-delay: -.4s; }
  .wave span:nth-child(5) { animation-delay: -.2s; } .wave span:nth-child(6) { animation-delay: -.7s; } .wave span:nth-child(7) { animation-delay: -.3s; }
  @keyframes wv { 0%,100% { height: 4px; } 50% { height: 18px; } }
  .buyers { display: grid; gap: 8px; }
  .buyer { position: relative; display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; align-items: center; width: 100%; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color .2s, background .2s, transform .2s; }
  .buyer:hover { border-color: var(--line-2); transform: translateY(-1px); }
  .buyer[aria-pressed="true"] { border-color: var(--amber); background: rgba(255,173,66,.08); }
  .avatar { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font: 800 16px/1 var(--display); color: var(--amber-ink); background: linear-gradient(135deg, var(--amber), var(--amber-2)); }
  .buyer[aria-pressed="false"] .avatar { background: var(--panel-2); color: var(--muted); }
  .buyer b { display: block; font-weight: 600; }
  .buyer small { color: var(--muted); font: 400 12px/1.4 var(--mono); }
  .lang { font: 700 10px/1 var(--mono); padding: 5px 7px; border-radius: 6px; border: 1px solid var(--line-2); color: var(--muted); letter-spacing: .06em; }
  .field { margin-top: 16px; }
  .field label { display: block; font: 500 11px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .phone { display: flex; align-items: center; border: 1px solid var(--line-2); border-radius: 14px; background: rgba(0,0,0,.25); transition: border-color .2s, box-shadow .2s; }
  .phone:focus-within { border-color: var(--amber); box-shadow: 0 0 0 4px rgba(255,173,66,.12); }
  .phone span { padding: 0 4px 0 14px; font: 500 16px/1 var(--mono); color: var(--muted); }
  .phone input { flex: 1; min-width: 0; padding: 14px 14px 14px 6px; border: 0; outline: 0; background: transparent; color: var(--text); font: 500 17px/1 var(--mono); letter-spacing: .04em; }
  .consent { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; font-size: 13px; color: var(--muted); cursor: pointer; }
  .consent input { accent-color: var(--amber); margin-top: 3px; width: 16px; height: 16px; flex: none; }
  .go { position: relative; overflow: hidden; margin-top: 16px; width: 100%; display: flex; justify-content: center; align-items: center; gap: 10px; padding: 16px; border: 0; border-radius: 14px; cursor: pointer; background: linear-gradient(100deg, var(--amber), var(--amber-2)); color: var(--amber-ink); font: 800 17px/1 var(--display); letter-spacing: -.01em; box-shadow: 0 14px 40px -12px rgba(255,122,47,.7); transition: transform .15s, filter .2s; }
  .go:hover { filter: brightness(1.07); transform: translateY(-1px); }
  .go:disabled { filter: grayscale(.6) brightness(.7); cursor: default; transform: none; }
  .go svg { width: 18px; height: 18px; }
  .msg { min-height: 20px; margin-top: 10px; font: 500 13px/1.4 var(--mono); color: var(--red); }

  /* paneles de llamada */
  .board { display: grid; grid-template-columns: 1.35fr .65fr; gap: 16px; margin-top: 56px; }
  @media (max-width: 900px) { .board { grid-template-columns: 1fr; margin-top: 36px; } }
  .panel { border: 1px solid var(--line); border-radius: 20px; background: var(--panel); padding: 20px; min-width: 0; }
  .panel-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
  .panel-h h2 { margin: 0; font: 600 13px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .state { display: inline-flex; align-items: center; gap: 8px; font: 500 12px/1 var(--mono); color: var(--muted); }
  .state i { width: 8px; height: 8px; border-radius: 50%; background: var(--dim); }
  body.ringing .state i { background: var(--amber); animation: blink 1s infinite; }
  body.live .state i { background: var(--red); animation: blink 1.4s infinite; }
  body.ended .state i { background: var(--teal); }
  @keyframes blink { 50% { opacity: .25; } }
  .log { display: flex; flex-direction: column; gap: 14px; min-height: 280px; max-height: 460px; overflow-y: auto; padding-right: 4px; scroll-behavior: smooth; }
  .entry { display: grid; grid-template-columns: 54px 1fr; gap: 12px; animation: rise .35s ease-out both; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  .entry time { font: 400 12px/1.8 var(--mono); color: var(--dim); }
  .entry .who { font: 700 11px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 5px; }
  .entry.ai .who { color: var(--amber); }
  .entry.me .who { color: var(--teal); }
  .entry p { margin: 0; font-size: 16px; }
  .entry.ai p { padding-left: 12px; border-left: 2px solid rgba(255,173,66,.5); }
  .empty { color: var(--dim); font-size: 15px; }
  .empty b { color: var(--muted); }
  .outcome { margin-top: 16px; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(63,214,180,.4); background: rgba(63,214,180,.08); animation: rise .4s ease-out both; }
  .outcome b { display: block; font-weight: 700; }
  .outcome small { font: 400 12px/1.4 var(--mono); color: var(--muted); }
  .outcome .tick { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--teal); color: var(--ink); font-weight: 800; flex: none; }
  .paylink { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 14px; background: linear-gradient(100deg, rgba(255,173,66,.16), rgba(255,122,47,.08)); border: 1px solid rgba(255,173,66,.45); color: var(--text); text-decoration: none; animation: rise .4s ease-out both; }
  .paylink:hover { text-decoration: none; border-color: var(--amber); }
  .paylink span { font: 500 13px/1.4 var(--mono); color: var(--muted); }
  .paylink b { color: var(--amber); }
  .hint { margin: 8px 2px 0; font: 400 12px/1.4 var(--mono); color: var(--dim); }
  .mem { display: grid; gap: 10px; }
  .memo { position: relative; padding: 14px 14px 14px 16px; border-radius: 14px; background: var(--panel-2); border: 1px solid var(--line); animation: rise .35s ease-out both; }
  .memo::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 3px; background: var(--amber); }
  .memo small { display: block; font: 500 11px/1.4 var(--mono); color: var(--muted); letter-spacing: .04em; margin-bottom: 6px; }
  .memo p { margin: 0; font-size: 15px; }
  .reset { background: none; border: 1px solid var(--line-2); color: var(--muted); font: 500 11px/1 var(--mono); padding: 7px 10px; border-radius: 8px; cursor: pointer; letter-spacing: .04em; }
  .reset:hover { color: var(--text); border-color: var(--text); }

  /* acta de cumplimiento de la llamada */
  .audit { margin-top: 12px; padding: 16px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--panel-2); animation: rise .4s ease-out both; }
  .audit-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
  .audit-h b { font: 600 12px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .score { font: 800 22px/1 var(--display); color: var(--teal); }
  .score.bad { color: var(--red); }
  .checks { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .checks li { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: start; font-size: 14px; }
  .checks li i { font-style: normal; font-weight: 800; color: var(--teal); }
  .checks li.fail i { color: var(--red); }
  .checks li small { display: block; color: var(--muted); font: 400 12px/1.4 var(--mono); }
  .checks li em { font: 500 10px/1 var(--mono); font-style: normal; letter-spacing: .06em; text-transform: uppercase; padding: 4px 6px; border-radius: 5px; border: 1px solid var(--line-2); color: var(--muted); }
  .checks li em.code { color: var(--amber); border-color: rgba(255,173,66,.4); }

  .voice { margin-top: 12px; border-radius: 14px; border: 1px solid rgba(0,129,251,.35); background: rgba(0,129,251,.06); animation: rise .4s ease-out both; }
  .voice summary { cursor: pointer; padding: 12px 16px; font: 600 12px/1.4 var(--mono); letter-spacing: .06em; color: #7ab8ff; list-style: none; }
  .voice summary::-webkit-details-marker { display: none; }
  .voice summary span { color: var(--muted); font-weight: 400; letter-spacing: 0; }
  .voice ol { margin: 0; padding: 0 16px 14px; list-style: none; display: grid; gap: 6px; }
  .voice li { font-size: 14px; } .voice li b { font: 700 11px/1 var(--mono); letter-spacing: .06em; text-transform: uppercase; margin-right: 6px; }
  .voice li.agent b { color: var(--amber); } .voice li.buyer b { color: var(--teal); }

  /* tablero del día */
  .today { margin-top: 56px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); background: var(--line); }
  @media (max-width: 900px) { .today { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 520px) { .today { grid-template-columns: repeat(2, 1fr); } }
  .today div { background: var(--ink-2); padding: 16px 18px; }
  .today strong { display: block; font: 800 28px/1 var(--display); letter-spacing: -.02em; }
  .today span { font: 400 11px/1.4 var(--mono); color: var(--muted); letter-spacing: .04em; }
  .today-h { margin: 56px 0 -40px; font: 600 13px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

  /* planificador: agenda del día que decide Muse */
  .planner { margin-top: 56px; }
  .planner-h { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
  .planner-h h3 { font: 800 clamp(26px, 3.5vw, 38px)/1.05 var(--display); letter-spacing: -.025em; margin: 10px 0 6px; }
  .planner-h p { margin: 0; color: var(--muted); max-width: 620px; }
  .plan-btn { display: inline-flex; align-items: center; gap: 10px; padding: 13px 18px; border-radius: 12px; border: 1px solid rgba(0,129,251,.5); background: linear-gradient(100deg, rgba(0,129,251,.22), rgba(122,184,255,.08)); color: var(--text); font: 700 15px/1 var(--display); cursor: pointer; transition: border-color .2s, transform .15s; }
  .plan-btn:hover { border-color: #7ab8ff; transform: translateY(-1px); }
  .plan-btn:disabled { opacity: .6; cursor: default; transform: none; }
  .plan-btn .inf { width: 26px; height: 13px; }
  body.planning .plan-btn .inf path { animation: draw 1.2s linear infinite; }
  .agenda { display: grid; gap: 10px; }
  .slot { display: grid; grid-template-columns: 112px 1fr; gap: 18px; padding: 16px 18px; border-radius: 16px; border: 1px solid var(--line); background: var(--panel); animation: rise .4s ease-out both; }
  @media (max-width: 620px) { .slot { grid-template-columns: 1fr; gap: 10px; } }
  .slot.skip { opacity: .72; border-style: dashed; }
  .when b { display: block; font: 800 24px/1 var(--display); letter-spacing: -.02em; }
  .when small { font: 500 11px/1.6 var(--mono); color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
  .slot.skip .when b { color: var(--dim); font-size: 18px; }
  .slot h4 { margin: 0 0 4px; font: 700 17px/1.3 var(--display); }
  .slot h4 span { font: 500 12px/1 var(--mono); color: var(--muted); margin-left: 6px; }
  .slot .goal { margin: 0; }
  .offer { display: inline-block; margin-top: 8px; padding: 8px 11px; border-radius: 10px; background: rgba(255,173,66,.09); border: 1px solid rgba(255,173,66,.3); font-size: 14px; }
  .offer b { font: 500 11px/1 var(--mono); color: var(--amber); letter-spacing: .08em; text-transform: uppercase; margin-right: 6px; }
  .why { margin: 8px 0 0; font-size: 14px; color: var(--muted); }
  .guard { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .guard li { font: 500 12px/1.5 var(--mono); color: var(--teal); }
  .guard li::before { content: "⛨ "; }
  .plan-meta { margin-top: 10px; font: 400 12px/1.4 var(--mono); color: var(--dim); }

  /* cómo funciona */
  .how { margin-top: 56px; }
  .how h3 { font: 800 clamp(26px, 3.5vw, 38px)/1.05 var(--display); letter-spacing: -.025em; margin: 0 0 22px; }
  .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; counter-reset: s; }
  @media (max-width: 900px) { .steps { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 520px) { .steps { grid-template-columns: 1fr; } }
  .step { position: relative; padding: 18px; border-radius: 18px; border: 1px solid var(--line); background: var(--panel); counter-increment: s; }
  .step::before { content: "0" counter(s); font: 500 12px/1 var(--mono); color: var(--amber); }
  .step b { display: block; margin: 12px 0 6px; font-size: 17px; }
  .step p { margin: 0; color: var(--muted); font-size: 14px; }
  .step code { font: 500 12px/1 var(--mono); color: var(--text); background: var(--panel-2); padding: 2px 5px; border-radius: 5px; }
  .tries { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
  @media (max-width: 760px) { .tries { grid-template-columns: 1fr; } }
  .try { padding: 16px 18px; border-radius: 16px; border: 1px dashed var(--line-2); font-size: 14px; color: var(--muted); }
  .try b { color: var(--text); }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font: 400 12px/1.6 var(--mono); color: var(--dim); }
  footer { align-items: center; }
  .builtby { display: inline-flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border: 1px solid var(--line-2); border-radius: 14px; background: var(--panel); color: var(--text); text-decoration: none; transition: border-color .2s, transform .2s; }
  .builtby:hover { text-decoration: none; border-color: #ff5a1f; transform: translateY(-1px); }
  .builtby img { width: 34px; height: 34px; border-radius: 9px; display: block; }
  .builtby small { display: block; font: 500 10px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .builtby b { display: block; font: 700 16px/1 var(--display); letter-spacing: -.01em; color: var(--text); }

  /* sello «Powered by Muse Spark · Meta» */
  .powered { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px; border-radius: 999px; border: 1px solid rgba(0,129,251,.35); background: linear-gradient(100deg, rgba(0,129,251,.14), rgba(122,184,255,.05)); box-shadow: 0 0 0 1px rgba(255,255,255,.03) inset, 0 10px 30px -14px rgba(0,129,251,.7); font: 500 12px/1 var(--mono); color: var(--muted); letter-spacing: .04em; text-decoration: none; position: relative; overflow: hidden; }
  .powered:hover { text-decoration: none; border-color: rgba(0,129,251,.7); }
  .powered b { color: var(--text); font: 700 14px/1 var(--display); letter-spacing: -.01em; }
  .powered .meta { color: #7ab8ff; font-weight: 700; }
  .powered::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.14) 50%, transparent 70%); transform: translateX(-120%); animation: sheen 4.5s ease-in-out 1.2s infinite; }
  @keyframes sheen { 0%, 70% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
  .inf { width: 30px; height: 15px; flex: none; }
  .inf path { stroke-dasharray: 120; stroke-dashoffset: 120; animation: draw 1.6s cubic-bezier(.6,0,.2,1) .4s forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .powered-row { margin-top: 18px; }
  .console-foot { display: flex; justify-content: center; margin-top: 14px; }
  .console-foot .powered { padding: 6px 12px 6px 9px; font-size: 11px; }
  .console-foot .powered b { font-size: 13px; }

  /* entrada escalonada */
  .reveal { animation: rise .7s cubic-bezier(.2,.7,.2,1) both; }
  .d1 { animation-delay: .05s; } .d2 { animation-delay: .15s; } .d3 { animation-delay: .25s; } .d4 { animation-delay: .35s; } .d5 { animation-delay: .45s; }
  @media (prefers-reduced-motion: reduce) { *, *::before { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<main>
  <div class="top reveal">
    <div class="brand"><div class="logo">P</div>PayMind Voice</div>
    <div class="live-pill"><i></i>Live demo · Meta Global AI Hackathon</div>
  </div>

  <section class="hero">
    <div>
      <div class="eyebrow reveal d1">Buy-Here-Pay-Here collections, by phone</div>
      <h1 class="reveal d2">The payment call,<br><em>made by Muse Spark.</em></h1>
      <p class="lede reveal d3">Car dealers that finance their own cars have someone on the lot calling every late buyer, in English or Spanish, and by the rules. PayMind Voice makes that call: it <b>confirms who picked up</b>, <b>agrees on a date within the dealer's rules</b>, and <b>remembers what each buyer promised</b> last time.</p>
      <div class="powered-row reveal d4"><a class="powered" href="https://dev.meta.ai/" target="_blank" rel="noopener"><svg class="inf" viewBox="0 0 48 24" aria-hidden="true"><defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#0081fb"/><stop offset=".55" stop-color="#0064e0"/><stop offset="1" stop-color="#7ab8ff"/></linearGradient></defs><path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8c5 0 7-5 12-8s7-8 12-8c4.4 0 8 3.6 8 8s-3.6 8-8 8c-5 0-7-5-12-8S17 4 12 4z" fill="none" stroke="url(#g1)" stroke-width="3.4" stroke-linecap="round"/></svg><span>Powered by <b>Muse Spark</b> · <span class="meta">Meta</span></span></a></div>
      <div class="chips reveal d4">
        <span class="chip"><b>●</b> Muse Spark 1.3</span>
        <span class="chip">Tool calling</span>
        <span class="chip">Per-buyer memory</span>
        <span class="chip">Agentic call planning</span>
        <span class="chip">Compliance audit</span>
        <span class="chip">Muse Wonder + Voice Transcribe</span>
        <span class="chip">EN / ES</span>
        <span class="chip">Twilio ConversationRelay</span>
      </div>
      <div class="stats reveal d5">
        <div class="stat"><strong>~1s</strong><span>to first word</span></div>
        <div class="stat"><strong>6</strong><span>call outcomes</span></div>
        <div class="stat"><strong>0</strong><span>debt details before ID</span></div>
      </div>
    </div>

    <div class="console reveal d3">
      <div class="console-h"><span>Place a demo call</span><div class="wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
      <div class="buyers" id="buyers"></div>
      <div class="field">
        <label for="phone">Your phone · US only</label>
        <div class="phone"><span>+1</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(713) 555-0123"></div>
      </div>
      <label class="consent"><input id="consent" type="checkbox"><span>I agree to receive one automated demo call at this number. It is recorded only to transcribe and audit it, and the recording is deleted right after. No real debt: every name and amount is fictitious.</span></label>
      <button class="go" id="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg><span id="goLabel">Call me</span></button>
      <div class="msg" id="msg" role="status"></div>
      <div class="console-foot"><a class="powered" href="https://dev.meta.ai/" target="_blank" rel="noopener"><svg class="inf" viewBox="0 0 48 24" aria-hidden="true"><defs><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stop-color="#0081fb"/><stop offset=".55" stop-color="#0064e0"/><stop offset="1" stop-color="#7ab8ff"/></linearGradient></defs><path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8c5 0 7-5 12-8s7-8 12-8c4.4 0 8 3.6 8 8s-3.6 8-8 8c-5 0-7-5-12-8S17 4 12 4z" fill="none" stroke="url(#g2)" stroke-width="3.4" stroke-linecap="round"/></svg><span>Powered by <b>Muse</b> · <span class="meta">Meta</span></span></a></div>
    </div>
  </section>

  <div class="today-h">Today on Lone Star Motors' line · live</div>
  <section class="today" id="today"></section>

  <section class="board">
    <div class="panel">
      <div class="panel-h"><h2>Live transcript</h2><span class="state"><i></i><span id="status">Idle</span></span></div>
      <div class="log" id="chat" aria-live="polite"><p class="empty">Pick a buyer, press <b>Call me</b>, pick up, and play along. Every word shows up here as it's spoken.</p></div>
      <div id="outcome"></div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Memory · <span id="memName">buyer</span></h2><button class="reset" id="reset">Reset</button></div>
      <div class="mem" id="mem"></div>
    </div>
  </section>

  <section class="planner">
    <div class="planner-h">
      <div><div class="eyebrow">Agentic planning</div><h3>Who to call today, and with what offer</h3><p>Muse Spark reads every account, the dealer's rules and each buyer's memory, then plans the day with tool calls. Compliance rules (calling hours, do-not-call, active promises) are enforced in code on top of its plan.</p></div>
      <button class="plan-btn" id="planBtn"><svg class="inf" viewBox="0 0 48 24" aria-hidden="true"><path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8c5 0 7-5 12-8s7-8 12-8c4.4 0 8 3.6 8 8s-3.6 8-8 8c-5 0-7-5-12-8S17 4 12 4z" fill="none" stroke="#7ab8ff" stroke-width="3.4" stroke-linecap="round"/></svg><span id="planLabel">Plan today's calls</span></button>
    </div>
    <div class="agenda" id="agenda"><p class="empty">No plan yet. Press <b>Plan today's calls</b> and watch Muse Spark decide.</p></div>
    <div class="plan-meta" id="planMeta"></div>
  </section>

  <section class="how">
    <h3>How a call works</h3>
    <div class="steps">
      <div class="step"><b>Twilio dials</b><p>ConversationRelay streams the buyer's words, already transcribed, to a Cloudflare Worker over WebSocket.</p></div>
      <div class="step"><b>Muse Spark talks</b><p>Responses API, streaming, <code>minimal</code> reasoning, so the first sentence is spoken in about a second.</p></div>
      <div class="step"><b>Tools decide</b><p><code>record_promise</code>, <code>send_pay_link</code>, <code>transfer_to_human</code>… The dealer's rules are enforced in code.</p></div>
      <div class="step"><b>It remembers, and gets audited</b><p>After hanging up, Muse Spark writes a case note for the next call, and a second Muse Spark pass audits the transcript against the collection rules.</p></div>
    </div>
    <div class="tries">
      <div class="try"><b>Promise, then call back.</b> Agree to pay on Friday. Call again: the agent brings up your promise.</div>
      <div class="try"><b>Say you're not the buyer.</b> It won't reveal a single detail about the debt.</div>
      <div class="try"><b>Say you lost your job.</b> No pressure: it hands you to a person on the team.</div>
    </div>
  </section>

  <footer>
    <a class="builtby" href="https://bizmind.us" target="_blank" rel="noopener"><img src="https://bizmind.us/brand/mark.svg" alt="" width="34" height="34"><span><small>Built by</small><b>BizMind AI Agency</b></span></a>
    <span>Fictitious dealer (Lone Star Motors) and buyers · Houston, TX · <a href="https://github.com/Joarciniegas/paymind-voice-hackathon">Source code</a></span>
  </footer>
</main>
<script>
const $ = (id) => document.getElementById(id);
const OUTCOMES = { promise: 'Payment promise recorded', pay_link: 'Pay link sent', human: 'Handed off to a person', do_not_call: 'Marked do-not-call', wrong_person: 'Not the buyer: nothing disclosed', done: 'Call completed', no_answer: 'No conversation' };
const EMPTY_MEM = '<p class="empty">Nothing yet. After your first call, Muse Spark writes a short case note here, and the next call picks up from it.</p>';
let buyer = null, buyers = [], poll = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (n) => '$' + Number(n).toFixed(0);
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function setState(name, label) {
  document.body.classList.remove('ringing', 'live', 'ended');
  if (name) document.body.classList.add(name);
  $('status').textContent = label;
}

function when(t, now) {
  if (!t) return '<b>—</b><small>not today</small>';
  const [d, hm] = t.split('T');
  let [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return '<b>' + h + ':' + String(m).padStart(2, '0') + '</b><small>' + ap + ' · ' + (d === now.slice(0, 10) ? 'today' : 'tomorrow') + '</small>';
}
function renderPlan(p) {
  if (!p) return;
  $('agenda').innerHTML = p.steps.map((s) => {
    const b = buyers.find((x) => x.id === s.buyerId) || { firstName: s.buyerId, vehicle: '' };
    const offer = s.offer ? '<div class="offer"><b>Opening offer</b>' + esc(s.offer.note || (s.offer.extensionDays + ' days max')) + ' · up to ' + s.offer.extensionDays + ' days' + (s.offer.splitPayment ? ' · split payment' : '') + '</div>' : '';
    const guard = s.guardrails.length ? '<ul class="guard">' + s.guardrails.map((g) => '<li>' + esc(g) + '</li>').join('') + '</ul>' : '';
    return '<div class="slot ' + s.action + '"><div class="when">' + (s.action === 'call' ? when(s.callAt, p.now) : '<b>Skip</b><small>no call today</small>') + '</div><div><h4>' + esc(b.firstName) + '<span>' + esc(b.vehicle) + '</span></h4><p class="goal">' + esc(s.goal) + '</p>' + offer + '<p class="why">' + esc(s.reason) + '</p>' + guard + '</div></div>';
  }).join('');
  $('planMeta').textContent = 'Planned by ' + p.model + ' at ' + p.now + ' (Houston). The next call to each buyer uses this plan as its script.';
}
$('planBtn').addEventListener('click', async () => {
  $('planBtn').disabled = true; document.body.classList.add('planning'); $('planLabel').textContent = 'Muse Spark is planning…';
  try {
    const r = await fetch('/api/plan', { method: 'POST' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Something went wrong.');
    renderPlan(j.plan);
  } catch (e) {
    $('planMeta').textContent = e.message;
  }
  $('planBtn').disabled = false; document.body.classList.remove('planning'); $('planLabel').textContent = 'Plan again';
});

async function init() {
  const r = await fetch('/api/buyers').then((x) => x.json());
  buyers = r.buyers;
  $('buyers').innerHTML = buyers.map((b) =>
    '<button class="buyer" aria-pressed="false" data-id="' + b.id + '"><span class="avatar">' + esc(b.firstName[0]) + '</span><span><b>' + esc(b.firstName) + ' · ' + esc(b.vehicle) + '</b><small>' +
    (b.pastDue > 0 ? money(b.pastDue) + ' past due · ' + b.daysPastDue + ' days late' : 'Up to date · next ' + money(b.paymentAmount)) + '</small></span><span class="lang">' + b.lang.toUpperCase() + '</span></button>').join('');
  document.querySelectorAll('.buyer').forEach((el) => el.addEventListener('click', () => pick(el.dataset.id)));
  pick(buyers[0].id);
  loadToday();
  fetch('/api/plan').then((x) => x.json()).then((j) => { if (j.plan) { renderPlan(j.plan); $('planLabel').textContent = 'Plan again'; } }).catch(() => {});
}

function pick(id) {
  buyer = buyers.find((b) => b.id === id);
  document.querySelectorAll('.buyer').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.id === id)));
  $('memName').textContent = buyer.firstName;
  $('goLabel').textContent = 'Call me as ' + buyer.firstName;
  loadMemory();
}

async function loadMemory() {
  const r = await fetch('/api/memory?d=' + buyer.id).then((x) => x.json());
  $('mem').innerHTML = r.memory.length
    ? r.memory.slice().reverse().map((m) => '<div class="memo"><small>' + esc(m.date) + ' · ' + esc(OUTCOMES[m.outcome] || m.outcome) + (m.promisedDate ? ' · ' + money(m.promisedAmount) + ' on ' + esc(m.promisedDate) : '') + '</small><p>' + esc(m.summary) + '</p></div>').join('')
    : EMPTY_MEM;
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
    $('chat').innerHTML = '<p class="empty">Ringing your phone as <b>' + esc(buyer.firstName) + '</b>. Pick up!</p>';
    $('outcome').innerHTML = '';
    setState('ringing', 'Ringing');
    clearInterval(poll);
    poll = setInterval(() => follow(j.callId), 1000);
    setTimeout(() => { clearInterval(poll); $('go').disabled = false; }, 6 * 60 * 1000);
  } catch (e) {
    $('msg').textContent = e.message;
    $('go').disabled = false;
  }
});

function renderVoice(v) {
  $('outcome').insertAdjacentHTML('beforeend', '<details class="voice"><summary>▸ Independent transcript · ' + esc(v.model) + ' <span>· speakers separated from the call recording (' + v.turns.length + ' turns)</span></summary><ol>' +
    v.turns.map((t) => '<li class="' + t.who + '"><b>' + (t.who === 'agent' ? 'Agent' : 'Buyer') + '</b>' + esc(t.text) + '</li>').join('') + '</ol></details>');
}
function renderAudit(a) {
  const ok = a.passed === a.total;
  $('outcome').insertAdjacentHTML('beforeend', '<div class="audit"><div class="audit-h"><b>Compliance audit · ' + esc(a.model) + (a.source === 'recording' ? ' · on the recording transcript' : '') + '</b><span class="score' + (ok ? '' : ' bad') + '">' + a.passed + '/' + a.total + '</span></div><ul class="checks">' +
    a.checks.map((c) => '<li class="' + (c.pass ? '' : 'fail') + '"><i>' + (c.pass ? '✓' : '✗') + '</i><span>' + esc(c.label) + '<small>' + esc(c.note) + '</small></span><em class="' + c.by + '">' + (c.by === 'code' ? 'code' : 'Muse') + '</em></li>').join('') + '</ul></div>');
}
async function loadToday() {
  const r = await fetch('/api/stats').then((x) => x.json()).catch(() => null);
  if (!r) return;
  const s = r.stats;
  const cells = [[s.calls, 'calls answered'], [money(s.promised), 'promised to pay'], [s.payLinks, 'pay links texted'], [s.humans, 'handed to a person'], [s.wrongPerson + s.doNotCall, 'protected (wrong person / do-not-call)'], [s.audits ? Math.round(100 * s.auditsClean / s.audits) + '%' : '—', 'calls with a clean audit']];
  $('today').innerHTML = cells.map((c) => '<div><strong>' + c[0] + '</strong><span>' + c[1] + '</span></div>').join('');
}

let shown = 0, endedAt = 0, smsShown = false, auditShown = false, voiceShown = false;
async function follow(callId) {
  const r = await fetch('/api/transcript?c=' + callId).then((x) => x.json()).catch(() => null);
  if (!r) return;
  const turns = r.events.filter((e) => e.kind === 'turn');
  if (turns.length && turns.length !== shown) {
    const t0 = Date.parse(turns[0].ts);
    $('chat').innerHTML = turns.map((t) => '<div class="entry ' + (t.role === 'assistant' ? 'ai' : 'me') + '"><time>' + mmss(Date.parse(t.ts) - t0) + '</time><div><div class="who">' + (t.role === 'assistant' ? 'PayMind Voice' : esc(buyer.firstName) + ' · you') + '</div><p>' + esc(t.content) + '</p></div></div>').join('');
    $('chat').scrollTop = $('chat').scrollHeight;
    shown = turns.length;
  }
  const end = r.events.find((e) => e.kind === 'end');
  const sms = r.events.find((e) => e.kind === 'sms');
  if (turns.length && !end) setState('live', 'On the call');
  if (end && !endedAt) {
    endedAt = Date.now();
    setState('ended', 'Call ended');
    $('outcome').innerHTML = '<div class="outcome"><span class="tick">✓</span><div><b>' + esc(OUTCOMES[end.outcome] || end.outcome) + '</b><small>' + (end.promisedDate ? money(end.promisedAmount) + ' on ' + esc(end.promisedDate) : 'Saved to ' + esc(buyer.firstName) + '\\'s memory') + '</small></div></div>';
    $('go').disabled = false;
    setTimeout(loadMemory, 6000); // el resumen de Muse tarda unos segundos
  }
  if (sms && !smsShown) {
    smsShown = true;
    $('outcome').insertAdjacentHTML('beforeend', '<a class="paylink" href="' + esc(sms.url) + '" target="_blank" rel="noopener"><span>💬 Pay link texted to your phone · ' + money(sms.amount) + '</span><b>Open the test pay link →</b></a><p class="hint">Stripe test mode: card 4242 4242 4242 4242, any future date, any CVC.</p>');
  }
  const voice = r.events.find((e) => e.kind === 'voice');
  if (voice && !voiceShown) { voiceShown = true; renderVoice(voice); }
  const audit = r.events.find((e) => e.kind === 'audit');
  if (audit && !auditShown) { auditShown = true; renderAudit(audit); loadToday(); }
  // Tras colgar se sigue mirando hasta que llega el acta (la grabación tarda; tope ~2 min).
  if (endedAt && (audit || Date.now() - endedAt > 120000)) {
    clearInterval(poll);
    shown = 0; endedAt = 0; smsShown = false; auditShown = false; voiceShown = false;
    loadToday();
  }
}

if (new URLSearchParams(location.search).get('paid') === '1') {
  $('msg').style.color = 'var(--teal)';
  $('msg').textContent = '✓ Test payment completed in Stripe. No real money moved.';
}

init();
</script>
</body>
</html>`;
