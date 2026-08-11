export async function fileToWebpDataUrl(
  file: File,
  maxSize = 256,
  maxBytes = 150_000,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.7;
  let dataUrl = canvas.toDataURL("image/webp", quality);
  while (dataUrl.length > maxBytes && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/webp", quality);
  }
  return dataUrl;
}
