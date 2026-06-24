# 4. Counter hardening

## What to build

Make the hosted usage counter correct and production-trustworthy — this is the defensible core of the product, the part a dev can't cheaply hand-roll. Replace the naive counter from slice 1 with one that is:

- **Correct under concurrency** — simultaneous `record` calls for the same user/feature, across multiple app instances/regions, never lose or double-count.
- **Period-aware** — usage resets cleanly on the billing-period boundary (day/month/etc. per the feature's config).
- **Configurable degradation** — fail-open stays the default, but a feature can opt into `failClosed` (block when the counter is unreachable) for features that cost the developer a lot per call.

## Acceptance criteria

- [ ] Concurrent `record` calls for one user/feature produce an exact count (no lost/double increments) under load.
- [ ] Usage resets on the configured billing-period boundary.
- [ ] Per-feature `failClosed` opt-in works: such a feature blocks when the counter is unreachable, while default features still fail open.
- [ ] One runnable check hammers a single user concurrently and asserts the final count is exact.
- [ ] One runnable check proves period rollover resets usage.

## Blocked by

- #3 The upgrade loop

## Status: PARTIAL (2026-06-23)
DONE+tested: per-feature `failClosed` opt-in (SDK). BUILT (pending creds): `upstashCounter` (atomic INCRBY across instances, period-scoped keys + EXPIRE cleanup). Needs Upstash REST URL+token to verify cross-instance correctness under concurrency.

## Status: DONE — verified (2026-06-23)
Upstash counter: 200 concurrent record() -> exactly 200 (atomic INCRBY); period-scoped keys (reset on boundary); `failClosed` opt-in tested. Wired into the example (`bismite.config.ts` prefers Upstash when configured). Live app on Upstash: fresh free user 5x200 then 402. Proof: `scripts/hammer-upstash.ts`.
