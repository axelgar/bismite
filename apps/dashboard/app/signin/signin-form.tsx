"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One form, sign-in/sign-up toggle. better-auth owns the credential handling; we only
// collect fields and route to /dashboard on success. Invite-only: a non-allowlisted email
// surfaces the lockdown's 403 message ("This email isn’t on the invite list yet.").
export function SignInForm({ redirect = "/dashboard" }: { redirect?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Something went wrong");
    router.push(redirect);
  }

  async function forgot() {
    setError("");
    setNotice("");
    if (!email) return setError("Enter your email first, then click “Forgot password”.");
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setNotice("If that email has an account, a reset link is on its way.");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div className="halo left-1/2 top-0 h-[420px] w-[560px] -translate-x-1/2" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Wordmark size={30} />
          <p className="text-sm text-muted-foreground">
            {mode === "signup" ? "Create your account" : "Sign in to your dashboard"}
          </p>
        </div>

        <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_28px_64px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <form onSubmit={submit} className="grid gap-3">
            {mode === "signup" && (
              <label className="grid gap-1.5 text-[13px] text-muted-foreground">
                Name
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            )}
            <label className="grid gap-1.5 text-[13px] text-muted-foreground">
              Email
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] text-muted-foreground">
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Min. 8 characters"
              />
            </label>

            {error && (
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
            )}
            {notice && <p className="text-[13px] text-muted-foreground">{notice}</p>}

            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>

            {mode === "signin" && (
              <button
                type="button"
                onClick={forgot}
                className="justify-self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="font-medium text-accent-tint hover:underline"
            onClick={() => {
              setError("");
              setNotice("");
              setMode(mode === "signup" ? "signin" : "signup");
            }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </main>
  );
}
