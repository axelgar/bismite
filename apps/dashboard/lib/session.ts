// Server-side session gate. requireUser() is the one authz call every dashboard page
// makes before touching the counter — no session => bounce to /signin.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function requireUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/signin");
  return s.user;
}
