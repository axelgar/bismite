// Rebuild plan state from Stripe into Upstash (bulk reconciliation). Recovers
// from missed/lost webhooks. Run: node --env-file=.env scripts/reconcile-from-stripe.mjs
const KEY = process.env.STRIPE_SECRET_KEY;
const PRICE = process.env.STRIPE_PRICE_PRO;
const U_URL = process.env.UPSTASH_REDIS_REST_URL;
const U_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!KEY) { console.error("STRIPE_SECRET_KEY missing"); process.exit(1); }
if (!U_URL || !U_TOKEN) { console.error("UPSTASH_REDIS_REST_URL / _TOKEN missing"); process.exit(1); }

async function stripe(path) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { authorization: `Bearer ${KEY}` } });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}
async function redis(...parts) {
  const path = parts.map(encodeURIComponent).join("/");
  const r = await fetch(`${U_URL}/${path}`, { headers: { authorization: `Bearer ${U_TOKEN}` } });
  if (!r.ok) throw new Error(`upstash ${parts[0]} ${r.status}`);
  return (await r.json()).result;
}

const sessions = await stripe("checkout/sessions?limit=20");

for (const s of sessions.data) {
  if (s.status !== "complete" || !s.client_reference_id || !s.customer) continue;
  let plan = "free";
  if (s.subscription) {
    const sub = await stripe(`subscriptions/${s.subscription}`);
    const active = sub.status === "active" || sub.status === "trialing";
    const priceId = sub.items?.data?.[0]?.price?.id;
    plan = active && priceId === PRICE ? "pro" : "free";
  }
  await redis("set", `bismite:plan:${s.client_reference_id}`, plan);
  await redis("set", `bismite:cust:u:${s.client_reference_id}`, s.customer);
  await redis("set", `bismite:cust:c:${s.customer}`, s.client_reference_id);
  console.log(`${s.client_reference_id} -> ${plan} (customer ${s.customer})`);
}

console.log("reconciled into Upstash");
