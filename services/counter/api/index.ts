// Vercel entry. vercel.json rewrites every path here; createHandler matches by
// suffix, so /v1/usage and /health route correctly. This service is NodeNext ESM:
// every relative import uses the ".js" specifier (Vercel compiles .ts -> .js and
// keeps the specifier literal). Locally we run via tsx, which resolves ".js" -> the
// real ".ts" file. The handler tolerates Vercel's pre-parsed req.body, no bodyParser.
import { makeStore, createHandler } from "../src/core.js";
import { makeControlPlane } from "../src/db.js";

export default createHandler(
  makeControlPlane(process.env),
  makeStore(process.env),
  process.env.ADMIN_TOKEN,
  Number(process.env.RATE_LIMIT_PER_MIN ?? 6000), // per-project/min; 0 disables
);
