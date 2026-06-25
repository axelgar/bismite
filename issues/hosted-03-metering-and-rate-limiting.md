# Hosted #3 — Metering (MTU + calls) & per-project rate limiting

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §6 (rate limiting), §8 (billing metrics).

## What to build

The measurement foundation for billing, plus the cost guardrail. Every counter request now also feeds the two billing metrics, and projects can't run up unbounded cost.

- **MTU**: on each `check`/`record`, add the `userId` to a per-project, per-month set (`proj_<id>:mtu:<YYYY-MM>` via `SADD`). MTU = set cardinality. Test-mode traffic is excluded.
- **Calls**: increment a per-project, per-month counter for billable calls. Test-mode excluded.
- **Rate limiting**: per-project request cap on the counter API (protects the shared Redis bill and enforces fair-use). Over the cap → 429. (First dogfood — Bismite metering Bismite.)
- A read path (`GET /v1/usage/summary` or similar) returns current-period MTU + calls for a project — consumed by the dashboard in #4.

*Demo:* drive traffic for a project across several `userId`s → MTU and calls reflect it; exceed the rate limit → 429; test-mode traffic doesn't move the billing numbers.

## Acceptance criteria

- [ ] MTU tracked per project/month (distinct `userId`s), readable.
- [ ] Billable calls tracked per project/month, readable.
- [ ] Test-mode traffic excluded from both metrics.
- [ ] Per-project rate limit enforced (429 over cap); limit configurable.
- [ ] A summary endpoint returns `{ mtu, calls, period }` for a project.
- [ ] Metric keys are period-scoped and expire on a sane boundary.

## Blocked by

- Hosted #2 (projects & keys).
