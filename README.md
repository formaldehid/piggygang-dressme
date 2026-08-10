# PiggyGang DressMe

A dress-up web app where holders customize their collectible with layered traits and download the result. Scoped to three collections: Piggy SOL Gang, Piggy Girl Gang, and Piggy Gang.

## Requirements

- Node 24 and pnpm 11 (both pinned — see `.tool-versions` and `packageManager` in `package.json`)

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm exec next typegen && pnpm exec tsc --noEmit` | Typecheck |

## Deployment

Hosted on Vercel. Pushes to `main` deploy to production; pull requests get preview deploys. CI (`.github/workflows/ci.yml`) runs lint, typecheck, and build on every push to `main` and every pull request.