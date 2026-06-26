// Counter HTTP core: key auth (via the control plane), tenant + mode namespacing,
// the store seam, and the shared request handler. Kept out of index.ts so it's
// testable without booting a server and reusable by the local server + Vercel fn.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlPlane, Mode } from "./db.js";
import { meter, summary, rateLimited } from "./metering.js";

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
export function createHandler(cp: ControlPlane, store: Store, adminToken?: string, rateLimitPerMin = 0) {
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
        const { name = "", owner = "" } = b.data ?? {};
        const out = await cp.createProject(String(name), String(owner));
        return json(200, out); // secrets revealed once, here only
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

      // --- Usage: authed by the project's API key -> {project, mode} or 401. ---
      const rawKey = bearer(req.headers.authorization);
      const resolved = rawKey ? await cp.resolveKey(rawKey) : null;
      if (!resolved) return json(401, { error: "invalid api key" });
      const { projectId, mode } = resolved;

      // Billing meters (MTU + calls) for one counter op. Awaited but never allowed to
      // fail the request — a metering blip must not take the hot path down. Awaiting
      // (vs fire-and-forget) so serverless doesn't kill the writes after we respond.
      const recordUsage = async (key: string) => {
        try {
          await meter(store, projectId, mode, key);
        } catch (e) {
          console.error("meter error:", e);
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
        const used = await store.increment(nsKey(projectId, mode, key), amount);
        await recordUsage(key);
        return json(200, { used });
      }

      if (req.method === "GET" && path.endsWith("/v1/usage")) {
        const key = url.searchParams.get("key");
        if (!key) return json(400, { error: "missing key" });
        const used = await store.read(nsKey(projectId, mode, key));
        await recordUsage(key);
        return json(200, { used });
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
  };
}
