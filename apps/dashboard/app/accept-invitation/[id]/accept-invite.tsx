"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Accept => join the org and land in the dashboard (now scoped to it). Decline => mark the
// invite rejected and go home. Errors (already accepted, expired mid-flow) surface as toasts.
export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const res = await authClient.organization.acceptInvitation({ invitationId });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Could not accept invitation");
    // Act in the org we just joined, then show its projects.
    if (res.data?.invitation?.organizationId) {
      await authClient.organization.setActive({ organizationId: res.data.invitation.organizationId });
    }
    router.push("/dashboard");
  }

  async function decline() {
    setBusy(true);
    await authClient.organization.rejectInvitation({ invitationId });
    setBusy(false);
    router.push("/dashboard");
  }

  return (
    <div className="mt-5 grid gap-2">
      <Button onClick={accept} disabled={busy} className="w-full">
        {busy ? "…" : "Accept invitation"}
      </Button>
      <Button onClick={decline} disabled={busy} variant="ghost" className="w-full">
        Decline
      </Button>
    </div>
  );
}
