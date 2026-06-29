// bismite — SDK-first billing & entitlements runtime.
// Heart of the product: gate (check) and meter (record) any feature in your code.
// Design promise: we never take your app down. Plan rules eval locally; the usage
// meter fails OPEN (a reachable-but-down counter never blocks a user).

export type Usage = { tokens?: number; count?: number };
// A HARD block from Bismite itself (PRD v2/B), distinct from `overLimit` (advisory) and
// from the dev's own `allowed:false` (their end-user's plan rule). The counter REFUSED
// the op: a new user past the Free ceiling, past the test cap, or calls over the tier
// ceiling. Only ever set on a confirmed response from a healthy counter — a fail-open
// transient leaves it undefined (the block is a positive signal, never the absence of one).
export type BlockedReason = "bismite_free_limit" | "bismite_test_limit" | "bismite_calls_ceiling";
// overLimit: the hosted counter signals the PROJECT is over its Bismite tier (MTU)
// allowance — orthogonal to `allowed` (the dev's own plan rule for THIS user). It's
// advisory: we never block on it (fail-open holds), the app just shows "upgrade your
// Bismite plan". false on a fail-open transient, so it's distinct from a meter outage.
export type CheckResult = {
  allowed: boolean;
  remaining: number;
  upgradeUrl: string | null;
  overLimit: boolean;
  blocked?: BlockedReason;
};
export type Period = "day" | "month";
// What the limit counts. "count" (default) = one per call — N requests/day.
// "tokens" = sum of token usage — the AI wedge, where each call costs a variable
// amount. `limit`/`remaining` are expressed in this unit either way.
export type Unit = "count" | "tokens";
// failClosed: block when the meter is unreachable instead of failing open.
// Default (omitted) is fail-open — the product promise. Opt into failClosed for
// features that cost YOU a lot per call (e.g. an expensive model) and where a
// brief block is cheaper than a usage leak.
export type FeatureRule =
  | { limit: number; period: Period; unit?: Unit; failClosed?: boolean }
  | "unlimited";
export type Plan = { features: Record<string, FeatureRule> };

/** The usage meter backend. HTTP-backed in prod (see ./http-counter); a seam so
 *  issue #4 can swap in a concurrency-correct store without touching the runtime. */
export interface CounterClient {
  // A bare number is the used count. The hosted counter returns the count plus an
  // `overLimit` tier flag and an optional `blocked` reason; other backends just return
  // the number (overLimit => false, blocked => undefined).
  read(key: string): Promise<number | { used: number; overLimit?: boolean; blocked?: BlockedReason }>;
  // The hosted counter may report a hard `blocked` reason (it refused to count the op);
  // other backends return void. Void/undefined => not blocked.
  increment(key: string, amount: number): Promise<void | { blocked?: BlockedReason }>;
}

export type BillingConfig = {
  plans: Record<string, Plan>;
  /** Resolve a user's plan. Faked/static for slice 1; Stripe-sourced in issue #2. */
  resolvePlan: (userId: string) => string | Promise<string>;
  counter: CounterClient;
  upgradeUrl?: (userId: string, feature: string) => string;
};

/** Bucket key for the current period. UTC so all instances agree. */
export function periodKey(period: Period, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (period === "month") return `${y}-${m}`;
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export class Billing {
  #config: BillingConfig;
  constructor(config: BillingConfig) {
    this.#config = config;
  }

  private async ruleFor(userId: string, feature: string): Promise<FeatureRule | undefined> {
    const planName = await this.#config.resolvePlan(userId);
    return this.#config.plans[planName]?.features[feature];
  }

  /** Gate a feature BEFORE the expensive work. Never throws. */
  async check(userId: string, feature: string): Promise<CheckResult> {
    const rule = await this.ruleFor(userId, feature);
    // Unknown feature or unlimited plan => allowed, no meter read needed.
    if (rule === undefined || rule === "unlimited") {
      return { allowed: true, remaining: Infinity, upgradeUrl: null, overLimit: false };
    }
    let used: number;
    let overLimit = false;
    let blocked: BlockedReason | undefined;
    try {
      const r = await this.#config.counter.read(`${userId}:${feature}:${periodKey(rule.period)}`);
      if (typeof r === "number") {
        used = r;
      } else {
        used = r.used;
        overLimit = !!r.overLimit;
        blocked = r.blocked; // confirmed hard block from a healthy counter
      }
    } catch {
      if (rule.failClosed) {
        // Opted-in strict mode: block when the meter is unreachable.
        return { allowed: false, remaining: 0, upgradeUrl: this.#config.upgradeUrl?.(userId, feature) ?? null, overLimit: false };
      }
      // FAIL-OPEN (default): meter unreachable => never block the customer's app.
      // overLimit stays false — a transient outage is not an over-limit signal.
      return { allowed: true, remaining: -1, upgradeUrl: null, overLimit: false };
    }
    const remaining = Math.max(0, rule.limit - used);
    const allowed = used < rule.limit;
    return {
      allowed,
      remaining,
      upgradeUrl: allowed ? null : (this.#config.upgradeUrl?.(userId, feature) ?? null),
      overLimit,
      blocked,
    };
  }

  /** Meter usage AFTER the work (token count is only known post-call). Never throws.
   *  Returns `{ blocked }` when the hosted counter refused the op (a confirmed hard
   *  block), mirroring check(); `{}` on the fail-open path or when nothing was metered. */
  async record(userId: string, feature: string, usage: Usage = {}): Promise<{ blocked?: BlockedReason }> {
    const rule = await this.ruleFor(userId, feature);
    if (rule === undefined || rule === "unlimited") return {};
    // Meter in the rule's unit: token features count actual tokens (known only
    // after the call returns), everything else counts one per call. A token
    // feature recorded without { tokens } — or any non-positive amount — meters
    // nothing rather than wasting a counter round-trip.
    const amount = rule.unit === "tokens" ? (usage.tokens ?? 0) : (usage.count ?? 1);
    if (amount <= 0) return {};
    try {
      const r = await this.#config.counter.increment(`${userId}:${feature}:${periodKey(rule.period)}`, amount);
      return { blocked: r?.blocked };
    } catch {
      // FAIL-OPEN: a failed record must never break the caller (blocked stays undefined).
      return {};
    }
  }
}
