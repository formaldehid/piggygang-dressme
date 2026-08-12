import { traitPercent, type Category, type ReadyCollection, type Trait } from "@/lib/collections";
import { EmptyThumb, TraitThumb } from "@/components/piggy/piggy-art";
import { RarityBadge } from "./rarity-badge";

const CELL =
  "flex w-full flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const selectedClass = (selected: boolean) =>
  selected
    ? "border-[var(--accent)] bg-[var(--accent)]/10"
    : "border-line bg-surface hover:border-ink-muted";

export function TraitGrid({
  collection,
  category,
  equippedSlug,
  onEquip,
  onClear,
}: {
  collection: ReadyCollection;
  category: Category;
  equippedSlug: string | null;
  onEquip: (trait: Trait) => void;
  onClear: () => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
      {category.optional && (
        <li>
          <button
            type="button"
            onClick={onClear}
            aria-pressed={equippedSlug === null}
            className={`${CELL} ${selectedClass(equippedSlug === null)}`}
          >
            <span className="block overflow-hidden rounded-lg bg-surface-raised">
              <EmptyThumb collection={collection} categoryId={category.id} />
            </span>
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-medium text-ink-muted">None</span>
              <RarityBadge percent={traitPercent(collection, category.noneCount)} />
            </span>
          </button>
        </li>
      )}

      {category.traits.map((trait) => {
        const selected = trait.slug === equippedSlug;
        return (
          <li key={trait.id}>
            <button
              type="button"
              onClick={() => onEquip(trait)}
              aria-pressed={selected}
              title={trait.name}
              className={`${CELL} ${selectedClass(selected)}`}
            >
              <span className="block overflow-hidden rounded-lg bg-surface-raised">
                <TraitThumb collection={collection} trait={trait} />
              </span>
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium">{trait.name}</span>
                <RarityBadge percent={traitPercent(collection, trait.count)} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
