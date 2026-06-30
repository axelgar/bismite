# PRD — v2/C · Observability (Phase 1)

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-29
> Source: v2 post-MVP grill (2026-06-29). Extends [PRD-hosted-platform.md](PRD-hosted-platform.md).
> **Best after [PRD-v2b](PRD-v2b-enforcement-pricing.md) so snapshots reflect the final meter semantics. Otherwise independent.**

---

## 1. One-liner

Turn two point-in-time numbers into a product that *feels* like PlanetScale: **usage-over-time charts + threshold email alerts** — the latter doubling as a conversion lever ("you're at 80% of Free → upgrade").

## 2. Problem

The dashboard shows MTU and calls as **current aggregate numbers only** (`apps/dashboard/components/meter.tsx`, fed by `usageSummary(projectId)`). There's no history, no trend, no alerting, no event visibility. That's the gap between "it works" and "this feels premium." Redis only holds the *current* period count, so there is nothing to chart yet — history has to be persisted.

## 3. Decisions (locked in the grill)

- **Phase 1 only:** usage-over-time charts + threshold email alerts.
- **Phase 2 deferred** (own future PRD): customer-facing webhooks, raw per-event log. Capture options in a log file (`PHASE2-observability.md`) so they aren't lost.

## 4. Scope

**In:**
- **Daily snapshots** of each project's MTU + calls persisted to Postgres (the control-plane DB), so trend is queryable.
- **Charts** in the dashboard project view: MTU and calls over time (period-to-date + trailing history).
- **Threshold email alerts:** a daily cron evaluates each project against its tier; at 80% (and 100%) of the Free MTU ceiling / Pro included, send a Resend email with an upgrade CTA. De-dupe so a project isn't emailed every day at the same threshold.
- `PHASE2-observability.md` written, listing the deferred options + rationale.

**Out (Phase 2 / other PRDs):**
- Customer-facing webhooks (delivery, retries, signing) — Phase 2.
- Raw event log of every check/record (write amplification, storage) — Phase 2.
- The alert *thresholds being user-configurable* — start fixed at 80/100%.

## 5. Technical approach

- **Snapshots:** a daily cron (Vercel cron) reads the authoritative per-project MTU/calls from the counter (`GET /v1/usage/summary?projectId=` already exists, `core.ts:151`) and writes a `usage_snapshots(project_id, date, mtu, calls)` row. Idempotent upsert on `(project_id, date)` (neon-http: no transactions). Cheap: one row per project per day.
- **Charts:** read snapshots for the project; render with a lightweight chart (the dashboard is already Tailwind v4 + shadcn — use a small charting primitive, no heavy dep). Period boundaries align with the billing period the meter already uses.
- **Alerts:** the same (or a second) daily cron compares snapshot vs tier ceiling (`plans.ts` / PRD-B); on first crossing of a threshold this period, send via the existing Resend sender (`apps/dashboard/lib/email.ts`, `emailHtml()` helper). Track "last alerted threshold per project per period" to de-dupe. Alert recipients = org owners/admins (PRD-A).
- **Reuse, don't rebuild:** the counter summary endpoint and Resend wiring already exist; this PRD is mostly persistence + a cron + a chart + an email template.

## 6. Definition of done

- [ ] Each project accrues a daily MTU/calls snapshot row; backfill not required (history starts now).
- [ ] Project view shows MTU and calls trend charts over the available history.
- [ ] A project crossing 80% of its MTU ceiling gets exactly one threshold email that period, with a working upgrade link; crossing 100% gets one more.
- [ ] Alerts go to org owners/admins; respect a project with no over-threshold usage (no email).
- [ ] `PHASE2-observability.md` exists with the deferred webhook + event-log options.

## 7. Dependencies

- Soft on **PRD-B** (so ceilings/tiers the alerts compare against are final) and **PRD-A** (alert recipients = org members). Can be built against current values and re-pointed.

## 8. Open questions for refinement

- **Snapshot granularity:** daily is the Phase-1 call. Hourly gives prettier charts but 24× the rows — defer unless charts look too coarse.
- **Chart library vs hand-rolled SVG** for two simple line charts — lean minimal (ponytail), add a lib only if it doesn't fit.
- Alert channel: email only for Phase 1 (Slack/webhook = Phase 2).

## 9. Suggested issue slices (for `/to-issues`)

1. `usage_snapshots` table + daily snapshot cron (no UI).
2. Trend charts (MTU + calls) in the project view.
3. Threshold alert cron + email template + per-period de-dupe.
4. `PHASE2-observability.md` options log.
