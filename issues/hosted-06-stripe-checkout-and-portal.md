# Hosted #6 — Billing: Stripe Checkout + Customer Portal

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §8, §9 (billing UI bought from Stripe).

## What to build

Close the monetization loop: a Free-tier developer upgrades through Stripe and their project's tier flips automatically — no custom billing UI.

- **Stripe Checkout**: an "Upgrade to Pro" action in the dashboard creates a Checkout Session tied to the developer/project; on success the project's `plan` flips to `pro`.
- **Webhook**: Stripe events (`checkout.session.completed`, `customer.subscription.*`) update the project's tier in Postgres — paid ⇒ pro, canceled/lapsed ⇒ back to free. (Reuse the verified webhook pattern from the SDK example.)
- **Customer Portal**: a "Manage billing" link sends the developer to Stripe's hosted portal for card, cancel, and invoices.
- This bills **our own** Stripe (us charging developers) — distinct from the developer's Stripe in the SDK product. Dogfooding Bismite-on-Bismite stays out of scope.

*Demo:* a Free dev at their MTU limit clicks Upgrade → completes Stripe Checkout (test card) → webhook flips the project to Pro → the higher allowance takes effect live; "Manage billing" opens the portal.

## Acceptance criteria

- [ ] "Upgrade" creates a real Stripe Checkout Session for the project.
- [ ] Webhook (signature-verified) flips the project tier on completion and on subscription changes.
- [ ] Cancellation/lapse returns the project to Free.
- [ ] "Manage billing" opens the Stripe Customer Portal.
- [ ] End-to-end: limit hit → upgrade → allowance raised, no redeploy.

## Blocked by

- Hosted #5 (tiers & enforcement).
