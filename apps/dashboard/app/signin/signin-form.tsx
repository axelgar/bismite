"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// One form, sign-in/sign-up toggle. better-auth owns the credential handling; we only
// collect fields and route to /dashboard on success. (page.tsx guards against already
// signed-in users reaching this.)
export function SignInForm() {
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
    router.push("/dashboard");
  }

  async function forgot() {
    setError("");
    setNotice("");
    if (!email) return setError("Enter your email first, then click “Forgot password”.");
    // Always succeeds to the user (no account enumeration); the email only arrives if the
    // account exists. The link lands on /reset-password?token=…
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setNotice("If that email has an account, a reset link is on its way.");
  }

  return (
    <main>
      <h1>{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10 }}>
        {mode === "signup" && (
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className="error">{error}</p>}
        {notice && <p className="muted">{notice}</p>}
        <button disabled={busy}>{busy ? "…" : mode === "signup" ? "Sign up" : "Sign in"}</button>
        {mode === "signin" && (
          <a
            href="#"
            className="muted"
            style={{ fontSize: "0.85rem" }}
            onClick={(e) => {
              e.preventDefault();
              forgot();
            }}
          >
            Forgot password?
          </a>
        )}
      </form>
      <p className="muted">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setError("");
            setNotice("");
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </a>
      </p>
    </main>
  );
}
