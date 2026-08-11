"use client";

import { type CSSProperties, useRef, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  defaultEquipped,
  type CategoryId,
  type Collection,
  type Trait,
} from "@/lib/collections";
import { PiggyArt, type Equipped } from "@/components/piggy/piggy-art";
import { CategoryTabs } from "./category-tabs";
import { DownloadButton } from "./download-button";
import { EquippedPanel } from "./equipped-panel";
import { TraitGrid } from "./trait-grid";

export function WardrobeEditor({ collection }: { collection: Collection }) {
  const [equipped, setEquipped] = useState<Equipped>(() => defaultEquipped(collection));
  const [activeId, setActiveId] = useState<CategoryId>(CATEGORIES[0].id);
  const svgRef = useRef<SVGSVGElement>(null);

  const category = CATEGORIES.find((item) => item.id === activeId) ?? CATEGORIES[0];
  const baseTrait = collection.traits.find((trait) => trait.id === equipped.body);

  function equip(trait: Trait) {
    setEquipped((previous) => {
      const meta = CATEGORIES.find((item) => item.id === trait.category);
      const alreadyOn = previous[trait.category] === trait.id;
      return {
        ...previous,
        // Clicking the equipped trait takes it off again, but only where the
        // category is allowed to be empty.
        [trait.category]: alreadyOn && meta?.optional ? null : trait.id,
      };
    });
  }

  function clear(categoryId: CategoryId) {
    setEquipped((previous) => ({ ...previous, [categoryId]: null }));
  }

  return (
    <div
      style={{ "--accent": collection.accent } as CSSProperties}
      className="mx-auto w-full max-w-6xl px-5 py-6 lg:py-10"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {collection.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">{collection.tagline}</p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-line px-3.5 py-2 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          All collections
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <PiggyArt
              svgRef={svgRef}
              collection={collection}
              equipped={equipped}
              className="aspect-square w-full"
            />
          </div>

          <DownloadButton svgRef={svgRef} filename={`${collection.slug}.png`} />

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
            equippedId={equipped[category.id]}
            baseTrait={baseTrait}
            onEquip={equip}
            onClear={() => clear(category.id)}
          />
        </div>
      </div>
    </div>
  );
}
