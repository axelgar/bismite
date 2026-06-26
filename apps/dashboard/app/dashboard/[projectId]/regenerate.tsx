"use client";
import { useState } from "react";
import { regenerateAction } from "../actions";
import type { Mode } from "@/lib/counter";

// Regenerate one mode's key and reveal the new secret once. The old key stops resolving
// immediately (counter does an atomic upsert), so this is the rotate path.
export function Regenerate({ projectId, mode }: { projectId: string; mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (key) {
    return (
      <div style={{ marginTop: 8 }}>
        <p className="error">⚠ New {mode} key — copy now, shown once.</p>
        <div className="row">
          <code className="key">{key}</code>
          <button className="secondary" type="button" onClick={() => navigator.clipboard?.writeText(key)}>
            Copy
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Regenerate the ${mode} key? The current one stops working immediately.`)) return;
          setBusy(true);
          setError("");
          const res = await regenerateAction(projectId, mode);
          setBusy(false);
          if ("error" in res) return setError(res.error ?? "");
          setKey(res.key);
        }}
      >
        {busy ? "…" : `Regenerate ${mode}`}
      </button>
      {error && <span className="error"> {error}</span>}
    </>
  );
}
