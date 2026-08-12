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
- `pnpm exec tsc --noEmit` — typecheck (no package script exists for this)

No test framework is configured.

## Architecture

Next.js 16.3.0 App Router project (fresh create-next-app) with TypeScript strict mode and React 19.

- Routes live in `app/` at the repo root (no `src/`). `app/layout.tsx` is the root layout; it loads Geist fonts via `next/font/google` and exposes them as CSS variables consumed in `app/globals.css`.
- Layouts/pages use Next 16's generated route-typed props (e.g. `LayoutProps<"/">`) as ambient globals — no import needed. These types are generated into `.next/types` and `.next/dev/types`, which tsconfig includes, so run `pnpm dev` or `pnpm build` at least once before typechecking.
- Styling is Tailwind CSS v4 via the `@tailwindcss/postcss` plugin: there is no tailwind.config file; theme tokens are defined in `app/globals.css` using `@import "tailwindcss"` and `@theme inline`. Dark mode follows `prefers-color-scheme`.
- Path alias `@/*` maps to the repo root.
- `pnpm-workspace.yaml` exists only for pnpm settings (`allowBuilds`); this is not a monorepo. Note it disables the `sharp` build, so `next/image` optimisation is unavailable — trait layers use plain `<img>` with a scoped lint override in `eslint.config.mjs`.

## Trait art

`public/piggy/**` and `lib/collections.generated.ts` are **generated** from the
`piggy-image-composer` repo (minted layer PNGs + collection metadata) by
`scripts/import-assets.mjs`, and committed because that repo does not exist on
the deploy host. Re-run only when the source art changes:

```
pnpm assets:import --source ../../piggydao/piggy-image-composer --verify 8
```

- Do not hand-edit `lib/collections.generated.ts`. Hand-authored copy (names, taglines, accents, tab order) lives in `lib/collections.ts`; shared types in `lib/collection-types.ts`.
- Layer paint order lives in the generated `stack`, not in code. `BodyHead`/`BodyLeftEar`/`BodyRightEar` are not traits — they are art keyed by the **Body** value, interleaved so ears sit correctly around clothes and hats. `layerSources()` in `lib/collections.ts` is the entire compositor and names no category explicitly.
- A category whose source dir contains `none.png` has *art* for its empty value (Girl Gang's Clothes "None" is a censored bar), so that value becomes a real trait rather than an empty slot.
- `--verify N` re-composites real tokens and pixel-diffs them against the official renders; it is what proves the layer order. macOS only (shells out to `sips`).
- Trait order inside a category is the wire format for `?look=` share codes and `tokens.txt`; `codeHash` guards against drift.