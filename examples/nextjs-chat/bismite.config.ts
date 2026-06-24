import { Billing } from "bismite";
import { httpCounter } from "bismite/http-counter";
import { upstashCounter } from "bismite/redis-counter";
import { getPlan } from "./lib/plan-store";
import { plans, planForPrice, planForSubscription } from "./lib/plan-mapping";

// Re-export the plan map + pure mappers so routes import from one place.
export { plans, planForPrice, planForSubscription };

// Use the production-grade Upstash counter when configured (concurrency-correct,
// period-scoped); fall back to the local counter service for a zero-setup demo.
const counter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? upstashCounter(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : httpCounter(process.env.COUNTER_URL ?? "http://localhost:4000");

export const bismite = new Billing({
  plans,
  resolvePlan: (userId) => getPlan(userId), // real plan, written by the Stripe webhook (#2)
  counter,
  upgradeUrl: (userId) => `/api/checkout?userId=${encodeURIComponent(userId)}`, // #3
});
