"use client";

import { useState } from "react";
import type { Equipped, ReadyCollection } from "@/lib/collections";
import { PiggyArt } from "./piggy-art";

/**
 * Where the official minted renders are served from, e.g. a blob bucket. The
 * collection's original image host (GenesysGo Shadow Drive) no longer resolves,
 * so these files exist only where we put them.
 */
const RENDER_BASE = process.env.NEXT_PUBLIC_RENDER_BASE_URL ?? "";

/**
 * A minted piggy as it was minted, falling back to compositing the same look
 * from trait layers.
 *
 * The fallback is not a degraded mode: the compositor was verified pixel-exact
 * against these very renders (worst channel delta 2 of 255). It means the
 * wallet picker works with no bucket configured at all.
 */
export function TokenImage({
  collection,
  mint,
  equipped,
  alt,
}: {
  collection: ReadyCollection;
  /** `null` for a piggy with no minted render to fetch — a swapped Core asset. */
  mint: string | null;
  equipped: Equipped;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = RENDER_BASE && mint ? `${RENDER_BASE}/${collection.slug}/${mint}.png` : "";

  if (!src || failed) {
    return <PiggyArt collection={collection} equipped={equipped} tier="thumb" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={collection.canvas}
      height={collection.canvas}
      draggable={false}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-square w-full select-none object-cover"
    />
  );
}
