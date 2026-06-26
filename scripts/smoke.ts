import assert from "node:assert/strict";
import { Billing } from "../packages/sdk/src/index.ts";
import { bismiteCounter } from "../packages/sdk/src/hosted.ts";

// Integration smoke for the hosted counter + control plane (hosted #2). Needs the
// counter service running (no DATABASE_URL => PGlite; no seed key anymore):
//   pnpm counter
const base = process.env.BISMITE_API_URL ?? "http://localhost:4000";
const admin = process.env.ADMIN_TOKEN ? { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } : {};
const billing = (apiKey: string) =>
  new Billing({
    plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
    resolvePlan: () => "free",
    counter: bismiteCounter(apiKey, base),
    upgradeUrl: () => "/upgrade",
  });

// 0) Mint a real project + keys via the issuance endpoint (replaces the seed).
const mint = await fetch(`${base}/v1/projects`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ name: "smoke", owner: "ci" }),
});
assert.equal(mint.status, 200, "project minted");
const { test: testKey, live: liveKey, projectId } = (await mint.json()) as {
  test: string;
  live: string;
  projectId: string;
};
assert.match(testKey, /^bsk_test_/);
assert.match(liveKey, /^bsk_live_/);
console.log("OK: minted project + test/live keys (secrets shown once)");

// 1) No bearer key => 401; an unknown key => 401.
assert.equal((await fetch(`${base}/v1/usage?key=x`)).status, 401, "missing key rejected");
const bad = await fetch(`${base}/v1/usage?key=x`, { headers: { authorization: "Bearer bsk_test_nope" } });
assert.equal(bad.status, 401, "unknown key rejected");
console.log("OK: unauthenticated / unknown-key requests rejected (401)");

// 2) Gate + meter through the hosted counter with the live key: blocks the 4th.
const live = billing(liveKey);
const user = `smoke-${process.pid}`;
for (let i = 0; i < 3; i++) {
  const c = await live.check(user, "chat-message");
  assert.equal(c.allowed, true, `req ${i + 1} allowed`);
  await live.record(user, "chat-message");
}
const blocked = await live.check(user, "chat-message");
assert.equal(blocked.allowed, false, "4th blocked");
assert.equal(blocked.upgradeUrl, "/upgrade");
console.log("OK: hosted counter blocks the 4th request");

// 3) Mode isolation: the SAME project's test key sees its own (zero) count for the
//    same user/feature — test traffic never mixes with live counts.
const test = billing(testKey);
const isolated = await test.check(user, "chat-message");
assert.equal(isolated.allowed, true, "test mode isolated from live counts");
assert.equal(isolated.remaining, 3, "test count untouched by live usage");
console.log("OK: test-mode and live-mode usage land in separate namespaces");

// 3b) Tenant isolation: a second project cannot see the first project's counts.
const mint2 = await fetch(`${base}/v1/projects`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ name: "smoke2", owner: "ci" }),
});
const other = billing(((await mint2.json()) as { live: string }).live);
const otherView = await other.check(user, "chat-message");
assert.equal(otherView.remaining, 3, "project B isolated from project A's counts");
console.log("OK: counts are namespaced per project");

// 3c) Bad input is rejected with 400, not a hung request or a 500.
const auth = { authorization: `Bearer ${liveKey}` };
const missingKey = await fetch(`${base}/v1/usage/increment`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ amount: 1 }),
});
assert.equal(missingKey.status, 400, "missing key => 400");
const badJson = await fetch(`${base}/v1/usage/increment`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: "{not json",
});
assert.equal(badJson.status, 400, "invalid json => 400");
const noQueryKey = await fetch(`${base}/v1/usage`, { headers: auth });
assert.equal(noQueryKey.status, 400, "missing query key => 400");
console.log("OK: malformed requests rejected (400), handler never hangs");

// 4) Regenerate invalidates the old key (acceptance: regenerate-to-rotate).
const regen = await fetch(`${base}/v1/keys/regenerate`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ projectId, mode: "live" }),
});
assert.equal(regen.status, 200, "regenerate ok");
const { key: newLive } = (await regen.json()) as { key: string };
assert.notEqual(newLive, liveKey, "new key differs");
// Old key may linger up to the resolver cache TTL on the instance that served it.
await new Promise((r) => setTimeout(r, 100));
const oldKeyResp = await fetch(`${base}/v1/usage?key=x`, { headers: { authorization: `Bearer ${liveKey}` } });
assert.equal(oldKeyResp.status, 401, "old key no longer resolves");
const newKeyResp = await fetch(`${base}/v1/usage?key=${user}`, { headers: { authorization: `Bearer ${newLive}` } });
assert.equal(newKeyResp.status, 200, "new key resolves");
console.log("OK: regenerating a key invalidates the old one");

// 6) Metering (hosted #3): MTU = distinct users, calls = billable ops, test-mode
//    excluded. Fresh project so the numbers are exactly what this section drives.
const m3 = await fetch(`${base}/v1/projects`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ name: "smoke-meter", owner: "ci" }),
});
const { test: m3Test, live: m3Live } = (await m3.json()) as { test: string; live: string };
const m3LiveBilling = billing(m3Live);
const m3TestBilling = billing(m3Test);
// Two distinct live users, each: 1 check (read) + 1 record (increment) = 2 metered calls.
for (const u of ["meter-a", "meter-b"]) {
  await m3LiveBilling.check(u, "chat-message");
  await m3LiveBilling.record(u, "chat-message");
}
// Test-mode user must NOT move either metric.
await m3TestBilling.check("meter-c", "chat-message");
await m3TestBilling.record("meter-c", "chat-message");

const now = new Date();
const expectedPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const sumResp = await fetch(`${base}/v1/usage/summary`, { headers: { authorization: `Bearer ${m3Live}` } });
assert.equal(sumResp.status, 200, "summary ok");
const sum = (await sumResp.json()) as { mtu: number; calls: number; period: string };
assert.equal(sum.mtu, 2, "MTU = 2 distinct live users (test user excluded)");
assert.equal(sum.calls, 4, "calls = 2 users x (1 check + 1 record); test traffic excluded");
assert.equal(sum.period, expectedPeriod, "summary scoped to the current UTC month");
console.log("OK: /v1/usage/summary reports MTU + calls; test-mode excluded from billing");

// 7) Per-project rate limit (hosted #3): over the cap => 429. Only asserted when the
//    server is started with a small cap AND smoke is told the same value, e.g.:
//    RATE_LIMIT_PER_MIN=20 pnpm counter   &&   RATE_LIMIT_PER_MIN=20 pnpm smoke
const rlCap = Number(process.env.RATE_LIMIT_PER_MIN ?? 0);
if (rlCap > 0 && rlCap <= 100) {
  const m4 = await fetch(`${base}/v1/projects`, {
    method: "POST",
    headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ name: "smoke-ratelimit", owner: "ci" }),
  });
  const rlAuth = { authorization: `Bearer ${((await m4.json()) as { live: string }).live}` };
  const hit = () =>
    fetch(`${base}/v1/usage?key=rl`, { headers: rlAuth }).then((r) => r.status);
  // Burst well past the cap (2x + slack) so a per-minute boundary roll still overflows.
  const codes = await Promise.all(Array.from({ length: rlCap * 2 + 5 }, hit));
  // Concurrent burst: assert on aggregate, not order (index != arrival order).
  assert.ok(codes.includes(200), "requests under the cap succeed");
  assert.ok(codes.includes(429), "rate limit trips with 429 once the cap is exceeded");
  assert.ok(codes.filter((c) => c === 200).length <= rlCap, "successes never exceed the cap");
  console.log(`OK: per-project rate limit enforced (cap=${rlCap}/min, 429 over cap)`);
} else {
  console.log("SKIP: rate-limit 429 check (set RATE_LIMIT_PER_MIN<=100 on server + smoke to run it)");
}

// 8) Tiers (hosted #5): the plan endpoint flips a project's tier, and metered counter
//    ops carry the `overLimit` wire field. Well under any tier MTU => false (crossing the
//    real Free MTU needs >1000 users; the unit tests cover the over-the-limit branch).
const m5 = await fetch(`${base}/v1/projects`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ name: "smoke-tier", owner: "ci" }),
});
const { live: m5Live, projectId: m5Id } = (await m5.json()) as { live: string; projectId: string };

assert.equal((await fetch(`${base}/v1/projects/plan`, {
  method: "POST",
  headers: { "content-type": "application/json" }, // no admin token
  body: JSON.stringify({ projectId: m5Id, plan: "pro" }),
})).status, process.env.ADMIN_TOKEN ? 401 : 200, "plan flip is admin-guarded");

const setPro = await fetch(`${base}/v1/projects/plan`, {
  method: "POST",
  headers: { ...admin, "content-type": "application/json" },
  body: JSON.stringify({ projectId: m5Id, plan: "pro" }),
});
assert.equal(setPro.status, 200, "plan set to pro");

const op = await fetch(`${base}/v1/usage/increment`, {
  method: "POST",
  headers: { authorization: `Bearer ${m5Live}`, "content-type": "application/json" },
  body: JSON.stringify({ key: "tier-u", amount: 1 }),
});
const opBody = (await op.json()) as { used: number; overLimit: boolean };
assert.equal(opBody.overLimit, false, "well under the tier MTU => no over-limit signal");
console.log("OK: tier plan endpoint flips the tier; counter op carries overLimit");

// 5) Fail-open: counter unreachable => check() never blocks.
const down = new Billing({
  plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
  resolvePlan: () => "free",
  counter: bismiteCounter(liveKey, "http://localhost:59999"),
});
assert.equal((await down.check(user, "chat-message")).allowed, true, "fail-open when counter unreachable");
console.log("OK: fail-open when counter is unreachable");
