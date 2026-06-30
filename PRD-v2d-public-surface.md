# PRD — v2/D · Public surface & onboarding

> Status: Draft v0.1 · Owner: tech@studioapp.co · Date: 2026-06-29
> Source: v2 post-MVP grill (2026-06-29). Extends [PRD-hosted-platform.md](PRD-hosted-platform.md).
> **Mostly independent. The "open signup" step is gated on PRD-B + go-live (live Stripe + email-verify).**

---

## 1. One-liner

Give Bismite a public face worth landing on — a Resend-style landing with **per-framework integration examples** and a **public pricing section**, a docs link from the app, and a quickstart that actually shows real code — while keeping the door quietly gated until the product can enforce itself.

## 2. Problem

- The landing (`examples/nextjs-chat/public/landing.html`) is a **single generic code block** + a **waitlist form** posting to Upstash (`app/api/waitlist/route.ts`). No framework examples, no pricing shown — weak next to resend.com.
- The dashboard has **no docs link** anywhere (`components/top-bar.tsx` is logo + email + sign-out).
- The in-app quickstart (`app/dashboard/[projectId]/project-tabs.tsx:138`) is just an `.env` + config snippet — no App Router, Pages Router, or Vercel AI SDK examples.
- Signup is gated by `SIGNUP_ALLOWLIST` but the UI still frames things around "early access / waitlist."

## 3. Decisions (locked in the grill)

- **Rip out the waitlist** form + `/api/waitlist` route entirely.
- **Landing redo, Resend-style:** hero, value props, and **per-framework integration tabs** (e.g. Next.js App Router, Pages Router, Node/Express) showing the gate→meter pattern.
- **Public pricing section/page:** Free 1k · Pro €19 / 10k incl / €8-per-1k · Enterprise custom (numbers from PRD-B).
- **Keep `SIGNUP_ALLOWLIST` enforced** behind a clean "Sign up" CTA (no invite-only language, no waitlist). The page *looks* open; the allowlist gates server-side.
- **Flip to fully-open signup as the explicit final go-live step**, gated on: enforcement live (PRD-B) + live Stripe keys + `requireEmailVerification: true`.
- **Docs link** in the dashboard top bar.
- **Expanded in-app quickstart:** App Router + Pages Router + Vercel AI SDK examples.

## 4. Scope

**In:**
- Remove waitlist form from `landing.html` + delete `examples/nextjs-chat/app/api/waitlist/route.ts` + its Upstash dependency/reference (README line about the waitlist).
- New landing: hero + value props + **framework-tabbed code examples** + **public pricing** + "Sign up" / "Sign in" CTAs (to app.bismite.dev). Keep it static (current approach) unless tabs need JS — minimal interactivity only.
- Pricing surfaced both on the landing and (optionally) a `/pricing` route; numbers single-sourced where practical.
- Dashboard top bar: docs link → bismite.dev/docs.
- In-app quickstart tab expanded: App Router route handler, Pages Router API route, and a Vercel AI SDK example (gate→`streamText`→meter tokens), reusing the patterns already in `QUICKSTART.md`.
- A short **go-live checklist** doc capturing the "open signup" gate (enforcement + live Stripe + email-verify) so it's an explicit step, not an accident.

**Out:**
- Org/teams UI → PRD-A (the members/invite surface lives there; this PRD is the *public* + onboarding surface).
- Enforcement/pricing logic → PRD-B (this PRD only *displays* the prices).
- Charts/alerts → PRD-C.

## 5. Technical approach

- **Landing** stays a static page served by the example (`examples/nextjs-chat`, rewrite `/` → `landing.html` already in `next.config.mjs`). Framework tabs = minimal vanilla JS toggle (no framework) to honor the static approach; reuse Halo design tokens already in the landing.
- **Pricing numbers** come from PRD-B's `plans.ts` conceptually, but the landing is static HTML — hardcode the display values with a comment pointing at `plans.ts` as source of truth (don't over-engineer a build step; ponytail).
- **Quickstart examples** mirror `QUICKSTART.md` (already hosted-first) but rendered in-app; the AI SDK example shows `check` → `streamText` → `record({ tokens })`.
- **Allowlist stays** exactly as-is (`apps/dashboard/lib/auth.ts` databaseHook) — only the *framing* changes (no waitlist copy). The go-live flip is just: clear `SIGNUP_ALLOWLIST` + set `requireEmailVerification: true` + swap live Stripe keys.

## 6. Definition of done

- [ ] Waitlist form gone; `/api/waitlist` route deleted; no Upstash waitlist reference remains.
- [ ] Landing shows framework-tabbed integration examples + a public pricing section with the PRD-B numbers.
- [ ] "Sign up" CTA leads to app.bismite.dev; signup still gated by `SIGNUP_ALLOWLIST` (verified: a non-allowlisted email is refused cleanly, no waitlist copy).
- [ ] Dashboard top bar links to the docs.
- [ ] In-app quickstart shows App Router + Pages Router + Vercel AI SDK examples that match the SDK API.
- [ ] Go-live checklist doc exists (open-signup gate: enforcement + live Stripe + email-verify).

## 7. Dependencies

- **Soft on PRD-B** for final pricing numbers (display only). The "open signup" go-live step is **hard-gated** on PRD-B + live Stripe + email-verify, but the landing/docs/quickstart work ships independently before that.

## 8. Open questions for refinement

- **Separate `/pricing` route vs a section on the landing?** Recommend a section first (less surface); promote to a page if it grows.
- **Which frameworks in the tabs?** Recommend Next.js App Router (primary), Pages Router, and one non-Next (Node/Express) to signal framework-agnostic. Confirm the set.
- Should the landing move out of `examples/nextjs-chat` into its own deploy eventually? Out of scope now (bismite.dev already serves it).

## 9. Suggested issue slices (for `/to-issues`)

1. Remove waitlist form + `/api/waitlist` route + Upstash reference.
2. Landing redo: hero + value props + framework-tabbed examples.
3. Public pricing section (PRD-B numbers, single-source comment).
4. Dashboard top-bar docs link.
5. Expanded in-app quickstart (App Router + Pages Router + AI SDK).
6. Go-live checklist doc (open-signup gate).
