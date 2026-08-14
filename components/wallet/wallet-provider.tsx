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
import { coreQueries } from "@/lib/collections";
import {
  getCoreAssets,
  getOwnedMints,
  isDasUnsupported,
  type CoreHoldings,
} from "@/lib/solana-rpc";
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
 * The chain is read **once per address**, not per collection, in two
 * independent calls: `getTokenAccountsByOwner` returns every SPL mint the
 * wallet holds in one go, and one DAS `searchAssets` per Core-sourced
 * collection (currently Piggy Gang's) returns its swapped piggies. Deciding
 * which SPL mints are piggies is a local intersection against each
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
  /** Core holdings per Core collection address, or null before a successful read. */
  ownedCore: Record<string, CoreHoldings> | null;
  coreReading: boolean;
  /** The Core read's failure, held apart: the SPL read can succeed while this fails. */
  coreError: string | null;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (wallet: SolanaWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  saveEndpoint: (value: string) => boolean;
  refresh: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

// Which DAS reads a connected address needs is config, not state.
const CORE = coreQueries();

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

  // The Core read, keyed exactly like the SPL one but held apart: a hung or
  // failed DAS endpoint must not blank the mint-indexed collections.
  const [coreRead, setCoreRead] = useState<{
    key: string;
    assets: Record<string, CoreHoldings> | null;
    error: string | null;
  } | null>(null);
  const currentCore = coreRead?.key === key ? coreRead : null;
  const ownedCore = currentCore?.assets ?? null;
  // The CORE.length guard keeps a build with no Core collections from deriving
  // "reading" forever — this read simply never happens there.
  const coreReading = CORE.length > 0 && key !== null && currentCore === null;
  const coreError = currentCore?.error ?? null;

  // Wallets register asynchronously and localStorage is browser-only, so both
  // are read after hydration rather than during render.
  useEffect(() => {
    const saved = readOverride();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of browser-only state
    setWallets(listWallets());
    setOverride(saved);
    return onWalletsChange(setWallets);
  }, []);

  // The SPL RPC call. Re-runs when the address, the endpoint or an explicit
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

  // The Core RPC call, on the same key so one refresh re-runs both. This is
  // the only multi-request read in the app, so it also aborts its in-flight
  // pagination when the address or endpoint changes mid-read; the aborted
  // rejection lands in the catch, where the dead `live` flag swallows it.
  useEffect(() => {
    if (!key || !address || !endpoint || CORE.length === 0) return;
    let live = true;
    const controller = new AbortController();
    Promise.all(
      CORE.map(async (query) =>
        [query.collection, await getCoreAssets(endpoint, address, query, controller.signal)] as const,
      ),
    )
      .then((entries) => live && setCoreRead({ key, assets: Object.fromEntries(entries), error: null }))
      .catch((cause: unknown) => {
        if (!live) return;
        const message = isDasUnsupported(cause)
          ? endpoint !== DEFAULT_ENDPOINT
            ? "Your RPC endpoint does not support the DAS API that listing Piggy Gang needs. The built-in endpoint does — clear the override in the wallet dialog to use it."
            : "The RPC endpoint could not list Core assets (no DAS support). Try again later."
          : cause instanceof Error
            ? cause.message
            : "Could not read the wallet's Core assets.";
        setCoreRead({ key, assets: null, error: message });
      });
    return () => {
      live = false;
      controller.abort();
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
      ownedCore,
      coreReading,
      coreError,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      connect,
      disconnect,
      saveEndpoint,
      refresh: () => setNonce((previous) => previous + 1),
    }),
    [wallets, wallet, address, endpoint, override, ownedMints, reading, error, ownedCore, coreReading, coreError, modalOpen, connect, disconnect, saveEndpoint],
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
