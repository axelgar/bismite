# Go-live checklist — opening public signup

Today the public surface (landing, docs, in-app quickstart) is live, but **signup
is gated**: `SIGNUP_ALLOWLIST` lets only known emails/domains create accounts. The
landing reads as open ("Sign up" CTA, no waitlist) — the allowlist enforces
server-side. The page being open and signup being open are deliberately separate.

Opening signup is the **final, manual step**, and it's gated on three things being
true. Do them together — flipping one without the others ships a hole.

## Gates (all must be true before opening)

- [ ] **Enforcement is live (PRD-B).** The counter actually blocks Free past the
      limit and bills Pro overage on Stripe Meters. Verify a Free project is refused
      past 1,000 MTU and a Pro project records overage. Without this, an open signup
      hands out unmetered usage.
- [ ] **Live Stripe keys.** Swap `STRIPE_SECRET_KEY` / `STRIPE_PUBLIC_KEY` /
      `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET` from `sk_test_…` to live values
      (dashboard env). Re-create the webhook endpoint against live mode and confirm
      `checkout.session.completed` + `customer.subscription.*` reach
      `/api/stripe/webhook`. Run one real upgrade end-to-end.
- [ ] **Email verification on.** Set `requireEmailVerification: true` in
      `apps/dashboard/lib/auth.ts` (currently `false`). Requires the `bismite.dev`
      sender domain verified in Resend and a confirmed delivery test — otherwise new
      users can't verify and are locked out.

## The flip

Once the gates pass:

1. **Clear the allowlist** — unset `SIGNUP_ALLOWLIST` in the dashboard prod env
   (empty/unset ⇒ open, per `signupAllowed` in `apps/dashboard/lib/auth.ts`).
2. **`requireEmailVerification: true`** committed and deployed.
3. **Live Stripe keys** set in prod env.
4. Deploy (`vercel --prod`) and run prod DB migrations.
5. Smoke test from a fresh, non-allowlisted email: sign up → verify email → create
   project → upgrade through Checkout → confirm the plan flips.

## Rollback

Re-set `SIGNUP_ALLOWLIST` to lock signup again. Sign-IN is never gated, so existing
users keep working regardless.
