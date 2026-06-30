import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "../src/core.js";
import {
  extractUser,
  period,
  meter,
  summary,
  rateLimited,
  mtuCeilingBlock,
  callsCeilingBlock,
  testCapBlock,
  TEST_MTU_CAP,
} from "../src/metering.js";
import type { Store } from "../src/core.js";

const JUNE = new Date("2026-06-15T12:00:00Z");

test("extractUser: userId is everything before :feature:period, even with colons", () => {
  assert.equal(extractUser("u1:chat:2026-06"), "u1");
  assert.equal(extractUser("u1:chat:2026-06-15"), "u1"); // daily period, still the head
  assert.equal(extractUser("tenant:42:chat:2026-06"), "tenant:42"); // colon in userId
});

test("period: UTC calendar-month bucket", () => {
  assert.equal(period(JUNE), "2026-06");
  assert.equal(period(new Date("2026-01-01T00:00:00Z")), "2026-01");
});

test("MTU counts distinct users; repeats don't inflate it; calls count every op", async () => {
  const s = makeStore({});
  for (const u of ["a", "b", "a", "a", "c"]) {
    await meter(s, "proj_x", "live", `${u}:chat:2026-06`, JUNE);
  }
  assert.deepEqual(await summary(s, "proj_x", JUNE), { mtu: 3, calls: 5, period: "2026-06" });
});

test("meter returns running MTU+calls for live (for tier enforcement), null for test", async () => {
  const s = makeStore({});
  assert.equal(await meter(s, "proj_x", "test", "a:chat:2026-06", JUNE), null);
  assert.deepEqual(await meter(s, "proj_x", "live", "a:chat:2026-06", JUNE), { mtu: 1, calls: 1 });
  assert.deepEqual(await meter(s, "proj_x", "live", "b:chat:2026-06", JUNE), { mtu: 2, calls: 2 });
  // Repeat user: MTU (distinct) holds, calls keep climbing.
  assert.deepEqual(await meter(s, "proj_x", "live", "a:chat:2026-06", JUNE), { mtu: 2, calls: 3 });
});

test("test-mode traffic is excluded from both metrics", async () => {
  const s = makeStore({});
  await meter(s, "proj_x", "test", "a:chat:2026-06", JUNE);
  await meter(s, "proj_x", "test", "b:chat:2026-06", JUNE);
  assert.deepEqual(await summary(s, "proj_x", JUNE), { mtu: 0, calls: 0, period: "2026-06" });
});

test("metrics are per-project and per-period (no cross-bleed)", async () => {
  const s = makeStore({});
  await meter(s, "proj_x", "live", "a:chat:2026-06", JUNE);
  await meter(s, "proj_y", "live", "a:chat:2026-06", JUNE);
  const may = new Date("2026-05-15T12:00:00Z");
  await meter(s, "proj_x", "live", "z:chat:2026-05", may);

  assert.equal((await summary(s, "proj_x", JUNE)).mtu, 1, "proj_x sees only its own user");
  assert.equal((await summary(s, "proj_y", JUNE)).calls, 1);
  assert.equal((await summary(s, "proj_x", may)).mtu, 1, "May bucket is separate from June");
});

test("mtuCeilingBlock: refuses a NEW user at the ceiling, always passes an existing one", async () => {
  const s = makeStore({});
  const proj = "proj_free";
  const ceiling = 3; // tiny stand-in for the Free 1,000
  for (let i = 0; i < ceiling; i++) await meter(s, proj, "live", `u${i}:chat:2026-06`, JUNE); // fill to ceiling

  // At the ceiling: an already-counted user still passes (never evict mid-month).
  assert.equal(await mtuCeilingBlock(s, proj, "live", "u1:chat:2026-06", ceiling, JUNE), null);
  // A genuinely-new user past the ceiling is refused (e.g. the 1,001st on Free).
  assert.equal(
    await mtuCeilingBlock(s, proj, "live", "u-new:chat:2026-06", ceiling, JUNE),
    "bismite_free_limit",
  );
  // Test mode is never MTU-blocked here (the test cap is a separate set, #3).
  assert.equal(await mtuCeilingBlock(s, proj, "test", "u-new:chat:2026-06", ceiling, JUNE), null);
  // An Infinity ceiling (overage/enterprise tiers) never blocks.
  assert.equal(await mtuCeilingBlock(s, proj, "live", "u-new:chat:2026-06", Infinity, JUNE), null);
});

test("mtuCeilingBlock: under the ceiling, even a new user passes (fills the last slot)", async () => {
  const s = makeStore({});
  const proj = "proj_room";
  await meter(s, proj, "live", "u0:chat:2026-06", JUNE);
  await meter(s, proj, "live", "u1:chat:2026-06", JUNE); // size 2 < ceiling 3 => room for one more
  assert.equal(await mtuCeilingBlock(s, proj, "live", "u2:chat:2026-06", 3, JUNE), null, "the 3rd user still fits");
});

test("mtuCeilingBlock: a store error propagates (caller fails OPEN, never blocks on doubt)", async () => {
  // The block is a positive signal from a HEALTHY counter; an unreachable store must not
  // synthesize one. mtuCeilingBlock throws; core.ts's safeBlock swallows it => no block.
  const broken = { setSize: async () => { throw new Error("counter down"); } } as unknown as Store;
  await assert.rejects(() => mtuCeilingBlock(broken, "p", "live", "u:f:2026-06", 3, JUNE));
});

test("callsCeilingBlock: blocks once the period's calls reach the ceiling; live-only; ∞ never blocks", async () => {
  const s = makeStore({});
  const proj = "proj_calls";
  const ceiling = 3;
  await meter(s, proj, "live", "a:chat:2026-06", JUNE); // calls=1 (same user: MTU stays 1, calls count every op)
  await meter(s, proj, "live", "a:chat:2026-06", JUNE); // calls=2
  assert.equal(await callsCeilingBlock(s, proj, "live", ceiling, JUNE), null, "under the ceiling: pass");
  await meter(s, proj, "live", "a:chat:2026-06", JUNE); // calls=3 == ceiling
  assert.equal(
    await callsCeilingBlock(s, proj, "live", ceiling, JUNE),
    "bismite_calls_ceiling",
    "at the ceiling: the next call is refused",
  );
  // Test mode isn't calls-metered, so it's never calls-blocked here; Enterprise (∞) never blocks.
  assert.equal(await callsCeilingBlock(s, proj, "test", ceiling, JUNE), null);
  assert.equal(await callsCeilingBlock(s, proj, "live", Infinity, JUNE), null);
});

test("testCapBlock: flat-100 cap on distinct test users; never bills; live unaffected", async () => {
  const s = makeStore({});
  const proj = "proj_test";
  for (let i = 0; i < TEST_MTU_CAP; i++) await meter(s, proj, "test", `u${i}:chat:2026-06`, JUNE); // fill to the cap

  assert.equal(await testCapBlock(s, proj, "test", "u1:chat:2026-06", JUNE), null, "existing test user passes");
  assert.equal(
    await testCapBlock(s, proj, "test", "u-new:chat:2026-06", JUNE),
    "bismite_test_limit",
    "the 101st new test user is refused",
  );
  // Live mode is never test-capped here (it has its own ceilings).
  assert.equal(await testCapBlock(s, proj, "live", "u-new:chat:2026-06", JUNE), null);
  // Test traffic populated only the separate test set — the billing meters never moved.
  assert.deepEqual(await summary(s, proj, JUNE), { mtu: 0, calls: 0, period: "2026-06" });
});

test("rateLimited: trips once the per-minute count exceeds the cap", async () => {
  const s = makeStore({});
  const limit = 3;
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await rateLimited(s, "proj_x", limit, JUNE));
  assert.deepEqual(results, [false, false, false, true, true]); // 4th request is over

  // A different minute resets the window.
  assert.equal(await rateLimited(s, "proj_x", limit, new Date(JUNE.getTime() + 60_000)), false);
  // limit <= 0 disables the limiter entirely.
  assert.equal(await rateLimited(s, "proj_y", 0, JUNE), false);
});
