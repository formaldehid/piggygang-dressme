"use client";

import { useEffect, useState } from "react";
import type { ReadyCollection } from "@/lib/collections";
import { loadMintIndex } from "@/lib/mint-index";
import { useWallet } from "./wallet-provider";

/**
 * How many of this collection the connected wallet holds.
 *
 * Costs no RPC call — the provider already has the wallet's holdings, so this
 * is an intersection against the collection's mint index, or a plain length
 * where a Core read supplied the token ids pre-validated. Renders nothing
 * until there is something true to say.
 */
export function OwnedCount({ collection }: { collection: ReadyCollection }) {
  const { ownedMints, ownedCore } = useWallet();
  // Keyed by the mints it counted, so it derives back to nothing on disconnect
  // rather than needing a synchronous reset inside the effect.
  const [tally, setTally] = useState<{ source: string[]; count: number } | null>(null);
  const source = collection.wallet;
  const mints = source?.kind === "mints" ? source : null;
  const count = source?.kind === "core"
    ? (ownedCore?.[source.collection]?.holdings.length ?? null)
    : tally?.source === ownedMints
      ? tally.count
      : null;

  useEffect(() => {
    if (!mints || !ownedMints) return;
    let live = true;
    loadMintIndex(collection, mints)
      .then((index) => {
        if (!live) return;
        setTally({
          source: ownedMints,
          count: ownedMints.reduce((total, mint) => total + (index.has(mint) ? 1 : 0), 0),
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [collection, mints, ownedMints]);

  if (!count) return null;

  return (
    <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[11px] text-[var(--accent)]">
      {count} yours
    </span>
  );
}
