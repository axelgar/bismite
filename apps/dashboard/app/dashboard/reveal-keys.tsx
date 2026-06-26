"use client";
// Show-once secret reveal + the copy-paste onboarding snippet (PRD §5 / issue #4). The
// snippet references the env var, not the literal secret, so it's still correct after the
// secret scrolls off — the developer pastes the key into BISMITE_API_KEY themselves.
function Copy({ value }: { value: string }) {
  return (
    <button className="secondary" onClick={() => navigator.clipboard?.writeText(value)} type="button">
      Copy
    </button>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ margin: "8px 0" }}>
      <div className="muted">{label}</div>
      <div className="row">
        <code className="key">{value}</code>
        <Copy value={value} />
      </div>
    </div>
  );
}

const SNIPPET = `# .env
BISMITE_API_KEY=<paste your live key>`;

const CODE = `import { Billing } from "bismite";
import { bismiteCounter } from "bismite/hosted";

export const bismite = new Billing({
  plans,
  resolvePlan: (userId) => myDb.getPlan(userId),
  counter: bismiteCounter(process.env.BISMITE_API_KEY!),
});`;

export function RevealKeys({ test, live }: { test: string; live: string }) {
  return (
    <div>
      <p className="error">⚠ Copy these now — they're shown once and can't be retrieved later.</p>
      <KeyRow label="Test key" value={test} />
      <KeyRow label="Live key" value={live} />
      <h2 style={{ marginTop: 20 }}>Drop it into your app</h2>
      <pre>{SNIPPET}</pre>
      <pre>{CODE}</pre>
    </div>
  );
}
