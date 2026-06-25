// Mint a project + test/live keys against a running counter service, no UI yet
// (hosted #2). Secrets are shown ONCE — here. The dashboard owns this in hosted #4.
//
//   pnpm counter                       # in another terminal
//   pnpm issue-key [name] [owner]      # add ADMIN_TOKEN=… if the server sets one
const base = process.env.BISMITE_API_URL ?? "http://localhost:4000";
const [name = "dev", owner = "local"] = process.argv.slice(2);
const headers: Record<string, string> = { "content-type": "application/json" };
if (process.env.ADMIN_TOKEN) headers.authorization = `Bearer ${process.env.ADMIN_TOKEN}`;

const r = await fetch(`${base}/v1/projects`, { method: "POST", headers, body: JSON.stringify({ name, owner }) });
if (!r.ok) {
  console.error(`issue failed: ${r.status} ${await r.text()}`);
  process.exit(1);
}
const { projectId, test, live } = (await r.json()) as { projectId: string; test: string; live: string };
console.log(`project:   ${projectId}`);
console.log(`test key:  ${test}`);
console.log(`live key:  ${live}`);
console.log(`\nWire the example to the test key:\n  export BISMITE_API_KEY=${test}`);
