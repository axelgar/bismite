# Backlog — deferred improvements

Things we deliberately chose **not** to do yet, with the trigger for revisiting.
Deferred ≠ forgotten. Each is isolated (mostly behind the counter's `Store` seam),
so waiting costs little. Newest first.

## Security / billing

### ✅ #6 — plan upgrades gated behind Stripe (DONE in working tree, pending go-live config)
- **Done:** the free self-serve `setPlanAction` is gone. Plan is now flipped **only** by
  the signature-verified Stripe webhook (`app/api/stripe/webhook`). Free→Pro via Checkout
  (`checkoutAction`), Pro→Free via the Customer Portal cancel (`portalAction`). Enterprise
  is "contact sales" (custom, per PRD §8). Counter stores `stripe_customer_id` and exposes
  `POST /v1/projects/billing` (admin) for the webhook; `setPlan` stays a manual/seed lever.
- **Stripe (TEST mode, acct `acct_1TlOH7PRWiCu5oTF`):** product `Bismite Pro`
  (`prod_UmGXtJoPy3UkJf`), price `price_1Tmi0EPRWiCu5oTFcADiXJdN` — **placeholder €49/mo,
  replace after price validation** (PRD §8: "do not anchor low"; make a new price, update
  `STRIPE_PRICE_PRO`).
- **Before opening signup / removing `SIGNUP_ALLOWLIST`, finish go-live:**
  1. Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (and `STRIPE_PRICE_PRO`) in the
     dashboard's Vercel env (live keys in prod), redeploy.
  2. Register the prod webhook endpoint (`https://app.bismite.dev/api/stripe/webhook`) in
     Stripe for `checkout.session.completed`, `customer.subscription.deleted|updated`.
  3. Validate the Pro price and swap the placeholder.
- **Where:** `apps/dashboard/lib/stripe.ts`, `app/dashboard/actions.ts`,
  `app/api/stripe/webhook/route.ts`, `app/dashboard/[projectId]/plan-select.tsx`;
  counter `src/{schema,db,core}.ts` + `drizzle/0002_left_brood.sql`.

## Hosted counter — performance & scale

### Batch metering Redis ops into one pipeline (perf, hot path)
- **Now:** each metered counter op (check/record) runs several sequential Upstash
  REST round-trips — `SADD`+`EXPIRE` (MTU), `INCRBY`+`EXPIRE` (calls), plus the
  rate-limit `INCRBY`+`EXPIRE`. ~15 Redis commands per user message (check+record),
  vs ~3 before metering. The two MTU/calls writes are already `Promise.all`'d
  (`metering.ts`), but each command is still its own HTTP request.
- **Next:** send the ordered commands as a single Upstash `/pipeline` request →
  one round-trip instead of many. `EXPIRE … NX` would also stop re-setting the TTL
  on every write.
- **Why deferred:** cost is negligible at current scale (~$30/M messages) and the
  latency only matters under load we don't have yet. Pure speculation to build now.
- **Revisit when:** Upstash command count shows up on the bill, OR measured counter
  p50 latency becomes a concern.
- **Where:** `services/counter/src/core.ts` (`makeStore`), `metering.ts`.

### MTU via HyperLogLog instead of exact `SADD` set (scale, memory)
- **Now:** MTU is an exact `SADD`/`SCARD` set per project per month — accurate, but
  the set grows with distinct users.
- **Next:** swap to HyperLogLog (`PFADD`/`PFCOUNT`, ~12 KB flat regardless of
  cardinality) — one-file change behind the `Store` seam.
- **Why deferred:** MTU is what we **bill on**, and HLL is ~0.81% approximate.
  Exact is the right default until per-project memory actually hurts.
- **Revisit when:** a project crosses ~100K MTU/month AND approximate counting is
  acceptable for billing.
- **Where:** `services/counter/src/core.ts` (`makeStore`), `metering.ts`.
