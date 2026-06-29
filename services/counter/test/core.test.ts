import { test } from "node:test";
import assert from "node:assert/strict";
import { nsKey, makeStore } from "../src/core.js";
import { makeControlPlane } from "../src/db.js";

// No DATABASE_URL => PGlite in-memory, exercising the real Drizzle schema + SQL.
const cp = makeControlPlane({});

test("nsKey: prefixes by project AND mode so tenants/modes can't collide", () => {
  assert.equal(nsKey("proj_a", "live", "u:f:2026-06"), "proj_a:live:u:f:2026-06");
  assert.notEqual(nsKey("proj_a", "live", "k"), nsKey("proj_b", "live", "k")); // tenant isolation
  assert.notEqual(nsKey("proj_a", "test", "k"), nsKey("proj_a", "live", "k")); // mode isolation
});

test("createProject mints resolvable test + live keys with the right prefixes", async () => {
  const { projectId, test: testKey, live: liveKey } = await cp.createProject("acme", "u1");
  assert.match(testKey, /^bsk_test_/);
  assert.match(liveKey, /^bsk_live_/);

  assert.deepEqual(await cp.resolveKey(testKey), { projectId, mode: "test", plan: "free" });
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", plan: "free" });

  // Unknown key => null (=> 401), and the scheme/value must match exactly.
  assert.equal(await cp.resolveKey("bsk_test_nope"), null);
});

test("projects default to the free plan; setPlan changes what the hot path resolves", async () => {
  const { projectId, live: liveKey } = await cp.createProject("tiers", "u-tier");
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", plan: "free" });

  await cp.setPlan(projectId, "pro");
  // Cache is cleared on setPlan, so the new tier resolves immediately (demo: bump to pro).
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", plan: "pro" });

  const [view] = await cp.listProjects("u-tier");
  assert.equal(view.plan, "pro");
});

test("setBilling: stores the Stripe customer id on upgrade, keeps it on cancel (#6)", async () => {
  const owner = "u-billing";
  const { projectId } = await cp.createProject("billed", owner);

  // Checkout completes => Pro + customer id stored.
  await cp.setBilling(projectId, "pro", "cus_123");
  let [view] = await cp.listProjects(owner);
  assert.equal(view.plan, "pro");
  assert.equal(view.stripeCustomerId, "cus_123");

  // Cancel (no customer id passed) => back to Free, but the id is retained so the user
  // can reopen the Customer Portal / resubscribe onto the same Stripe customer.
  await cp.setBilling(projectId, "free");
  [view] = await cp.listProjects(owner);
  assert.equal(view.plan, "free");
  assert.equal(view.stripeCustomerId, "cus_123", "customer id retained across cancel");
});

test("regenerate replaces the key for a mode and invalidates the old one", async () => {
  const { projectId, test: oldKey, live: liveKey } = await cp.createProject("bravo", "u2");
  assert.deepEqual(await cp.resolveKey(oldKey), { projectId, mode: "test", plan: "free" }); // warms cache too

  const newKey = await cp.regenerate(projectId, "test");
  assert.notEqual(newKey, oldKey);
  assert.equal(await cp.resolveKey(oldKey), null, "old key no longer resolves");
  assert.deepEqual(await cp.resolveKey(newKey), { projectId, mode: "test", plan: "free" });
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", plan: "free" }, "live key untouched");
});

test("listProjects: scoped to owner, with per-mode key metadata and no secrets", async () => {
  const owner = "owner-list-1";
  const a = await cp.createProject("alpha", owner);
  const b = await cp.createProject("beta", owner);
  await cp.createProject("other", "someone-else"); // must not leak across owners

  const list = await cp.listProjects(owner);
  assert.equal(list.length, 2);
  assert.deepEqual(new Set(list.map((p) => p.projectId)), new Set([a.projectId, b.projectId]));

  const alpha = list.find((p) => p.projectId === a.projectId)!;
  assert.deepEqual(
    new Set(alpha.keys.map((k) => k.mode)),
    new Set(["test", "live"]),
    "both mode keys surfaced",
  );
  // No secret/hash fields ever escape the read shape.
  assert.equal(JSON.stringify(list).includes("bsk_"), false);
  assert.equal(JSON.stringify(list).includes("hashedKey"), false);

  assert.deepEqual(await cp.listProjects("nobody"), [], "unknown owner => empty");
});

test("makeStore (memory): increment returns running total, read reflects it", async () => {
  const s = makeStore({}); // no UPSTASH_* => in-memory
  assert.equal(await s.read("k"), 0);
  assert.equal(await s.increment("k", 2), 2);
  assert.equal(await s.increment("k", 3), 5);
  assert.equal(await s.read("k"), 5);
  assert.equal(await s.read("other"), 0);
});
