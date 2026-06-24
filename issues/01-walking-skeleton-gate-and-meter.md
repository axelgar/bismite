# 1. Walking skeleton: gate + meter one feature, end-to-end (no Stripe)

## What to build

The thinnest complete path through every layer, which also establishes the project skeleton. A monorepo holding three things: the SDK package, the hosted counter service, and a Next.js example app.

A developer defines a single feature with a per-period usage limit in `billing.config.ts` (e.g. `chat-message`, 20/day). The SDK exposes `check(userId, feature)` → `{ allowed, remaining, upgradeUrl }` (evaluates the limit locally against the config + a read from the hosted counter) and `record(userId, feature, usage)` (increments the hosted counter). The plan a user is on is **static/faked** at this stage — Stripe comes in slice 2.

Behaviour is **fail-open**: if the counter is unreachable, `check` returns `allowed: true`.

The Next.js example is a minimal chat endpoint that calls `check` before the (mocked or real) LLM call and `record` after. The UI shows remaining quota and blocks at the limit. This example *is* the demo and the validation artifact.

A naive counter is acceptable here — concurrency/period-reset correctness is slice 4.

## Acceptance criteria

- [x] Monorepo scaffolded: SDK package, counter service, Next.js example.
- [x] `billing.config.ts` defines one feature with a per-period limit, evaluated by the SDK.
- [x] `check(userId, feature)` returns `{ allowed, remaining, upgradeUrl }`.
- [x] `record(userId, feature, usage)` increments the hosted counter.
- [x] Next.js example gates before / records after on a chat endpoint, shows remaining, blocks at the limit. (Builds clean; route + page compile.)
- [x] Fail-open verified: with the counter unreachable, `check` returns `allowed: true` and the app keeps working.
- [x] One runnable check (test or self-check) proves: Nth request blocked, counter-down request allowed. (`pnpm test` — 4 unit tests; `scripts/smoke.ts` — real HTTP counter + fail-open.)

## Blocked by

- None — can start immediately

## Status: DONE (2026-06-23)

Verify with: `pnpm test` and `PORT=47821 node services/counter/src/index.ts & COUNTER_URL=http://localhost:47821 node scripts/smoke.ts`
