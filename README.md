# PayMind Voice — bilingual AI collections calls for Buy-Here-Pay-Here car dealers

Built by **BizMind AI Agency** (Houston, TX) for the **Meta Global AI Developer Hackathon** (Startup Track · *Build for Your World*), Oct 27 – Nov 4, 2026.

Buy-Here-Pay-Here dealerships finance their own cars, so every missed payment is a phone call someone on the lot has to make — in English or Spanish, by the rules (identity first, no threats). PayMind Voice makes those calls with **Muse Spark**: it confirms who picked up, explains the balance, negotiates a payment date within the dealer's rules, sends a pay link, and hands off to a human when it should.

## What existed before vs. what was built during the hackathon

| | Status |
|---|---|
| Twilio ConversationRelay ⇄ Cloudflare Worker WebSocket, compliance rules in the prompt, outcome tags (`[[PROMISE]]`, `[[HUMAN]]`…) | **Pre-existing** — commit `7fa0cc7` (built Oct 3, 2026 on Llama 3.3 70B via Workers AI) |
| Switched the brain to **Muse Spark 1.3** through the Meta Model API (Responses API, streaming, `minimal` reasoning for ~1 s first token) | **Built during the hackathon** |
| Demo mode with 100 % fictitious dealer and buyers (`src/demo-data.ts`) — no real customer data | **Built during the hackathon** |
| _Coming this week:_ per-debtor memory across calls, live transcript page, SMS pay link (Stripe test mode), agentic call planning | **Built during the hackathon** |

Every commit after `7fa0cc7` is hackathon work: `git diff 7fa0cc7..main`.

## Run it

```bash
npm install
npx wrangler secret put MODEL_API_KEY   # Meta Model API key
npx wrangler secret put VOICE_KEY       # random string, signs the WebSocket URL
npx wrangler deploy
```

Twilio connects to `wss://<worker>/ws?c=demo-maria-1&t=<HMAC-SHA256(VOICE_KEY, c)>`.

## Data and secrets

- All names, vehicles and amounts in this repo are fictitious. *Lone Star Motors* does not exist.
- No keys live in the code: they are Cloudflare secrets.
