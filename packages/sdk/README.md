# Bismite

**Gate, meter, and monetize any feature in 3 lines — and it never takes your app down.**

Bismite is an SDK-first billing & entitlements runtime that lives in your code. It answers, on every request: *is this user allowed to use this feature, and how much have they used?* — with the upgrade/paywall loop wired straight through Stripe.

Built for AI apps, where usage limits aren't a nice-to-have — every request costs you real money.

```ts
import { bismite } from "./bismite.config";

// gate before the expensive work
const access = await bismite.check(userId, "chat-message");
if (!access.allowed) {
  return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });
}

const completion = await openai.chat.completions.create({ /* ... */ });

// meter after (token count is only known once the call returns)
await bismite.record(userId, "chat-message", { tokens: completion.usage.total_tokens });
```

That's it. The feature is now gated, metered, and monetized.

## Why not just Stripe Meters + a Redis counter?

You can build the naive version in an afternoon. The part that gets worse over time — and that Bismite owns — is:

- **A usage counter that's actually correct** under concurrency, across serverless instances and regions, that resets cleanly on the billing boundary.
- **The Stripe ↔ app sync** so a missed webhook never locks out a paying customer at 2am.
- **The instant upgrade loop**: limit reached → the right paywall → checkout → entitlement updates with no deploy.

## The promise: we never take your app down

- **Plan/feature checks run locally**, in-memory, with background refresh — **zero network on the hot path.** They work even if Bismite is completely down.
- **The usage meter fails open by default** — if it's unreachable, your users are let through (you eat a small usage leak instead of an outage).
- Need strict enforcement on an expensive feature? Opt a single feature into `failClosed`.

```ts
// bismite.config.ts — plans as code
export const plans = {
  // unit: "tokens" meters actual token usage — each call spends a variable
  // amount (the AI wedge). Omit `unit` to count calls: { limit: 20, period: "day" }.
  free: { features: { "chat-message": { limit: 50_000, period: "day", unit: "tokens" } } },
  pro:  { features: { "chat-message": "unlimited" } },
};
```

Check before the call (you don't know the token cost yet), record the actual usage after — `remaining` is in the rule's unit (tokens here, calls otherwise).

## How it works

| Layer | What it does |
|---|---|
| `check()` / `record()` | The runtime in your code — gate before, meter after |
| Local rule evaluation | Resolves the plan + limit with no hot-path network call |
| Usage counter | Atomic, period-scoped count (Upstash Redis, or your own `CounterClient`) |
| Stripe sync | Webhook keeps plan state fresh; reconciliation recovers missed events |
| Upgrade loop | `upgradeUrl` → Stripe Checkout → webhook → instant unlock |

## Counter backends

```ts
import { upstashCounter } from "bismite/redis-counter"; // atomic, cross-instance
import { httpCounter } from "bismite/http-counter";     // point at your own service
```

`CounterClient` is a two-method interface (`read`, `increment`) — bring your own backend if you'd rather.

## Status

Early. Today: usage-limit-per-plan, fail-open runtime, Stripe plan sync + upgrade loop, Upstash counter. Roadmap: a dashboard for non-engineers to change prices without a deploy, multiple pricing models, and becoming the billing rail (merchant-of-record) so we charge for usage, not just count it.

## Example

A runnable Next.js chat app — clone, `pnpm install`, and watch the gate → meter → upgrade loop work end to end. See [`examples/nextjs-chat`](../../examples/nextjs-chat).
