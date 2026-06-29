# UX — implement "Halo" design: shadcn dashboard + re-skinned static landing/docs

> Implementation handoff. Decisions are locked (below) — this supersedes the
> "decisions to make" in [ux-design-system-and-polish.md](ux-design-system-and-polish.md).
> Build it; don't re-litigate the direction or the stack.

## Parent / source

- PRD: [PRD-hosted-platform.md](../PRD-hosted-platform.md) §9 + the §4 "the dashboard is how you demo" framing.
- **Design source of truth (Claude Design):** project **"Bismite Design System"**,
  `projectId 6954555b-5e63-4210-a6ab-3f27f80c4212`, file **`Bismite Directions.dc.html`**.
  Read it via the DesignSync MCP (auth: `/design-login`):
  `DesignSync method=get_file projectId=6954555b-5e63-4210-a6ab-3f27f80c4212 path="Bismite Directions.dc.html"`.
  It's a canvas-mode doc with two directions + three reference frames (style tile, landing
  hero, dashboard usage). **Build Direction A only.** The token spec below is transcribed
  from it so you don't strictly need the MCP, but open it for the exact layouts/spacing.

## Locked decisions

1. **Direction A — "Halo"** (warm · iridescent · generous). Not Direction B.
2. **Dashboard (`apps/dashboard`): adopt Tailwind CSS + shadcn/ui.** Use shadcn for the
   accessible interactive primitives; build the bespoke/branded pieces custom on top.
3. **Landing + docs stay static** (`examples/nextjs-chat/public/{landing,docs}.html`) — re-skin
   the existing inline styles to the Halo tokens. **No React, no build step** for them. Keep
   them "as static as possible." Share the palette with the dashboard via **CSS variables**
   (one documented token block, same hex values as the Tailwind theme).
4. Fonts via **`next/font`** (Google) in the dashboard, not CDN `<link>` (perf, no layout
   shift). Static pages may use the Google Fonts `<link>` they already use.

## Halo design tokens (the source of truth — mirror into the Tailwind theme AND the static-page CSS vars)

**Fonts:** Space Grotesk (300–700) for display/UI; JetBrains Mono (400–600) for code, API
keys, usage numbers, and labels/badges.

**Color:**
- bg `#0B0D12` · surface `#14161E` · surface-2 `#0E1017` · border `#242837` · border-soft `#1C2030` · input-border `#2C3140`
- text `#E9EAEE` · text-2 `#C7CAD3` · muted `#9298A8` / `#8A90A2` · faint `#6E7485`
- accent (iris) `#9B7CFF` · accent-hover `#AC92FF` · accent-tint `#B7A6FF`
- **iridescent gradient** `linear-gradient(135deg, #9B7CFF, #7CB5FF, #6EE0D0)` (110deg for the headline) — used on the logo, the "3 lines" headline, healthy meter fills, avatar
- accent ring `0 0 0 4px rgba(155,124,255,.18)` (hover) / `0 0 0 3px rgba(155,124,255,.2)` (input focus)
- halo glow `radial-gradient(50% 50% at 50% 50%, rgba(155,124,255,.16), transparent 70%)`
- semantic: success `#3ECF8E` · warning `#E8B339` (gradient w/ `#F0A33A`) · over-limit `#F2793D` (gradient w/ `#F0556A`) · danger `#F0556A`
- code syntax: keyword `#7C86A0` · ident `#9B7CFF` · method `#6EE0D0` · string `#3ECF8E` · number `#E8B339` · comment `#5B6171`

**Radius:** cards 16px · buttons/inputs 9px · code blocks 10px · meters 6px · pills 999px.
**Shadow:** card `0 28px 64px -30px rgba(0,0,0,.75)` + inset top highlight `inset 0 1px 0 rgba(255,255,255,.04)`.
**Motion:** `@keyframes meterIn { from { transform: scaleX(0) } to { transform: scaleX(1) } }`
(transform-origin:left, `cubic-bezier(.22,1,.36,1)`, ~.9s) for meter fills; button hover/ focus
transitions ~.18s. Keep motion purposeful; respect `prefers-reduced-motion`.

## Component plan

**Use shadcn (Radix a11y for free — closes the deferred #4 a11y gap):** Button, Input, Select,
Dialog (the key-reveal moment), Toast/Sonner (copy + action feedback), DropdownMenu (project /
account menu), Tooltip, Skeleton (loading), Badge, Tabs, Card. Theme them with the Halo tokens
so they inherit the look — don't ship shadcn's default slate look.

**Build bespoke (shadcn has no equivalent — this is the "not boring" work):** the iris gradient
**logo** (nested rounded squares, gradient stroke); the **usage Meter** (track + gradient fill
that changes by state healthy→approaching→over-limit, with the `meterIn` animation and a state
% label); the **gradient headline** + **halo glows**; the **key-reveal card**; the masked
**API-key field** with inline Copy + "Copied" confirm; the Test/Live **segmented toggle**.

## Surfaces & states to build

Wire the design onto the EXISTING functionality (#1–#6) — re-skin, don't rebuild logic or
re-fetch shapes. Build every state, not just the happy path.

- **Auth** — sign in / sign up. Invite-only: a non-allowlisted email shows the clear "not on
  the invite list yet" message (the better-auth 403 from the lockdown).
- **Projects list** — cards (name, id, key count) + prominent Create. **Empty state** = an
  inviting "create your first project" moment.
- **Key-reveal** (after create) — test + live keys shown ONCE, Copy + "Copied", "store it now"
  security warning, drop-in `bismiteCounter(process.env.BISMITE_API_KEY!)` snippet. Make it feel
  important/secure (Dialog).
- **Project detail:**
  - **Usage** — MTU + Calls meters vs the project's plan limit, with the **healthy /
    approaching / over-limit** visual states (the over-limit MTU card is the hero moment: orange→red
    gradient fill + glow + "upgrade" CTA + "new users may not be tracked until you upgrade" copy).
    MTU is headline; calls are the softer guardrail.
  - **Plan / billing** — current tier + allowances. **Wire to the existing #6 Stripe actions:**
    "Upgrade to Pro" → `checkoutAction`, "Manage billing" → `portalAction`, Enterprise = contact
    sales. 🔴 **Do NOT reintroduce a free plan dropdown** — #6 removed it on purpose (upgrades are
    Stripe-gated; see BACKLOG.md). The tier changes only via the Stripe webhook.
  - **API keys** — test + live, masked (`bsk_live_••••6035`), "last used", Regenerate with a
    confirm (it invalidates the old key).
  - **Quickstart** — the copy-paste snippet.
- **All states everywhere:** loading (Skeletons), empty, error, success toasts (copy / regenerate
  / upgrade-returned).
- **Landing + docs** — re-skin `public/landing.html` + `public/docs.html` to Halo tokens (hero +
  3-line code sample + 3 value props + waitlist; docs left-nav + code blocks). Static, shared CSS vars.

## Constraints (do not break)

- Preserve all security boundaries: `requireUser`, `ownedProject` IDOR gates, server-only
  `ADMIN_TOKEN`, keys shown once / never re-fetchable.
- Accessibility: AA contrast, visible focus, keyboard nav, labels, `prefers-reduced-motion`.
- Responsive (mobile → desktop).
- Don't regress the live deploys — dashboard build must pass (mind the `.npmrc`
  `legacy-peer-deps` already there for better-auth/drizzle).

## Acceptance criteria

- [ ] Tailwind + shadcn set up in `apps/dashboard`; Halo tokens drive the theme (one token source).
- [ ] All dashboard surfaces above rebuilt in Halo, across all states; a11y + responsive.
- [ ] Usage meters show healthy/approaching/over-limit states; over-limit surfaces the upgrade CTA wired to `checkoutAction`.
- [ ] No free plan dropdown — upgrade/downgrade go through Stripe (#6) only.
- [ ] `landing.html` + `docs.html` re-skinned to Halo, still static, sharing the same token values.
- [ ] Dashboard builds; existing flows (auth, create/regenerate, usage, checkout/portal) still work.
- [ ] Deployed; dashboard + marketing read as one polished product.

## Suggested phasing

1. Tailwind + shadcn install; Halo theme/tokens; fonts via next/font. Port the shared base components.
2. Bespoke components (logo, Meter, key field, key-reveal Dialog, toggle, gradient/halo bits).
3. Screens: auth → projects list (+empty) → key-reveal → project detail (usage/plan/keys/quickstart) → states.
4. Re-skin landing + docs to the shared tokens.
5. Verify (build, a11y pass, responsive, flows), then deploy.

## Blocked by

- None — all functionality (#1–#6) exists and is live. This is a pure presentation/polish layer on top.
