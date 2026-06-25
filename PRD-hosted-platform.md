# PRD — Bismite Hosted Platform (managed counter + self-serve)

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-25
> Source: distilled from the hosted-platform grill (2026-06-25), after the first
> customer interviews. Extends the shipped SDK ([PRD.md](PRD.md)); does not replace it.

---

## 1. One-liner

**`npm install bismite`, get one API key, and the usage counter is handled.** No Redis to provision, no second vendor — the managed runtime that gates, meters, and monetizes any feature, hosted by us and still impossible to take your app down.

## 2. Problem (validated)

Bismite shipped as an SDK with a **bring-your-own-Upstash** counter. The first interviews loved the product but named one consistent friction:

> "It would be nice if everything was more plug-and-play — no separate Upstash account, something more integrated within the product itself."

The day-one experience today is: `npm install bismite` → *now go create an Upstash account, copy two secrets, wire them up, hope it's configured right.* That gap between install and working is where adoption leaks. The counter is also the part that genuinely needs real infra (atomic, correct under concurrency, cross-instance, period-scoped) — exactly the part a developer should not have to operate.

## 3. Target user

Unchanged from the SDK PRD: **self-serve AI app builders**, greenfield, usage-limits-are-existential. The hosted platform is what turns "I installed a clever library" into "I'm running on a product." The signup/using unit is the **individual developer**, bottom-up — not a team/org sale.

## 4. Vision & principles

- **The counter is the moat; hosting it is the product.** A BYO-Upstash SDK is a wrapper anyone can eat. A hosted runtime with a managed, correct counter is a defensible product — and it's the billable surface (BYO-Upstash had nowhere to charge).
- **Still never take your app down.** The hot path now depends on our uptime, but `check()` already **fails open** — counter unreachable ⇒ users pass. The promise survives the move to hosted infra.
- **No lock-in is a feature.** The `CounterClient` seam stays; "point it at your own Redis anytime" is a trust/sales argument, not a liability.
- **Buy what isn't the moat.** Auth and billing UI are bought (better-auth, Stripe-hosted). We build the counter service, metering, key auth, and the thin dashboard.

## 5. Product shape

```ts
// bismite.config.ts — the ONLY change from BYO is the counter line
import { Billing } from "bismite";
import { bismiteCounter } from "bismite/hosted";   // was: upstashCounter(url, token)

export const bismite = new Billing({
  plans,
  resolvePlan: (userId) => myDb.getPlan(userId),    // plan state stays in YOUR db (no vendor)
  counter: bismiteCounter(process.env.BISMITE_API_KEY!),
  upgradeUrl: (userId) => `/api/checkout?userId=${userId}`,
});
```

The SDK change is nearly free: `bismiteCounter(apiKey)` is the existing `httpCounter` pattern + an `Authorization: Bearer` header pointed at `api.bismite.dev`. Everything else (`check`/`record`, fail-open, plan rules) is unchanged.

## 6. Architecture

| Concern | Approach |
|---|---|
| Counter store | **One shared multi-tenant Redis** (Upstash internally, hidden). Keys namespaced `proj_<id>:<userId>:<feature>:<period>`. Values are non-sensitive integers ⇒ low blast radius; correct isolation via key prefix derived from the validated API key. |
| Control-plane store | **Postgres from day one** — `api_key → project`, project metadata, plan/usage config, billing linkage. Source of truth for keys; hot-path lookups cached (Redis/in-memory). |
| Counter API | `POST /v1/usage/increment`, `GET /v1/usage`, auth via `Authorization: Bearer bsk_…`. Resolves key → project → namespace → INCRBY/EXPIRE / GET. |
| Tenant isolation | Key-prefix namespacing in the shared store. No per-tenant database (that's the per-region margin trap). |
| Rate limiting | **Per-project, from day one** — protects our Upstash bill and enforces fair-use on the call guardrail. (First dogfood: Bismite metering Bismite.) |
| Multi-region (deferred) | When earned: stand up one more shared Redis in region B, route `region=B` projects there. Additive, not per-tenant. |
| Degradation | `check()` fails open if the hosted counter is unreachable. Per-feature `failClosed` opt-in unchanged. |

## 7. API keys & modes

- **One secret key per project, per mode.** Server-side only — no public/client key (Bismite runs on the backend hot path).
- **Test/live modes** — `bsk_test_…` / `bsk_live_…`. Test mode = isolated namespace that **does not count toward MTU/calls billing**. Build + CI without polluting usage or paying.
- **Hashed at rest** in Postgres, shown once on creation, **regenerate-to-rotate** (multi-active-key rotation deferred).
- `key → project` **cached off the hot path**; Postgres is the source of truth.

## 8. Our billing model

- **MTU (Monthly Tracked Users) = the headline price.** An MTU = any `userId` that appears in a `check`/`record` within the calendar month. Value-aligned (grows with the customer's business, like Schematic/Clerk/WorkOS), predictable, premium — **not** cost-plus on calls.
- **Calls = an included allowance + cost-covering overage**, acting as a **guardrail, not a second headline meter.** Normal apps never think about it; abnormally heavy usage pays a small overage. Calls map to our Upstash cost, so this is the lever that prevents margin-negative customers. **Overage priced ≥ ~€0.10 / 50k calls** (marginal cost is ~$0.06/50k, so this stays safely profitable).
- **Tiers: Free / Pro / Enterprise** (three, to start). Free = generous, to protect bottom-up adoption. Pro = flat €/mo + included MTU & call buckets + overage. Enterprise = custom — and the home of the deferred expensive features (multi-region, data isolation, SLA), so they get paid for exactly when needed. **A middle "Scale" tier is deferred** until usage data shows where customers cluster.
- **Exact numbers TBD via validation — do not anchor low** (€5 likely underprices a tool that monetizes someone's whole app).
- **v1 bills via Stripe directly.** Dogfooding Bismite-on-Bismite is a later milestone (avoids chicken-and-egg).

## 9. Dashboard (v1, minimal)

**Build (the moat):** counter service + Postgres + key auth + metering.
**Buy:**
- **Auth → better-auth** (open-source, free, lives in our Postgres). Chosen over Clerk because per-MAU pricing taxes a free-heavy bottom-up funnel; over building because auth is explicitly not our wedge. WorkOS AuthKit kept in reserve for Enterprise SSO.
- **Billing UI → Stripe Checkout** (upgrade) + **Stripe Customer Portal** (card, cancel, invoices). Two redirects; Stripe hosts the rest.

**Minimal UI surface:**
1. Sign in (better-auth).
2. Create project → reveal `bsk_test_`/`bsk_live_` keys (once) → regenerate.
3. **Usage view** — current MTU + calls this period vs plan limit. Delivers the founding observability promise; one chart + the numbers, no deep analytics.
4. Upgrade / manage billing (Stripe redirects).

## 10. v1 scope (ruthless)

**In:**
- Hosted counter service (shared multi-tenant Redis) + `POST /v1/usage/increment`, `GET /v1/usage`.
- Postgres control-plane: projects, API keys (hashed, test/live), usage/plan linkage.
- API-key auth + per-project rate limiting + key→project caching.
- MTU + call metering for billing; Free/Pro/Enterprise tiers; Stripe Checkout + Customer Portal.
- SDK `bismiteCounter(apiKey)` export.
- Minimal dashboard (better-auth + project/key mgmt + usage view).
- Docs/quickstart updated to lead with hosted; BYO kept as the documented escape hatch.

**Out (→ fast-follow / v2):**
- **Hosted plan state** (point your Stripe webhook at Bismite) — opt-in fast-follow; drags in storing the dev's Stripe creds + a plan-config surface.
- Multi-region / region selection.
- Teams, seats, member management.
- A middle "Scale" tier.
- Plan/price configuration UI; deep analytics/logs.
- Multi-active-key rotation.
- Dogfooded billing (Bismite-on-Bismite).

## 11. Business model recap

BYO-Upstash had no billing surface (the dev paid Upstash). The hosted counter **is** the surface: a free tier to drive bottom-up adoption, MTU-priced paid tiers that scale with the customer's success, and an Enterprise tier that funds the expensive infrastructure. This is "charge a SaaS fee for the tool," now made real — and it sets up the eventual merchant-of-record (% of GMV) move from the original vision.

## 12. Riskiest assumptions & validation

1. **Will developers trust us to host the counter on the hot path?** Mitigated by fail-open (we can't take them down) + BYO escape hatch (no lock-in). Validate by shipping hosted to the design partners who already use BYO and watching adoption.
2. **Is MTU the willingness-to-pay metric, and at what price?** Validate the *number* (not the axis) in the next round of conversations — explicitly probe what they'd pay per tracked user.
3. **Free-tier economics under abuse.** The call guardrail + per-project rate limiting are the defense; validate the free-tier call allowance against real usage shapes before opening signups widely.

## 13. Open questions (resolve before/while building)

- Postgres host (Vercel marketplace / Neon / Supabase) and schema for projects/keys/usage.
- Exact MTU counting mechanics (per-project monthly set: `SADD`; cost + reset semantics).
- API-key format details + hashing scheme; test/live namespace separation in the shared store.
- Free-tier limits (MTU + calls) and the Pro price point — from validation.
- Rate-limit thresholds per tier.
- Onboarding copy: how the dashboard hands off to the SDK (`BISMITE_API_KEY` → `bismiteCounter`).

## 14. Suggested milestones

1. **Counter service spike** — shared multi-tenant Redis + `/v1/usage/*` + API-key auth + namespacing + rate limiting. The hard, moat-y part first.
2. **Control plane** — Postgres schema + key issuance (hashed, test/live) + key→project cache.
3. **SDK `bismiteCounter`** — thin client over the seam; quickstart/docs lead with hosted.
4. **Metering for billing** — MTU + call counting, surfaced for the usage view.
5. **Dashboard** — better-auth + project/key mgmt + usage view + Stripe Checkout/Portal.
6. **Ship hosted to existing BYO design partners**, validate trust + the MTU price point.
