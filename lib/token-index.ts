import { decodeLook, LOOK_ALPHABET, type Equipped, type ReadyCollection } from "./collections";

export type TokenLook = { id: number; equipped: Equipped; rank: number };

export type TokenIndex = {
  firstId: number;
  count: number;
  lookAt(id: number): TokenLook | null;
  randomId(): number;
};

const cache = new Map<string, Promise<TokenIndex>>();

/**
 * Every token's real trait combination, as fixed-width rows of look codes.
 *
 * A row IS a look code (plus a 3-char rarity rank), so loading a piggy is a
 * string slice — no parsing, no per-token objects. ~68 KB for 10,000 tokens,
 * fetched only when the loader is actually used.
 */
export function loadTokenIndex(collection: ReadyCollection): Promise<TokenIndex> {
  const cached = cache.get(collection.slug);
  if (cached) return cached;

  const pending = fetchIndex(collection).catch((error: unknown) => {
    cache.delete(collection.slug);
    throw error;
  });
  cache.set(collection.slug, pending);
  return pending;
}

async function fetchIndex(collection: ReadyCollection): Promise<TokenIndex> {
  const response = await fetch(collection.tokens.path);
  if (!response.ok) throw new Error(`token index unavailable (${response.status})`);
  const text = await response.text();

  const newline = text.indexOf("\n");
  if (newline === -1) throw new Error("token index is malformed");
  const [version, slug, stride, firstId, count, codeHash] = text.slice(0, newline).split(" ");

  // Guards the drift that would otherwise silently load someone else's piggy:
  // if the trait order changed, every row decodes to the wrong art.
  if (
    version !== "v1" ||
    slug !== collection.slug ||
    Number(stride) !== collection.tokens.stride ||
    Number(firstId) !== collection.tokens.firstId ||
    Number(count) !== collection.tokens.count ||
    codeHash !== collection.codeHash
  ) {
    throw new Error("token index does not match this build — re-run pnpm assets:import");
  }

  const body = text.slice(newline + 1);
  const width = collection.tokens.stride;
  const start = collection.tokens.firstId;
  const total = collection.tokens.count;

  return {
    firstId: start,
    count: total,
    randomId: () => start + Math.floor(Math.random() * total),
    lookAt(id) {
      if (!Number.isInteger(id) || id < start || id >= start + total) return null;
      const row = body.slice((id - start) * width, (id - start + 1) * width);
      if (row.length !== width) return null;

      const equipped = decodeLook(collection, row.slice(0, width - 3));
      if (!equipped) return null;

      let rank = 0;
      for (const char of row.slice(width - 3)) {
        const digit = LOOK_ALPHABET.indexOf(char);
        if (digit === -1) return null;
        rank = rank * 64 + digit;
      }
      return { id, equipped, rank };
    },
  };
}
