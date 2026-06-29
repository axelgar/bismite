# v2/A #5 — Account settings: change password, sessions & profile

## Parent

[PRD-v2a-org-model.md](../PRD-v2a-org-model.md) — §3 (decisions), §4 (scope), §6 (DoD).

## What to build

An account settings page that closes the existing "change password while signed in" gap — `apps/dashboard/app/reset-password/page.tsx:4` promises it but it doesn't exist. These come ~free with better-auth and are independent of the org work.

- Profile: view/edit name and email.
- **Change password while authenticated** (current → new), distinct from the logged-out reset flow.
- Active sessions: list, revoke individual sessions, and "sign out everywhere".

*Demo:* a signed-in user changes their password, sees their active sessions, revokes one, and signs out of all other devices — all without leaving the dashboard.

## Acceptance criteria

- [ ] Account settings page exists with profile (name/email) editing.
- [ ] Authenticated user can change their password (current + new), separate from logged-out reset.
- [ ] Active sessions listed; individual revoke and sign-out-everywhere both work.
- [ ] The promise in `reset-password/page.tsx` resolves to a real in-app flow.

## Blocked by

- None — can start immediately (independent of the org model).
