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
  if (mode !== "live") return null;
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
