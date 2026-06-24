// Plan + customer linkage store. Upstash-backed when configured (serverless-safe
// and persistent — works on Vercel); in-memory fallback for a zero-setup local
// run. The Stripe webhook is the writer; reconciliation can rebuild it.
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(URL_ && TOKEN);

const mem = new Map<string, string>(); // fallback only (resets on restart)

async function cmd(parts: string[]): Promise<string | undefined> {
  const path = parts.map(encodeURIComponent).join("/");
  const r = await fetch(`${URL_}/${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`upstash ${parts[0]} ${r.status}`);
  const d = (await r.json()) as { result: string | null };
  return d.result ?? undefined;
}

async function get(key: string): Promise<string | undefined> {
  return useUpstash ? cmd(["get", key]) : mem.get(key);
}
async function set(key: string, val: string): Promise<void> {
  if (useUpstash) await cmd(["set", key, val]);
  else mem.set(key, val);
}

export async function getPlan(userId: string): Promise<string> {
  return (await get(`bismite:plan:${userId}`)) ?? "free";
}
export async function setPlan(userId: string, plan: string): Promise<void> {
  await set(`bismite:plan:${userId}`, plan);
}
export async function linkCustomer(userId: string, customerId: string): Promise<void> {
  await set(`bismite:cust:u:${userId}`, customerId);
  await set(`bismite:cust:c:${customerId}`, userId);
}
export async function userForCustomer(customerId: string): Promise<string | undefined> {
  return get(`bismite:cust:c:${customerId}`);
}
export async function customerForUser(userId: string): Promise<string | undefined> {
  return get(`bismite:cust:u:${userId}`);
}
