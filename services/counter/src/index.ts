import { createServer } from "node:http";

// ponytail: in-memory Map, single process, naive — NOT concurrency-correct and
// loses state on restart. That's fine for slice 1 (walking skeleton). Issue #4
// swaps this for a concurrency-correct, period-aware store (e.g. Redis/atomic).
const store = new Map<string, number>();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && url.pathname === "/usage") {
    return json(200, { used: store.get(url.searchParams.get("key") ?? "") ?? 0 });
  }

  if (req.method === "POST" && url.pathname === "/increment") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { key, amount = 1 } = JSON.parse(body || "{}") as { key: string; amount?: number };
    store.set(key, (store.get(key) ?? 0) + amount);
    return json(200, { used: store.get(key) });
  }

  if (req.method === "GET" && url.pathname === "/health") return json(200, { ok: true });

  res.writeHead(404);
  res.end();
});

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => console.log(`counter listening on :${port}`));
