/**
 * The entire chain-reading surface of this app: which mints does a wallet hold.
 *
 * Deliberately plain `fetch` against JSON-RPC rather than @solana/web3.js — we
 * need one method, and the library would drag a Buffer polyfill into a bundle
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

async function call(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC returned ${response.status}`);

  // JSON-RPC reports failures in the body with a 200, so the status check above
  // is not enough on its own.
  const payload: unknown = await response.json();
  const body = payload as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "RPC error");
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
