# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Git rules

- NEVER commit or push. When work is ready, suggest a commit message and let the user run git themselves.
- Suggested commit messages must be a single line, with no Co-Authored-By trailer or any other Claude/AI attribution.

## Commands

Use pnpm (version pinned via `packageManager` in package.json; Node 24 via `.tool-versions`).

- `pnpm dev` — dev server at http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`)
- `pnpm exec next typegen && pnpm exec tsc --noEmit` — typecheck (no package script exists for this; `next typegen` generates `next-env.d.ts` and route types first)

No test framework is configured.

## Architecture

Next.js 16.3.0 App Router project (fresh create-next-app) with TypeScript strict mode and React 19.

- Routes live in `app/` at the repo root (no `src/`). `app/layout.tsx` is the root layout; it loads Geist fonts via `next/font/google` and exposes them as CSS variables consumed in `app/globals.css`.
- Layouts/pages use Next 16's generated route-typed props (e.g. `LayoutProps<"/">`) as ambient globals — no import needed. These types are generated into `.next/types` and `.next/dev/types`, which tsconfig includes; `pnpm exec next typegen` generates them without a full build.
- Styling is Tailwind CSS v4 via the `@tailwindcss/postcss` plugin: there is no tailwind.config file; theme tokens are defined in `app/globals.css` using `@import "tailwindcss"` and `@theme inline`. Dark mode follows `prefers-color-scheme`.
- Path alias `@/*` maps to the repo root.
- `pnpm-workspace.yaml` exists only for pnpm settings (`allowBuilds`); this is not a monorepo.