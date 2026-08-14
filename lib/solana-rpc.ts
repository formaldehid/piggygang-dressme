/**
 * The entire chain-reading surface of this app: which tokens does a wallet
 * hold. Two reads — SPL token accounts for the mint-indexed collections, and
 * DAS `searchAssets` for Metaplex Core assets (Piggy Gang's swapped piggies).
 *
 * Deliberately plain `fetch` against JSON-RPC rather than @solana/web3.js — we
 * need two methods, and the library would drag a Buffer polyfill into a bundle
 * whose only other dependencies are React and Next.
 */

/** SPL Token, then Token-2022. A piggy can live under either program. */
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];

type TokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: unknown;
          tokenAmount?: { decimals?: unknown; uiAmount?: unknown };
        };
      };
    };
  };
};

/** A JSON-RPC failure that kept its error code, so -32601 stays detectable. */
export class RpcError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

// `params` is an array for the classic methods and a named-params object for
// DAS ones — JSON-RPC allows both, but wrapping the object in an array would
// typecheck and still break the request.
async function call(
  endpoint: string,
  method: string,
  params: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  if (!response.ok) throw new Error(`RPC returned ${response.status}`);

  // JSON-RPC reports failures in the body with a 200, so the status check above
  // is not enough on its own.
  const payload: unknown = await response.json();
  const body = payload as { result?: unknown; error?: { code?: number; message?: string } };
  if (body.error) throw new RpcError(body.error.message ?? "RPC error", body.error.code);
  return body.result;
}

/**
 * Every mint the wallet holds exactly one indivisible unit of — the shape of an
 * NFT. Fungible balances and burnt-but-not-closed accounts fall out here, and
 * whether a mint is a piggy is decided later against the committed mint index,
 * never by anything the endpoint says.
 */
export async function getOwnedMints(endpoint: string, owner: string): Promise<string[]> {
  // Settled, not all: an endpoint that rejects the Token-2022 program should
  // still return the classic accounts, which is where every piggy actually is.
  const responses = await Promise.allSettled(
    TOKEN_PROGRAMS.map((programId) =>
      call(endpoint, "getTokenAccountsByOwner", [
        owner,
        { programId },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]),
    ),
  );
  const ok = responses.filter((result) => result.status === "fulfilled");
  if (ok.length === 0) {
    const failed = responses[0] as PromiseRejectedResult;
    throw failed.reason instanceof Error ? failed.reason : new Error("RPC request failed");
  }

  const mints = new Set<string>();
  for (const { value: response } of ok) {
    const accounts = (response as { value?: TokenAccount[] })?.value ?? [];
    for (const account of accounts) {
      const info = account?.account?.data?.parsed?.info;
      const amount = info?.tokenAmount;
      if (!info || typeof info.mint !== "string") continue;
      if (amount?.decimals !== 0 || amount?.uiAmount !== 1) continue;
      mints.add(info.mint);
    }
  }
  return [...mints];
}

/** One held Core asset, already identified: `id` is valid, in range and unique. */
export type CoreHolding = { asset: string; id: number };

export type CoreHoldings = {
  holdings: CoreHolding[];
  /** Live assets whose name did not resolve to a usable token id — surfaced, not hidden. */
  skipped: number;
};

/** A Core collection to query, with the id range its asset names must land in. */
export type CoreQuery = { collection: string; firstId: number; count: number };

/** Whether a failure means the endpoint has no DAS API at all. */
export function isDasUnsupported(cause: unknown): boolean {
  if (cause instanceof RpcError && cause.code === -32601) return true;
  return cause instanceof Error && /method not found/i.test(cause.message);
}

const CORE_PAGE = 1000;
/**
 * The collection maxes out at 10,000 assets = 10 pages. Past this the endpoint
 * is looping or lying, and every possible valid id has already had its chance,
 * so truncating loses nothing a thrown error would have kept.
 */
const CORE_MAX_PAGES = 10;

type DasAsset = {
  id?: unknown;
  burnt?: unknown;
  content?: { metadata?: { name?: unknown } };
};

/**
 * Every live Metaplex Core asset of one collection this wallet holds, resolved
 * to token ids. An asset's on-chain name "#N" IS its token id, so the endpoint
 * is trusted for *which* ids are held, never for what they are — names that do
 * not parse to a unique id inside the collection's range are counted, not kept.
 */
export async function getCoreAssets(
  endpoint: string,
  owner: string,
  query: CoreQuery,
  signal?: AbortSignal,
): Promise<CoreHoldings> {
  // First asset claiming an id wins; a duplicate name is an unusable identity.
  const byId = new Map<number, string>();
  let skipped = 0;

  for (let page = 1; page <= CORE_MAX_PAGES; page += 1) {
    const result = await call(
      endpoint,
      "searchAssets",
      {
        ownerAddress: owner,
        grouping: ["collection", query.collection],
        page,
        limit: CORE_PAGE,
      },
      signal,
    );
    const items = (result as { items?: unknown[] } | null)?.items;
    if (!Array.isArray(items)) throw new Error("Core asset response was malformed.");

    for (const raw of items) {
      const item = raw as DasAsset;
      // A burnt asset is nobody's piggy — defensive, and not counted as skipped.
      if (item?.burnt === true) continue;
      const asset = item?.id;
      const name = item?.content?.metadata?.name;
      const match = typeof name === "string" ? /^#([1-9][0-9]*)$/.exec(name.trim()) : null;
      const id = match ? Number(match[1]) : NaN;
      // Pagination is a window over a live index, so an asset leaving the
      // wallet between pages can shift the next page to re-serve one we have
      // already kept — a benign re-observation, not an unidentifiable asset.
      if (typeof asset === "string" && byId.get(id) === asset) continue;
      if (
        typeof asset !== "string" ||
        !Number.isSafeInteger(id) ||
        id < query.firstId ||
        id >= query.firstId + query.count ||
        byId.has(id)
      ) {
        skipped += 1;
        continue;
      }
      byId.set(id, asset);
    }

    // `result.total` is this page's size, not the grand total, so it cannot
    // drive the loop — a short page is the end.
    if (items.length < CORE_PAGE) break;
  }

  const holdings = [...byId].map(([id, asset]) => ({ asset, id }));
  holdings.sort((a, b) => a.id - b.id);
  return { holdings, skipped };
}
