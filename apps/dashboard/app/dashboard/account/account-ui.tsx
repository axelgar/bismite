"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Session = { token: string; current: boolean; ipAddress: string | null; userAgent: string | null; createdAt: string };

// One card per concern. Mutations go through the better-auth client; we toast results and
// refresh the server data (session list) on change.
export function AccountUI({ name, email, sessions }: { name: string; email: string; sessions: Session[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.updateUser({ name: displayName.trim() });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Could not save");
    toast.success("Profile updated");
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Could not change password");
    setCurrent("");
    setNext("");
    toast.success(revokeOthers ? "Password changed; other sessions signed out" : "Password changed");
    router.refresh();
  }

  async function revoke(token: string) {
    setBusy(true);
    const res = await authClient.revokeSession({ token });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Could not revoke");
    toast.success("Session revoked");
    router.refresh();
  }

  async function revokeOthersNow() {
    setBusy(true);
    const res = await authClient.revokeOtherSessions();
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Could not sign out other sessions");
    toast.success("Signed out everywhere else");
    router.refresh();
  }

  const card = "rounded-[16px] border border-border bg-card p-6";
  const label = "grid gap-1.5 text-[13px] text-muted-foreground";

  return (
    <div className="mt-8 grid gap-6">
      <form onSubmit={saveProfile} className={`${card} grid gap-3`}>
        <h2 className="text-sm font-medium">Profile</h2>
        <label className={label}>
          Name
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className={label}>
          Email
          <Input value={email} disabled />
          <span className="text-xs text-muted-foreground">Email changes aren’t supported yet.</span>
        </label>
        <Button type="submit" disabled={busy || displayName.trim() === name} className="justify-self-start">
          Save
        </Button>
      </form>

      <form onSubmit={changePassword} className={`${card} grid gap-3`}>
        <h2 className="text-sm font-medium">Change password</h2>
        <label className={label}>
          Current password
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className={label}>
          New password
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={revokeOthers} onChange={(e) => setRevokeOthers(e.target.checked)} />
          Sign out other devices
        </label>
        <Button type="submit" disabled={busy} className="justify-self-start">
          Update password
        </Button>
      </form>

      <section className={`${card} grid gap-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Active sessions</h2>
          {sessions.length > 1 && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={revokeOthersNow}>
              Sign out everywhere else
            </Button>
          )}
        </div>
        <ul className="divide-y divide-border-soft">
          {sessions.map((s) => (
            <li key={s.token} className="flex items-center gap-3 py-3">
              <Monitor className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm">{s.userAgent ?? "Unknown device"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.ipAddress ?? "no ip"} · since {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="ml-auto">
                {s.current ? (
                  <Badge variant="success">This device</Badge>
                ) : (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => revoke(s.token)}>
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
