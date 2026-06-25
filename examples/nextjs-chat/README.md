# Meter — Next.js chat example

The whole product in one route: gate a feature before the work, meter it after.

```bash
# from the monorepo root
pnpm install

# 1. start the hosted counter service (defaults to :4000)
pnpm counter

# 2. in another terminal, mint a project + API key, then set it
pnpm issue-key                       # prints a bsk_test_ key
export BISMITE_API_KEY=bsk_test_...  # paste the test key

# 3. run the example (reads BISMITE_API_KEY; unset = ungated/fail-open)
pnpm --filter nextjs-chat dev
```

Open http://localhost:3000. The free plan allows **5 messages/day**. Send 6 — the
6th returns `402` and the UI shows the upgrade prompt. Stop the counter and the
app keeps working (fail-open).

The interesting code is two calls in `app/api/chat/route.ts`:

```ts
const access = await bismite.check(userId, "chat-message");   // gate
// ... do the work ...
await bismite.record(userId, "chat-message", { count: 1 });   // meter
```

Plans live in `bismite.config.ts` (config-as-code). Plan resolution is faked for
now — issue #2 syncs the real plan from Stripe.
