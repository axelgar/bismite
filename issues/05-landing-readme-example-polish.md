# 5. Landing + README + clonable example polish

## What to build

The public-facing validation artifact, documenting the now-complete gate → meter → upgrade loop. Three things:

- **README** leading with the Style A hero code (`check` then `record`), the "never takes your app down" promise, and a copy-paste quickstart.
- **Landing page** with the same promise and code, plus a clear "get access" call to action to measure interest.
- **Example polish** — the Next.js chat app cloneable and running in under a minute (clear env setup, sample `billing.config.ts`, seeded plans).

For a dev tool, the working `npm install` is the real landing page, so the bar is: a stranger clones the example and sees it working in ~60 seconds.

## Acceptance criteria

- [ ] README shows the Style A hero code and a working quickstart.
- [ ] Landing page communicates the promise + hero code + a "get access" CTA.
- [ ] Example app clones and runs end-to-end (gate → meter → upgrade) in under a minute from clean checkout.
- [ ] Quickstart verified by following it from scratch with no prior context.

## Blocked by

- #4 Counter hardening

## Status: DONE (2026-06-23)
Wrote `packages/sdk/README.md` (npm-facing, Style A hero + promise + API), monorepo `README.md`, and a self-contained `landing/index.html` (hero, code, 3 value props, get-access form). Landing verified rendering in browser. Example already cloneable + plan-aware.
