// Billing metrics (PRD-hosted-platform §8) + the fair-use guardrail (§6), all over
// the Store seam so they're testable without a server and backend-agnostic.
//
// Metering is derived server-side from the counter request — no SDK/wire change.
// The SDK builds counter keys as `${userId}:${feature}:${period}`, so the userId is
// already on the hot path; we just read it back out. Keys are namespaced
// `proj_<id>:mtu|calls|rl:<bucket>`; counter keys are `proj_<id>:test|live:...`, so
// the second segment (mode vs metric) keeps the two spaces from ever colliding.
import type { Store } from "./core.js";
import type { Mode } from "./db.js";

/** UTC calendar-month bucket — the billing period for both MTU and calls. */
export function period(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UTC calendar day (YYYY-MM-DD) — the snapshot bucket for daily usage history. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Pull the userId out of an SDK counter key. The userId is everything before the
 *  trailing `:feature:period`, so we slice from the end — that tolerates userIds
 *  which themselves contain ':'.
 *  ponytail: assumes feature names contain no ':'. If features ever embed colons,
 *  thread userId explicitly through the wire instead of recovering it here. */
export function extractUser(counterKey: string): string {
  const parts = counterKey.split(":");
  return parts.length <= 2 ? counterKey : parts.slice(0, -2).join(":");
}

const mtuKey = (proj: string, p: string) => `${proj}:mtu:${p}`;
const callsKey = (proj: string, p: string) => `${proj}:calls:${p}`;
// A SEPARATE distinct-user set for TEST keys — never feeds billing, just enforces the cap.
const testMtuKey = (proj: string, p: string) => `${proj}:testmtu:${p}`;

// Flat test-key allowance, every tier (PRD v2/B §3): 100 (not 1k) so it can't cannibalize
// the live-key upgrade lever. Test usage is hard-capped here but never billed.
export const TEST_MTU_CAP = 100;

// Hard-block reasons Bismite itself returns (PRD v2/B). Mirrors the SDK's BlockedReason
// (packages/sdk) — kept as a local copy, like the plans mirror, to avoid coupling the
// counter deploy to the SDK package.
export type BlockedReason = "bismite_free_limit" | "bismite_test_limit" | "bismite_calls_ceiling";

/** The humane MTU hard-ceiling gate for tiers with NO overage (Free): once the period's
 *  distinct-user set is at `ceiling`, refuse a genuinely-NEW user but always let an
 *  already-counted user through (never evict mid-month). Returns the block reason, or
 *  null to proceed. Run BEFORE `meter()` so a refused user is never added/counted.
 *  Tiers that bill overage (Pro) pass Infinity => never blocks here (that's #6/#8).
 *  A thrown store error bubbles to the caller, which fails open (no block on doubt). */
export async function mtuCeilingBlock(
  store: Store,
  projectId: string,
  mode: Mode,
  counterKey: string,
  ceiling: number,
  now = new Date(),
): Promise<BlockedReason | null> {
  if (mode !== "live" || !isFinite(ceiling)) return null; // test cap is separate (#3)
  const key = mtuKey(projectId, period(now));
  // size < ceiling => room for one more, even a new user (e.g. the 1,000th on Free).
  if ((await store.setSize(key)) < ceiling) return null;
  // At/over the ceiling: only users already counted this period may pass.
  if (await store.isMember(key, extractUser(counterKey))) return null;
  return "bismite_free_limit"; // a new user past the ceiling (e.g. the 1,001st on Free)
}

/** Hard fair-use ceiling on billable calls (PRD v2/B §6): once this period's call count
 *  reaches the tier's `ceiling`, hard-block every tier (Free 100k, Pro 5M, Ent ∞). This is
 *  the per-PERIOD guardrail that protects the Redis margin and routes heavy users to sales —
 *  distinct from the per-MINUTE rate limit (`rateLimited`, a 429 burst guard). Live-only
 *  (test calls aren't metered). Returns the reason or null. Run BEFORE `meter()` so a
 *  refused call isn't itself counted. A thrown store error bubbles up => caller fails open. */
export async function callsCeilingBlock(
  store: Store,
  projectId: string,
  mode: Mode,
  ceiling: number,
  now = new Date(),
): Promise<BlockedReason | null> {
  if (mode !== "live" || !isFinite(ceiling)) return null;
  // >= so `ceiling` calls succeed and the next one is refused (mirrors the MTU off-by-one).
  if ((await store.read(callsKey(projectId, period(now)))) >= ceiling) return "bismite_calls_ceiling";
  return null;
}

/** Flat-100 cap on distinct TEST-key users (PRD v2/B §3) — same humane new-user rule as the
 *  Free MTU ceiling, but over a SEPARATE set that never bills. Closes the "test keys are an
 *  uncapped production bypass" hole. Test-mode only (live has its own ceilings). Returns the
 *  reason or null; a thrown store error bubbles up => caller fails open. */
export async function testCapBlock(
  store: Store,
  projectId: string,
  mode: Mode,
  counterKey: string,
  now = new Date(),
): Promise<BlockedReason | null> {
  if (mode !== "test") return null;
  const key = testMtuKey(projectId, period(now));
  if ((await store.setSize(key)) < TEST_MTU_CAP) return null; // room for one more
  if (await store.isMember(key, extractUser(counterKey))) return null; // already counted => pass
  return "bismite_test_limit"; // a new test user past the cap (the 101st)
}

/** Feed the two billing meters for one live counter op (a check or a record), and
 *  return the running period totals so the caller can apply tier enforcement.
 *  Test mode is excluded so CI/build traffic never moves the bill (PRD §7) => null. */
export async function meter(
  store: Store,
  projectId: string,
  mode: Mode,
  counterKey: string,
  now = new Date(),
): Promise<{ mtu: number; calls: number } | null> {
  if (mode !== "live") {
    // Test mode: count the distinct user in the SEPARATE test set (enforces the flat-100
    // cap, #3) but touch NO billing meter — test traffic must never move the bill (PRD §7).
    if (mode === "test") await store.addMember(testMtuKey(projectId, period(now)), extractUser(counterKey));
    return null;
  }
  const p = period(now);
  // Independent keys, so run concurrently — halves the metering round-trips on the
  // hot path. (Batching into one Upstash pipeline is the next step — see BACKLOG.md.)
  const [, calls] = await Promise.all([
    store.addMember(mtuKey(projectId, p), extractUser(counterKey)), // MTU = distinct users
    store.increment(callsKey(projectId, p), 1), // billable calls (guardrail meter)
  ]);
  // ponytail: one extra SCARD for the live MTU count (SADD doesn't return cardinality).
  // Folds into the pipeline batch when that BACKLOG item lands.
  const mtu = await store.setSize(mtuKey(projectId, p));
  return { mtu, calls };
}

/** Current-period billing numbers for a project (read path for the #4 dashboard). */
export async function summary(store: Store, projectId: string, now = new Date()) {
  const p = period(now);
  const [mtu, calls] = await Promise.all([
    store.setSize(mtuKey(projectId, p)),
    store.read(callsKey(projectId, p)),
  ]);
  return { mtu, calls, period: p };
}

// Window slightly longer than 60s so the bucket survives until the next one starts.
const RL_TTL = 70;

/** Per-project fixed-window rate limit — protects the shared Redis bill and enforces
 *  fair-use (PRD §6, first Bismite-meters-Bismite dogfood). One INCR per request on a
 *  per-minute bucket; over `limit` => true (caller returns 429). `limit <= 0` disables.
 *  ponytail: flat per-project cap. Per-tier rate-limit thresholds stay a PRD §13 open
 *  question (need validation data); the MTU headline limit is the tier lever for now. */
export async function rateLimited(
  store: Store,
  projectId: string,
  limit: number,
  now = new Date(),
): Promise<boolean> {
  if (limit <= 0) return false;
  const minute = Math.floor(now.getTime() / 60_000);
  const n = await store.increment(`${projectId}:rl:${minute}`, 1, RL_TTL);
  return n > limit;
}
