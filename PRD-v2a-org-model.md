# PRD — v2/A · Org model & access

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-29
> Source: v2 post-MVP grill (2026-06-29). Extends [PRD-hosted-platform.md](PRD-hosted-platform.md).
> **Foundational PRD — B/C/D's billing surfaces sit on this. Do first.**

---

## 1. One-liner

**Everything is an org.** A project belongs to an organization, not a user; Stripe bills the org; teammates are invited into it. A solo dev silently gets an org-of-one, so "add a teammate" is the same code path on day one as on day one-thousand.

## 2. Problem

Today a project has a single `owner` string (the user id). There are no teams, no shared access, no invites — and **Stripe's customer is the user**. The user asked for "invite people to a team," but that requires an org model underneath everything first. Critically, moving the **Stripe customer from user → org is a nasty retrofit** once real subscriptions exist, so it must happen before paid scale (PRD-B).

## 3. Decisions (locked in the grill)

- **Adopt the better-auth organization plugin** — don't hand-roll orgs/memberships/roles/invitations. We're already on better-auth (`apps/dashboard/lib/auth.ts`).
- **Projects belong to an org** — `projects.owner` (string user id) → `projects.org_id`. Every "my projects" query re-scopes to "this org's projects".
- **Auto-create a personal org on signup** — no personal-vs-team split-brain. Solo dev = org of one.
- **Stripe customer = the org, not the user.** Plan, billing, overage all attach to `org_id`.
- **Three roles:** `owner` (billing + delete + transfer ownership), `admin` (manage keys + members), `member` (read usage + use keys). Invites via the plugin + the existing Resend sender (`apps/dashboard/lib/email.ts`).
- **Account settings + logged-in change-password** are in-scope here — they come ~free with better-auth and close the existing "change password while signed in" gap (`apps/dashboard/app/reset-password/page.tsx:4` promises it; it doesn't exist).

## 4. Scope

**In:**
- better-auth organization plugin wired (orgs, memberships, roles, invitations).
- Schema: `organization` + `member` + `invitation` tables (plugin-managed); `projects.owner` → `org_id` (`services/counter/src/schema.ts`).
- Auto-personal-org on signup (hook alongside the existing `SIGNUP_ALLOWLIST` databaseHook in `lib/auth.ts`).
- Org switcher in the dashboard top bar (`apps/dashboard/components/top-bar.tsx`).
- Members page: list members, invite by email, change role, remove. Accept-invite flow (email → join).
- Account settings page: profile (name/email), **change password while authenticated**, active sessions, sign out everywhere.
- Stripe customer linkage moves to org: `projects.stripe_customer_id` → an org-level `stripe_customer_id` (or an `organization.stripe_customer_id` column). Control-plane `setBilling` (`services/counter/src/db.ts`) keys off org.
- Migration of existing single-owner projects into an auto-created personal org per current owner.

**Out (other PRDs / deferred):**
- Enforcement, pricing, Stripe Meters → PRD-B.
- Per-seat billing (orgs are free; we bill usage, not seats — confirm in §8).
- SSO / SAML, SCIM, audit log of member actions.

## 5. Technical approach

- **Counter control plane** (`services/counter/src/`): `projects` table swaps `owner` for `org_id`; `listProjects(owner)` → `listProjects(orgId)`; admin `GET /v1/projects?owner=` → `?org=`. The counter doesn't need to know about members/roles — it only needs `org_id` on the project for billing attribution. Authz (who-can-see-this-project) is enforced in the dashboard, which already holds the better-auth session.
- **Dashboard** (`apps/dashboard/`): the org plugin gives `auth.api` helpers for orgs/invitations. `requireUser()` (`lib/session.ts`) gains an active-org notion; dashboard queries pass the active `org_id` to the counter admin API.
- **Stripe**: `stripe.customers.create` moves to org creation (lazily, on first checkout, as today) but stores the id on the org. PRD-B's webhook (`apps/dashboard/app/api/stripe/webhook/route.ts`) maps `metadata.orgId` instead of `projectId`.
- **Migration**: one-time — for each existing project, create a personal org owned by the current `owner`, set `org_id`, move any `stripe_customer_id` up to the org. Neon-http has no transactions (known constraint) → idempotent upserts, run once, verify counts.

## 6. Definition of done

- [ ] A new signup lands in an auto-created personal org; can create projects in it.
- [ ] Owner can invite by email; invitee receives a Resend email, accepts, and sees the org's projects with their role's permissions.
- [ ] Roles enforced: member can't manage keys/billing; admin can't delete the org or change billing; owner can.
- [ ] Stripe customer is created against the org; billing/plan attach to `org_id`.
- [ ] Logged-in user can change their password and view/revoke sessions from an account settings page.
- [ ] Existing projects migrated into personal orgs with no data loss; usage unaffected.

## 7. Dependencies

None — this is the base. **Blocks** PRD-B (org-billing) and the "members/teams" parts of PRD-D.

## 8. Open questions for refinement

- **Org-level Stripe column vs reuse `projects.stripe_customer_id`?** Lean: add `stripe_customer_id` to the org and deprecate it on project (a project's plan still lives on the project for per-project enforcement, but the *customer* is the org). Confirm whether plan is per-project or per-org — today plan is per-project (`projects.plan`); with org billing, is the subscription per-project or per-org? **Recommend: subscription per-org, plan per-project stays as the enforced tier** (an org can have several projects on different tiers under one customer). Validate in PRD-B refinement.
- **Are orgs free (we bill usage, not seats)?** Recommend yes — no per-seat pricing; keeps invites frictionless.
- Invite-acceptance for a not-yet-registered email: create account through invite vs require signup first (allowlist interaction).

## 9. Suggested issue slices (for `/to-issues`)

1. Wire better-auth org plugin + schema; auto-personal-org on signup (no UI yet).
2. `projects.owner` → `org_id` in counter control plane + admin API; migration of existing projects.
3. Stripe customer moves user → org (lazy create on first checkout; column on org).
4. Dashboard: org switcher + members page (invite / role / remove) + accept-invite flow.
5. Account settings page: change password + sessions + profile.
