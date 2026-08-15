/**
 * Downscales and center-crops a user-selected image file into a square WebP data URL.
 *
 * @param file The uploaded image File
 * @param targetSize The width/height in pixels for the square avatar (default: 160px)
 * @param maxBytes The target maximum byte size (default: 80KB)
 * @returns Promise<string> Base64 WebP data URL
 */
export async function fileToWebpDataUrl(
  file: File,
  targetSize = 160,
  maxBytes = 80_000,
): Promise<string> {
  let imgWidth = 0;
  let imgHeight = 0;
  let drawSource: CanvasImageSource;
  let closeSource: (() => void) | null = null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      imgWidth = bitmap.width;
      imgHeight = bitmap.height;
      drawSource = bitmap;
      closeSource = () => bitmap.close();
    } catch {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
      });
      imgWidth = img.naturalWidth || img.width;
      imgHeight = img.naturalHeight || img.height;
      drawSource = img;
      closeSource = () => URL.revokeObjectURL(url);
    }
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    imgWidth = img.naturalWidth || img.width;
    imgHeight = img.naturalHeight || img.height;
    drawSource = img;
    closeSource = () => URL.revokeObjectURL(url);
  }

  try {
    // Determine square center-crop coordinates
    const minDim = Math.min(imgWidth, imgHeight);
    const sx = Math.max(0, (imgWidth - minDim) / 2);
    const sy = Math.max(0, (imgHeight - minDim) / 2);

    const outDim = Math.max(32, Math.min(targetSize, minDim));

    const canvas = document.createElement("canvas");
    canvas.width = outDim;
    canvas.height = outDim;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(drawSource, sx, sy, minDim, minDim, 0, 0, outDim, outDim);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/webp", quality);

    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    while (dataUrl.length > maxBytes && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/webp", quality);
    }

    return dataUrl;
  } finally {
    closeSource?.();
  }
}
