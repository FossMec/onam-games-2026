import { describe, expect, it } from "vite-plus/test";
import { MIN_IMAGE_SIDE, decodeSubmissionImage, isNearlySquare, readImageSize } from "./image";

/**
 * Header fixtures rather than real image files.
 *
 * `readImageSize` only ever reads the first thirty-odd bytes, so a hand-built
 * header exercises exactly the code under test and keeps binary blobs out of
 * the repo. Each builder mirrors the layout documented in `image.ts`.
 */

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(0x89504e47, 0);
  bytes.writeUInt32BE(0x0d0a1a0a, 4);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function webpLossy(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8 ", 12, "ascii");
  bytes[23] = 0x9d;
  bytes[24] = 0x01;
  bytes[25] = 0x2a;
  bytes.writeUInt16LE(width, 26);
  bytes.writeUInt16LE(height, 28);
  return bytes;
}

function webpLossless(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(25);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8L", 12, "ascii");
  bytes[20] = 0x2f;
  // 14 bits of (width-1), then 14 bits of (height-1).
  bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return bytes;
}

function webpExtended(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function jpeg(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(20);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  // A JFIF APP0 segment first, so the marker walk has something to skip.
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes.writeUInt16BE(4, 4); // segment length, payload only
  bytes[8] = 0xff;
  bytes[9] = 0xc0; // SOF0
  bytes.writeUInt16BE(11, 10);
  bytes[12] = 8; // sample precision
  bytes.writeUInt16BE(height, 13);
  bytes.writeUInt16BE(width, 15);
  return bytes;
}

describe("readImageSize", () => {
  it("reads PNG", () => {
    expect(readImageSize(png(1024, 1024))).toEqual({ width: 1024, height: 1024 });
  });

  it("reads lossy WebP — what the browser canvas actually produces", () => {
    expect(readImageSize(webpLossy(1024, 1024))).toEqual({ width: 1024, height: 1024 });
  });

  it("reads lossless WebP", () => {
    expect(readImageSize(webpLossless(900, 640))).toEqual({ width: 900, height: 640 });
  });

  it("reads extended WebP", () => {
    expect(readImageSize(webpExtended(4000, 3000))).toEqual({ width: 4000, height: 3000 });
  });

  it("reads JPEG past a leading APP0 segment", () => {
    expect(readImageSize(jpeg(1600, 900))).toEqual({ width: 1600, height: 900 });
  });

  it("returns null rather than guessing at anything else", () => {
    expect(readImageSize(Buffer.from("not an image at all, truly"))).toBeNull();
    expect(readImageSize(Buffer.alloc(0))).toBeNull();
    // RIFF, but a WAV rather than a WebP.
    const wav = Buffer.alloc(32);
    wav.write("RIFF", 0, "ascii");
    wav.write("WAVE", 8, "ascii");
    expect(readImageSize(wav)).toBeNull();
  });
});

describe("isNearlySquare", () => {
  it("accepts an exact square", () => {
    expect(isNearlySquare(1024, 1024, 5)).toBe(true);
  });

  it("accepts a couple of stray pixels", () => {
    expect(isNearlySquare(1024, 1020, 5)).toBe(true);
  });

  it("rejects a screenshot", () => {
    expect(isNearlySquare(1920, 1080, 5)).toBe(false);
  });

  it("is not fooled by which side is longer", () => {
    expect(isNearlySquare(1080, 1920, 5)).toBe(false);
  });

  it("rejects degenerate dimensions", () => {
    expect(isNearlySquare(0, 0, 5)).toBe(false);
  });
});

describe("decodeSubmissionImage", () => {
  const asDataUrl = (bytes: Buffer, mime = "png") =>
    `data:image/${mime};base64,${bytes.toString("base64")}`;

  it("accepts a square render", () => {
    const decoded = decodeSubmissionImage(asDataUrl(png(1024, 1024)), 5);
    expect(decoded.width).toBe(1024);
    expect(decoded.ext).toBe("png");
  });

  it("names the actual dimensions when it refuses a non-square", () => {
    expect(() => decodeSubmissionImage(asDataUrl(png(1920, 1080)), 5)).toThrow(/1920×1080/);
  });

  it("refuses an image too small to judge", () => {
    const tiny = MIN_IMAGE_SIDE - 1;
    expect(() => decodeSubmissionImage(asDataUrl(png(tiny, tiny)), 5)).toThrow(/too small/);
  });

  it("refuses anything that is not one of the three formats", () => {
    expect(() => decodeSubmissionImage("data:image/gif;base64,AAAA", 5)).toThrow();
    expect(() => decodeSubmissionImage("https://example.com/x.png", 5)).toThrow();
    // The stored-XSS shape the old URL field had to guard against.
    expect(() => decodeSubmissionImage("javascript:alert(1)", 5)).toThrow();
  });

  it("refuses bytes it cannot identify", () => {
    expect(() => decodeSubmissionImage(asDataUrl(Buffer.alloc(40)), 5)).toThrow(/could not read/i);
  });
});
