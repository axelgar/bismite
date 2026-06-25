// Control plane: project + API-key lifecycle and the key->project resolver the
// counter hot path calls. Postgres (Neon) is the source of truth; resolution is
// cached in-process so the hot path rarely touches the DB (PRD §6, §7).
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { apiKeys, projects } from "./schema.js";

export type Mode = "test" | "live";

export interface ControlPlane {
  /** Bearer key -> {project, mode}, cached; null => unknown/revoked (=> 401). */
  resolveKey(rawKey: string): Promise<{ projectId: string; mode: Mode } | null>;
  /** Create a project and mint both keys. Secrets are returned ONCE, here only. */
  createProject(name: string, owner: string): Promise<{ projectId: string; test: string; live: string }>;
  /** Replace a project's key for one mode; old key stops resolving. Returns the new secret. */
  regenerate(projectId: string, mode: Mode): Promise<string>;
}

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const id = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;
const secret = (mode: Mode) => `bsk_${mode}_${randomBytes(24).toString("base64url")}`;

// ponytail: per-instance Map cache, ~30s TTL. Postgres stays source of truth.
// Cross-instance invalidation (regenerate on instance A) is bounded by TTL; swap in
// shared Redis if that staleness window ever matters.
const TTL_MS = 30_000;

/** Neon (DATABASE_URL) for deploys, else PGlite in-memory for zero-config local dev
 *  + tests — both run the exact same Drizzle queries and migration files. */
export function makeControlPlane(env: Record<string, string | undefined>): ControlPlane {
  // Lazy, memoized init so the Vercel handler can be built synchronously; PGlite
  // also needs an async migrate() before first use.
  let ready: Promise<any> | undefined;
  const db = () =>
    (ready ??= (async () => {
      const url = env.DATABASE_URL;
      if (url) {
        const { drizzle } = await import("drizzle-orm/neon-http");
        const { neon } = await import("@neondatabase/serverless");
        return drizzle(neon(url), { schema: { projects, apiKeys } });
      }
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      // PGLITE_DATA => file-backed (local server keeps minted keys across restarts);
      // unset => in-memory (tests, smoke — the server is the only DB holder).
      const d = drizzle(new PGlite(env.PGLITE_DATA), { schema: { projects, apiKeys } });
      await migrate(d, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
      return d;
    })());

  const cache = new Map<string, { val: { projectId: string; mode: Mode } | null; exp: number }>();

  return {
    async resolveKey(rawKey) {
      const h = hash(rawKey);
      const hit = cache.get(h);
      if (hit && hit.exp > Date.now()) return hit.val; // hot path: no DB, no last_used write
      const d = await db();
      const [row] = await d
        .select({ projectId: apiKeys.projectId, mode: apiKeys.mode })
        .from(apiKeys)
        .where(eq(apiKeys.hashedKey, h))
        .limit(1);
      const val = row ? { projectId: row.projectId, mode: row.mode as Mode } : null;
      cache.set(h, { val, exp: Date.now() + TTL_MS });
      // Best-effort, fire-and-forget — never block resolution on the usage stamp.
      if (val) d.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.hashedKey, h)).catch(() => {});
      return val;
    },

    async createProject(name, owner) {
      const d = await db();
      const projectId = id("proj");
      await d.insert(projects).values({ id: projectId, name, owner });
      const test = secret("test");
      const live = secret("live");
      await d.insert(apiKeys).values([
        { id: id("key"), projectId, hashedKey: hash(test), mode: "test" },
        { id: id("key"), projectId, hashedKey: hash(live), mode: "live" },
      ]);
      return { projectId, test, live };
    },

    async regenerate(projectId, mode) {
      const d = await db();
      const key = secret(mode);
      await d.delete(apiKeys).where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.mode, mode)));
      await d.insert(apiKeys).values({ id: id("key"), projectId, hashedKey: hash(key), mode });
      cache.clear(); // rare op — drop the whole cache so the old key stops resolving now
      return key;
    },
  };
}
