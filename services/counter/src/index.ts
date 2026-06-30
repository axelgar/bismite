import { createServer } from "node:http";
import { makeStore, createHandler } from "./core.js";
import { makeControlPlane } from "./db.js";

// Local node:http server (`pnpm counter`). Same handler runs on Vercel via
// api/index.ts. Control plane = Neon when DATABASE_URL is set, else file-backed
// PGlite so locally-minted keys survive restarts (the example's dev loop).
if (!process.env.DATABASE_URL && !process.env.PGLITE_DATA) {
  process.env.PGLITE_DATA = `${import.meta.dirname}/../.pglite`;
}
const handler = createHandler(
  makeControlPlane(process.env),
  makeStore(process.env),
  process.env.ADMIN_TOKEN,
  Number(process.env.RATE_LIMIT_PER_MIN ?? 6000), // per-project/min; 0 disables
  process.env.CRON_SECRET,
);

const port = Number(process.env.PORT ?? 4000);
createServer(handler).listen(port, () => console.log(`counter listening on :${port}`));
