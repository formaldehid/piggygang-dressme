import type { ReadyCollection } from "./collections";

export type Mints = NonNullable<ReadyCollection["mints"]>;

/** Mint address to token id. */
export type MintIndex = Map<string, number>;

const cache = new Map<string, Promise<MintIndex>>();

/**
 * Which mint is which token, fetched once per collection and kept for the tab.
 *
 * This is the whole reason the app never has to trust an RPC for anything but
 * "which mints does this wallet hold" — identity, traits and rarity all come
 * from files we generated and committed.
 */
export function loadMintIndex(collection: ReadyCollection, mints: Mints): Promise<MintIndex> {
  const cached = cache.get(collection.slug);
  if (cached) return cached;

  const pending = fetchIndex(collection, mints).catch((error: unknown) => {
    cache.delete(collection.slug);
    throw error;
  });
  cache.set(collection.slug, pending);
  return pending;
}

async function fetchIndex(collection: ReadyCollection, mints: Mints): Promise<MintIndex> {
  const response = await fetch(mints.path);
  if (!response.ok) throw new Error(`mint index unavailable (${response.status})`);
  const text = await response.text();

  const newline = text.indexOf("\n");
  const [version, slug, width, firstId, count] = text.slice(0, newline).split(" ");

  // No codeHash here, unlike tokens.txt: a mint list does not depend on trait
  // order, so it cannot drift when the art is re-imported.
  if (
    version !== "v1" ||
    slug !== collection.slug ||
    Number(width) !== mints.width ||
    Number(firstId) !== mints.firstId ||
    Number(count) !== mints.count
  ) {
    throw new Error("mint index does not match this build — re-run pnpm assets:import");
  }

  const body = text.slice(newline + 1);
  const index: MintIndex = new Map();
  for (let i = 0; i < mints.count; i += 1) {
    // Rows are right-padded to a fixed width so the id is the row number.
    const mint = body.slice(i * mints.width, (i + 1) * mints.width).trimEnd();
    index.set(mint, mints.firstId + i);
  }
  return index;
}
