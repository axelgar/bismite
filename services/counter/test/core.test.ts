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

  assert.deepEqual(await cp.resolveKey(testKey), { projectId, mode: "test", orgId: "u1", plan: "free" });
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", orgId: "u1", plan: "free" });

  // Unknown key => null (=> 401), and the scheme/value must match exactly.
  assert.equal(await cp.resolveKey("bsk_test_nope"), null);
});

test("plan is per-ORG: setPlan changes what every project in the org resolves to", async () => {
  const { projectId, live: liveKey } = await cp.createProject("tiers", "org-tier");
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", orgId: "org-tier", plan: "free" });

  await cp.setPlan("org-tier", "pro"); // keyed off the ORG now, not the project
  // Cache is cleared on setPlan, so the new tier resolves immediately.
  assert.deepEqual(await cp.resolveKey(liveKey), { projectId, mode: "live", orgId: "org-tier", plan: "pro" });

  const [view] = await cp.listProjects("org-tier");
  assert.equal(view.plan, "pro");
});

test("setBilling: stores the Stripe customer id on the ORG on upgrade, keeps it on cancel", async () => {
  const orgId = "org-billing";
  await cp.createProject("billed", orgId);

  // Checkout completes => Pro + customer id stored on the org.
  await cp.setBilling(orgId, "pro", "cus_123");
  let [view] = await cp.listProjects(orgId);
  assert.equal(view.plan, "pro");
  assert.equal(view.stripeCustomerId, "cus_123");

  // Cancel (no customer id passed) => back to Free, but the id is retained so the user
  // can reopen the Customer Portal / resubscribe onto the same Stripe customer.
  await cp.setBilling(orgId, "free");
  [view] = await cp.listProjects(orgId);
  assert.equal(view.plan, "free");
  assert.equal(view.stripeCustomerId, "cus_123", "customer id retained across cancel");
});

test("Free = 1 project: a 2nd project on a Free org is refused; Pro lifts the cap", async () => {
  const orgId = "org-onefree";
  await cp.createProject("first", orgId); // ok
  await assert.rejects(() => cp.createProject("second", orgId), /free_one_project/);

  await cp.setPlan(orgId, "pro"); // upgrade lifts the limit
  const second = await cp.createProject("second", orgId);
  assert.match(second.live, /^bsk_live_/);
  assert.equal((await cp.listProjects(orgId)).length, 2);
});

test("regenerate replaces the key for a mode and invalidates the old one", async () => {
  const { projectId, test: oldKey, live: liveKey } = await cp.createProject("bravo", "org-2");
  assert.deepEqual(await cp.resolveKey(oldKey), { projectId, mode: "test", orgId: "org-2", plan: "free" }); // warms cache

  const newKey = await cp.regenerate(projectId, "test");
  assert.notEqual(newKey, oldKey);
  assert.equal(await cp.resolveKey(oldKey), null, "old key no longer resolves");
  assert.deepEqual(await cp.resolveKey(newKey), { projectId, mode: "test", orgId: "org-2", plan: "free" });
  assert.deepEqual(
    await cp.resolveKey(liveKey),
    { projectId, mode: "live", orgId: "org-2", plan: "free" },
    "live key untouched",
  );
});

test("listProjects: scoped to org, with per-mode key metadata and no secrets", async () => {
  const owner = "owner-list-1";
  const a = await cp.createProject("alpha", owner);
  await cp.setPlan(owner, "pro"); // Free = 1 project; Pro holds several
  const b = await cp.createProject("beta", owner);
  await cp.createProject("other", "someone-else"); // must not leak across orgs

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

test("snapshots: listAllProjectIds spans owners; recordSnapshot upserts idempotently per day", async () => {
  const a = await cp.createProject("snap-a", "snap-owner-1");
  const b = await cp.createProject("snap-b", "snap-owner-2"); // different owner

  const all = await cp.listAllProjectIds();
  assert.ok(all.includes(a.projectId) && all.includes(b.projectId), "ids span all owners");

  // First write for the day, then a same-day re-run with new numbers, then next day.
  await cp.recordSnapshot(a.projectId, "2026-06-29", 10, 100);
  await cp.recordSnapshot(a.projectId, "2026-06-29", 25, 250); // cron re-run: must overwrite, not dup
  await cp.recordSnapshot(a.projectId, "2026-06-30", 30, 300); // next day => new row

  const rows = await cp.listSnapshots(a.projectId);
  assert.equal(rows.length, 2, "one row per (project, day) — same-day re-run overwrote");
  assert.deepEqual(rows[0], { date: "2026-06-29", mtu: 25, calls: 250 }, "overwritten with latest numbers");
  assert.deepEqual(rows[1], { date: "2026-06-30", mtu: 30, calls: 300 });

  assert.deepEqual(await cp.listSnapshots(b.projectId), [], "snapshots are per-project");
});

test("makeStore (memory): increment returns running total, read reflects it", async () => {
  const s = makeStore({}); // no UPSTASH_* => in-memory
  assert.equal(await s.read("k"), 0);
  assert.equal(await s.increment("k", 2), 2);
  assert.equal(await s.increment("k", 3), 5);
  assert.equal(await s.read("k"), 5);
  assert.equal(await s.read("other"), 0);
});
