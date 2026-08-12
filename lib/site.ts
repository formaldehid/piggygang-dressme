export const SITE = {
  name: "Piggy Dress Me",
  tagline: "Dress your piggy for any occasion.",
} as const;

export type Social = {
  label: string;
  href: string;
  /** Key into ICONS in components/site-footer.tsx */
  icon: "x" | "discord" | "marketplace";
};

/** From the collection metadata in the piggy-image-composer export. */
export const SOCIALS: Social[] = [
  { label: "X", href: "https://twitter.com/PiggySolGang", icon: "x" },
  { label: "Discord", href: "https://discord.gg/QyUHFsZnuJ", icon: "discord" },
  { label: "piggygang.com", href: "https://piggygang.com/", icon: "marketplace" },
];
