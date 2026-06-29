import { requireNoUser } from "@/lib/session";
import { ResetForm } from "./reset-form";

// If you're already signed in you can change your password from the app — no reason to
// be on the reset page. (Edge: a logged-in user with a reset link is bounced to the
// dashboard; they can sign out first if they really want the email flow.)
export default async function ResetPassword() {
  await requireNoUser();
  return <ResetForm />;
}
