// Rebuild local plan state from Stripe (bulk reconciliation). Recovers from
// missed/lost webhooks or a wiped in-memory store. Run: node --env-file=.env scripts/reconcile-from-stripe.mjs
import { writeFileSync } from "node:fs";

const KEY = process.env.STRIPE_SECRET_KEY;
const PRICE = process.env.STRIPE_PRICE_PRO;
if (!KEY) { console.error("STRIPE_SECRET_KEY missing"); process.exit(1); }

async function stripe(path) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { authorization: `Bearer ${KEY}` } });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

const sessions = await stripe("checkout/sessions?limit=20");
const state = { plan: {}, cust: {} };

for (const s of sessions.data) {
  if (s.status !== "complete" || !s.client_reference_id || !s.customer) continue;
  let plan = "free";
  if (s.subscription) {
    const sub = await stripe(`subscriptions/${s.subscription}`);
    const active = sub.status === "active" || sub.status === "trialing";
    const priceId = sub.items?.data?.[0]?.price?.id;
    plan = active && priceId === PRICE ? "pro" : "free";
  }
  state.plan[s.client_reference_id] = plan;
  state.cust[`u:${s.client_reference_id}`] = s.customer;
  state.cust[`c:${s.customer}`] = s.client_reference_id;
  console.log(`${s.client_reference_id} -> ${plan} (customer ${s.customer})`);
}

writeFileSync(".bismite-state.json", JSON.stringify(state, null, 2));
console.log("wrote .bismite-state.json");
