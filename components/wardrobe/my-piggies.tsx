import { useEffect, useMemo, useState } from "react";
import type { Equipped, ReadyCollection } from "@/lib/collections";
import { loadMintIndex } from "@/lib/mint-index";
import { loadTokenIndex } from "@/lib/token-index";
import { useWallet } from "@/components/wallet/wallet-provider";
import { TokenImage } from "@/components/piggy/token-image";

const GHOST =
  "rounded-full border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const CELL =
  "flex w-full flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const selectedClass = (selected: boolean) =>
  selected
    ? "border-[var(--accent)] bg-[var(--accent)]/10"
    : "border-line bg-surface hover:border-ink-muted";

type Owned = { id: number; rank: number; mint: string; equipped: Equipped };

/**
 * Tiles rendered before "Show more". Without a render bucket configured each
 * tile composites the piggy from its layers, so a wallet holding 162 of them
 * would otherwise put ~1,800 images on the page and take seconds to settle.
 */
const PAGE = 24;

/**
 * The piggies this holder owns in this collection.
 *
 * No RPC call of its own: the provider fetches the wallet's mints once, and
 * deciding which of them belong here is a local intersection against the
 * committed mint index. Switching collections costs nothing on the network.
 */
export function MyPiggies({
  collection,
  mints,
  selectedId,
  onLoad,
}: {
  collection: ReadyCollection;
  /** Passed in so the caller proves the collection has a mint index. */
  mints: NonNullable<ReadyCollection["mints"]>;
  selectedId: number | null;
  onLoad: (equipped: Equipped, token: { id: number; rank: number }) => void;
}) {
  const { address, ownedMints, reading, error: walletError, openModal, refresh } = useWallet();

  // Held against the mints it was resolved from, so a new read derives back to
  // "not resolved yet" without a synchronous reset.
  const [resolved, setResolved] = useState<{ source: string[]; rows: Owned[] | null } | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const current = resolved?.source === ownedMints ? resolved : null;
  const owned = current?.rows ?? null;
  const shown = useMemo(() => owned?.slice(0, limit) ?? null, [owned, limit]);

  // The provider owns connection and RPC failures, but this panel is where a
  // holder is looking when the read fails, so it echoes them rather than
  // sitting on an empty grid.
  const failure = current && !current.rows
    ? "Could not load the collection index."
    : (ownedMints ? null : walletError);

  useEffect(() => {
    if (!ownedMints) return;
    let live = true;
    Promise.all([loadTokenIndex(collection), loadMintIndex(collection, mints)])
      .then(([index, mintIndex]) => {
        if (!live) return;
        const rows: Owned[] = [];
        for (const mint of ownedMints) {
          const id = mintIndex.get(mint);
          if (id === undefined) continue;
          const look = index.lookAt(id);
          if (look) rows.push({ id, rank: look.rank, mint, equipped: look.equipped });
        }
        rows.sort((a, b) => a.id - b.id);
        setResolved({ source: ownedMints, rows });
      })
      .catch(() => live && setResolved({ source: ownedMints, rows: null }));
    return () => {
      live = false;
    };
  }, [collection, mints, ownedMints]);

  return (
    <section aria-label="My piggies" className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.14em] text-ink-muted uppercase">My piggies</h2>
        {owned && owned.length > 0 && (
          <span className="font-mono text-xs text-ink-muted">{owned.length}</span>
        )}
      </div>

      {!address && (
        <p className="text-xs text-ink-muted">
          <button type="button" onClick={openModal} className="text-[var(--accent)] hover:underline">
            Connect a wallet
          </button>{" "}
          to dress the piggies you own.
        </p>
      )}

      {address && (
        <>
          {reading && <p className="text-xs text-ink-muted">Reading the wallet…</p>}

          {!reading && !owned && !failure && (
            <p className="text-xs text-ink-muted">Nothing read from this wallet yet.</p>
          )}

          {!reading && owned?.length === 0 && (
            <p className="text-xs text-ink-muted">
              No {collection.name} piggies in this wallet. Anything listed for sale or staked is
              held elsewhere and will not show up here.
            </p>
          )}

          {!reading && shown && shown.length > 0 && (
            <ul className="grid grid-cols-3 gap-2.5">
              {shown.map((piggy) => {
                const selected = piggy.id === selectedId;
                return (
                  <li key={piggy.mint}>
                    <button
                      type="button"
                      onClick={() => onLoad(piggy.equipped, { id: piggy.id, rank: piggy.rank })}
                      aria-pressed={selected}
                      title={`Piggy #${piggy.id} — rank ${piggy.rank}`}
                      className={`${CELL} ${selectedClass(selected)}`}
                    >
                      <span className="block overflow-hidden rounded-lg bg-surface-raised">
                        <TokenImage
                          collection={collection}
                          mint={piggy.mint}
                          equipped={piggy.equipped}
                          alt={`Piggy #${piggy.id}`}
                        />
                      </span>
                      <span className="truncate font-mono text-xs font-medium">#{piggy.id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-2 flex gap-2">
            {owned && owned.length > limit && (
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={GHOST}>
                Show {Math.min(PAGE, owned.length - limit)} more
              </button>
            )}
            <button type="button" onClick={refresh} disabled={reading} className={GHOST}>
              {reading ? "Reading…" : "Refresh"}
            </button>
          </div>
        </>
      )}

      {failure && (
        <p role="alert" className="mt-2 text-xs text-brand">
          {failure}
        </p>
      )}
    </section>
  );
}
