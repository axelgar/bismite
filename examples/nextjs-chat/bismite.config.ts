import { Billing } from "bismite";
import { bismiteCounter } from "bismite/hosted";
import { upstashCounter } from "bismite/redis-counter";
import { getPlan } from "./lib/plan-store";
import { plans, planForPrice, planForSubscription } from "./lib/plan-mapping";

// Re-export the plan map + pure mappers so routes import from one place.
export { plans, planForPrice, planForSubscription };

// Lead with the hosted counter: one API key, no second vendor. Mint a key against
// a running counter service (`pnpm counter` then `pnpm issue-key`) and set
// BISMITE_API_KEY — no more seed. An unset/invalid key fails open (ungated) rather
// than crashing. BYO-Upstash is the no-lock-in escape hatch — opt in explicitly
// with BISMITE_COUNTER=upstash. (Mere presence of UPSTASH_* can't mean "counter" —
// the app uses it for plan state too.)
const counter =
  process.env.BISMITE_COUNTER === "upstash" &&
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
    ? upstashCounter(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : bismiteCounter(
        process.env.BISMITE_API_KEY ?? "",
        process.env.BISMITE_API_URL ?? "http://localhost:4000",
      );

export const bismite = new Billing({
  plans,
  resolvePlan: (userId) => getPlan(userId), // real plan, written by the Stripe webhook (#2)
  counter,
  upgradeUrl: (userId) => `/api/checkout?userId=${encodeURIComponent(userId)}`, // #3
});
