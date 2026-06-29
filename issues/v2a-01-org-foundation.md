# v2/A #1 — Org foundation: org plugin, schema & auto-personal-org

## Parent

[PRD-v2a-org-model.md](../PRD-v2a-org-model.md) — §3 (decisions), §4 (scope), §5 (technical approach).

## What to build

Stand up the org model underneath the existing better-auth setup so that every user belongs to an organization — without any org-facing UI yet. This is the foundation the billing and team slices sit on.

- Wire the **better-auth organization plugin** into `apps/dashboard/lib/auth.ts` — orgs, memberships, roles, invitations (plugin-managed `organization` / `member` / `invitation` tables).
- Define the three roles: `owner` (billing + delete + transfer), `admin` (manage keys + members), `member` (read usage + use keys).
- **Auto-create a personal org on signup**: a databaseHook alongside the existing `SIGNUP_ALLOWLIST` hook creates an org-of-one and makes the new user its `owner`. No personal-vs-team split-brain.

*Demo:* a fresh signup produces an `organization` row plus a `member` row linking the user as `owner` — verified by inspecting the DB or a script; no dashboard changes required.

## Acceptance criteria

- [ ] Organization plugin wired into `lib/auth.ts`; `organization` / `member` / `invitation` tables exist.
- [ ] Three roles defined with the documented permission split (owner / admin / member).
- [ ] Every new signup lands in an auto-created personal org as its `owner`.
- [ ] Existing auth flows (allowlist signup, login, password reset) still pass.

## Blocked by

- None — can start immediately.
