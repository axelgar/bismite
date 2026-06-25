import type { CounterClient } from "./index.js";

/** Hosted Bismite counter — the managed runtime (PRD-hosted-platform §5). Same
 *  wire shape as ./http-counter, plus an `Authorization: Bearer <api key>` header
 *  and the `/v1/usage*` paths the hosted service exposes. The api key resolves to
 *  your project namespace server-side, so one key only ever touches your counts.
 *
 *  Throws on any failure so the SDK's check/record fail-open logic kicks in — a
 *  down hosted counter never takes your app down. `baseUrl` defaults to the
 *  hosted API; point it at your own deployment to self-host (no lock-in). */
export function bismiteCounter(apiKey: string, baseUrl = "https://api.bismite.dev"): CounterClient {
  const auth = { authorization: `Bearer ${apiKey}` };
  return {
    async read(key) {
      const r = await fetch(`${baseUrl}/v1/usage?key=${encodeURIComponent(key)}`, { headers: auth });
      if (!r.ok) throw new Error(`bismite counter read ${r.status}`);
      const data = (await r.json()) as { used?: number };
      return data.used ?? 0;
    },
    async increment(key, amount) {
      const r = await fetch(`${baseUrl}/v1/usage/increment`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ key, amount }),
      });
      if (!r.ok) throw new Error(`bismite counter increment ${r.status}`);
    },
  };
}
