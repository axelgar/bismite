import assert from "node:assert/strict";
import { Billing } from "../packages/sdk/src/index.ts";
import { bismiteCounter } from "../packages/sdk/src/hosted.ts";

// Integration smoke for the hosted counter. Needs the counter service running
// with its default dev seed (bsk_test_dev=proj_dev, bsk_test_other=proj_other):
//   pnpm counter
const base = process.env.BISMITE_API_URL ?? "http://localhost:4000";
const billing = (apiKey: string) =>
  new Billing({
    plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
    resolvePlan: () => "free",
    counter: bismiteCounter(apiKey, base),
    upgradeUrl: () => "/upgrade",
  });

// 1) No bearer key => 401.
const noauth = await fetch(`${base}/v1/usage?key=x`);
assert.equal(noauth.status, 401, "missing key rejected");
console.log("OK: unauthenticated request rejected (401)");

// 2) Gate + meter through the hosted counter: blocks the 4th.
const a = billing("bsk_test_dev");
const user = `smoke-${process.pid}`;
for (let i = 0; i < 3; i++) {
  const c = await a.check(user, "chat-message");
  assert.equal(c.allowed, true, `req ${i + 1} allowed`);
  await a.record(user, "chat-message");
}
const blocked = await a.check(user, "chat-message");
assert.equal(blocked.allowed, false, "4th blocked");
assert.equal(blocked.upgradeUrl, "/upgrade");
console.log("OK: hosted counter blocks the 4th request");

// 3) Tenant isolation: a different project's key sees its own (zero) count for the
//    same user/feature — it cannot read project A's counters.
const b = billing("bsk_test_other");
const isolated = await b.check(user, "chat-message");
assert.equal(isolated.allowed, true, "project B isolated from project A's counts");
assert.equal(isolated.remaining, 3, "project B count untouched by project A");
console.log("OK: counts are namespaced per project");

// 3b) Bad input is rejected with 400, not a hung request or a 500.
const auth = { authorization: "Bearer bsk_test_dev" };
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

// 4) Fail-open: counter unreachable => check() never blocks.
const down = new Billing({
  plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
  resolvePlan: () => "free",
  counter: bismiteCounter("bsk_test_dev", "http://localhost:59999"),
});
const c = await down.check(user, "chat-message");
assert.equal(c.allowed, true, "fail-open when counter unreachable");
console.log("OK: fail-open when counter is unreachable");
