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
- `pnpm-workspace.yaml` exists only for pnpm settings (`allowBuilds`); this is not a monorepo. Note it disables the `sharp` build, so `next/image` optimisation is unavailable — trait layers use plain `<img>` with a scoped lint override in `eslint.config.mjs`.

## Trait art

`public/piggy/**` and `lib/collections.generated.ts` are **generated** by
`scripts/import-assets.mjs` and committed, because the sources do not exist on
the deploy host. Re-run only when the source art changes:

```
pnpm assets:import \
  --source ../../piggydao/piggy-image-composer \
  --art piggy-gang=~/Downloads/Piggy_Gang_New_Art_Files \
  --verify 8
```

Always pass every source: the manifest is rewritten wholesale, so a partial run
would drop the collections it skipped. `--source` is the composer repo, which
holds the metadata and the reference renders; `--art <slug>=<dir>` points at
layer PNGs delivered outside it.

All three are metadata collections — real counts, rarity, ranks and a
`tokens.txt` index. **Piggy Gang is Piggy SOL Gang re-skinned**: the redrawn art
carries no metadata of its own, so it reads `piggy-sol-gang.json` too. They
differ only in how a metadata value finds its art, per category in `COLLECTIONS`:

- *implied* (SOL Gang, Girl Gang) — the value **is** the trait name and
  `kebabify(value)` **is** the filename.
- *declared* (Piggy Gang) — a `map` from old metadata value to new trait name,
  which is `Piggy Trait Mapping.xlsx` transcribed. `map` plus `empty` must
  partition the observed values exactly, so a renamed art file or a new metadata
  value is a hard error rather than a silently empty slot.

What `declared` buys, beyond renaming: `attrs` lets a category key on more than
one attribute (Piggy Gang's Body is `Body` × `Received Mud`, because the redraw
gives mud its own art — Pink+mud is Boar, Salmon+mud is Mud Splash), and two
categories can carve up one attribute (`Special` is five full-canvas props filed
under `Earring/`, each half declaring the other's values as `empty`, with its own
z-slot below `Body` so Angel Wings sits behind the shoulders).

Other per-collection knobs: `canvas` is both the expected source size and the
shipped full-tier size (Piggy Gang is 2000, the minted two 1080) and reaches the
app as `collection.canvas`, which sizes the PNG export — a hardcoded size would
silently crop it. `convert: true` runs Display P3 → sRGB through `sips`, which
Piggy Gang's art needs or the browser paints the wrong colours. `skipDirs` names
delivered folders that are deliberately not imported; anything else unexpected in
the tree fails the run. A category may hand-set `focus` when a union bounding box
would be useless — Piggy Gang's `Special` holds two full-canvas layers, so its
thumbnails would otherwise be un-zoomed and the small props illegible.

- Do not hand-edit `lib/collections.generated.ts`. Hand-authored copy (names, taglines, accents, tab order) lives in `lib/collections.ts`; shared types in `lib/collection-types.ts`.
- Layer paint order lives in the generated `stack`, not in code. `BodyHead`/`BodyLeftEar`/`BodyRightEar` are not traits — they are art keyed by the **Body** value, interleaved so ears sit correctly around clothes and hats. `layerSources()` in `lib/collections.ts` is the entire compositor and names no category explicitly.
- A category whose source dir contains `none.png` has *art* for its empty value (Girl Gang's Clothes "None" is a censored bar), so that value becomes a real trait rather than an empty slot.
- `--verify N` re-composites real tokens and pixel-diffs them against the official renders; it is what proves the layer order. It runs only where a collection declares `renders`. Piggy Gang declares none — `piggy-sol-gang-images/` renders the art it replaced — so its order was derived by eye; if that art is ever re-exported, check it visually again. Note the sol-gang renders on disk are stale placeholders and fail the diff: pass `--renders piggy-sol-gang=<dir>` pointing at files extracted from `piggy-sol-gang-images.zip`. macOS only (shells out to `sips`).
- Trait order inside a category is the wire format for `?look=` share codes and `tokens.txt`; `codeHash` guards against drift.