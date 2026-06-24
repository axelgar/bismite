import { test } from "node:test";
import assert from "node:assert/strict";

// priceToPlan reads this at module load — set before importing the config.
process.env.STRIPE_PRICE_PRO = "price_test_pro";
const { planForSubscription, planForPrice } = await import("../lib/plan-mapping.ts");

test("active/trialing subscription on the pro price -> pro", () => {
  assert.equal(planForSubscription("active", "price_test_pro"), "pro");
  assert.equal(planForSubscription("trialing", "price_test_pro"), "pro");
});

test("inactive subscription -> free regardless of price", () => {
  assert.equal(planForSubscription("canceled", "price_test_pro"), "free");
  assert.equal(planForSubscription("past_due", "price_test_pro"), "free");
  assert.equal(planForSubscription("incomplete_expired", "price_test_pro"), "free");
});

test("unknown / missing price -> free", () => {
  assert.equal(planForPrice("price_unknown"), "free");
  assert.equal(planForPrice(undefined), "free");
});
