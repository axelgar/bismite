# PRD — Bismite: an SDK-first billing & entitlements runtime on Stripe

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-22
> Source: distilled from the `/grill-me` session. Name is a placeholder.

---

## 1. One-liner

**Gate, meter, and monetize any feature in 3 lines — and it never takes your app down.**

A developer SDK that lives in your app code and answers, on every request: *is this user allowed to use this feature, and how much have they used?* — with the upgrade/paywall loop wired through Stripe. The SDK is the product; the dashboard is a later skin.

## 2. Problem

Every app with paid tiers re-solves the same thing badly:
- Scattered `if (user.plan === 'pro')` checks across dozens of files.
- A hand-rolled usage counter that's wrong under concurrency / across serverless instances.
- Stripe ↔ app state drift: Stripe says Pro, the DB says Free, a webhook was missed, a paying user is locked out at 2am.
- Changing a price or a limit means a code deploy and a migration.

Stripe ships *primitives* (Meters, Entitlements, Customer Portal, Pricing Tables) but not the **in-app runtime** that gates and meters features in the developer's own code. That glue is rebuilt, badly, in every project.

## 3. Target user (beachhead)

**AI app builders** — chatbots, agents, generation tools — building greenfield in 2026.

Why them first:
- Usage limits are **existential**, not cosmetic: every request costs them real money to OpenAI/Anthropic, so uncapped usage bankrupts them. A meter is survival.
- **Greenfield** — adopting at project start, no rip-out cost.
- **Latency-forgiving** — the usage check sits right before a multi-second LLM call, so a ~10ms meter read is noise. The latency objection that kills entitlements-as-a-service for high-frequency gateways doesn't apply here.
- **Fastest-growing dev segment**; they already think in "credits."

Expansion after beachhead: general B2B SaaS feature-gating (same engine, metering dialed down).

## 4. Vision & principles

- **The SDK is the heart.** Like `resend.emails.send()` or the Supabase client — the runtime in the developer's code is why they stay. "The dashboard is how you demo; the SDK is why they stay."
- **We never take your app down.** Plan/feature checks evaluate **locally, in-memory** (synced like a feature-flag SDK) — zero network on the hot path. The usage meter is hosted but **fails open, always.** Revenue-leak-during-our-outage is the accepted tradeoff for trust.
- **Config-as-code first.** Plans live in `billing.config.ts`, not a UI. Devs love it (Drizzle/Prisma DX), and it's the cheapest path to proving the thesis.
- **Software now, become-the-rail later.** Sit on the customer's own Stripe to start; become Merchant-of-Record (% of GMV) once we own the metering.

## 5. The core API (Style A — explicit `check` / `record`)

```ts
// before the expensive work — gate it
const access = await billing.check(userId, "chat-message");
if (!access.allowed) {
  return Response.json({ error: "limit", upgradeUrl: access.upgradeUrl }, { status: 402 });
}

const completion = await openai.chat.completions.create({ ... });

// after — meter the real usage (token count is only known post-call)
await billing.record(userId, "chat-message", { tokens: completion.usage.total_tokens });
```

- `check(userId, feature)` → `{ allowed, remaining, upgradeUrl }` — local rule eval + meter read.
- `record(userId, feature, usage)` → reports consumption to the hosted counter.
- `guard(userId, feature, fn)` — optional wrapper sugar (check + auto-record). Marketing convenience, not the load-bearing path.
- Verbs (`check`/`record`/`guard`) are placeholders, open for naming.

## 6. Architecture

| Concern | Approach |
|---|---|
| Rule evaluation (plan → features/limits) | Synced ruleset, evaluated **locally in-memory**, background refresh. Zero hot-path network. Survives total outage. |
| Usage counting | Hosted counter (must be correct under concurrency / across regions / reset on billing boundary). The genuinely hard part — the moat. |
| Degradation | **Fail-open by default** (per-feature `failClosed` opt-in for features that cost the dev a lot per call). |
| Plan source of truth | The customer's own Stripe (subscription → plan). Webhook keeps local plan state fresh. |
| Upgrade loop | `upgradeUrl` → Stripe Checkout → webhook → plan flips → entitlement updates without a deploy. |

## 7. v1 scope (ruthless)

**In:**
- `check` + `record`
- **One** pricing shape: per-feature usage limit per plan (e.g. Free = 20/day, Pro = unlimited)
- Local rule eval + hosted counter, fail-open
- Upgrade loop via Stripe Checkout + webhook
- Plans defined in **`billing.config.ts`** (no dashboard)
- A **cloneable Next.js chat example** wired end-to-end — this *is* the demo
- README + landing page

**Out (→ v2):**
- Dashboard / control plane
- Multiple pricing models (seats, tiers, credits-as-currency)
- Merchant-of-Record, tax, payouts
- Analytics / observability dashboards (yes — even though "monitoring" was in the original pitch; it doesn't gate validation)

## 8. Business model

- **v1:** layer on the customer's own Stripe; charge a SaaS subscription (+ usage) for the tool. Trust-first — devs keep their money in their own Stripe.
- **v2:** Merchant-of-Record — money flows through us, we remit their sales tax/VAT, we take a % of GMV. Bundles naturally with metering ("we count it *and* charge for it"). This is where the larger revenue lives.

## 9. Competitive landscape

- **Stripe** — ships the primitives; the threat is "why not just use Meters + a Redis counter." Our answer: the in-app runtime DX + never-go-down promise + the upgrade loop as one install.
- **Polar** (closest comparable) — open-source, dev-first MoR, adding usage billing. **Leads with checkout; we lead with the gate inside the app code.**
- **LemonSqueezy** (acquired by Stripe), **Paddle** — MoR, not SDK-runtime-first.
- **Schematic** — entitlements, thin/young, dashboard-leaning.
- **Lago / Orb / Metronome** — metering engines, finance-sold / enterprise.
- Auth (Clerk/WorkOS/better-auth) — explicitly NOT the wedge.

## 10. Riskiest assumption & validation plan

**Riskiest assumption:** AI devs will reach for a third-party runtime at all, instead of Stripe Meters + a ~30-line self-hosted counter.

**Validation (do in parallel with building, not after):**
1. **10 customer conversations** with AI builders. One question: *"Show me how you handle usage limits and paywalls today."* Groans about a hacky Redis counter = pain found. Shrugs ("Meters is fine") = six months saved.
2. **Tryable MVP** (section 7) + README + landing, shipped together. For a dev tool the working `npm install` *is* the landing page.
3. Ship to the 3 most-annoyed people from step 1.

## 11. Open questions (resolve before/while building)

- How is the tool itself priced? (per-MAU? per-event metered? flat?)
- The name.
- GTM / distribution to AI builders (where do they hang out; launch surface).
- `billing.config.ts` schema (plans, features, limits, reset windows, failClosed flags).
- Exact plan-state sync from Stripe (webhook set + reconciliation for missed events).
- Counter backend (managed Redis? Durable Objects? own store?) and its correctness guarantees.

## 12. Suggested milestones

1. **Validate** — 10 conversations + landing + README. (No engine yet.)
2. **Spike the counter** — the one hard part; prove a correct, fast, fail-open usage counter.
3. **Thin SDK** — `check`/`record` + `billing.config.ts` + Stripe plan sync + upgrade loop.
4. **Next.js example** — cloneable chat app, 60-seconds-to-running.
5. **Ship to 3 design partners**, iterate on DX.
