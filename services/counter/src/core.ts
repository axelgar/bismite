// Counter HTTP core: key auth (via the control plane), tenant + mode namespacing,
// the store seam, and the shared request handler. Kept out of index.ts so it's
// testable without booting a server and reusable by the local server + Vercel fn.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlPlane, Mode } from "./db.js";
import { PLANS, planFor, type PlanId } from "./plans.js";
import {
  meter,
  summary,
  orgSummary,
  rateLimited,
  utcDay,
  mtuCeilingBlock,
  callsCeilingBlock,
  testCapBlock,
  overageDelta,
  overageUnbank,
  type BlockedReason,
} from "./metering.js";

/** Tenant + mode namespace: a key from project A can never read/write project B's
 *  counts, and a project's `test` traffic is isolated from its `live` counts. */
export function nsKey(proj: string, mode: Mode, key: string): string {
  return `${proj}:${mode}:${key}`;
}

export interface Store {
  read(key: string): Promise<number>;
  /** INCRBY + (re)set a bounded TTL so period/window buckets self-clean. */
  increment(key: string, amount: number, ttlSeconds?: number): Promise<number>;
  /** SADD a member to a set (for distinct-user / MTU counting) + bound its TTL. */
  addMember(key: string, member: string, ttlSeconds?: number): Promise<void>;
  /** SCARD — set cardinality (e.g. distinct MTU users this period). */
  setSize(key: string): Promise<number>;
  /** SISMEMBER — is `member` already in the set? Lets the MTU ceiling pass an
   *  already-counted user without adding a new one (the "never evict" rule). */
  isMember(key: string, member: string): Promise<boolean>;
}

// ~40-day TTL: outlives a calendar-month bucket, then the key self-deletes.
const MONTH_TTL = 60 * 60 * 24 * 40;

/** Bearer token off a request, or null. Used for both API keys and the admin token. */
function bearer(authHeader: string | undefined): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  return m ? m[1] : null;
}

/** Read+parse a JSON body, tolerating hosts (Vercel) that pre-parse req.body.
 *  Throws "invalid json" / "body too large" so the handler can map them to 400/413. */
async function readJson(req: IncomingMessage): Promise<any> {
  let pre: unknown;
  try {
    pre = (req as { body?: unknown }).body;
  } catch {
    throw new Error("invalid json");
  }
  if (pre !== undefined && pre !== null) {
    try {
      return typeof pre === "string" ? JSON.parse(pre || "{}") : pre;
    } catch {
      throw new Error("invalid json");
    }
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("body too large");
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("invalid json");
  }
}

/** The HTTP request handler, framework-agnostic over node's req/res. Shared by the
 *  local node:http server (src/index.ts) and the Vercel function (api/index.ts).
 *  Paths are matched by suffix so it works whether the host serves `/v1/usage` or
 *  rewrites it under `/api`. `adminToken` guards key issuance (unset => open, for
 *  local dev; the dashboard + better-auth own real issuance authz in hosted #4). */
export function createHandler(
  cp: ControlPlane,
  store: Store,
  adminToken?: string,
  rateLimitPerMin = 0,
  cronSecret?: string,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const body = async () => {
      try {
        return { ok: true as const, data: await readJson(req) };
      } catch (e) {
        json((e as Error).message === "body too large" ? 413 : 400, { error: (e as Error).message });
        return { ok: false as const };
      }
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (req.method === "GET" && path.endsWith("/health")) return json(200, { ok: true });

      // --- Admin: key issuance (no API key; guarded by the admin token when set). ---
      const isAdmin = !adminToken || bearer(req.headers.authorization) === adminToken;

      if (req.method === "POST" && path.endsWith("/v1/projects")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { name = "", org = "" } = b.data ?? {};
        try {
          const out = await cp.createProject(String(name), String(org));
          return json(200, out); // secrets revealed once, here only
        } catch (e) {
          // Free = 1 project (v2/B): surface a distinct 403 the dashboard can message + CTA.
          if ((e as Error).message === "free_one_project") {
            return json(403, { error: "free_one_project" });
          }
          throw e;
        }
      }

      if (req.method === "POST" && path.endsWith("/v1/keys/regenerate")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { projectId, mode } = b.data ?? {};
        if (typeof projectId !== "string" || (mode !== "test" && mode !== "live")) {
          return json(400, { error: "projectId and mode (test|live) required" });
        }
        return json(200, { key: await cp.regenerate(projectId, mode) });
      }

      // --- Admin: set an ORG's billing tier (settable manually for seeds/Enterprise). ---
      if (req.method === "POST" && path.endsWith("/v1/projects/plan")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { orgId, plan } = b.data ?? {};
        if (typeof orgId !== "string" || typeof plan !== "string" || !(plan in PLANS)) {
          return json(400, { error: "orgId and plan (free|pro|enterprise) required" });
        }
        await cp.setPlan(orgId, plan as PlanId);
        return json(200, { orgId, plan });
      }

      // --- Admin: Stripe-authoritative tier flip (v2/B). Called by the dashboard's verified
      // webhook: sets the ORG's plan and (on first checkout) its stripe customer id. ---
      if (req.method === "POST" && path.endsWith("/v1/projects/billing")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { orgId, plan, stripeCustomerId } = b.data ?? {};
        if (typeof orgId !== "string" || typeof plan !== "string" || !(plan in PLANS)) {
          return json(400, { error: "orgId and plan (free|pro|enterprise) required" });
        }
        await cp.setBilling(
          orgId,
          plan as PlanId,
          typeof stripeCustomerId === "string" ? stripeCustomerId : undefined,
        );
        return json(200, { orgId, plan });
      }

      // Dashboard read path: an org's projects (+ key metadata, no secrets). The dashboard
      // passes the session's active org as ?org, then scopes its whole UI to this.
      if (req.method === "GET" && path.endsWith("/v1/projects")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        return json(200, await cp.listProjects(url.searchParams.get("org") ?? ""));
      }

      // Dashboard read path: usage by projectId behind the admin token. Keys are
      // hashed at rest, so the dashboard can't auth as the project — it reads by id.
      // (SDK callers hit the key-authed summary below and never pass ?projectId.)
      if (req.method === "GET" && path.endsWith("/v1/usage/summary") && url.searchParams.has("projectId")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        return json(200, await summary(store, url.searchParams.get("projectId")!));
      }

      // Dashboard + overage-reconcile read path: an ORG's authoritative MTU this period
      // (distinct users across all its projects). The basis for overage billing (v2/B).
      if (req.method === "GET" && path.endsWith("/v1/usage/org") && url.searchParams.has("orgId")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const orgId = url.searchParams.get("orgId")!;
        // Include the ENFORCED plan so the billing + alert crons size limits off the real
        // tier, never a stale "ever had a Stripe customer" proxy (v2/B review fix).
        const [s, plan] = await Promise.all([orgSummary(store, orgId), cp.orgPlan(orgId)]);
        return json(200, { ...s, plan });
      }

      // Overage reconcile (v2/B): the dashboard sends an org's authoritative period overage;
      // we bank it and return only the not-yet-reported DELTA, which the dashboard pushes to
      // the Stripe Meter. Idempotent + missed-run-safe. Admin-guarded.
      if (req.method === "POST" && path.endsWith("/v1/usage/org/overage")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { orgId, overage } = b.data ?? {};
        if (typeof orgId !== "string" || typeof overage !== "number" || !Number.isFinite(overage)) {
          return json(400, { error: "orgId and numeric overage required" });
        }
        return json(200, { delta: await overageDelta(store, orgId, overage) });
      }

      // Overage rollback (v2/B review fix): if the dashboard's Stripe meter push fails after
      // we banked a delta, it calls this to un-bank so the next reconcile retries instead of
      // silently dropping the overage. Admin-guarded.
      if (req.method === "POST" && path.endsWith("/v1/usage/org/overage/unbank")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        const b = await body();
        if (!b.ok) return;
        const { orgId, delta } = b.data ?? {};
        if (typeof orgId !== "string" || typeof delta !== "number" || !Number.isFinite(delta)) {
          return json(400, { error: "orgId and numeric delta required" });
        }
        await overageUnbank(store, orgId, delta);
        return json(200, { ok: true });
      }

      // Dashboard read path: a project's daily snapshot history for trend charts
      // (observability PRD-C #5). Admin-guarded, by projectId — same shape as the
      // summary read above; the dashboard scopes to the owner before calling.
      if (req.method === "GET" && path.endsWith("/v1/usage/history") && url.searchParams.has("projectId")) {
        if (!isAdmin) return json(401, { error: "admin only" });
        return json(200, await cp.listSnapshots(url.searchParams.get("projectId")!));
      }

      // Cron: persist today's MTU/calls for every project so trend is queryable
      // (observability PRD-C). GET because Vercel cron issues GETs; guarded by the
      // admin token OR Vercel's CRON_SECRET bearer. Idempotent per (project, day),
      // so an extra invocation just overwrites today's row.
      if (req.method === "GET" && path.endsWith("/v1/snapshots/run")) {
        // Fail CLOSED: require a real cron secret or a real admin token. Unlike key issuance,
        // this must NOT fall through the "no adminToken => everyone is admin" dev default —
        // an unconfigured deploy would leave the snapshot sweep world-triggerable (v2/B fix).
        const isCron = !!cronSecret && bearer(req.headers.authorization) === cronSecret;
        const isRealAdmin = !!adminToken && bearer(req.headers.authorization) === adminToken;
        if (!isCron && !isRealAdmin) return json(401, { error: "admin or cron only" });
        const day = utcDay();
        const ids = await cp.listAllProjectIds();
        for (const id of ids) {
          const s = await summary(store, id);
          await cp.recordSnapshot(id, day, s.mtu, s.calls);
        }
        return json(200, { day, projects: ids.length });
      }

      // --- Usage: authed by the project's API key -> {project, mode} or 401. ---
      const rawKey = bearer(req.headers.authorization);
      const resolved = rawKey ? await cp.resolveKey(rawKey) : null;
      if (!resolved) return json(401, { error: "invalid api key" });
      const { projectId, mode, orgId } = resolved;
      const plan = planFor(resolved.plan);

      // Billing meters (MTU + calls) for one counter op. Awaited but never allowed to
      // fail the request — a metering blip must not take the hot path down. Awaiting
      // (vs fire-and-forget) so serverless doesn't kill the writes after we respond.
      // Returns the running period totals (or null in test/on error) so the caller can
      // surface the tier over-limit signal.
      const recordUsage = async (key: string) => {
        try {
          return await meter(store, projectId, mode, key, new Date(), orgId);
        } catch (e) {
          console.error("meter error:", e);
          return null;
        }
      };
      // Over the tier's MTU allowance => surface an over-limit signal (PRD §8: MTU is the
      // headline limit). It's advisory only — we never block, so fail-open holds and the
      // app just shows "upgrade". Calls are a guardrail (overage in #6), not blocked here.
      const overMtu = (m: { mtu: number; calls: number } | null) => !!m && m.mtu > plan.mtuIncluded;

      // Free hard ceiling (PRD v2/B): tiers with NO overage cap MTU hard; tiers that bill
      // overage (Pro) pass Infinity => never blocked here. Confirmed block only — any store
      // error throws inside mtuCeilingBlock and we swallow it to fail OPEN (never block on
      // doubt; the block must be a positive signal, never the absence of one).
      // ponytail: this adds a SCARD (+ a SISMEMBER only when at the ceiling) ahead of
      // meter() on the live hot path. Folds into the Upstash pipeline batch when that
      // BACKLOG item lands; until then it's 1–2 extra REST ops on confirmed-over Free.
      const mtuCeiling = plan.mtuOveragePer1k == null ? plan.mtuIncluded : Infinity;
      const safeBlock = async (key: string): Promise<BlockedReason | null> => {
        try {
          // Mode-gated ceilings; first hit wins, all fail OPEN via this try/catch. Live:
          // calls guardrail (every tier) then the Free MTU cap. Test: the flat-100 cap.
          return (
            (await callsCeilingBlock(store, projectId, mode, plan.callsCeiling)) ??
            (await mtuCeilingBlock(store, projectId, mode, key, mtuCeiling)) ??
            (await testCapBlock(store, projectId, mode, key))
          );
        } catch (e) {
          console.error("block check error:", e);
          return null; // FAIL-OPEN
        }
      };

      // Per-project rate limit on the counter hot path (not the dashboard summary).
      const isCounterCall = path.endsWith("/v1/usage/increment") || path.endsWith("/v1/usage");
      if (isCounterCall && (await rateLimited(store, projectId, rateLimitPerMin))) {
        return json(429, { error: "rate limit exceeded" });
      }

      if (req.method === "GET" && path.endsWith("/v1/usage/summary")) {
        return json(200, await summary(store, projectId));
      }

      if (req.method === "POST" && path.endsWith("/v1/usage/increment")) {
        const b = await body();
        if (!b.ok) return;
        const { key, amount = 1 } = b.data ?? {};
        if (typeof key !== "string" || !key) return json(400, { error: "missing key" });
        if (typeof amount !== "number" || !Number.isFinite(amount)) {
          return json(400, { error: "invalid amount" });
        }
        // Refuse a new user past the Free ceiling BEFORE counting them anywhere — neither
        // the dev's own end-user counter nor the MTU set moves. 200 (not 4xx) so the SDK
        // surfaces `blocked` instead of treating it as a fail-open transient.
        const blocked = await safeBlock(key);
        if (blocked) return json(200, { used: await store.read(nsKey(projectId, mode, key)), blocked });
        const used = await store.increment(nsKey(projectId, mode, key), amount);
        const m = await recordUsage(key);
        return json(200, { used, overLimit: overMtu(m) });
      }

      if (req.method === "GET" && path.endsWith("/v1/usage")) {
        const key = url.searchParams.get("key");
        if (!key) return json(400, { error: "missing key" });
        const used = await store.read(nsKey(projectId, mode, key));
        const blocked = await safeBlock(key);
        if (blocked) return json(200, { used, blocked });
        const m = await recordUsage(key);
        return json(200, { used, overLimit: overMtu(m) });
      }

      res.writeHead(404);
      res.end();
    } catch (err) {
      // Never hang a request on an unexpected error (e.g. a store/DB blip).
      console.error("counter error:", err);
      if (!res.headersSent) json(500, { error: "internal error" });
    }
  };
}

/** Upstash REST when configured (atomic INCRBY + EXPIRE, period buckets self-clean),
 *  else an in-memory Map for zero-setup local dev. ~40-day TTL outlives a month bucket. */
export function makeStore(env: Record<string, string | undefined>): Store {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // TTLs are no-ops in memory (single dev process; buckets just live until exit).
    const m = new Map<string, number>();
    const sets = new Map<string, Set<string>>();
    return {
      async read(k) {
        return m.get(k) ?? 0;
      },
      async increment(k, amount) {
        const v = (m.get(k) ?? 0) + amount;
        m.set(k, v);
        return v;
      },
      async addMember(k, member) {
        let set = sets.get(k);
        if (!set) sets.set(k, (set = new Set()));
        set.add(member);
      },
      async setSize(k) {
        return sets.get(k)?.size ?? 0;
      },
      async isMember(k, member) {
        return sets.get(k)?.has(member) ?? false;
      },
    };
  }
  const cmd = async (parts: (string | number)[]): Promise<unknown> => {
    const path = parts.map((p) => encodeURIComponent(String(p))).join("/");
    const r = await fetch(`${url}/${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`upstash ${r.status}`);
    return ((await r.json()) as { result: unknown }).result;
  };
  // ponytail: INCRBY+EXPIRE (and SADD+EXPIRE) are 2 REST calls each — the hot path
  // now runs a handful per request. Batch via Upstash pipeline / EXPIRE NX if the
  // Redis op count ever shows up on the bill.
  return {
    async read(k) {
      return Number((await cmd(["GET", k])) ?? 0);
    },
    async increment(k, amount, ttl = MONTH_TTL) {
      const v = Number(await cmd(["INCRBY", k, amount]));
      await cmd(["EXPIRE", k, ttl]); // bound storage; old period buckets self-delete
      return v;
    },
    async addMember(k, member, ttl = MONTH_TTL) {
      await cmd(["SADD", k, member]);
      await cmd(["EXPIRE", k, ttl]);
    },
    async setSize(k) {
      return Number((await cmd(["SCARD", k])) ?? 0);
    },
    async isMember(k, member) {
      return Number((await cmd(["SISMEMBER", k, member])) ?? 0) === 1;
    },
  };
}
