# PRD — v2/B · Enforcement & pricing

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-29
> Source: v2 post-MVP grill (2026-06-29). Extends [PRD-hosted-platform.md](PRD-hosted-platform.md) §8.
> **Stripe-overage part depends on [PRD-v2a](PRD-v2a-org-model.md) (Stripe customer = org). Enforcement mechanics can start in parallel.**

---

## 1. One-liner

Make the tiers *bite*: a generous hard ceiling on Free, a small hard cap on test keys, **usage-based overage** on Pro — all while keeping the "we never take your app down" fail-open promise for paying customers.

## 2. Problem

Three holes, one root: **Bismite can't currently enforce or charge for usage.**
- The MTU/calls limit is **purely advisory** — `core.ts` returns `overLimit` in a 200 and never blocks (`services/counter/src/core.ts:176`). Free is functionally unlimited; tiers are decorative.
- **Test keys never bill and have no cap** beyond a per-project rate limit (`metering.ts:40` returns `null` for non-live) — a trivial production bypass.
- **Pricing is a placeholder** — `plans.ts` has MTU/calls numbers but no prices, and there is **no overage billing at all**, just a flat Pro tier that doesn't enforce. The original "€X + per-extra-users" model doesn't exist in any form.

## 3. Decisions (locked in the grill)

- **Enforcement model = hybrid:** advisory + overage on paid; hard ceiling on Free; separate small cap on test keys.
- **MTU is the SOLE billed meter.** Calls become a **hard fair-use ceiling per tier** (not advisory, never billed) — protects Redis margin, routes heavy users to sales. (Rejected billing both meters: two invoice lines reintroduce per-call anxiety + ugly 2×-requests math.)
- **Pricing:** Free €0 / 1,000 MTU · **Pro €19/mo / 10,000 MTU included / €8 per extra 1,000 MTU** · Enterprise custom. Call ceilings: Free 100k/mo, Pro 5M/mo, Ent ∞.
- **Free ceiling mechanics:** block only genuinely-**new** users past 1k this period (existing tracked users always pass — never evict mid-month); `record()` returns `blocked: "bismite_free_limit"` (distinct from the dev's own end-user `allowed:false`); **fail-open if the counter is unreachable** (enforce only on confirmed-over).
- **Test cap:** flat **100** distinct MTU/month, every tier; hard-blocked with `blocked: "bismite_test_limit"`; still never bills; still per-project rate-limited. 100 (not 1k) so it can't cannibalize the live-key upgrade lever.

## 4. Scope

**In:**
- New `plans.ts` numbers (MTU included, MTU overage rate, call ceiling per tier).
- Counter enforcement: `record()`/increment returns a structured `blocked` reason when a **new** MTU would exceed the Free ceiling or the test cap; calls over the tier ceiling hard-block; existing-user records always pass; transient/counter-down → fail-open (no block).
- SDK surfaces the blocked reason: `CheckResult`/record result gains `blocked?: "bismite_free_limit" | "bismite_test_limit" | "bismite_calls_ceiling"` (`packages/sdk/src/index.ts`, `hosted.ts`).
- **Stripe Meters** for MTU overage on Pro: report billable overage (MTU above included) to Stripe; €8/1k via a metered price; subscription stays the €19 base + metered overage.
- Dashboard: show "blocked / over ceiling" state distinctly from the existing advisory meter (`apps/dashboard/components/meter.tsx`), with the upgrade CTA.

**Out:**
- Org model / Stripe-customer-on-org → PRD-A (this PRD *consumes* it).
- Customer-facing webhooks when a user is blocked → Phase 2 (PRD-C defers).
- Charts/alerts → PRD-C.

## 5. Technical approach

- **"New user" detection:** MTU is a SADD set per period (`services/counter/src/metering.ts`). A user is "new" iff SADD reports they weren't already in the set. Enforce *before* committing: if the set is already at the ceiling **and** this user is new, refuse (don't add) and return `blocked`. Existing members (SADD returns 0 / already present) always pass. This is the humane "never evict mid-month" rule.
- **Fail-open boundary:** the block only fires on a *confirmed* over-ceiling from a healthy counter. Any error/timeout path keeps today's fail-open (`check()` lets the user through). The block is a positive signal, never the absence of one.
- **Calls ceiling:** today calls are advisory; add a hard 429-style block when a tier's call ceiling is exceeded (distinct from the existing per-project rate-limit 429 in `metering.ts:72`). Surface as `blocked: "bismite_calls_ceiling"`.
- **Test cap:** test mode currently short-circuits metering (`metering.ts:40`). Add a *separate* small test-MTU set with a flat-100 ceiling and the same new-user block, while keeping test out of billing meters.
- **Stripe Meters:** subscription = base price (€19) + a metered price for MTU overage. At period close (or rolling), report `max(0, liveMTU − 10_000)/1000 * €8` worth of meter events keyed to the **org's** Stripe customer (PRD-A). Reconcile from the counter's authoritative MTU, not from incremental events, to survive missed reports.
- **plans.ts shape:** extend each tier with `{ mtuIncluded, mtuOveragePer1k (paid only), callsCeiling }`. `planFor()` keeps safe-defaulting to free.

## 6. Definition of done

- [ ] Free project: the 1,001st *new* user this period is refused with `blocked: "bismite_free_limit"`; users counted earlier still pass; counter-down → all pass (fail-open).
- [ ] Test key: 101st new user refused with `blocked: "bismite_test_limit"`; test usage never appears on any invoice.
- [ ] Calls over a tier's ceiling hard-block with `blocked: "bismite_calls_ceiling"`; under ceiling unaffected.
- [ ] SDK exposes the blocked reason to the dev; example app shows the right message.
- [ ] Pro subscription bills €19 base + €8/1k MTU overage via Stripe Meters, attributed to the org customer; verified with a test-mode subscription crossing 10k.
- [ ] Dashboard distinguishes "over ceiling / blocked" from advisory "approaching".

## 7. Dependencies

- **PRD-A** for the Stripe-overage half (customer = org). Enforcement mechanics (Free/test/calls blocks, SDK signal) can land before A.

## 8. Open questions for refinement

- **Overage billing cadence:** report meter events rolling (daily) vs at period close. Recommend daily reconcile from authoritative MTU (resilient to missed events) — confirm against Stripe Meters' aggregation.
- **Is plan per-project or per-org?** (Cross-ref PRD-A §8.) Recommend per-project tier, per-org customer.
- **Grace on Free?** Hard 1,000 vs a small soft buffer (e.g. block at 1,050) to avoid a jarring exact-cap cliff. Recommend hard at 1,000 for legibility; revisit if support complains.
- Exact Stripe price/meter IDs to create (test + live) — currently only `STRIPE_PRICE_PRO` exists (`apps/dashboard/lib/stripe.ts:11`).

## 9. Suggested issue slices (for `/to-issues`)

1. New `plans.ts` numbers + `planFor` (config only).
2. Counter: Free-ceiling new-user block + `blocked` reason; fail-open preserved.
3. Counter: test-mode flat-100 cap + `blocked` reason (separate test set).
4. Counter: calls hard-ceiling per tier + `blocked` reason.
5. SDK: surface `blocked` in check/record result; example app messaging.
6. Stripe Meters: €19 base + €8/1k MTU overage on the org customer (depends on PRD-A).
7. Dashboard: over-ceiling/blocked state in the meter UI.
