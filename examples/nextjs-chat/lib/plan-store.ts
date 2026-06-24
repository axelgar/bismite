import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ponytail: file-backed JSON so plan state survives `next dev` hot-reloads
// (module-level Maps reset on recompile, which is confusing mid-demo) and server
// restarts. Single-instance only; a real app persists this on the user row in
// its DB. The Stripe webhook is the writer.
const FILE = join(process.cwd(), ".bismite-state.json");

type State = { plan: Record<string, string>; cust: Record<string, string> };

function load(): State {
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return { plan: {}, cust: {} };
  }
}
function save(s: State): void {
  try { writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch { /* best-effort */ }
}

export function getPlan(userId: string): string {
  return load().plan[userId] ?? "free";
}
export function setPlan(userId: string, plan: string): void {
  const s = load();
  s.plan[userId] = plan;
  save(s);
}
export function linkCustomer(userId: string, customerId: string): void {
  const s = load();
  s.cust[`u:${userId}`] = customerId;
  s.cust[`c:${customerId}`] = userId;
  save(s);
}
export function userForCustomer(customerId: string): string | undefined {
  return load().cust[`c:${customerId}`];
}
export function customerForUser(userId: string): string | undefined {
  return load().cust[`u:${userId}`];
}
