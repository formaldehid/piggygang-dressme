/**
 * Collection + trait data for the wardrobe editor.
 *
 * The real trait artwork does not exist yet, so every trait here is described
 * as a `variant` (which silhouette to draw) plus a two-colour palette. The
 * drawing itself lives in `components/piggy/trait-layer.tsx`. Keeping traits as
 * plain serializable objects matters: a Server Component page passes them
 * straight across the boundary into the client-side editor.
 */

/** Also the z-order the layers are painted in: first entry is furthest back. */
export const CATEGORY_ORDER = [
  "background",
  "body",
  "outfit",
  "mouth",
  "eyes",
  "headwear",
  "accessory",
] as const;

export type CategoryId = (typeof CATEGORY_ORDER)[number];

export type Trait = {
  id: string;
  name: string;
  category: CategoryId;
  variant: number;
  colors: [string, string];
};

export type Category = {
  id: CategoryId;
  label: string;
  /** Optional categories can be left empty; required ones always have something equipped. */
  optional: boolean;
};

export type Collection = {
  slug: string;
  name: string;
  tagline: string;
  supply: number;
  /** Drives the card glow and the editor's active-state chrome. */
  accent: string;
  traits: Trait[];
};

export const CATEGORIES: Category[] = [
  { id: "background", label: "Background", optional: false },
  { id: "body", label: "Skin", optional: false },
  { id: "outfit", label: "Outfit", optional: true },
  { id: "mouth", label: "Mouth", optional: false },
  { id: "eyes", label: "Eyes", optional: false },
  { id: "headwear", label: "Headwear", optional: true },
  { id: "accessory", label: "Accessory", optional: true },
];

type Spec = readonly [name: string, c0: string, c1: string];

/** Eyes and mouths read the same across all three collections. */
const EYES: readonly Spec[] = [
  ["Beady", "#1f2937", "#ffffff"],
  ["Sleepy", "#1f2937", "#1f2937"],
  ["Wink", "#1f2937", "#ffffff"],
  ["Sparkle", "#1f2937", "#ffffff"],
  ["Laser", "#ff2d55", "#ff8fa3"],
];

const MOUTHS: readonly Spec[] = [
  ["Smile", "#7f1d1d", "#ffffff"],
  ["Grin", "#7f1d1d", "#ffffff"],
  ["Smirk", "#7f1d1d", "#ffffff"],
  ["Oh!", "#7f1d1d", "#ef7d94"],
];

type Recipe = {
  slug: string;
  name: string;
  tagline: string;
  supply: number;
  accent: string;
  backgrounds: readonly Spec[];
  skins: readonly Spec[];
  outfits: readonly Spec[];
  headwear: readonly Spec[];
  accessories: readonly Spec[];
};

const RECIPES: Recipe[] = [
  {
    slug: "piggy-sol-gang",
    name: "Piggy SOL Gang",
    tagline: "The originals, straight off the chain.",
    supply: 3333,
    accent: "#9945ff",
    backgrounds: [
      ["Solana Night", "#120a2a", "#9945ff"],
      ["Validator", "#0a1f1a", "#14f195"],
      ["Mainnet", "#1a1030", "#7c3aed"],
      ["Devnet", "#0d1b2a", "#38bdf8"],
      ["Airdrop", "#2a1030", "#f472b6"],
      ["Bull Run", "#2a1a0a", "#fbbf24"],
    ],
    skins: [
      ["Classic Pink", "#ffb3c9", "#f78fb0"],
      ["Chrome", "#cfd8e3", "#a8b6c6"],
      ["Cocoa", "#c98f6f", "#a97155"],
    ],
    outfits: [
      ["Dev Hoodie", "#5b21b6", "#7c3aed"],
      ["Gold Chain", "#ffd166", "#f59e0b"],
      ["Validator Scarf", "#14f195", "#0e9f6e"],
      ["Airdrop Tee", "#22d3ee", "#0891b2"],
      ["Tux", "#111827", "#e5e7eb"],
      ["Puffer", "#f472b6", "#db2777"],
    ],
    headwear: [
      ["Snapback", "#7c3aed", "#4c1d95"],
      ["Crown", "#ffd166", "#f59e0b"],
      ["Beanie", "#14f195", "#0e9f6e"],
      ["Halo", "#fde68a", "#fbbf24"],
      ["Cowboy", "#a97155", "#7c4a2d"],
      ["Horns", "#ef4444", "#991b1b"],
    ],
    accessories: [
      ["Shades", "#111827", "#374151"],
      ["Earring", "#ffd166", "#f59e0b"],
      ["Cigar", "#7c4a2d", "#f97316"],
      ["Blush", "#ff8fa3", "#ff5c7a"],
      ["Monocle", "#e5e7eb", "#9ca3af"],
    ],
  },
  {
    slug: "piggy-girl-gang",
    name: "Piggy Girl Gang",
    tagline: "Pastel piggies with a mean streak.",
    supply: 2222,
    accent: "#ff8ec4",
    backgrounds: [
      ["Bubblegum", "#2a1020", "#ff8ec4"],
      ["Lilac Haze", "#1c1430", "#c9a6ff"],
      ["Peach Fizz", "#2e1618", "#ffb4a2"],
      ["Cotton Sky", "#141c2e", "#a6d8ff"],
      ["Mint Cream", "#0f2420", "#9ff0d0"],
      ["Golden Hour", "#2c1c0c", "#ffd166"],
    ],
    skins: [
      ["Blush Pink", "#ffc2d6", "#ff9dbb"],
      ["Rose Gold", "#ffc9b3", "#f0a184"],
      ["Mocha", "#c98f6f", "#a97155"],
    ],
    outfits: [
      ["Cardigan", "#c9a6ff", "#a97dff"],
      ["Pearls", "#f8f5ff", "#d8cfe8"],
      ["Silk Scarf", "#ff8ec4", "#e5619b"],
      ["Crop Tee", "#9ff0d0", "#4ec99b"],
      ["Ballgown", "#ffb4a2", "#e58b76"],
      ["Puffer", "#a6d8ff", "#6bb6e8"],
    ],
    headwear: [
      ["Bow", "#ff8ec4", "#e5619b"],
      ["Tiara", "#ffd166", "#f59e0b"],
      ["Beret", "#c9a6ff", "#a97dff"],
      ["Halo", "#fde68a", "#fbbf24"],
      ["Sun Hat", "#ffe0b3", "#e8bd83"],
      ["Devil Horns", "#ff5fa2", "#c9316f"],
    ],
    accessories: [
      ["Heart Shades", "#ff5fa2", "#ffd1e4"],
      ["Hoops", "#ffd166", "#f59e0b"],
      ["Lollipop", "#ff8ec4", "#ffffff"],
      ["Blush", "#ff8fa3", "#ff5c7a"],
      ["Monocle", "#e5e7eb", "#9ca3af"],
    ],
  },
  {
    slug: "piggy-gang",
    name: "Piggy Gang",
    tagline: "Muddy, gold-plated and completely feral.",
    supply: 4444,
    accent: "#ff5fa2",
    backgrounds: [
      ["Pink Static", "#2a0f1c", "#ff5fa2"],
      ["Gold Rush", "#2a1e08", "#ffd166"],
      ["Mud Bath", "#1e1512", "#a97155"],
      ["Neon Sty", "#12142a", "#7dd3fc"],
      ["Truffle", "#181022", "#b388ff"],
      ["Sunset Pen", "#2d1410", "#ff8a5b"],
    ],
    skins: [
      ["Classic Pink", "#ffb3c9", "#f78fb0"],
      ["Mud Caked", "#b08968", "#8c6a4f"],
      ["Midnight", "#6b7280", "#4b5563"],
    ],
    outfits: [
      ["Hoodie", "#374151", "#111827"],
      ["Gold Chain", "#ffd166", "#f59e0b"],
      ["Bandana", "#ef4444", "#b91c1c"],
      ["Jersey", "#22d3ee", "#0891b2"],
      ["Tux", "#111827", "#e5e7eb"],
      ["Overalls", "#3b82f6", "#1d4ed8"],
    ],
    headwear: [
      ["Trucker Cap", "#ef4444", "#991b1b"],
      ["Crown", "#ffd166", "#f59e0b"],
      ["Beanie", "#f97316", "#c2410c"],
      ["Halo", "#fde68a", "#fbbf24"],
      ["Cowboy", "#a97155", "#7c4a2d"],
      ["Horns", "#ff5fa2", "#c9316f"],
    ],
    accessories: [
      ["Shades", "#111827", "#374151"],
      ["Gold Tooth", "#ffd166", "#f59e0b"],
      ["Cigar", "#7c4a2d", "#f97316"],
      ["Blush", "#ff8fa3", "#ff5c7a"],
      ["Monocle", "#e5e7eb", "#9ca3af"],
    ],
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function build(
  slug: string,
  category: CategoryId,
  specs: readonly Spec[],
  variantCount: number,
): Trait[] {
  return specs.map(([name, c0, c1], index) => ({
    id: `${slug}-${category}-${slugify(name)}`,
    name,
    category,
    variant: index % variantCount,
    colors: [c0, c1] as [string, string],
  }));
}

export const COLLECTIONS: Collection[] = RECIPES.map((recipe) => ({
  slug: recipe.slug,
  name: recipe.name,
  tagline: recipe.tagline,
  supply: recipe.supply,
  accent: recipe.accent,
  traits: [
    ...build(recipe.slug, "background", recipe.backgrounds, 3),
    ...build(recipe.slug, "body", recipe.skins, 3),
    ...build(recipe.slug, "outfit", recipe.outfits, 6),
    ...build(recipe.slug, "mouth", MOUTHS, 4),
    ...build(recipe.slug, "eyes", EYES, 5),
    ...build(recipe.slug, "headwear", recipe.headwear, 6),
    ...build(recipe.slug, "accessory", recipe.accessories, 5),
  ],
}));

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((collection) => collection.slug === slug);
}

export function traitsByCategory(collection: Collection, category: CategoryId): Trait[] {
  return collection.traits.filter((trait) => trait.category === category);
}

/** The starting outfit: first trait of each required category, optionals empty. */
export function defaultEquipped(collection: Collection): Record<CategoryId, string | null> {
  const equipped = {} as Record<CategoryId, string | null>;
  for (const category of CATEGORIES) {
    const first = traitsByCategory(collection, category.id)[0];
    equipped[category.id] = category.optional ? null : (first?.id ?? null);
  }
  return equipped;
}
