"use client";
import { useState, useTransition } from "react";
import { checkoutAction, portalAction } from "../actions";
import { PLANS, type PlanId } from "@/lib/plans";

// #6: upgrades go through Stripe Checkout, never a free flip. Free => "Upgrade to Pro"
// (Checkout); Pro => "Manage billing" (Customer Portal: change card / cancel => downgrade);
// Enterprise is custom (PRD §8) so it's a sales contact, not self-serve.
const SALES = "tech@studioapp.co?subject=Bismite%20Enterprise";

export function PlanSelect({
  projectId,
  plan,
  billingEnabled,
}: {
  projectId: string;
  plan: PlanId;
  billingEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();

  // Each action redirects to Stripe on success; only the failure path returns an {error}.
  const run = (fn: (id: string) => Promise<{ error: string } | void>) => () =>
    start(async () => {
      const r = await fn(projectId);
      if (r?.error) setErr(r.error);
    });

  return (
    <div className="row">
      <strong>Plan: {PLANS[plan].name}</strong>
      <span className="row" style={{ gap: 8 }}>
        {plan === "free" && (
          <>
            <button onClick={run(checkoutAction)} disabled={pending || !billingEnabled}>
              {billingEnabled ? "Upgrade to Pro" : "Billing not configured"}
            </button>
            <a href={`mailto:${SALES}`}>Enterprise? Contact sales</a>
          </>
        )}
        {plan === "pro" && (
          <button onClick={run(portalAction)} disabled={pending}>
            Manage billing
          </button>
        )}
        {plan === "enterprise" && <a href={`mailto:${SALES}`}>Manage with sales</a>}
        {err && <span style={{ color: "#dc2626" }}>{err}</span>}
      </span>
    </div>
  );
}
