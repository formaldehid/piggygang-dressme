import { getWallets } from "@wallet-standard/app";

/**
 * Wallet Standard discovery, which is all this app needs: it reads an address
 * and never signs anything. The per-wallet adapters are deprecated in favour of
 * this, and skipping them keeps the dependency at one small package.
 */

const SOLANA_MAINNET = "solana:mainnet";
const CONNECT = "standard:connect";
const DISCONNECT = "standard:disconnect";
const EVENTS = "standard:events";

/**
 * The slice of the standard we actually touch. Declared structurally rather
 * than imported so the app does not take a second dependency for types.
 */
export type SolanaWallet = {
  readonly name: string;
  readonly icon: string;
  readonly chains: readonly string[];
  readonly features: Readonly<Record<string, unknown>>;
  readonly accounts: readonly { readonly address: string }[];
};

type ConnectFeature = { connect: () => Promise<{ accounts: readonly { address: string }[] }> };
type DisconnectFeature = { disconnect: () => Promise<void> };
type EventsFeature = { on: (event: "change", listener: () => void) => () => void };

function isSolanaWallet(wallet: SolanaWallet): boolean {
  return wallet.chains.includes(SOLANA_MAINNET) && CONNECT in wallet.features;
}

/** Registered Solana wallets right now. Empty during SSR and before hydration. */
export function listWallets(): SolanaWallet[] {
  if (typeof window === "undefined") return [];
  return (getWallets().get() as readonly SolanaWallet[]).filter(isSolanaWallet);
}

/**
 * Wallets register asynchronously, and a holder may install one with the tab
 * open, so the list is a subscription rather than a one-shot read.
 */
export function onWalletsChange(listener: (wallets: SolanaWallet[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wallets = getWallets();
  const emit = () => listener(listWallets());
  const off = [wallets.on("register", emit), wallets.on("unregister", emit)];
  return () => off.forEach((remove) => remove());
}

/** Prompts the wallet and returns the addresses it authorised, if any. */
export async function connect(wallet: SolanaWallet): Promise<string[]> {
  const feature = wallet.features[CONNECT] as ConnectFeature | undefined;
  if (!feature) throw new Error(`${wallet.name} cannot connect`);
  const { accounts } = await feature.connect();
  return accounts.map((account) => account.address);
}

/** Not every wallet implements disconnect; where it does not, forgetting locally is enough. */
export async function disconnect(wallet: SolanaWallet): Promise<void> {
  const feature = wallet.features[DISCONNECT] as DisconnectFeature | undefined;
  await feature?.disconnect();
}

/** Fires when the holder switches or locks accounts inside the wallet. */
export function onAccountsChange(wallet: SolanaWallet, listener: (addresses: string[]) => void): () => void {
  const feature = wallet.features[EVENTS] as EventsFeature | undefined;
  if (!feature) return () => {};
  return feature.on("change", () => listener(wallet.accounts.map((account) => account.address)));
}
