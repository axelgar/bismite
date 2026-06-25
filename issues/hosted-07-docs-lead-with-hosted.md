# Hosted #7 — Docs & quickstart lead with hosted

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §4, §10 (BYO as escape hatch).

## What to build

Make hosted the obvious default path everywhere, and reframe BYO-Upstash as the documented-but-not-default escape hatch.

- **QUICKSTART.md / README / docs.html**: the primary path is `npm install bismite` → get an API key from the dashboard → `bismiteCounter(process.env.BISMITE_API_KEY)`. The Upstash/`upstashCounter` path moves to an "advanced / self-host — you're never locked in" section.
- **Onboarding handoff** documented end-to-end: dashboard sign-up → create project → copy key → run, mirroring the in-app snippet from #4.
- Landing page nav/CTA points at hosted signup.
- Keep the BYO content accurate (it still works) but secondary.

*Demo:* a brand-new developer follows the hosted quickstart top-to-bottom and is gating+metering in minutes without provisioning any infra.

## Acceptance criteria

- [ ] QUICKSTART, README, and docs.html lead with the hosted `bismiteCounter` path.
- [ ] BYO-Upstash is present but clearly the "self-host / no-lock-in" secondary option.
- [ ] The dashboard → `BISMITE_API_KEY` → `bismiteCounter` handoff is documented as one continuous flow.
- [ ] Landing CTA points at hosted signup.
- [ ] No doc instructs a new user to create an Upstash account on the default path.

## Blocked by

- Hosted #4 (dashboard — the onboarding handoff and signup must exist). Can run alongside #5/#6.
