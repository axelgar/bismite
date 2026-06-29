"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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

  if (done) {
    return (
      <main>
        <h1>Password updated</h1>
        <p className="muted">Redirecting you to sign in…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Set a new password</h1>
      {token === "" ? (
        <p className="error">Missing reset token. Use the link from your email, or request a new one on the sign-in page.</p>
      ) : (
        <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10 }}>
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="error">{error}</p>}
          <button disabled={busy || !token}>{busy ? "…" : "Update password"}</button>
        </form>
      )}
    </main>
  );
}
