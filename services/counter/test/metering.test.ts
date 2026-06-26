import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "../src/core.js";
import { extractUser, period, meter, summary, rateLimited } from "../src/metering.js";

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
