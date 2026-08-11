import { CATEGORIES, type CategoryId, type Collection } from "@/lib/collections";
import type { Equipped } from "@/components/piggy/piggy-art";

export function EquippedPanel({
  collection,
  equipped,
  onSelectCategory,
  onClear,
}: {
  collection: Collection;
  equipped: Equipped;
  onSelectCategory: (category: CategoryId) => void;
  onClear: (category: CategoryId) => void;
}) {
  return (
    <section
      aria-label="Equipped traits"
      className="rounded-card border border-line bg-surface p-4"
    >
      <h2 className="mb-3 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase">
        Equipped
      </h2>

      <ul className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => {
          const trait = collection.traits.find((item) => item.id === equipped[category.id]);

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
                  className="rounded-full py-1.5 pr-2 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="text-ink-muted">{category.label}</span>
                  <span className="ml-1.5 font-medium">{trait ? trait.name : "—"}</span>
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
    </section>
  );
}
