import { requireNoUser } from "@/lib/session";
import { SignInForm } from "./signin-form";

// `redirect` lets an invite link bounce an un-authed user through sign-in and back to the
// accept page. Only same-origin relative paths are honored (no open redirects).
function safeDest(dest?: string) {
  return dest && dest.startsWith("/") && !dest.startsWith("//") ? dest : "/dashboard";
}

// Already signed in? Don't show the auth form — go straight to the destination.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const dest = safeDest((await searchParams).redirect);
  await requireNoUser(dest);
  return <SignInForm redirect={dest} />;
}
