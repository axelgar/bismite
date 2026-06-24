// Waitlist signups -> Upstash set (SADD dedupes by email). Reuses the same
// Upstash creds as the usage counter, so there's no extra infra to run.
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return Response.json({ error: "waitlist not configured" }, { status: 503 });

  const r = await fetch(`${url}/sadd/bismite:waitlist/${encodeURIComponent(email)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) return Response.json({ error: "store failed" }, { status: 502 });

  return Response.json({ ok: true });
}
