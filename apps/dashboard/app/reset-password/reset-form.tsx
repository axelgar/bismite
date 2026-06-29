"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Landing form for the password-reset email link. better-auth's email points here with
// ?token=…; we read it (from window.location to avoid a Suspense boundary), take a new
// password, and call resetPassword({ token }). (page.tsx guards already-signed-in users.)
export function ResetForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setToken(p.get("token") ?? "");
    if (p.get("error")) setError("This reset link is invalid or has expired. Request a new one.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Reset failed — the link may have expired.");
    setDone(true);
    setTimeout(() => router.push("/signin"), 1500);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div className="halo left-1/2 top-0 h-[420px] w-[560px] -translate-x-1/2" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Wordmark size={30} />
          <p className="text-sm text-muted-foreground">
            {done ? "Password updated" : "Set a new password"}
          </p>
        </div>

        <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_28px_64px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {done ? (
            <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
          ) : token === "" ? (
            <p role="alert" className="text-[13px] text-destructive">
              Missing reset token. Use the link from your email, or request a new one on the sign-in page.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <label className="grid gap-1.5 text-[13px] text-muted-foreground">
                New password
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                />
              </label>
              {error && (
                <p role="alert" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !token} className="mt-1 w-full">
                {busy ? "…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
