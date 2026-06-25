// Pure-ish counter core: key auth, tenant namespacing, the store seam, and the
// shared request handler. Kept out of index.ts so it's testable without booting a
// server and reusable by both the local server and the Vercel function.
import type { IncomingMessage, ServerResponse } from "node:http";

// Built-in dev seed so the example + smoke run with zero config. Real keys are
// seeded via BISMITE_API_KEYS in deploys; issuance (hashed, test/live) is hosted #2.
const DEFAULT_KEYS = "bsk_test_dev=proj_dev,bsk_test_other=proj_other";

/** Resolve `Authorization: Bearer <key>` -> project id, or null (=> 401). */
export function resolveProject(
  authHeader: string | undefined,
  keys: Record<string, string>,
): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  return (m && keys[m[1]]) || null;
}
/** Parse the seeded "key=proj,key2=proj2" map (defaults to the dev seed). */
resolveProject.parse = (raw: string | undefined): Record<string, string> =>
  Object.fromEntries(
    (raw || DEFAULT_KEYS)
      .split(",")
      .map((p) => p.trim().split("="))
      .filter(([k, v]) => k && v),
  );

/** Tenant namespace: a key from project A can never read/write project B's counts. */
export function nsKey(proj: string, key: string): string {
  return `${proj}:${key}`;
}

export interface Store {
  read(key: string): Promise<number>;
  increment(key: string, amount: number): Promise<number>;
}

/** The HTTP request handler, framework-agnostic over node's req/res. Shared by the
 *  local node:http server (src/index.ts) and the Vercel function (api/index.ts) so
 *  routing/auth/validation live in exactly one place. Paths are matched by suffix
 *  so it works whether the host serves `/v1/usage` or rewrites it under `/api`. */
export function createHandler(keys: Record<string, string>, store: Store) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (req.method === "GET" && path.endsWith("/health")) return json(200, { ok: true });

      // Everything under /v1 is authed: Bearer key -> project, or 401. The project
      // id becomes the key prefix, so a tenant can only touch its own namespace.
      const proj = resolveProject(req.headers.authorization, keys);
      if (!proj) return json(401, { error: "invalid api key" });

      if (req.method === "POST" && path.endsWith("/v1/usage/increment")) {
        let parsed: { key?: unknown; amount?: unknown };
        let pre: unknown;
        try {
          // Some hosts (Vercel) expose a lazily-parsed body getter that throws on
          // malformed JSON — turn that into a clean 400 rather than a 500.
          pre = (req as { body?: unknown }).body;
        } catch {
          return json(400, { error: "invalid json" });
        }
        if (pre !== undefined && pre !== null) {
          // Host already parsed the body (e.g. Vercel) — use it instead of the stream.
          try {
            parsed = typeof pre === "string" ? JSON.parse(pre || "{}") : (pre as object);
          } catch {
            return json(400, { error: "invalid json" });
          }
        } else {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 4096) return json(413, { error: "body too large" });
          }
          try {
            parsed = JSON.parse(raw || "{}");
          } catch {
            return json(400, { error: "invalid json" });
          }
        }
        const { key, amount = 1 } = parsed;
        if (typeof key !== "string" || !key) return json(400, { error: "missing key" });
        if (typeof amount !== "number" || !Number.isFinite(amount)) {
          return json(400, { error: "invalid amount" });
        }
        return json(200, { used: await store.increment(nsKey(proj, key), amount) });
      }

      if (req.method === "GET" && path.endsWith("/v1/usage")) {
        const key = url.searchParams.get("key");
        if (!key) return json(400, { error: "missing key" });
        return json(200, { used: await store.read(nsKey(proj, key)) });
      }

      res.writeHead(404);
      res.end();
    } catch (err) {
      // Never hang a request on an unexpected error (e.g. a store/network blip).
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
    const m = new Map<string, number>();
    return {
      async read(k) {
        return m.get(k) ?? 0;
      },
      async increment(k, amount) {
        const v = (m.get(k) ?? 0) + amount;
        m.set(k, v);
        return v;
      },
    };
  }
  const ttl = 60 * 60 * 24 * 40;
  const cmd = async (parts: (string | number)[]): Promise<unknown> => {
    const path = parts.map((p) => encodeURIComponent(String(p))).join("/");
    const r = await fetch(`${url}/${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`upstash ${r.status}`);
    return ((await r.json()) as { result: unknown }).result;
  };
  return {
    async read(k) {
      return Number((await cmd(["GET", k])) ?? 0);
    },
    async increment(k, amount) {
      const v = Number(await cmd(["INCRBY", k, amount]));
      await cmd(["EXPIRE", k, ttl]); // bound storage; old period buckets self-delete
      return v;
    },
  };
}
