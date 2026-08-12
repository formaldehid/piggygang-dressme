/** Shared thresholds so a badge and its tint never disagree. */
export function rarityTier(percent: number): { label: string; className: string } {
  if (percent < 1) return { label: "Mythic", className: "bg-gold/20 text-gold" };
  if (percent < 5) return { label: "Rare", className: "bg-brand/20 text-brand" };
  if (percent < 15) return { label: "Uncommon", className: "bg-ink/10 text-ink" };
  return { label: "Common", className: "bg-ink/5 text-ink-muted" };
}

export function formatPercent(percent: number): string {
  if (percent < 0.1) return `${percent.toFixed(2)}%`;
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function RarityBadge({ percent }: { percent: number }) {
  const tier = rarityTier(percent);
  return (
    <span
      title={`${tier.label} — ${formatPercent(percent)} of the collection`}
      className={`rounded px-1 py-px font-mono text-[10px] leading-tight ${tier.className}`}
    >
      {formatPercent(percent)}
    </span>
  );
}
