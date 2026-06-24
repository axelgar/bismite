import { test } from "node:test";
import assert from "node:assert/strict";
import { Billing, periodKey, type CounterClient } from "../src/index.ts";

function memCounter(): CounterClient {
  const m = new Map<string, number>();
  return {
    async read(k) { return m.get(k) ?? 0; },
    async increment(k, a) { m.set(k, (m.get(k) ?? 0) + a); },
  };
}

const downCounter: CounterClient = {
  async read() { throw new Error("counter down"); },
  async increment() { throw new Error("counter down"); },
};

const plans = {
  free: { features: { "chat-message": { limit: 3, period: "day" as const } } },
  pro: { features: { "chat-message": "unlimited" as const } },
};

test("blocks the Nth request once the limit is reached", async () => {
  const billing = new Billing({
    plans, counter: memCounter(),
    resolvePlan: () => "free",
    upgradeUrl: () => "/upgrade",
  });
  for (let i = 0; i < 3; i++) {
    const c = await billing.check("u1", "chat-message");
    assert.equal(c.allowed, true, `request ${i + 1} should be allowed`);
    assert.equal(c.remaining, 3 - i);
    await billing.record("u1", "chat-message");
  }
  const blocked = await billing.check("u1", "chat-message");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.upgradeUrl, "/upgrade");
});

test("FAIL-OPEN: counter unreachable => allowed, record never throws", async () => {
  const billing = new Billing({ plans, counter: downCounter, resolvePlan: () => "free" });
  const c = await billing.check("u1", "chat-message");
  assert.equal(c.allowed, true);
  await billing.record("u1", "chat-message"); // must not throw
});

test("failClosed feature BLOCKS when the counter is unreachable", async () => {
  const strictPlans = {
    free: { features: { "expensive-gen": { limit: 3, period: "day" as const, failClosed: true } } },
  };
  const billing = new Billing({
    plans: strictPlans, counter: downCounter,
    resolvePlan: () => "free", upgradeUrl: () => "/upgrade",
  });
  const c = await billing.check("u1", "expensive-gen");
  assert.equal(c.allowed, false);
  assert.equal(c.upgradeUrl, "/upgrade");
});

test("unlimited plan is always allowed without touching the meter", async () => {
  const billing = new Billing({ plans, counter: downCounter, resolvePlan: () => "pro" });
  const c = await billing.check("u1", "chat-message");
  assert.equal(c.allowed, true);
  assert.equal(c.remaining, Infinity);
});

test("usage is bucketed per period (day vs month)", () => {
  const d = new Date("2026-06-22T10:00:00Z");
  assert.equal(periodKey("day", d), "2026-06-22");
  assert.equal(periodKey("month", d), "2026-06");
});
