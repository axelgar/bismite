"use client";
import { useState, useTransition } from "react";
import { setPlanAction } from "../actions";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";

// Manual tier flip (PRD §8: settable for now; #6 flips it via Stripe Checkout). Changing
// it re-meters the project against the new allowance — the demo's "bump to pro" lever.
export function PlanSelect({ projectId, plan }: { projectId: string; plan: PlanId }) {
  const [current, setCurrent] = useState<PlanId>(plan);
  const [pending, start] = useTransition();
  return (
    <label className="row">
      <strong>Plan</strong>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as PlanId;
          setCurrent(next);
          start(() => {
            setPlanAction(projectId, next);
          });
        }}
      >
        {PLAN_IDS.map((id) => (
          <option key={id} value={id}>
            {PLANS[id].name}
          </option>
        ))}
      </select>
    </label>
  );
}
