import {
  oneInOdds,
  rarityPercentile,
  slotCount,
  traitOf,
  traitPercent,
  type CategoryId,
  type Equipped,
  type ReadyCollection,
} from "@/lib/collections";
import { RarityBadge } from "./rarity-badge";

export function EquippedPanel({
  collection,
  equipped,
  onSelectCategory,
  onClear,
}: {
  collection: ReadyCollection;
  equipped: Equipped;
  onSelectCategory: (category: CategoryId) => void;
  onClear: (category: CategoryId) => void;
}) {
  const percentile = rarityPercentile(collection, equipped);

  return (
    <section aria-label="Equipped traits" className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.14em] text-ink-muted uppercase">Equipped</h2>
        <span className="font-mono text-xs text-ink-muted">
          {collection.categories.length} slots
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {collection.categories.map((category) => {
          const trait = traitOf(collection, equipped, category.id);
          return (
            <li key={category.id}>
              <span
                className={`flex items-center rounded-full border text-xs ${
                  trait ? "border-line bg-surface-raised" : "border-dashed border-line"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className="flex items-center gap-1.5 rounded-full py-1.5 pr-2 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="text-ink-muted">{category.label}</span>
                  <span className="font-medium">{trait ? trait.name : "None"}</span>
                  <RarityBadge
                    percent={traitPercent(collection, slotCount(collection, equipped, category))}
                  />
                </button>

                {category.optional && trait ? (
                  <button
                    type="button"
                    onClick={() => onClear(category.id)}
                    aria-label={`Remove ${trait.name}`}
                    className="rounded-full px-2 py-1.5 text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    ✕
                  </button>
                ) : (
                  <span className="pr-3" />
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm">
            Rarer than <span className="font-semibold text-[var(--accent)]">{percentile}%</span> of{" "}
            {collection.name}
          </span>
          <span className="font-mono text-xs text-ink-muted">
            {oneInOdds(collection, equipped)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          Statistical rarity across visual traits — not the official ranking.
        </p>
      </div>
    </section>
  );
}
