import { layerSources, type Equipped, type ReadyCollection } from "./collections";

/** Native size of the source art — the export matches the official renders. */
export const EXPORT_SIZE = 1080;

function loadDecoded(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  // decode() resolves only once the bitmap is actually drawable; onload can
  // fire earlier. Older Safari rejects decode() for detached images, so keep
  // the listener path as a fallback.
  return image.decode().then(
    () => image,
    () =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`could not load ${src}`));
      }),
  );
}

/**
 * Composites the equipped look to a PNG the same way the collection was
 * rendered: every layer drawn at native size, in stack order.
 *
 * The layers are same-origin, so the canvas is never tainted. Deliberately no
 * `crossOrigin` — setting it would create a second HTTP cache entry and
 * re-download every layer the preview already has.
 */
export async function renderLook(
  collection: ReadyCollection,
  equipped: Equipped,
): Promise<Blob> {
  const layers = layerSources(collection, equipped, "full");
  if (layers.length === 0) throw new Error("nothing to render");

  // Fetch in parallel, draw in order: Promise.all preserves array order, so
  // z-order comes from the stack rather than from who downloaded first.
  const images = await Promise.all(layers.map((layer) => loadDecoded(layer.src)));

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas is unavailable");

  for (const image of images) context.drawImage(image, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not encode the PNG"))),
      "image/png",
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking synchronously cancels the save in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
