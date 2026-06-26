// ponytail: placeholder free-tier limits. PRD §8/§13 say the real MTU/call numbers come
// from validation, and plan assignment (Free/Pro/Enterprise) + Stripe land in hosted #5.
// Until then every project is "free" and the usage view meters against these. Swap for a
// per-project `plan` column once billing exists.
export const FREE_PLAN = { name: "Free", mtu: 1000, calls: 100_000 };
