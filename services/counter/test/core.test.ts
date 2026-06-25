import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProject, nsKey, makeStore } from "../src/core.ts";

const keys = resolveProject.parse(undefined); // built-in dev seed

test("resolveProject: valid Bearer key -> project, else null (401)", () => {
  assert.equal(resolveProject("Bearer bsk_test_dev", keys), "proj_dev");
  assert.equal(resolveProject("bearer bsk_test_dev", keys), "proj_dev"); // case-insensitive scheme
  assert.equal(resolveProject(undefined, keys), null);
  assert.equal(resolveProject("Bearer nope", keys), null);
  assert.equal(resolveProject("bsk_test_dev", keys), null); // missing scheme
});

test("resolveProject.parse: env map overrides the default seed", () => {
  assert.deepEqual(resolveProject.parse("k1=p1, k2=p2"), { k1: "p1", k2: "p2" });
});

test("nsKey: prefixes by project so tenants can't collide", () => {
  assert.equal(nsKey("proj_a", "u:f:2026-06"), "proj_a:u:f:2026-06");
  assert.notEqual(nsKey("proj_a", "u:f:2026-06"), nsKey("proj_b", "u:f:2026-06"));
});

test("makeStore (memory): increment returns running total, read reflects it", async () => {
  const s = makeStore({}); // no UPSTASH_* => in-memory
  assert.equal(await s.read("k"), 0);
  assert.equal(await s.increment("k", 2), 2);
  assert.equal(await s.increment("k", 3), 5);
  assert.equal(await s.read("k"), 5);
  assert.equal(await s.read("other"), 0);
});
