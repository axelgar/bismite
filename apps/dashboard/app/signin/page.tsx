import { requireNoUser } from "@/lib/session";
import { SignInForm } from "./signin-form";

// Already signed in? Don't show the auth form — go to the dashboard.
export default async function SignIn() {
  await requireNoUser();
  return <SignInForm />;
}
