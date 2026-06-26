// Control plane: project + API-key lifecycle and the key->project resolver the
// counter hot path calls. Postgres (Neon) is the source of truth; resolution is
// cached in-process so the hot path rarely touches the DB (PRD §6, §7).
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { apiKeys, projects } from "./schema.js";

export type Mode = "test" | "live";

/** A project plus its per-mode key metadata, no secrets — the #4 dashboard read shape. */
export interface ProjectView {
  projectId: string;
  name: string;
  createdAt: Date;
  keys: Array<{ mode: Mode; createdAt: Date; lastUsedAt: Date | null }>;
}

export interface ControlPlane {
  /** Bearer key -> {project, mode}, cached; null => unknown/revoked (=> 401). */
  resolveKey(rawKey: string): Promise<{ projectId: string; mode: Mode } | null>;
  /** Create a project and mint both keys. Secrets are returned ONCE, here only. */
  createProject(name: string, owner: string): Promise<{ projectId: string; test: string; live: string }>;
  /** Replace a project's key for one mode; old key stops resolving. Returns the new secret. */
  regenerate(projectId: string, mode: Mode): Promise<string>;
  /** Projects owned by `owner` (+ key metadata, no secrets). The dashboard scopes
   *  every view to the logged-in user via this — it's the per-user authz boundary. */
  listProjects(owner: string): Promise<ProjectView[]>;
}

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const id = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;
const secret = (mode: Mode) => `bsk_${mode}_${randomBytes(24).toString("base64url")}`;

// ponytail: per-instance Map cache, ~30s TTL. Postgres stays source of truth.
// Cross-instance invalidation (regenerate on instance A) is bounded by TTL; swap in
// shared Redis if that staleness window ever matters.
const TTL_MS = 30_000;
// Unknown keys get a much shorter negative cache: still absorbs bad-key/abuse
// floods, but a just-minted key resolves within seconds instead of being shadowed
// as "missing" for the full hit-TTL.
const NEG_TTL_MS = 5_000;

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
      cache.set(h, { val, exp: Date.now() + (val ? TTL_MS : NEG_TTL_MS) });
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
      const hashed = hash(key);
      // Single atomic upsert on the (project_id, mode) unique constraint — replaces
      // the mode's key in one statement, so there's no window where the project is
      // keyless. (A delete+insert isn't atomic, and the neon-http prod driver has no
      // transactions, so the upsert is the right tool here.)
      await d
        .insert(apiKeys)
        .values({ id: id("key"), projectId, hashedKey: hashed, mode })
        .onConflictDoUpdate({
          target: [apiKeys.projectId, apiKeys.mode],
          set: { hashedKey: hashed, createdAt: new Date(), lastUsedAt: null },
        });
      cache.clear(); // rare op — drop the whole cache so the old key stops resolving now
      return key;
    },

    async listProjects(owner) {
      const d = await db();
      const projs = await d.select().from(projects).where(eq(projects.owner, owner));
      if (projs.length === 0) return [];
      // Two queries + group in JS — clearer than a join and the row counts are tiny
      // (a dev's handful of projects, ≤2 keys each). Secrets are never selected.
      const ids = projs.map((p) => p.id);
      const keys = await d
        .select({
          projectId: apiKeys.projectId,
          mode: apiKeys.mode,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
        })
        .from(apiKeys)
        .where(inArray(apiKeys.projectId, ids));
      const byProj = new Map<string, ProjectView["keys"]>();
      for (const k of keys) {
        const list = byProj.get(k.projectId) ?? [];
        list.push({ mode: k.mode as Mode, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt });
        byProj.set(k.projectId, list);
      }
      return projs.map((p) => ({
        projectId: p.id,
        name: p.name,
        createdAt: p.createdAt,
        keys: byProj.get(p.id) ?? [],
      }));
    },
  };
}
