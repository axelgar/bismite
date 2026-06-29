import { bismite } from "../../../bismite.config";
import { getPlan } from "../../../lib/plan-store";

// GET: current plan/quota without consuming — lets the UI show the right copy on load.
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") ?? "demo-user";
  const access = await bismite.check(userId, "chat-message");
  const unlimited = access.remaining === Infinity;
  return Response.json({
    plan: await getPlan(userId),
    unlimited,
    remaining: unlimited ? null : access.remaining, // Infinity -> null isn't JSON-safe
  });
}

// POST: the whole product in one route — gate before, meter after.
export async function POST(req: Request) {
  const { userId = "demo-user", message = "" } = await req.json();

  const access = await bismite.check(userId, "chat-message");
  // Bismite itself refused (this app's provider hit a Bismite tier ceiling) — distinct from
  // THIS end-user hitting their own plan limit below. Surface the reason so the demo shows
  // the right copy ("the app's free Bismite limit was reached") rather than a generic block.
  if (access.blocked) {
    return Response.json(
      { error: "bismite_blocked", blocked: access.blocked, plan: await getPlan(userId) },
      { status: 402 },
    );
  }
  if (!access.allowed) {
    return Response.json(
      { error: "limit_reached", upgradeUrl: access.upgradeUrl, plan: await getPlan(userId) },
      { status: 402 },
    );
  }

  // ponytail: mock LLM. In a real app this is openai.chat.completions.create(...)
  // — and you'd record { tokens: completion.usage.total_tokens } instead.
  const reply = `echo: ${message}`;

  await bismite.record(userId, "chat-message", { count: 1 });
  const unlimited = access.remaining === Infinity;
  return Response.json({
    reply,
    plan: await getPlan(userId),
    unlimited,
    remaining: unlimited ? null : access.remaining - 1,
  });
}
