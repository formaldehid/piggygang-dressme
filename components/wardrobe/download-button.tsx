import { type RefObject, useState } from "react";

/** Exported PNG edge length, in pixels. */
const EXPORT_SIZE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the preview"));
    image.src = src;
  });
}

/**
 * Rasterises the live preview SVG to a PNG. The trait art is plain shapes with
 * literal colours and no external references, so the canvas never gets tainted
 * and `toDataURL` stays available.
 */
export function DownloadButton({
  svgRef,
  filename,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    const svg = svgRef.current;
    if (!svg || busy) return;

    setBusy(true);
    setFailed(false);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(EXPORT_SIZE));
    clone.setAttribute("height", String(EXPORT_SIZE));

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    try {
      const image = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(image, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename;
      link.click();
    } catch {
      setFailed(true);
    } finally {
      URL.revokeObjectURL(url);
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
        {busy ? "Preparing…" : "Download PNG"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-center text-xs text-brand">
          Download failed — please try again.
        </p>
      )}
    </div>
  );
}
