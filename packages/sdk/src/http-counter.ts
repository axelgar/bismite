import type { CounterClient } from "./index.js";

/** HTTP-backed usage meter. Throws on any failure so the SDK's check/record
 *  fail-open logic kicks in. The base URL points at the counter service. */
export function httpCounter(baseUrl: string): CounterClient {
  return {
    async read(key) {
      const r = await fetch(`${baseUrl}/usage?key=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`counter read ${r.status}`);
      const data = (await r.json()) as { used?: number };
      return data.used ?? 0;
    },
    async increment(key, amount) {
      const r = await fetch(`${baseUrl}/increment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, amount }),
      });
      if (!r.ok) throw new Error(`counter increment ${r.status}`);
    },
  };
}
