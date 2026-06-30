# PHASE2 — Observability (deferred options)

> Companion to [PRD-v2c-observability.md](PRD-v2c-observability.md). Phase 1 ships daily
> snapshots, trend charts, and threshold email alerts. The options below were
> **explicitly deferred in the 2026-06-29 grill** — captured here so they aren't lost,
> not committed to. Each gets its own PRD if/when validated.

## 1. Customer-facing webhooks

Let a project register a URL and receive events (threshold crossed, usage rolled over,
key used in a new mode, etc.).

- **Why deferred:** delivery is a real system, not a feature — retries with backoff, a
  dead-letter path, HMAC signing + a published verification recipe, replay protection,
  and per-endpoint disable on repeated failure. That's a PRD on its own.
- **When to pick up:** customers ask to drive their own automation off usage, or support
  load from "did my limit get hit?" justifies push over the dashboard pull.
- **Sketch:** `webhook_endpoints(project_id, url, secret, enabled)` + an outbox table +
  a delivery worker. Sign with `X-Bismite-Signature: t=<ts>,v1=<hmac>`. Reuse the Phase-1
  threshold-crossing event as the first payload type.

## 2. Raw per-event log

Persist every check/record (project, user, feature, mode, timestamp) for per-event
drill-down and export, not just daily rollups.

- **Why deferred:** write amplification. The hot path is one Redis op today; logging every
  event doubles writes and adds unbounded storage growth that needs partitioning/TTL and a
  retention policy. The daily snapshot already answers "what's the trend?" — the raw log
  only answers "show me event #X", which nobody has asked for yet.
- **When to pick up:** a customer needs auditable, exportable per-event records (compliance,
  billing disputes), or debugging metering discrepancies requires event-level truth.
- **Sketch:** append-only `usage_events` to a cheaper store (object storage / ClickHouse /
  Tinybird), **not** the control-plane Postgres. Sample or TTL aggressively. Keep it off the
  synchronous hot path — fire-and-forget to a queue.

## 3. User-configurable alert thresholds

Phase 1 fixes thresholds at 80% / 100%. Let users set their own (e.g. alert at 50%, or add
a 120% overage warning).

- **Why deferred:** fixed 80/100 covers the conversion lever (the point of Phase 1) without
  any settings UI, storage, or validation. Configurability is polish, not the value.
- **When to pick up:** users ask for it, or different tiers want different alert behaviour.
- **Sketch:** `alert_thresholds(project_id, pct[])` defaulting to `[80,100]`; the alert cron
  reads it instead of the hardcoded list. De-dupe key already includes the threshold, so it
  generalises for free.

## 4. Additional alert channels

Phase 1 is email-only (via Resend). Deferred: Slack, generic webhook, in-app/dashboard
notifications, SMS.

- **Why deferred:** email reaches every org owner/admin with zero extra integration. More
  channels = per-channel auth, delivery, and config — and Slack specifically overlaps with
  the webhooks work in §1.
- **When to pick up:** teams ask to route alerts into their ops tooling. Build it on top of
  §1's delivery infrastructure rather than as a one-off Slack call.
