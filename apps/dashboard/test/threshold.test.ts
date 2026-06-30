import { test } from "node:test";
import assert from "node:assert/strict";
import { thresholdToAlert } from "../lib/threshold";

const FREE = 1_000; // Free MTU ceiling

test("below 80% => no alert", () => {
  assert.equal(thresholdToAlert(799, FREE, 0), 0);
});

test("gradual climb fires 80 then 100, one each (de-dupes via lastAlerted)", () => {
  // First run at 85%: alert 80.
  assert.equal(thresholdToAlert(850, FREE, 0), 80);
  // Still 85%, already alerted 80: nothing.
  assert.equal(thresholdToAlert(900, FREE, 80), 0);
  // Now at 100%, last was 80: alert 100.
  assert.equal(thresholdToAlert(1000, FREE, 80), 100);
  // Over 100%, already alerted 100: nothing.
  assert.equal(thresholdToAlert(1500, FREE, 100), 0);
});

test("a jump straight past 100% fires only 100, not 80 as well", () => {
  assert.equal(thresholdToAlert(1200, FREE, 0), 100);
});

test("exactly at a threshold counts as crossed (>=)", () => {
  assert.equal(thresholdToAlert(800, FREE, 0), 80);
  assert.equal(thresholdToAlert(1000, FREE, 0), 100);
});

test("uncapped ceiling (enterprise / Infinity) never alerts", () => {
  assert.equal(thresholdToAlert(9_999_999, Infinity, 0), 0);
  assert.equal(thresholdToAlert(5, 0, 0), 0);
});
