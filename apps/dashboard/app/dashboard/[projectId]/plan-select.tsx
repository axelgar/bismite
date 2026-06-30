"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { checkoutAction, portalAction } from "../actions";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// #6: upgrades go through Stripe Checkout, never a free flip. Free => "Upgrade to Pro"
// (Checkout); Pro => "Manage billing" (Customer Portal: change card / cancel => downgrade);
// Enterprise is custom (PRD §8) so it's a sales contact, not self-serve. There is NO plan
// dropdown — the tier is flipped only by the verified Stripe webhook.
const SALES = "mailto:tech@studioapp.co?subject=Bismite%20Enterprise";

function fmtAllowance(n: number): string {
  if (!isFinite(n)) return "∞";
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  return n.toLocaleString();
}

// Shared transition wrapper. Each action redirects to Stripe on success; only the failure
// path returns an {error}.
function useBilling() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const run = (fn: (id: string) => Promise<{ error: string } | void>, projectId: string) => () =>
    start(async () => {
      const r = await fn(projectId);
      if (r?.error) setErr(r.error);
    });
  return { pending, err, run };
}

/** The over-limit / upgrade CTA, reused in the usage MTU card and the Plan tab. */
export function UpgradeButton({
  projectId,
  plan,
  billingEnabled,
  size,
}: {
  projectId: string;
  plan: PlanId;
  billingEnabled: boolean;
  size?: "sm" | "default";
}) {
  const { pending, err, run } = useBilling();

  if (plan === "free") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size={size} onClick={run(checkoutAction, projectId)} disabled={pending || !billingEnabled}>
          {billingEnabled ? "Upgrade to Pro" : "Billing not configured"}
        </Button>
        {err && <span className="text-[11px] text-destructive">{err}</span>}
      </div>
    );
  }
  if (plan === "pro") {
    return (
      <Button size={size} variant="secondary" asChild>
        <a href={SALES}>Contact sales</a>
      </Button>
    );
  }
  return null; // enterprise: unlimited, never over
}

/** Plan tab: current tier + the three allowances, Stripe-wired actions. */
export function PlanSection({
  projectId,
  plan,
  billingEnabled,
  hasCustomer,
  canManageBilling,
}: {
  projectId: string;
  plan: PlanId;
  billingEnabled: boolean;
  hasCustomer: boolean;
  canManageBilling: boolean;
}) {
  const { pending, err, run } = useBilling();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Plan &amp; billing</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            You’re on the <span className="text-foreground-2">{PLANS[plan].name}</span> plan. Upgrades
            and cancellations go through Stripe.
          </p>
        </div>
        {plan === "pro" && canManageBilling && (
          <Button
            variant="secondary"
            onClick={run(portalAction, projectId)}
            disabled={pending || !hasCustomer}
          >
            Manage billing
          </Button>
        )}
      </div>

      {err && (
        <p role="alert" className="text-[13px] text-destructive">
          {err}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const current = id === plan;
          return (
            <div
              key={id}
              className={cn(
                "relative rounded-[12px] border bg-surface p-4",
                current ? "border-primary" : "border-border",
              )}
            >
              {current && (
                <Badge variant="live" className="absolute right-3 top-3 normal-case tracking-[0.06em]">
                  Current
                </Badge>
              )}
              <div className="font-semibold">{p.name}</div>
              <div className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
                {fmtAllowance(p.mtuIncluded)} MTU
                <br />
                {fmtAllowance(p.callsCeiling)} calls
              </div>

              <div className="mt-4">
                {id === "pro" && plan === "free" && canManageBilling && (
                  <Button
                    size="sm"
                    onClick={run(checkoutAction, projectId)}
                    disabled={pending || !billingEnabled}
                  >
                    {billingEnabled ? "Upgrade" : "Unavailable"}
                  </Button>
                )}
                {id === "enterprise" && plan !== "enterprise" && (
                  <a href={SALES} className="text-[13px] text-muted-foreground hover:text-foreground">
                    Contact →
                  </a>
                )}
                {current && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-success">
                    <Check className="size-3.5" /> Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
