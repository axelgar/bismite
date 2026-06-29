# v2/A #4 — Team UX: org switcher, members page & invite→accept loop

## Parent

[PRD-v2a-org-model.md](../PRD-v2a-org-model.md) — §4 (scope), §6 (DoD).

## What to build

The full team experience, end-to-end: switch orgs, manage members, and invite a teammate by email who accepts and lands in the org with their role's permissions.

- **Org switcher** in the dashboard top bar (`apps/dashboard/components/top-bar.tsx`) — sets the active org that #2's queries scope to.
- **Members page**: list members; invite by email (plugin invitation + the existing Resend sender `apps/dashboard/lib/email.ts`); change a member's role; remove a member.
- **Accept-invite flow**: invitee clicks the emailed link, joins the org, and sees the org's projects. Handle the not-yet-registered-email case per §8 (create through invite vs. signup-first / allowlist interaction).
- **Role enforcement** in the dashboard: `member` can't manage keys/billing; `admin` can't delete the org or change billing; `owner` can.

*Demo:* an owner invites an email → invitee gets a Resend email → accepts → appears in the members list and sees the org's projects; a `member` is blocked from key/billing actions; switching orgs in the top bar swaps the visible projects.

## Acceptance criteria

- [ ] Org switcher in the top bar sets the active org and re-scopes visible projects.
- [ ] Members page lists members and supports invite-by-email, change-role, and remove.
- [ ] Invitee receives a Resend email, accepts, joins, and sees the org's projects.
- [ ] Roles enforced in the UI and API: member ≠ admin ≠ owner per the documented split.
- [ ] Not-yet-registered invitee path resolved (signup/allowlist interaction handled).

## Blocked by

- v2/A #1 (orgs, memberships, invitations).
- v2/A #2 (projects scoped to org so members see "the org's projects").
