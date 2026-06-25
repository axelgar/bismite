# Hosted #5 — Plan tiers & limit enforcement

## Parent

[PRD-hosted-platform.md](../PRD-hosted-platform.md) — §8 (billing model).

## What to build

Make a project's plan tier mean something: define the tiers, attach one to each project, and enforce the Free-tier limits. Payment comes in #6 — here the tier is just a settable field so enforcement can be built and demoed independently.

- **Tier definitions** (config-as-code): Free / Pro / Enterprise, each with an included **MTU** allowance and **call** allowance (numbers are placeholders, easily changed).
- A `plan` field on the project (default `free`), settable manually/seed for now.
- **Enforcement** on the counter path: when a project exceeds its MTU and/or call allowance, apply the agreed model — **calls are a guardrail with overage; MTU is the headline limit**. Over the Free MTU limit ⇒ the over-limit signal surfaces to the SDK (so the app can show "upgrade"), without breaking fail-open semantics for transient errors.
- Dashboard usage view reflects the project's tier and its limits.

*Demo:* a Free project crosses its MTU allowance → the over-limit signal appears; bump the project's `plan` to `pro` → allowance raised, traffic flows again.

## Acceptance criteria

- [ ] Free / Pro / Enterprise tiers defined with MTU + call allowances.
- [ ] Each project has a `plan` (default free); changing it changes enforced limits.
- [ ] Over-MTU-limit produces a clear over-limit signal to the caller (distinct from a fail-open transient).
- [ ] Call overage handled as a guardrail per the PRD (not a hard headline block at the included amount).
- [ ] Dashboard shows the current tier and its limits.

## Blocked by

- Hosted #4 (dashboard — to show tier/limits and exercise the flow).
