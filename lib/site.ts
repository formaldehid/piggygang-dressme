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

// TODO: point these at the real Piggy Gang accounts.
export const SOCIALS: Social[] = [
  { label: "X", href: "#", icon: "x" },
  { label: "Discord", href: "#", icon: "discord" },
  { label: "Marketplace", href: "#", icon: "marketplace" },
];
