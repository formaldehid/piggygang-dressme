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
| `pnpm assets:import` | Regenerate trait art and the manifest — see CLAUDE.md |
| `pnpm renders:upload` | Publish the official minted renders to object storage |

## Connecting a wallet

Connect from the button at the right of the navbar; it opens a chooser listing every
Solana wallet you have installed. Once connected, the landing cards show how many of
each collection you hold and the editor offers them as starting looks. Everything
works without a wallet. The connection is read-only — nothing is signed and nothing
is written on chain.

Ownership is resolved against `public/piggy/<slug>/mints.txt`, a committed index of
which mint is which token, so the RPC is only ever asked *which mints this wallet
holds* — never what they are. A working RPC endpoint ships with the app
(`NEXT_PUBLIC_SOLANA_RPC_URL`, see below); holders who would rather use their own
can set it in the wallet modal, and that override stays in their browser.

## Configuration

Copy `.env.example` to `.env.local`. Both variables are optional and the app works
without either.

`NEXT_PUBLIC_SOLANA_RPC_URL` overrides the built-in Solana endpoint. Being
`NEXT_PUBLIC_` it ships in the client bundle and is readable by anyone viewing
source — unavoidable for a browser-side RPC call, so rate-limit it and restrict it
to your domains at the provider.

`NEXT_PUBLIC_RENDER_BASE_URL` is the base URL of the bucket holding the official
minted renders. Leave it unset and the wallet picker composites each piggy from its
trait layers instead, which is pixel-identical — so the feature needs no
infrastructure to work.

To populate the bucket:

```bash
pnpm renders:upload --source ../../piggydao/piggy-image-composer --dry-run
pnpm renders:upload --source ../../piggydao/piggy-image-composer --bucket s3://<bucket>/renders
```

It verifies every file against the collection metadata before transferring, unpacks
the SOL Gang zip (the copies on disk are zero-byte placeholders), and syncs — so an
interrupted run resumes by re-running it. Roughly 3.4 GiB across 15,000 objects.
Note the collections' original image host, `shdw-drive.genesysgo.net`, no longer
resolves, so these local files may be the only surviving copy of the official art.

## Deployment

Hosted on Vercel. Pushes to `main` deploy to production; pull requests get preview deploys. CI (`.github/workflows/ci.yml`) runs lint, typecheck, and build on every push to `main` and every pull request.