import { CATEGORIES, type CategoryId, type Collection, traitsByCategory } from "@/lib/collections";

export function CategoryTabs({
  collection,
  active,
  onSelect,
}: {
  collection: Collection;
  active: CategoryId;
  onSelect: (category: CategoryId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Trait categories"
      className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {CATEGORIES.map((category) => {
        const selected = category.id === active;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(category.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              selected
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-ink"
                : "border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
          >
            {category.label}
            <span className="ml-1.5 font-mono text-xs text-ink-muted">
              {traitsByCategory(collection, category.id).length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
