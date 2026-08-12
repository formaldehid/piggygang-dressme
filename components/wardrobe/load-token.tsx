import { useState, type FormEvent } from "react";
import type { Equipped, ReadyCollection } from "@/lib/collections";
import { loadTokenIndex } from "@/lib/token-index";

/**
 * Loads a real token's trait combination as a starting point. The index is
 * ~68 KB and only fetched once the control is touched, so visitors who never
 * use it pay nothing.
 */
export function LoadToken({
  collection,
  onLoad,
}: {
  collection: ReadyCollection;
  onLoad: (equipped: Equipped, token: { id: number; rank: number }) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { firstId, count } = collection.tokens;
  const prefetch = () => void loadTokenIndex(collection).catch(() => {});

  async function load(requested?: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const index = await loadTokenIndex(collection);
      const id = requested ?? index.randomId();
      const token = index.lookAt(id);
      if (!token) {
        setError(`Pick a number between ${firstId} and ${firstId + count - 1}.`);
        return;
      }
      setValue(`#${token.id}`);
      onLoad(token.equipped, { id: token.id, rank: token.rank });
    } catch {
      setError("Could not load the collection index.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(value.trim().replace(/^#/, ""));
    if (!Number.isInteger(parsed)) {
      setError(`Pick a number between ${firstId} and ${firstId + count - 1}.`);
      return;
    }
    void load(parsed);
  }

  return (
    <section aria-label="Load a real piggy" className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase">
        Load a real piggy
      </h2>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={prefetch}
          onPointerEnter={prefetch}
          inputMode="numeric"
          placeholder={`#1 – #${firstId + count - 1}`}
          aria-label="Token number"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-raised px-3.5 py-2 text-sm placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
        >
          Load
        </button>
      </form>

      <button
        type="button"
        onClick={() => void load()}
        onPointerEnter={prefetch}
        disabled={busy}
        className="mt-2 w-full rounded-full border border-line px-4 py-2 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        {busy ? "Loading…" : "Random real piggy"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-brand">
          {error}
        </p>
      )}
    </section>
  );
}
