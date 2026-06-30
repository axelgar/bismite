# Bismite

**Gate, meter, and monetize any feature in 3 lines — and it never takes your app down.**

An SDK-first billing & entitlements runtime on Stripe, built for AI apps. `npm install bismite`, get one API key, and the usage counter is handled. → Full pitch & API: [`packages/sdk/README.md`](packages/sdk/README.md).

```ts
const access = await bismite.check(userId, "chat-message");   // gate
if (!access.allowed) return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });
// ...expensive LLM call...
await bismite.record(userId, "chat-message", { tokens });     // meter
```

## Use it in your app

```bash
npm install bismite
```

Then sign up at **[app.bismite.dev](https://app.bismite.dev)**, create a project, and point the counter at your key:

```ts
import { bismiteCounter } from "bismite/hosted";
counter: bismiteCounter(process.env.BISMITE_API_KEY!)   // no Redis to provision
```

→ **[QUICKSTART.md](QUICKSTART.md)** — gated feature in 5 minutes, standalone (no clone). The rest of this README is for hacking on the monorepo itself.

## Monorepo

| Path | What |
|---|---|
| `packages/sdk` | The `bismite` SDK — `check` / `record`, local rule eval, counters |
| `services/counter` | The hosted usage-counter service (deployed at `api.bismite.dev`) |
| `apps/dashboard` | The hosted dashboard (`app.bismite.dev`) — signup, projects, keys, usage, billing |
| `examples/nextjs-chat` | Runnable Next.js chat app — the gate → meter → upgrade loop end to end |
| `examples/nextjs-chat/public/landing.html` | Marketing landing page (served at `/landing.html`) — hero, per-framework integration tabs, pricing |
| `PRD.md`, `issues/` | Product doc and the build issues |

## Hacking on the monorepo

```bash
pnpm install
pnpm test                                   # SDK + mapping unit tests
pnpm build                                  # build the publishable SDK (dist/)
pnpm counter                                # local counter (or set UPSTASH_* in the example's .env)
pnpm --filter nextjs-chat dev               # the example app
```

Open the example, send messages until you hit the free limit, and upgrade through real Stripe Checkout. See [`examples/nextjs-chat/README.md`](examples/nextjs-chat/README.md) for the Stripe setup.

## Status

Hosted platform is live: managed counter (`api.bismite.dev`) + self-serve dashboard (`app.bismite.dev`) with projects, API keys, usage meters, and Stripe upgrades. The SDK (gate/meter, Stripe plan sync, upgrade loop) ships on npm. Next: more pricing models and becoming the billing rail (merchant-of-record).
