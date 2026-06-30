import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Wordmark } from "@/components/logo";
import { AcceptInvite } from "./accept-invite";

// Landing for an emailed invite link. Must be signed in as the invited email — getInvitation
// enforces that — so we bounce un-authed visitors through sign-in (which carries them back).
// A not-yet-registered invitee can sign up there: the pending invite bypasses the allowlist.
export default async function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect(`/signin?redirect=/accept-invitation/${id}`);

  let invite: Awaited<ReturnType<typeof auth.api.getInvitation>> | null = null;
  try {
    invite = await auth.api.getInvitation({ query: { id }, headers: h });
  } catch {
    invite = null; // expired, already handled, or addressed to a different email
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div className="halo left-1/2 top-0 h-[420px] w-[560px] -translate-x-1/2" />
      <div className="relative w-full max-w-[400px] text-center">
        <div className="flex justify-center">
          <Wordmark size={30} />
        </div>
        {invite ? (
          <div className="mt-7 rounded-[16px] border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">You’ve been invited to join</p>
            <p className="mt-1 text-lg font-semibold">{invite.organizationName ?? "an organization"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              as <span className="font-medium text-foreground">{invite.role ?? "member"}</span>
            </p>
            <AcceptInvite invitationId={id} />
          </div>
        ) : (
          <div className="mt-7 rounded-[16px] border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              This invitation is invalid, expired, or was sent to a different email.
            </p>
            <a href="/dashboard" className="mt-4 inline-block text-sm text-accent-tint hover:underline">
              Go to dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
