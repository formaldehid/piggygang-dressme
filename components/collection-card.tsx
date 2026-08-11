import type { CSSProperties } from "react";
import Link from "next/link";
import { CATEGORIES, traitsByCategory, type Collection } from "@/lib/collections";
import { PiggyArt, type Equipped } from "@/components/piggy/piggy-art";

/** A dressed look for the card art, offset per card so the three don't match. */
function showcase(collection: Collection, seed: number): Equipped {
  const equipped = {} as Equipped;
  CATEGORIES.forEach((category, index) => {
    const traits = traitsByCategory(collection, category.id);
    equipped[category.id] = traits.length
      ? traits[(seed + index * 2) % traits.length].id
      : null;
  });
  return equipped;
}

export function CollectionCard({
  collection,
  index,
}: {
  collection: Collection;
  index: number;
}) {
  return (
    <Link
      href={`/dress/${collection.slug}`}
      style={{ "--accent": collection.accent } as CSSProperties}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className="relative aspect-square overflow-hidden">
        <PiggyArt
          collection={collection}
          equipped={showcase(collection, index + 1)}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-line p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight">{collection.name}</h3>
          <span className="font-mono text-xs text-ink-muted">
            {collection.supply.toLocaleString("en-US")}
          </span>
        </div>
        <p className="text-sm text-ink-muted">{collection.tagline}</p>
        <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
          Dress up
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
