import type { CounterClient } from "./index.ts";

/** Upstash Redis usage meter (issue #4). Correct across instances/regions:
 *  INCRBY is atomic, so concurrent records never lose or double-count. Keys are
 *  period-scoped by the SDK (`user:feature:2026-06`), so a new period starts at
 *  zero; EXPIRE auto-cleans old buckets. Uses the Upstash REST API — no deps.
 *
 *  ttlSeconds defaults to ~40 days so a monthly bucket survives its full period
 *  plus slack before cleanup. */
export function upstashCounter(
  url: string,
  token: string,
  ttlSeconds = 60 * 60 * 24 * 40,
): CounterClient {
  async function cmd(parts: (string | number)[]): Promise<unknown> {
    const path = parts.map((p) => encodeURIComponent(String(p))).join("/");
    const r = await fetch(`${url}/${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`upstash ${r.status}`);
    return (await r.json() as { result: unknown }).result;
  }

  return {
    async read(key) {
      return Number((await cmd(["GET", key])) ?? 0);
    },
    async increment(key, amount) {
      await cmd(["INCRBY", key, amount]);
      await cmd(["EXPIRE", key, ttlSeconds]); // bound storage; old period buckets self-delete
    },
  };
}
