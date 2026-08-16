/**
 * Client-side preparation of a pookalam entry image.
 *
 * Two jobs, both of which have to happen before the bytes leave the browser.
 *
 * The squareness check is here because this is where it can still be *useful*.
 * Telling somebody their 16:9 screenshot is the wrong shape after a slow upload
 * on college wifi is a worse product than telling them the instant they pick
 * the file. The server checks it again and is the actual authority - this is
 * the fast, kind copy of the same rule.
 *
 * The downscale is here because a phone camera JPEG is four megabytes and the
 * contest displays the image at about 600px. Re-encoding to WebP at a sane size
 * turns a slow upload into an instant one and keeps the bucket small, and the
 * canvas re-encode has a useful side effect: it drops every EXIF field, so a
 * photo does not arrive carrying the author's device name and GPS coordinates
 * into a round that is supposed to be anonymous.
 */

/** Longest side we store. Comfortably above any display size we use. */
export const OUTPUT_SIZE = 1024;

/** Matches the server's `pookalam.aspect_tolerance_pct` default. */
export const DEFAULT_ASPECT_TOLERANCE_PCT = 5;

/** Server refuses anything under this. Checked here so the message is early. */
const MIN_SIDE = 320;

/** Aim below this; the server's hard limit is 1.2 MB. */
const TARGET_BYTES = 900_000;

export interface PreparedImage {
  /** WebP (or JPEG, on browsers without WebP encoding) data URL. */
  dataUrl: string;
  /** Dimensions of the *original* file, for the "yours is 1600×900" message. */
  sourceWidth: number;
  sourceHeight: number;
}

export class ImageRejected extends Error {}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safari has historically refused some formats here; fall through.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new ImageRejected("We could not open that file as an image."));
    img.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    release: () => URL.revokeObjectURL(url),
  };
}

/** How far from 1:1 the image is, as a percentage. 0 is perfectly square. */
export function aspectDeviationPct(width: number, height: number): number {
  if (width <= 0 || height <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(width / height - 1) * 100;
}

/**
 * Validates and re-encodes a chosen file into a square WebP data URL.
 *
 * Throws `ImageRejected` with a message meant for the entrant. Anything within
 * tolerance but not exactly square is centre-cropped to square - at a few
 * percent that removes a sliver of background nobody will miss, and it means
 * every entry renders identically in the voting grid.
 */
export async function preparePookalamImage(
  file: File,
  tolerancePct = DEFAULT_ASPECT_TOLERANCE_PCT,
): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImageRejected("That is not an image file. PNG, JPEG or WebP, please.");
  }

  const loaded = await loadImage(file);
  try {
    const { width, height } = loaded;
    if (width < MIN_SIDE || height < MIN_SIDE) {
      throw new ImageRejected(
        `That render is ${width}×${height}. It needs to be at least ${MIN_SIDE}px on each side.`,
      );
    }
    if (aspectDeviationPct(width, height) > tolerancePct) {
      throw new ImageRejected(
        `Pookalams have to be square (1:1). Yours is ${width}×${height} - re-render or crop it to a square and try again.`,
      );
    }

    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;
    const out = Math.min(OUTPUT_SIZE, side);

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageRejected("Your browser would not give us a canvas to resize with.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(loaded.source, sx, sy, side, side, 0, 0, out, out);

    let quality = 0.9;
    let dataUrl = canvas.toDataURL("image/webp", quality);
    // Older Safari silently hands back a PNG here, which is both huge and not
    // what the caller was promised - so fall back to JPEG explicitly.
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    const format = dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    while (dataUrl.length > TARGET_BYTES && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL(format, quality);
    }
    if (dataUrl.length > TARGET_BYTES) {
      throw new ImageRejected(
        "That image will not compress small enough. Try exporting it at a lower resolution.",
      );
    }

    return { dataUrl, sourceWidth: width, sourceHeight: height };
  } finally {
    loaded.release();
  }
}
