# v2/A #3 — Stripe customer moves from user to org

## Parent

[PRD-v2a-org-model.md](../PRD-v2a-org-model.md) — §4 (scope), §5 (technical approach), §8 (open questions).

## What to build

Make the **org** the Stripe customer, so the user→org customer retrofit lands before paid scale (PRD-B). Subscription is per-org; plan stays per-project as the enforced tier (per §8 recommendation).

- Add `stripe_customer_id` to the org (control-plane `setBilling` in `services/counter/src/db.ts` keys off org instead of project).
- `stripe.customers.create` happens lazily on first checkout (as today) but stores the id on the org.
- PRD-B's webhook (`apps/dashboard/app/api/stripe/webhook/route.ts`) maps `metadata.orgId` instead of `projectId`.
- Migration: move any existing `projects.stripe_customer_id` up to the owning org (folds into / follows the #2 migration).

*Demo:* first checkout for an org creates a Stripe customer recorded on the org row; a second project in the same org reuses that customer; webhook updates resolve via `orgId`.

## Acceptance criteria

- [ ] Org carries `stripe_customer_id`; `setBilling` attributes billing to `org_id`.
- [ ] Customer is lazily created on first checkout and stored on the org (not the project).
- [ ] A second project under the same org reuses the org's customer.
- [ ] Webhook resolves customers/subscriptions via `metadata.orgId`.
- [ ] Existing project-level `stripe_customer_id` values migrated up to their org.

## Blocked by

- v2/A #1 (orgs must exist).
- v2/A #2 (projects carry `org_id`; shares the migration path).
