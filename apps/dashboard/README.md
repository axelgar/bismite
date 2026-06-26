# Bismite dashboard (hosted #4)

The self-serve surface: sign up, create a project, copy your keys, watch MTU/calls climb.
A thin BFF over the counter control-plane API — it holds `ADMIN_TOKEN` server-side and
scopes every call to the logged-in user. better-auth owns auth; the counter owns
projects/keys/usage.

## Run the demo

```bash
# 1. Counter (control plane + metering). From repo root:
pnpm counter                     # :4000, PGlite + in-memory store, open issuance

# 2. Dashboard env
cd apps/dashboard
cp .env.example .env.local       # set DATABASE_URL (Postgres for better-auth) + BETTER_AUTH_SECRET
pnpm db:setup                    # create the better-auth tables (additive + idempotent)
pnpm dev                         # :3001
```

Then: sign up → create a project → copy the live key → paste it into `examples/nextjs-chat`'s
`BISMITE_API_KEY` → use the app → refresh the project's Usage view.

## Deploy (Vercel)

Separate Vercel project from the counter, same repo. No `vercel.json` — Vercel
auto-detects Next.js; the only non-default setting is the monorepo root.

1. **New project → Root Directory = `apps/dashboard`.** Vercel installs the pnpm
   workspace from the repo root and builds just this app.
2. **Set env vars in Vercel** (`vercel env add …` or the dashboard UI — never commit them):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Same Neon instance as the counter (auth tables live alongside `projects`/`api_keys`). |
   | `BETTER_AUTH_SECRET` | A **fresh** `openssl rand -base64 32` for prod (not your local one). |
   | `BETTER_AUTH_URL` | The deployed dashboard origin, e.g. `https://app.bismite.dev`. |
   | `BISMITE_API_URL` | The deployed counter, e.g. `https://api.bismite.dev`. |
   | `ADMIN_TOKEN` | **Must match the counter's** `ADMIN_TOKEN` (the BFF trust between them). |
   | `SIGNUP_ALLOWLIST` | Invite-only gate (non-secret): comma-separated emails / `@domain`. **Required in prod** or signup is open. e.g. `you@studioapp.co,@studioapp.co`. |

3. **Create the auth tables once** against the prod DB: `pnpm db:setup` (additive +
   idempotent — safe to re-run; never touches the counter's tables).

`auth-client.ts` infers its origin from the browser, so nothing is hardcoded to localhost.

## Notes

- **Auth**: email + password only for v1. GitHub social is a later add (needs OAuth creds).
- **Signup is invite-only** via `SIGNUP_ALLOWLIST` (`lib/auth.ts`). Sign-in is never gated.
  Email verification is a documented seam in `lib/auth.ts` for when you open signup up.
- **Plan limits** are placeholders (`lib/plans.ts`) — real Free/Pro/Enterprise + Stripe land in #5.
- `ADMIN_TOKEN` must match the counter's. Unset on both = open issuance (local dev only).
- Regenerate the auth schema after better-auth changes: `pnpm auth:generate`, then
  `pnpm db:generate` for the SQL and `pnpm db:setup` to apply it. We avoid `drizzle-kit
  push` on purpose: it only knows the auth schema, so against the shared counter DB it
  would offer to drop `projects`/`api_keys`.
