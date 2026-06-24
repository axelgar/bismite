import assert from "node:assert/strict";
import { Billing } from "../packages/sdk/src/index.ts";
import { httpCounter } from "../packages/sdk/src/http-counter.ts";

const base = process.env.COUNTER_URL ?? "http://localhost:4000";
const billing = new Billing({
  plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
  resolvePlan: () => "free",
  counter: httpCounter(base),
  upgradeUrl: () => "/upgrade",
});

const user = `smoke-${process.pid}`;
for (let i = 0; i < 3; i++) {
  const c = await billing.check(user, "chat-message");
  assert.equal(c.allowed, true, `req ${i + 1} allowed`);
  await billing.record(user, "chat-message");
}
const blocked = await billing.check(user, "chat-message");
assert.equal(blocked.allowed, false, "4th blocked");
assert.equal(blocked.upgradeUrl, "/upgrade");
console.log("OK: real HTTP counter blocks the 4th request");

// Fail-open: point at a dead port.
const failopen = new Billing({
  plans: { free: { features: { "chat-message": { limit: 3, period: "day" } } } },
  resolvePlan: () => "free",
  counter: httpCounter("http://localhost:59999"),
});
const c = await failopen.check(user, "chat-message");
assert.equal(c.allowed, true, "fail-open when counter unreachable");
console.log("OK: fail-open when counter is unreachable");
