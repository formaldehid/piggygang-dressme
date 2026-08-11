import {
  type Category,
  type Collection,
  type Trait,
  traitsByCategory,
} from "@/lib/collections";
import { TraitThumb } from "@/components/piggy/piggy-art";

const CELL =
  "flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function TraitGrid({
  collection,
  category,
  equippedId,
  baseTrait,
  onEquip,
  onClear,
}: {
  collection: Collection;
  category: Category;
  equippedId: string | null;
  /** Faint silhouette drawn behind each thumbnail for context. */
  baseTrait?: Trait;
  onEquip: (trait: Trait) => void;
  onClear: () => void;
}) {
  const traits = traitsByCategory(collection, category.id);

  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
      {category.optional && (
        <li>
          <button
            type="button"
            onClick={onClear}
            aria-pressed={equippedId === null}
            className={`${CELL} w-full ${
              equippedId === null
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-line bg-surface hover:border-ink-muted"
            }`}
          >
            <span className="flex aspect-square items-center justify-center rounded-lg bg-surface-raised text-2xl text-ink-muted">
              ✕
            </span>
            <span className="truncate text-xs font-medium text-ink-muted">None</span>
          </button>
        </li>
      )}

      {traits.map((trait) => {
        const selected = trait.id === equippedId;
        return (
          <li key={trait.id}>
            <button
              type="button"
              onClick={() => onEquip(trait)}
              aria-pressed={selected}
              className={`${CELL} w-full ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-line bg-surface hover:border-ink-muted"
              }`}
            >
              <span className="block aspect-square overflow-hidden rounded-lg bg-surface-raised">
                <TraitThumb trait={trait} base={baseTrait} />
              </span>
              <span className="truncate text-xs font-medium">{trait.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
