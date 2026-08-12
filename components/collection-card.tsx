import type { CSSProperties } from "react";
import Link from "next/link";
import { decodeLook, defaultEquipped, type Collection } from "@/lib/collections";
import { PiggyArt } from "@/components/piggy/piggy-art";
import { PiggyMark } from "@/components/brand/wordmark";

export function CollectionCard({ collection }: { collection: Collection }) {
  const accent = { "--accent": collection.accent } as CSSProperties;

  if (collection.status === "coming-soon") {
    return (
      <div
        style={accent}
        className="flex w-full flex-col overflow-hidden rounded-card border border-dashed border-line bg-surface/50"
      >
        <div className="flex aspect-square items-center justify-center bg-[var(--accent)]/5">
          <PiggyMark className="h-16 w-16 opacity-25" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 border-t border-line p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-ink-muted">
              {collection.name}
            </h3>
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-muted">
              Coming soon
            </span>
          </div>
          <p className="text-sm text-ink-muted">{collection.tagline}</p>
        </div>
      </div>
    );
  }

  const equipped = decodeLook(collection, collection.heroLook) ?? defaultEquipped(collection);

  return (
    <Link
      href={`/dress/${collection.slug}`}
      style={accent}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <PiggyArt
        collection={collection}
        equipped={equipped}
        tier="thumb"
        eager
        className="w-full transition-transform duration-300 group-hover:scale-105"
      />

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
