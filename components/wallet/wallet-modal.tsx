"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { useWallet } from "./wallet-provider";

/**
 * Wallet chooser and connection settings.
 *
 * A native <dialog> rather than a hand-rolled overlay: it renders in the top
 * layer — so it clears the sticky header without the codebase gaining its first
 * z-index scale — and brings focus trapping, Escape-to-close and ::backdrop
 * with it. Styled in the `--brand` vocabulary throughout, because showModal()
 * promotes it out of the editor's `--accent` scope even when opened from there.
 */
const ROW =
  "flex w-full items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-left text-sm transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const INPUT =
  "min-w-0 flex-1 rounded-full border border-line bg-surface-raised px-3.5 py-2 text-sm placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const ACTION =
  "shrink-0 rounded-full border border-line px-4 py-2 text-sm text-ink-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const shorten = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export function WalletModal() {
  const { wallets, address, override, error, modalOpen, closeModal, connect, disconnect, saveEndpoint } = useWallet();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (modalOpen && !element.open) element.showModal();
    if (!modalOpen && element.open) element.close();
  }, [modalOpen]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (saveEndpoint(field.current?.value ?? "") && address) closeModal();
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Wallet"
      // Escape and the close button both fire `close`, so state syncs here
      // rather than in every handler.
      onClose={closeModal}
      // The dialog element's own box is the backdrop once padding is removed,
      // so a click that lands on it and not on the panel is a click outside.
      onClick={(event) => {
        if (event.target === dialog.current) closeModal();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {address ? "Wallet" : "Connect a wallet"}
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </div>

        {address ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <span className="font-mono text-sm">{shorten(address)}</span>
            <button type="button" onClick={() => void disconnect()} className={ACTION}>
              Disconnect
            </button>
          </div>
        ) : wallets.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No Solana wallet detected. Install Phantom, Solflare or Backpack, then reload this
            page.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {wallets.map((candidate) => (
              <li key={candidate.name}>
                <button type="button" onClick={() => void connect(candidate)} className={ROW}>
                  <span
                    aria-hidden
                    // A data URI from the wallet, as a background rather than an
                    // <img>: no-img-element is only disabled under components/piggy.
                    style={{ backgroundImage: `url("${candidate.icon}")` }}
                    className="size-6 shrink-0 rounded-md bg-surface bg-contain bg-center bg-no-repeat"
                  />
                  <span className="font-medium">{candidate.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="mt-5 border-t border-line pt-4">
          <label htmlFor="wallet-rpc" className="block text-xs text-ink-muted">
            Your own Solana RPC endpoint, if you would rather not use ours. Optional, stored
            in this browser only, and used solely to list which tokens your wallet holds.
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="wallet-rpc"
              ref={field}
              // Uncontrolled, remounted each time the dialog opens, so the saved
              // override is restored and an abandoned edit does not linger.
              key={String(modalOpen)}
              defaultValue={override}
              placeholder="Using the built-in endpoint"
              inputMode="url"
              className={INPUT}
            />
            <button type="submit" className={ACTION}>
              {override ? "Update" : "Use mine"}
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-xs text-brand">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
