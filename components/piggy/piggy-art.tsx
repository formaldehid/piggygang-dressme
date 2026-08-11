import type { Ref } from "react";
import {
  CATEGORY_ORDER,
  type CategoryId,
  type Collection,
  type Trait,
} from "@/lib/collections";
import { ART_SIZE, TraitLayer } from "./trait-layer";

export type Equipped = Record<CategoryId, string | null>;

const VIEW_BOX = `0 0 ${ART_SIZE} ${ART_SIZE}`;

function describe(collection: Collection, equipped: Equipped): string {
  const worn = CATEGORY_ORDER.map((category) => equipped[category])
    .map((id) => collection.traits.find((trait) => trait.id === id)?.name)
    .filter(Boolean);
  return `${collection.name} piggy wearing ${worn.join(", ")}`;
}

/** The composed collectible: every equipped trait stacked in CATEGORY_ORDER. */
export function PiggyArt({
  collection,
  equipped,
  svgRef,
  className,
}: {
  collection: Collection;
  equipped: Equipped;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}) {
  const byId = new Map(collection.traits.map((trait) => [trait.id, trait]));

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEW_BOX}
      className={className}
      role="img"
      aria-label={describe(collection, equipped)}
    >
      {CATEGORY_ORDER.map((category) => {
        const id = equipped[category];
        const trait = id ? byId.get(id) : undefined;
        return trait ? <TraitLayer key={category} trait={trait} /> : null;
      })}
    </svg>
  );
}

/** A single trait, drawn over a faint body so off-face traits stay readable. */
export function TraitThumb({ trait, base }: { trait: Trait; base?: Trait }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEW_BOX} className="h-full w-full" aria-hidden="true">
      {trait.category !== "background" && base && (
        <g opacity="0.16">
          <TraitLayer trait={base} />
        </g>
      )}
      <TraitLayer trait={trait} />
    </svg>
  );
}
