"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_ENDPOINT,
  isValidEndpoint,
  readOverride,
  writeOverride,
} from "@/lib/rpc-endpoint";
import { getOwnedMints } from "@/lib/solana-rpc";
import {
  connect as connectWallet,
  disconnect as disconnectWallet,
  listWallets,
  onAccountsChange,
  onWalletsChange,
  type SolanaWallet,
} from "@/lib/wallet";
import { WalletModal } from "./wallet-modal";

/**
 * Everything wallet-shaped, held once for the whole app so the navbar, the
 * landing cards and the editor all read the same connection.
 *
 * The mints a wallet holds are fetched **once per address**, not per
 * collection: `getTokenAccountsByOwner` returns the whole wallet in one call,
 * and deciding which of those are piggies is a local intersection against each
 * collection's committed mint index. Consumers therefore never touch the RPC.
 */
type WalletState = {
  wallets: SolanaWallet[];
  wallet: SolanaWallet | null;
  address: string | null;
  /** The endpoint in use, default or override. */
  endpoint: string;
  /** The holder's own endpoint, or "" when they are on the shipped default. */
  override: string;
  /** Every mint the wallet holds, or null before a successful read. */
  ownedMints: string[] | null;
  reading: boolean;
  error: string | null;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (wallet: SolanaWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  saveEndpoint: (value: string) => boolean;
  refresh: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const state = useContext(WalletContext);
  if (!state) throw new Error("useWallet must be used inside <WalletProvider>");
  return state;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  // "" means the shipped default; the state holds only a holder's own override
  // so the server and first client render agree.
  const [override, setOverride] = useState("");
  const endpoint = override || DEFAULT_ENDPOINT;
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nonce, setNonce] = useState(0);

  // The read is stored against the inputs that produced it, so everything about
  // it can be *derived* rather than reset — which is what keeps the effect below
  // free of synchronous setState and its cascading renders.
  const [read, setRead] = useState<{ key: string; mints: string[] | null; error: string | null } | null>(null);
  const key = address && endpoint ? `${address}|${endpoint}|${nonce}` : null;
  const current = read?.key === key ? read : null;
  const ownedMints = current?.mints ?? null;
  const reading = key !== null && current === null;
  const error = connectionError ?? current?.error ?? null;

  // Wallets register asynchronously and localStorage is browser-only, so both
  // are read after hydration rather than during render.
  useEffect(() => {
    const saved = readOverride();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of browser-only state
    setWallets(listWallets());
    setOverride(saved);
    return onWalletsChange(setWallets);
  }, []);

  // The one RPC call. Re-runs when the address, the endpoint or an explicit
  // refresh changes — never when the visitor moves between collections.
  useEffect(() => {
    if (!key || !address || !endpoint) return;
    let live = true;
    getOwnedMints(endpoint, address)
      .then((mints) => live && setRead({ key, mints, error: null }))
      .catch((cause: unknown) => {
        if (!live) return;
        const message = cause instanceof Error ? cause.message : "Could not read the wallet.";
        setRead({ key, mints: null, error: message });
      });
    return () => {
      live = false;
    };
  }, [key, address, endpoint]);

  // The holder can switch or lock accounts inside the wallet while we are open.
  useEffect(() => {
    if (!wallet) return;
    return onAccountsChange(wallet, ([next]) => setAddress(next ?? null));
  }, [wallet]);

  const connect = useCallback(async (candidate: SolanaWallet) => {
    setConnectionError(null);
    try {
      const [first] = await connectWallet(candidate);
      if (!first) {
        setConnectionError("That wallet did not share an account.");
        return;
      }
      setWallet(candidate);
      setAddress(first);
    } catch {
      setConnectionError("Connection was declined.");
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (wallet) await disconnectWallet(wallet).catch(() => {});
    // Clearing the address invalidates the read's key, so `ownedMints` derives
    // back to null on its own.
    setWallet(null);
    setAddress(null);
    setConnectionError(null);
  }, [wallet]);

  /** An empty value clears the override and returns to the shipped default. */
  const saveEndpoint = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !isValidEndpoint(trimmed)) {
      setConnectionError("That does not look like an https:// endpoint.");
      return false;
    }
    writeOverride(trimmed);
    setOverride(trimmed);
    setConnectionError(null);
    return true;
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      wallets,
      wallet,
      address,
      endpoint,
      override,
      ownedMints,
      reading,
      error,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      connect,
      disconnect,
      saveEndpoint,
      refresh: () => setNonce((previous) => previous + 1),
    }),
    [wallets, wallet, address, endpoint, override, ownedMints, reading, error, modalOpen, connect, disconnect, saveEndpoint],
  );

  // A fragment, deliberately: <body> is a flex column whose children are the
  // header, main and footer, and a wrapper element would break that. A closed
  // <dialog> is display:none, so the modal adds no layout either.
  return (
    <WalletContext value={value}>
      {children}
      <WalletModal />
    </WalletContext>
  );
}
