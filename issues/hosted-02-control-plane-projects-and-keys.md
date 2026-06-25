# Hosted #2 — Control plane: projects & API-key lifecycle

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §6 (control-plane store), §7 (API keys & modes).

## What to build

Replace the seeded key from #1 with a real, persisted project + API-key model in Postgres, including test/live modes.

- Postgres schema: `projects` (id, name, owner, created_at) and `api_keys` (project_id, hashed_key, mode `test|live`, created_at, last_used_at).
- Key issuance mints a secret key shown **once**: `bsk_test_…` / `bsk_live_…`. Stored **hashed** (never plaintext); regenerate replaces it.
- The counter service resolves `Bearer` key → hash lookup → project + mode, **cached** off the hot path (Redis/in-memory) with Postgres as source of truth.
- Test mode writes to an **isolated namespace** (e.g. `proj_<id>:test:…`) so test traffic never mixes with or pollutes live counts.

*Demo:* create a project (API/seed script is fine — no UI yet), receive `bsk_test_`/`bsk_live_` keys, drive usage with each, and confirm test and live counters are separate.

## Acceptance criteria

- [ ] `projects` + `api_keys` tables exist; keys stored hashed.
- [ ] An endpoint/script creates a project and mints test + live keys, revealing the secret once.
- [ ] Counter service authenticates against issued keys (not the seed); unknown/revoked keys → 401.
- [ ] `key → project` resolution is cached; Postgres is the source of truth.
- [ ] Test-mode and live-mode usage land in separate namespaces (verified isolated).
- [ ] Regenerating a key invalidates the old one.

## Blocked by

- Hosted #1 (walking-skeleton hosted counter).
