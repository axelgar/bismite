# Quickstart — gated feature in 5 minutes

Add a usage limit + paywall to any feature in your app. This is the standalone
path: `npm install bismite` into your own project. No monorepo, no clone.

> Want the full working app (Stripe Checkout + webhook upgrade loop wired)?
> See [`examples/nextjs-chat`](examples/nextjs-chat). This page is the minimum to
> get a gate + meter running.

## 1. Install

```bash
npm install bismite
```

## 2. A usage counter (Upstash, free tier)

The meter needs an atomic, shared counter so the limit is correct across
serverless instances. [Upstash Redis](https://upstash.com) has a free tier and a
REST API (no TCP, works on any serverless runtime). Create a database and copy
its REST URL + token into your env:

```bash
# .env.local
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

> Don't want to sign up yet? Any object with `read(key)` / `increment(key, n)`
> works — `CounterClient` is a two-method interface. An in-memory `Map` is fine
> for a single-process demo (it just won't be correct across instances).

## 3. Define plans as code — `bismite.config.ts`

```ts
import { Billing } from "bismite";
import { upstashCounter } from "bismite/redis-counter";

// Plans + per-feature limits. No dashboard, no deploy to change a number.
export const plans = {
  free: { features: { "chat-message": { limit: 20, period: "day" } } },
  pro:  { features: { "chat-message": "unlimited" } },
};

export const bismite = new Billing({
  plans,
  // Resolve a user's current plan. Hard-code for now; in step 5 this reads the
  // plan your Stripe webhook wrote.
  resolvePlan: (userId) => "free",
  counter: upstashCounter(
    process.env.UPSTASH_REDIS_REST_URL!,
    process.env.UPSTASH_REDIS_REST_TOKEN!,
  ),
  // Where to send a blocked user to upgrade (step 5).
  upgradeUrl: (userId) => `/api/checkout?userId=${encodeURIComponent(userId)}`,
});
```

## 4. Gate before, meter after

The whole product is two calls around the expensive work. Both are
**fail-open** — if the counter is unreachable, the user is let through. Your app
never goes down because billing did.

```ts
import { bismite } from "./bismite.config";

export async function POST(req: Request) {
  const { userId, message } = await req.json();

  // GATE — before the expensive call
  const access = await bismite.check(userId, "chat-message");
  if (!access.allowed) {
    return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });
  }

  const reply = await callYourLLM(message); // the thing that costs money

  // METER — after (you only know token counts once it returns)
  await bismite.record(userId, "chat-message", { count: 1 });

  return Response.json({ reply, remaining: access.remaining - 1 });
}
```

That's a working gate + meter. Free users get 20/day, then a `402` with an
upgrade URL. **Done with the SDK part.**

### Metering tokens instead of calls

For AI features the limit is usually tokens, not requests. Add `unit: "tokens"`
to the rule and record the real usage after the call returns:

```ts
// plan: { limit: 50_000, period: "day", unit: "tokens" }
const access = await bismite.check(userId, "chat-message"); // gate on tokens-so-far
if (!access.allowed) return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });

const completion = await openai.chat.completions.create({ /* ... */ });

await bismite.record(userId, "chat-message", { tokens: completion.usage.total_tokens });
```

`remaining` is then tokens left this period. `check()` runs before the call (you
don't yet know its cost), so you gate on usage-so-far and meter the actual after.

## 5. The upgrade loop (Stripe) — optional next step

To make the paywall actually take money, wire three things:

1. **`/api/checkout`** — create a Stripe Checkout Session with
   `client_reference_id = userId`, redirect to it.
2. **`/api/stripe/webhook`** — on `checkout.session.completed` and
   `customer.subscription.*`, write the user's new plan to a store, and have
   `resolvePlan` read from it. Now an upgrade flips the plan with no deploy.
3. **Reconciliation** — re-pull the plan from Stripe on demand, so a missed
   webhook never locks out a paying customer.

All three are implemented and live-verified in
[`examples/nextjs-chat`](examples/nextjs-chat) — copy the four files in
`app/api/` and `lib/`. That's the difference between "I counted usage" and "I got
paid for it."

## Failure modes, on purpose

- **Counter down** → users pass (fail-open). Opt a single expensive feature into
  strict blocking with `failClosed: true` on its rule.
- **Missed Stripe webhook** → run reconciliation; the plan re-syncs from Stripe.
- **New billing period** → counters are period-scoped (`day`/`month`), so the
  limit resets cleanly on the boundary with no cron.
