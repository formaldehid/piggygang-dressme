import type { CSSProperties } from "react";
import {
  categoryOf,
  describeLook,
  layerSources,
  mannequinEquipped,
  type Equipped,
  type ReadyCollection,
  type Rect,
  type Trait,
} from "@/lib/collections";

const FULL_FRAME: Rect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Percentage box that zooms the canvas onto a category's art. A raw Earring
 * layer occupies about a fifth of the frame — without this it is an 11-pixel
 * smudge in a grid cell.
 */
function frame(focus: Rect): CSSProperties {
  return {
    width: `${100 / focus.w}%`,
    height: `${100 / focus.h}%`,
    left: `${(-focus.x / focus.w) * 100}%`,
    top: `${(-focus.y / focus.h) * 100}%`,
  };
}

/** The composed collectible: every equipped layer stacked in paint order. */
export function PiggyArt({
  collection,
  equipped,
  tier = "full",
  focus = FULL_FRAME,
  className,
  eager = false,
}: {
  collection: ReadyCollection;
  equipped: Equipped;
  tier?: "full" | "thumb";
  focus?: Rect;
  className?: string;
  eager?: boolean;
}) {
  const layers = layerSources(collection, equipped, tier);

  return (
    <div
      role="img"
      aria-label={describeLook(collection, equipped)}
      className={`relative isolate aspect-square overflow-hidden ${className ?? ""}`}
    >
      <div className="absolute" style={frame(focus)}>
        {layers.map((layer) => (
          // Keyed by the stack step, never by src: React then mutates src on
          // the same node, so the browser keeps painting the previous bitmap
          // until the new one decodes instead of flashing empty.
          <img
            key={layer.key}
            src={layer.src}
            alt=""
            width={collection.canvas}
            height={collection.canvas}
            draggable={false}
            decoding="async"
            loading={eager ? "eager" : "lazy"}
            // The preview is the LCP element and competes with a screenful of
            // lazy thumbs on the same connection.
            fetchPriority={eager ? "high" : "auto"}
            className="absolute inset-0 h-full w-full select-none"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A single trait as a paper doll — mannequin body plus the trait, framed on
 * that category's art. Same resolver as the preview, so there is no second
 * rendering path to keep in sync.
 */
export function TraitThumb({
  collection,
  trait,
}: {
  collection: ReadyCollection;
  trait: Trait;
}) {
  const category = categoryOf(collection, trait.categoryId);

  return (
    <PiggyArt
      collection={collection}
      tier="thumb"
      focus={category.focus}
      equipped={{ ...mannequinEquipped(collection), [trait.categoryId]: trait.slug }}
    />
  );
}

/** The empty-slot tile: the mannequin with nothing in that category. */
export function EmptyThumb({
  collection,
  categoryId,
}: {
  collection: ReadyCollection;
  categoryId: string;
}) {
  const category = categoryOf(collection, categoryId);

  return (
    <PiggyArt
      collection={collection}
      tier="thumb"
      focus={category.focus}
      equipped={{ ...mannequinEquipped(collection), [categoryId]: null }}
    />
  );
}
