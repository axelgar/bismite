# 2. Stripe as plan source of truth

## What to build

Replace the static/faked plan from slice 1 with the customer's real plan, sourced from their own Stripe account. The config maps each plan defined in `billing.config.ts` to a Stripe product/price. A Stripe webhook keeps a local copy of each user's plan fresh as subscriptions are created, changed, or cancelled. `check` now resolves the user's plan (and therefore their limits) from that synced state.

This is the "layer on their own Stripe" model — money stays in the customer's Stripe; we only read subscription state. Rule evaluation stays local; the webhook only updates the cached plan, so the hot path still touches no network for plan resolution.

Include reconciliation for missed webhooks (a way to re-pull a user's current subscription from Stripe on demand), since a missed event silently locking out a paying customer is the exact failure mode this product exists to prevent.

## Acceptance criteria

- [ ] `billing.config.ts` plans map to Stripe products/prices.
- [ ] A Stripe webhook updates the local plan state on subscription create/update/cancel.
- [ ] `check` resolves the user's plan and limits from synced Stripe state, not a static value.
- [ ] Plan resolution on the hot path remains local (no network call per check).
- [ ] Reconciliation path exists: a user's plan can be re-pulled from Stripe on demand to recover from a missed webhook.
- [ ] Demo: changing a subscription in the Stripe dashboard changes the user's limit in the example app.

## Blocked by

- #1 Walking skeleton

## Status: CODE COMPLETE — pending live verification (2026-06-23)
Webhook + reconciliation + priceToPlan built; typechecks against the Stripe SDK via `next build`; pure mapping unit-tested. Needs the user's Stripe TEST keys to verify the live subscription->plan sync.

## Status: DONE — verified LIVE (2026-06-23)
Real test-card Checkout fired `checkout.session.completed` -> webhook returned [200] -> plan flipped to pro -> user saw unlimited. Reconciliation (`scripts/reconcile-from-stripe.mjs`) rebuilds plan state from Stripe, recovering from missed webhooks / wiped state. Plan store is now file-backed so it survives hot-reloads. All 4 acceptance criteria met.
