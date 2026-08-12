/**
 * The Solana RPC endpoint used to list a connected wallet's token accounts, and
 * nothing else.
 *
 * A default ships with the app so connecting just works. It is `NEXT_PUBLIC_`,
 * so it is in the client bundle and readable by anyone — that is inherent to
 * calling an RPC from the browser, and the endpoint should be rate-limited and
 * domain-restricted at the provider accordingly. Holders can point the app at
 * their own endpoint instead; that override is stored in their browser only.
 */
const KEY = "piggy.rpc-endpoint";

export const DEFAULT_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://sissy-c5ed1o-fast-mainnet.helius-rpc.com";

/** Rejects anything that is not an http(s) URL, so a typo cannot become a fetch. */
export function isValidEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** The holder's own endpoint, or "" when they are on the default. */
export function readOverride(): string {
  // localStorage throws outright when the browser blocks storage, rather than
  // returning null, so every access is guarded.
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Passing "" clears the override and returns to the default. */
export function writeOverride(value: string): void {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    // A holder who blocks storage just falls back to the default.
  }
}
