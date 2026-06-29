# UX — design system + polish pass across all surfaces

> ✅ RESOLVED → the decisions below are settled and the actionable spec lives in
> [ux-implement-halo-dashboard.md](ux-implement-halo-dashboard.md): Direction A "Halo",
> Tailwind + shadcn for the dashboard, landing/docs stay static sharing CSS-var tokens.
> Keep this file for the problem framing/rationale; implement from the other one.

> Cross-cutting quality task, not part of the linear hosted #1–#7 chain. The product
> is functionally complete and live, but every surface was hand-rolled separately and
> reads as flat/static. This unifies and elevates the look & feel.

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §9 (dashboard) and the §4 "the
dashboard is how you demo" framing. This is the polish that makes the demo land.

## Problem

Three surfaces, three disconnected looks, all minimal:
- **Dashboard** (`apps/dashboard`): 48-line hand-rolled `globals.css`, **light** theme
  (indigo accent), no states (no empty/loading/error styling, static meters), no motion.
- **Landing** (`examples/nextjs-chat/public/landing.html`): **dark** theme, inline `<style>`.
- **Docs** (`examples/nextjs-chat/public/docs.html`): dark theme, separate inline `<style>`.

No shared tokens, inconsistent brand (light vs dark, different accents), and the dashboard
— the actual product surface an interviewer/user touches — feels like a prototype.

## What to build

A cohesive **design language** applied across surfaces, dashboard-first.

**1. Establish the system (tokens, once):** color (one brand + semantic states:
success/warning/over-limit/danger), type scale, spacing rhythm, radius, elevation/shadow,
motion (durations/easing), focus rings. One source of truth, reused by every surface.

**2. Dashboard — redesign every state, not just the happy path:**
- Sign-in, project list, project detail, key-reveal, plan select.
- **Real empty state** (no projects → inviting "create your first project" moment).
- **Loading + error states** (actions currently flip with no skeleton/spinner polish).
- **Usage meters that feel alive** — color by headroom (healthy → warning → over-limit),
  and surface the **over-limit / upgrade** affordance (the `overLimit` signal from #5 has
  no visual home yet).
- **The key-reveal moment** is the product's "aha" — make it feel important and secure
  (the once-only secret, copy affordance, the drop-in snippet).
- Micro-interactions: copy feedback, regenerate confirm, plan-change transition, button
  busy states.
- **Responsive / mobile** and **accessibility basics** (focus-visible, AA contrast,
  labels, keyboard nav).

**3. Align landing + docs** to the same tokens/brand so the whole product feels like one
thing (don't rebuild them — re-skin to the system).

## Decisions to make first (grill these before coding)

- **Approach:** extend hand-rolled CSS with a tokens file (lightest), vs adopt
  Tailwind + a headless component kit (e.g. shadcn/ui) for the dashboard, vs a tiny CSS
  framework. Trade DX/consistency against a new dependency — pick deliberately, don't
  default to a heavy kit for a handful of pages.
- **Brand direction:** unify on the dark theme (landing/docs already are) or a refined
  light dashboard + dark marketing? Pick one accent + voice.
- **Design-first?** Worth a quick exploration (Figma / design tooling / a couple of
  static mockups) to choose a direction before implementing, given it's subjective.

## Acceptance criteria

- [ ] Shared design tokens (color/type/space/radius/shadow/motion) as one source of truth.
- [ ] Dashboard redesigned across all states (list, detail, key-reveal, plan select,
      empty, loading, error, over-limit) — cohesive, responsive, AA-accessible.
- [ ] Usage meters show headroom state + an over-limit/upgrade affordance.
- [ ] Landing + docs re-skinned to the same system (one consistent brand).
- [ ] No heavy dependency added unless that approach was deliberately chosen above.
- [ ] Deployed; the live dashboard + marketing pages look like one polished product.

## Blocked by

- None functionally — all surfaces exist today.
- **Recommended sequencing: after #6 (Stripe).** #6 adds upgrade/billing-management
  screens; polishing now means re-polishing those when they land. Either wait for #6, or
  do the dashboard system now and fold #6's surfaces into it as they ship.
