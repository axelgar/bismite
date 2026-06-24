# 3. The upgrade loop

## What to build

Close the revenue loop: when a user is over their limit, `check` returns a working `upgradeUrl` pointing at a Stripe Checkout session for the appropriate higher plan. Completing Checkout fires the webhook from slice 2, which flips the user's plan, and their entitlement updates immediately — no deploy, no manual step.

The example app surfaces this end to end: hitting the limit shows an upgrade prompt wired to `upgradeUrl`; after Checkout the user is unblocked on their next action.

This is the part that turns the SDK from a gate into a monetization machine. Keep it to the single pricing shape from slice 1 (per-feature usage limit per plan); other pricing models are out of scope.

## Acceptance criteria

- [ ] `check` returns a valid `upgradeUrl` (Stripe Checkout session) when a user is over limit.
- [ ] Completing Checkout flips the user's plan via the existing webhook.
- [ ] Entitlement updates immediately after upgrade with no deploy.
- [ ] Example app: limit reached → upgrade prompt → Checkout → unblocked.
- [ ] One runnable check proves the plan flip propagates to a subsequent `check`.

## Blocked by

- #2 Stripe as plan source of truth

## Status: CODE COMPLETE — pending live verification (2026-06-23)
Checkout route + upgradeUrl wired; typechecks via `next build`. Needs Stripe TEST keys to verify the live limit->checkout->unlock loop.
LIVE (2026-06-23): `/api/checkout` creates a real cs_test checkout session (303 -> checkout.stripe.com) with the real Pro price. Remaining: watch the plan flip after a real test-card payment (needs Stripe CLI webhook forwarding).

## Status: DONE — verified LIVE (2026-06-23)
Full loop confirmed: limit -> 402 -> upgrade prompt -> Stripe Checkout (test card 4242) -> webhook flips plan -> /api/chat unlimited. UI now plan-aware (shows "Pro — unlimited").
