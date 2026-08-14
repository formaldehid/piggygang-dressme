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
- `wallet: true` also emits `mints.txt`, a fixed-width index of which mint is which token. Set on the two minted collections only — Piggy Gang re-skins SOL Gang's mints, so it would duplicate the file and list a held piggy twice. `mints: null` in the manifest means the collection has no SPL mint index; the wallet UI is driven by `collection.wallet` in `lib/collections.ts` — the mint index where one exists, a hand-declared Metaplex Core collection (Piggy Gang), or `null` to disable it.

## Wallet

Connecting is **read-only** — the app reads an address and never signs. Keep it that way; nothing here needs a transaction.

- `lib/wallet.ts` is Wallet Standard discovery via `@wallet-standard/app`, deliberately not `@solana/wallet-adapter-*` (deprecated per-wallet adapters, and a large tree for an app with three runtime deps).
- `components/wallet/wallet-provider.tsx` holds all wallet state and is mounted in `app/layout.tsx`, so the navbar, the landing cards and the editor read one connection. It **must not render a DOM element** — `<body>` is a flex column whose children have to stay the header, main and footer.
- **The wallet is read once per address, not per collection.** Two independent reads in the provider's one keyed effect pair: `getTokenAccountsByOwner` returns every SPL mint in a single call, and one DAS `searchAssets` per Core-backed collection (today only Piggy Gang's) returns its swapped Core assets. Deciding which SPL mints are piggies is a local intersection against each collection's `mints.txt`. Consumers (`my-piggies.tsx`, `owned-count.tsx`) therefore never touch the RPC, and moving between collections costs nothing on the network. Keep it that way. The reads are deliberately not merged into one state write: a hung or failed DAS endpoint must not blank the mint-indexed collections.
- `--accent` is a per-collection inline style on the editor root, so it does **not** reach the navbar or the modal — and `showModal()` promotes the dialog to the top layer, escaping it even when opened from the editor. Both use the global `--brand` vocabulary that `components/site-footer.tsx` establishes.
- The wallet chooser is a native `<dialog>`: top-layer rendering means the app still has exactly one z-index (`z-30`, the sticky header), and focus trapping, Escape and `::backdrop` come for free. It is the only overlay in the codebase; the `::backdrop` rule lives in `app/globals.css`.
- `lib/solana-rpc.ts` is the entire chain-reading surface: `getTokenAccountsByOwner` for SPL mints and DAS `searchAssets` for Core assets, both over plain `fetch`, so `@solana/web3.js` and its Buffer polyfill stay out of the bundle. Resist growing this.
- **The endpoint is trusted only for WHICH tokens a wallet holds, never for what they are.** The SPL collections are closed (10,000 and 5,000, contiguous), so their ownership is decided against committed `mints.txt` and stays offline-verifiable. Piggy Gang's swapped piggies are Metaplex Core assets minted on demand — no closed list to commit — so the DAS read supplies the held token ids instead: an asset's on-chain name `#N` **is** its token id (verified unique and in range across all minted assets), and `getCoreAssets` parses, range-checks and deduplicates before React ever sees a holding. Traits, rarity and rank still come only from committed `tokens.txt`.
- `lib/rpc-endpoint.ts` ships a default Solana endpoint (`NEXT_PUBLIC_SOLANA_RPC_URL`) so connecting works with no setup, and holders may override it from the modal (`localStorage`, their browser only). The default is in the client bundle by necessity — a browser-side RPC call cannot hide its endpoint — so it must be rate-limited and domain-restricted at the provider rather than treated as a secret. It must also support the DAS API (`searchAssets`); a holder override without DAS degrades only Piggy Gang's wallet features — with a message saying so — while the SPL collections keep working.
- Piggies that are listed for sale or staked are held by an escrow or program, not the wallet — true for the SPL collections and for Core assets on the major marketplaces alike — so they will not appear. The empty states say so; Piggy Gang's also points holders at Piggy SOL Gang for piggies not yet swapped to the new art.
- The official renders are **not** in this repo. `NEXT_PUBLIC_RENDER_BASE_URL` points at a bucket populated by `pnpm renders:upload`; unset, `components/piggy/token-image.tsx` composites the same look from layers, which is pixel-identical. The collections' original host (`shdw-drive.genesysgo.net`) no longer resolves, so those local files may be the only surviving copy of the official art.