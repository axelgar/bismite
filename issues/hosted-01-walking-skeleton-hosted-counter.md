# Hosted #1 — Walking skeleton: hosted counter end-to-end

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §5, §6, §10.

## What to build

The thinnest end-to-end path that proves the moat: a deployed counter service the SDK talks to with an API key, backed by the shared multi-tenant Redis, so the existing example app gates and meters through *our* hosted counter instead of the developer's own Upstash.

- A counter service exposing `POST /v1/usage/increment` (`{ key, amount }`) and `GET /v1/usage?key=…`, authenticated by `Authorization: Bearer <api key>`.
- Requests are namespaced into the shared store as `proj_<id>:<key>` so one tenant can never read or write another's counts. Atomic `INCRBY` + `EXPIRE`; period-scoping stays in the SDK (unchanged).
- SDK gains a `bismiteCounter(apiKey, baseUrl?)` export — the existing `httpCounter` shape plus the auth header.
- For this slice only, the `api key → project` mapping is a single **seeded** value (env/config). No issuance, no Postgres yet — just enough to prove the path.

*Demo:* point the Next.js example's `bismite.config.ts` at `bismiteCounter(...)` against the deployed service; the free-tier limit still blocks at N and meters correctly. Fail-open still holds if the service is unreachable.

## Acceptance criteria

- [ ] `POST /v1/usage/increment` and `GET /v1/usage` deployed and reachable.
- [ ] Requests without a valid Bearer key are rejected (401); valid key resolves to its project namespace.
- [ ] Counts are namespaced by project — a key for project A cannot read/write project B's counters.
- [ ] `bismiteCounter(apiKey)` exported from the SDK, implementing `CounterClient`.
- [ ] Example app gates+meters through the hosted counter (5→block) with zero Upstash config.
- [ ] Counter unreachable ⇒ `check()` fails open (verified).

## Blocked by

None — can start immediately.
