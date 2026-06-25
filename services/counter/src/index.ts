import { createServer } from "node:http";
import { resolveProject, makeStore, createHandler } from "./core.ts";

// Local node:http server (`pnpm counter`). The same handler runs on Vercel via
// api/index.ts. Seeded api-key -> project map (issuance + control plane = hosted #2).
const handler = createHandler(resolveProject.parse(process.env.BISMITE_API_KEYS), makeStore(process.env));

const port = Number(process.env.PORT ?? 4000);
createServer(handler).listen(port, () => console.log(`counter listening on :${port}`));
