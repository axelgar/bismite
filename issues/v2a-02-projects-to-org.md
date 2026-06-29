# v2/A #2 — Re-home projects from owner to org + migrate existing

## Parent

[PRD-v2a-org-model.md](../PRD-v2a-org-model.md) — §4 (scope), §5 (technical approach), §6 (DoD).

## What to build

Move project ownership from a single user to an org, end-to-end through the counter control plane, the admin API, the dashboard queries, and a one-time migration of existing data.

- Counter control plane (`services/counter/src/schema.ts`): `projects.owner` (user id) → `projects.org_id`.
- `listProjects(owner)` → `listProjects(orgId)`; admin `GET /v1/projects?owner=` → `?org=`.
- Dashboard re-scopes "my projects" to "this org's projects": `requireUser()` (`lib/session.ts`) gains an active-org notion and passes the active `org_id` to the counter admin API. Authz (who-can-see-this-project) is enforced in the dashboard, which holds the better-auth session — the counter only needs `org_id` for billing attribution.
- **Migration** (one-time, idempotent): for each existing project, create a personal org owned by the current `owner`, set `org_id`, and re-point the dashboard. Neon-http has no transactions → idempotent upserts, run once, verify counts.

*Demo:* an existing single-owner project still appears for its owner, now scoped through their personal org; admin API lists projects by `?org=`; project counts before/after migration match.

## Acceptance criteria

- [ ] `projects.org_id` replaces `projects.owner`; counter resolves projects by org.
- [ ] Admin API filters by `?org=`; dashboard passes the active org's id.
- [ ] `requireUser()` exposes an active org; all "my projects" queries re-scope to it.
- [ ] Migration creates a personal org per existing owner and back-fills `org_id` with zero data loss; idempotent on re-run; counts verified.
- [ ] Usage/metering for migrated projects is unaffected.

## Blocked by

- v2/A #1 (org foundation — orgs/memberships must exist).
