// Issue #4 proof: concurrency correctness of the Upstash counter.
// Fire N concurrent record() calls at one user/feature; the final count must be
// exactly N (atomic INCRBY — no lost/double increments). Also shows period
// bucketing (a different period reads 0 = clean reset).
// Run: node --env-file=.env scripts/hammer-upstash.ts
import assert from "node:assert/strict";
import { Billing, periodKey } from "bismite";
import { upstashCounter } from "bismite/redis-counter";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
assert(url && token, "UPSTASH_REDIS_REST_URL / _TOKEN required");

const counter = upstashCounter(url, token);
const plans = { pro: { features: { gen: { limit: 1_000_000, period: "day" as const } } } };
const bismite = new Billing({ plans, resolvePlan: () => "pro", counter });

const N = 200;
const user = `hammer-${process.pid}`;
const feature = "gen";

console.log(`firing ${N} concurrent record() calls...`);
await Promise.all(Array.from({ length: N }, () => bismite.record(user, feature, { count: 1 })));

const todayKey = `${user}:${feature}:${periodKey("day")}`;
const used = await counter.read(todayKey);
console.log(`final count: ${used} (expected ${N})`);
assert.equal(used, N, "concurrent increments lost/double-counted");
console.log("OK: count is exact under concurrency");

// Period bucketing: a different day's key is independent (this is the "reset").
const otherDay = `${user}:${feature}:${periodKey("day", new Date("2000-01-01T00:00:00Z"))}`;
assert.equal(await counter.read(otherDay), 0, "different period should start at 0");
console.log("OK: usage is period-scoped (resets on period boundary)");
