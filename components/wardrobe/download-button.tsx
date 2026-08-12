import { useState } from "react";
import type { Equipped, ReadyCollection } from "@/lib/collections";
import { downloadBlob, renderLook } from "@/lib/render-look";

export function DownloadButton({
  collection,
  equipped,
  lookCode,
}: {
  collection: ReadyCollection;
  equipped: Equipped;
  lookCode: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const blob = await renderLook(collection, equipped);
      downloadBlob(blob, `${collection.slug}-${lookCode}.png`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="w-full rounded-full bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-canvas transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        {busy ? "Rendering…" : "Download PNG"}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-ink-muted">
        {failed ? (
          <span role="alert" className="text-brand">
            Render failed — please try again.
          </span>
        ) : (
          `${collection.canvas} × ${collection.canvas}, same layers as the original art`
        )}
      </p>
    </div>
  );
}
