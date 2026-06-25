# Hosted #4 — Dashboard: auth + project/key management + usage view

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §9 (dashboard).

## What to build

The minimal self-serve surface that turns the API into a product a developer can onboard onto in the browser. Build only the moat-adjacent UI; buy auth.

- **Auth via better-auth** (lives in our Postgres). Sign up / sign in. Do not hand-roll auth.
- **Project & key management**: create a project, view it, reveal `bsk_test_`/`bsk_live_` keys **once** on creation, regenerate. Wires to the #2 issuance endpoints.
- **Usage view**: current-period **MTU + calls vs the plan limit** (one chart + the numbers), reading the #3 summary endpoint. This delivers the founding observability promise.
- **Onboarding handoff**: after creating a project, show the exact snippet — set `BISMITE_API_KEY`, use `bismiteCounter(process.env.BISMITE_API_KEY)`.

*Demo:* a new developer signs up in the browser, creates a project, copies a key, drops it into the example app, and watches their MTU/calls climb in the dashboard.

## Acceptance criteria

- [ ] Sign up / sign in works (better-auth), backed by Postgres.
- [ ] Authenticated user can create a project and see only their own projects.
- [ ] Test + live keys revealed once on creation; regenerate works.
- [ ] Usage view shows current MTU + calls against the plan limit.
- [ ] Onboarding shows the copy-paste `bismiteCounter` snippet with the project's key.

## Blocked by

- Hosted #3 (metering — needed for the usage view).
