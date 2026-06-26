# Backlog — deferred improvements

Things we deliberately chose **not** to do yet, with the trigger for revisiting.
Deferred ≠ forgotten. Each is isolated (mostly behind the counter's `Store` seam),
so waiting costs little. Newest first.

## Security / billing

### 🔴 Plan upgrades are FREE self-serve until Stripe (#6) gates them
- **Now:** the dashboard's `PlanSelect` → `setPlanAction` lets any logged-in user set
  their project to Pro/Enterprise with **no payment**. It's the pre-Stripe manual tier
  lever (#5) and nullifies MTU enforcement with one click.
- **Why it's currently safe:** signup is **invite-only** (`SIGNUP_ALLOWLIST`), so only
  trusted beta users can reach it.
- **Must do before opening signup:** #6 gates *upgrades* behind Stripe Checkout
  (downgrades can stay free). Until then, do NOT remove the signup allowlist.
- **Where:** `apps/dashboard/app/dashboard/[projectId]/plan-select.tsx`,
  `apps/dashboard/app/dashboard/actions.ts` (`setPlanAction`, marked `TODO(#6)`).

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
