# Bismite

**Gate, meter, and monetize any feature in 3 lines — and it never takes your app down.**

An SDK-first billing & entitlements runtime on Stripe, built for AI apps. → Full pitch & API: [`packages/sdk/README.md`](packages/sdk/README.md).

```ts
const access = await bismite.check(userId, "chat-message");   // gate
if (!access.allowed) return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });
// ...expensive LLM call...
await bismite.record(userId, "chat-message", { tokens });     // meter
```

## Monorepo

| Path | What |
|---|---|
| `packages/sdk` | The `bismite` SDK — `check` / `record`, local rule eval, counters |
| `services/counter` | Local usage-counter service (zero-setup demo backend) |
| `examples/nextjs-chat` | Runnable Next.js chat app — the gate → meter → upgrade loop end to end |
| `landing/index.html` | Marketing landing page |
| `PRD.md`, `issues/` | Product doc and the build issues |

## Quickstart

```bash
pnpm install
pnpm test                                   # SDK + mapping unit tests
pnpm counter                                # local counter (or set UPSTASH_* in the example's .env)
pnpm --filter nextjs-chat dev               # the example app
```

Open the example, send messages until you hit the free limit, and upgrade through real Stripe Checkout. See [`examples/nextjs-chat/README.md`](examples/nextjs-chat/README.md) for the Stripe setup.

## Status

Build issues #1–#4 done & verified live (gate/meter, Stripe plan sync, upgrade loop, Upstash counter). Next: a dashboard for non-engineers, more pricing models, and becoming the billing rail (merchant-of-record).
