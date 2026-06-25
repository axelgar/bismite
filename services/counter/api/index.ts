// Vercel entry. vercel.json rewrites every path here; createHandler matches by
// suffix, so /v1/usage and /health route correctly. This package is ESM
// ("type":"module"), so Vercel compiles core.ts -> core.js and the runtime import
// must use the ".js" specifier (NodeNext) — distinct from the local server's
// "./core.ts" (Node type-stripping). api/ only ever runs on Vercel, so .js is safe.
// The handler tolerates Vercel's pre-parsed req.body, so no bodyParser config needed.
import { resolveProject, makeStore, createHandler } from "../src/core.js";

export default createHandler(
  resolveProject.parse(process.env.BISMITE_API_KEYS),
  makeStore(process.env),
);
