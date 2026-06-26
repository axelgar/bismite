"use client";
import { useState } from "react";
import { createProjectAction } from "./actions";
import { RevealKeys } from "./reveal-keys";

// Create a project, then reveal both secrets ONCE inline. After dismissing, they're gone
// for good (regenerate to get a fresh one) — that's the whole point of show-once.
export function CreateProject() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ projectId: string; test: string; live: string } | null>(
    null,
  );

  if (created) {
    return (
      <div className="card">
        <h2>
          Project created — <code>{created.projectId}</code>
        </h2>
        <RevealKeys test={created.test} live={created.live} />
        <button className="secondary" onClick={() => setCreated(null)} style={{ marginTop: 12 }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await createProjectAction(name);
        setBusy(false);
        if ("error" in res) return setError(res.error ?? "");
        setName("");
        setCreated(res);
      }}
      style={{ display: "flex", gap: 10 }}
    >
      <input
        placeholder="New project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1 }}
        required
      />
      <button disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
