"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  decodeLook,
  defaultEquipped,
  encodeLook,
  randomLook,
  type CategoryId,
  type Equipped,
  type ReadyCollection,
  type Trait,
} from "@/lib/collections";
import { PiggyArt } from "@/components/piggy/piggy-art";
import { CategoryTabs } from "./category-tabs";
import { DownloadButton } from "./download-button";
import { EquippedPanel } from "./equipped-panel";
import { LoadToken } from "./load-token";
import { MyPiggies } from "./my-piggies";
import { TraitGrid } from "./trait-grid";

const ACTION =
  "flex-1 rounded-full border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function WardrobeEditor({ collection }: { collection: ReadyCollection }) {
  // equipped + synced travel together so adopting the shared look is a single
  // state write rather than two cascading ones.
  const [{ equipped, synced }, setState] = useState<{ equipped: Equipped; synced: boolean }>(() => ({
    equipped: defaultEquipped(collection),
    synced: false,
  }));
  const [activeId, setActiveId] = useState<CategoryId>(collection.categories[0].id);
  // Which piggy this look came from, and whether it is still that piggy's own
  // look. Identity is sticky through edits — the point of loading yours is to
  // change it — while `pristine` is what the rank readout depends on.
  const [token, setToken] = useState<{ id: number; rank: number; pristine: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const touch = () => setToken((previous) => (previous ? { ...previous, pristine: false } : null));
  const adopt = (loaded: { id: number; rank: number }) => setToken({ ...loaded, pristine: true });

  const setEquipped = (next: Equipped | ((previous: Equipped) => Equipped)) =>
    setState((previous) => ({
      ...previous,
      equipped: typeof next === "function" ? next(previous.equipped) : next,
    }));

  const code = useMemo(() => encodeLook(collection, equipped), [collection, equipped]);

  // Adopt a shared look once, after hydration. The URL is a browser-only
  // source, so this cannot happen during the first render — the server has
  // already emitted <img src> for the default look and they must match.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("look");
    const look = shared ? decodeLook(collection, shared) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of browser-only state
    setState({ equipped: look ?? defaultEquipped(collection), synced: true });
  }, [collection]);

  // Write it back with replaceState: the route stays static (useSearchParams
  // would force a Suspense boundary around the whole editor), Back still
  // leaves the page, and depending on `code` — a primitive — means no loop.
  useEffect(() => {
    if (!synced) return;
    const url = new URL(window.location.href);
    url.searchParams.set("look", code);
    window.history.replaceState(null, "", url);
  }, [code, synced]);

  const category = collection.categories.find((item) => item.id === activeId) ?? collection.categories[0];

  function equip(trait: Trait) {
    touch();
    setEquipped((previous) => {
      const meta = collection.categories.find((item) => item.id === trait.categoryId);
      const alreadyOn = previous[trait.categoryId] === trait.slug;
      // Clicking the equipped trait takes it off, but only where the category
      // is allowed to be empty.
      return {
        ...previous,
        [trait.categoryId]: alreadyOn && meta?.optional ? null : trait.slug,
      };
    });
  }

  function clear(categoryId: CategoryId) {
    touch();
    setEquipped((previous) => ({ ...previous, [categoryId]: null }));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      style={{ "--accent": collection.accent } as CSSProperties}
      className="mx-auto w-full max-w-6xl px-5 py-6 lg:py-10"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{collection.name}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {token ? (
              <>
                Piggy <span className="font-medium text-ink">#{token.id}</span>
                {token.pristine
                  ? ` — rank ${token.rank} of ${collection.supply.toLocaleString("en-US")}`
                  : " — edited"}
              </>
            ) : (
              collection.tagline
            )}
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-line px-3.5 py-2 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          All collections
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-2">
          {/* shrink-0 is load-bearing: the rail is a flex column that scrolls,
              and without it this aspect-square box is compressed to nothing as
              soon as the panels below make the column overflow. */}
          <div className="shrink-0 overflow-hidden rounded-card border border-line bg-surface">
            <PiggyArt collection={collection} equipped={equipped} eager className="w-full" />
          </div>

          <DownloadButton collection={collection} equipped={equipped} lookCode={code} />

          <div className="flex gap-2">
            <button
              type="button"
              className={ACTION}
              onClick={() => {
                setToken(null);
                setEquipped(randomLook(collection));
              }}
            >
              {/* A rolled look is nobody's piggy, so identity is dropped entirely. */}
              Surprise me
            </button>
            <button
              type="button"
              className={ACTION}
              onClick={() => {
                setToken(null);
                setEquipped(defaultEquipped(collection));
              }}
            >
              Reset
            </button>
            <button type="button" className={ACTION} onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          {collection.wallet && (
            <MyPiggies
              collection={collection}
              source={collection.wallet}
              selectedId={token?.id ?? null}
              onLoad={(look, loaded) => {
                setEquipped(look);
                adopt(loaded);
              }}
            />
          )}

          <LoadToken
            collection={collection}
            onLoad={(look, loaded) => {
              setEquipped(look);
              adopt(loaded);
            }}
          />

          <EquippedPanel
            collection={collection}
            equipped={equipped}
            onSelectCategory={setActiveId}
            onClear={clear}
          />
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:mt-0">
          <CategoryTabs collection={collection} active={activeId} onSelect={setActiveId} />
          <TraitGrid
            collection={collection}
            category={category}
            equippedSlug={equipped[category.id]}
            onEquip={equip}
            onClear={() => clear(category.id)}
          />
        </div>
      </div>
    </div>
  );
}
