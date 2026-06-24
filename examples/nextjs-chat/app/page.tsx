"use client";

import { useEffect, useState } from "react";

type Line = { role: "you" | "bot" | "system"; text: string };

const USER = "demo-user";

export default function Page() {
  const [log, setLog] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<string>("free");
  const [unlimited, setUnlimited] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Reflect the real plan on load (and after returning from Stripe Checkout).
  useEffect(() => {
    fetch(`/api/chat?userId=${USER}`)
      .then((r) => r.json())
      .then((d) => { setPlan(d.plan); setUnlimited(d.unlimited); setRemaining(d.remaining); })
      .catch(() => {});
  }, []);

  async function send() {
    const message = input.trim();
    if (!message) return;
    setInput("");
    setLog((l) => [...l, { role: "you", text: message }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: USER, message }),
    });

    if (res.status === 402) {
      const { upgradeUrl } = await res.json();
      setBlocked(upgradeUrl ?? "/upgrade");
      setLog((l) => [...l, { role: "system", text: "Daily limit reached — upgrade to keep chatting." }]);
      return;
    }
    const d = await res.json();
    setPlan(d.plan);
    setUnlimited(d.unlimited);
    setRemaining(d.remaining);
    setLog((l) => [...l, { role: "bot", text: d.reply }]);
  }

  return (
    <main>
      <h1>Bismite chat</h1>
      <p style={{ color: "#666" }}>
        {unlimited
          ? "Pro plan — unlimited messages ✓"
          : `Free plan: 5 messages/day.${remaining !== null ? ` Remaining today: ${remaining}.` : ""}`}
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 160, marginBottom: 12 }}>
        {log.map((l, i) => (
          <div key={i} style={{ margin: "6px 0", color: l.role === "system" ? "#b00" : "#111" }}>
            <b>{l.role}:</b> {l.text}
          </div>
        ))}
      </div>

      {blocked ? (
        <a href={blocked} style={{ display: "inline-block", padding: "10px 16px", background: "#111", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Upgrade to Pro
        </a>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Say something…"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button onClick={send} style={{ padding: "10px 16px", borderRadius: 8 }}>Send</button>
        </div>
      )}
    </main>
  );
}
