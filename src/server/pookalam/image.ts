/**
 * Pookalam artwork: decode, verify, store.
 *
 * WHY WE HOST THE IMAGE INSTEAD OF LINKING IT
 *
 * The contest used to take a URL. That is free until the day it isn't: a link
 * can rot between review and voting, it can be swapped for something else after
 * approval, and it leaks — an imgur album title or a raw.githubusercontent path
 * names the author, which destroys the anonymity the whole Elo round depends
 * on. Uploading once, to our own bucket, under a random filename, fixes all
 * three at the cost of a storage bucket we already run for avatars.
 *
 * WHERE THE BYTES GO
 *
 * Supabase Storage, not Postgres. A hundred 400KB entries is 40MB of bytea that
 * would ride along in every backup, every `select *` mistake and every pooled
 * connection; object storage is what this is for, the project already has a
 * service-role client, and it costs no new credentials or third-party account.
 *
 * WHAT IS CHECKED HERE
 *
 * Squareness is checked in the browser first, which is what makes the error
 * useful — the entrant finds out before a slow upload. It is checked *again*
 * here because the browser check is advice, not enforcement: a server action is
 * an HTTP endpoint and anyone can post to it directly.
 */

import { getSupabaseAdmin } from "~/server/supabase/client";

/** Bucket holding contest artwork. Public-read, service-role write. */
export const POOKALAM_BUCKET = "pookalams";

/** Hard ceiling on a stored entry. The client aims well under this. */
export const MAX_IMAGE_BYTES = 1_200_000;

/** Below this an image is too small to judge on a laptop screen. */
export const MIN_IMAGE_SIDE = 320;

export interface DecodedImage {
  bytes: Buffer;
  mime: "image/webp" | "image/png" | "image/jpeg";
  ext: "webp" | "png" | "jpg";
  width: number;
  height: number;
}

const DATA_URL = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Width and height straight out of the file header.
 *
 * Three small format readers rather than an image library: the only question
 * being asked is "is this square", the answer lives in the first thirty bytes
 * of all three formats, and a decoder in the request path would be a much
 * larger attack surface than the thing it is guarding.
 */
export function readImageSize(bytes: Buffer): { width: number; height: number } | null {
  // PNG — IHDR is fixed-position, so this is two reads.
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  // WebP — RIFF container, then one of three VP8 chunk flavours.
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF") {
    if (bytes.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8 " && bytes.length >= 30) {
      // Lossy: 14-bit dimensions after the 3-byte sync code.
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes.length >= 25) {
      // Lossless: 14 bits each, packed little-endian, stored as size-1.
      const packed = bytes.readUInt32LE(21);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === "VP8X" && bytes.length >= 30) {
      // Extended: 24-bit canvas size, also stored as size-1.
      const width = bytes.readUIntLE(24, 3) + 1;
      const height = bytes.readUIntLE(27, 3) + 1;
      return { width, height };
    }
    return null;
  }

  // JPEG — walk the marker chain to the start-of-frame.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0-SOF15, skipping the four that are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc, 0xd8].includes(marker)) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }

  return null;
}

/** True when the sides are within `tolerancePct` of each other. */
export function isNearlySquare(width: number, height: number, tolerancePct: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return Math.abs(ratio - 1) * 100 <= Math.max(0, tolerancePct);
}

/**
 * Turns the browser's data URL into verified bytes.
 *
 * Every failure here is phrased for the entrant, because every one of them is
 * something they can act on.
 */
export function decodeSubmissionImage(dataUrl: string, tolerancePct: number): DecodedImage {
  const match = DATA_URL.exec(dataUrl.trim());
  if (!match) {
    throw new Error("That file did not come through as an image. Try a PNG, JPEG or WebP.");
  }
  const mime = `image/${match[1]}` as DecodedImage["mime"];
  const ext = match[1] === "jpeg" ? "jpg" : (match[1] as "webp" | "png");
  const bytes = Buffer.from(match[2], "base64");

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("That image is too large. Keep it under about 1 MB.");
  }
  const size = readImageSize(bytes);
  if (!size) {
    throw new Error("We could not read that image. Re-export it as a PNG or WebP and try again.");
  }
  if (size.width < MIN_IMAGE_SIDE || size.height < MIN_IMAGE_SIDE) {
    throw new Error(
      `That image is too small — it needs to be at least ${MIN_IMAGE_SIDE}px square.`,
    );
  }
  if (!isNearlySquare(size.width, size.height, tolerancePct)) {
    throw new Error(
      `Pookalams have to be square. Yours is ${size.width}×${size.height} — crop it to 1:1 and re-upload.`,
    );
  }
  return { bytes, mime, ext, width: size.width, height: size.height };
}

export interface StoredImage {
  url: string;
  path: string;
  width: number;
  height: number;
}

/**
 * Writes the artwork to the bucket under an unguessable name.
 *
 * The path carries a random UUID rather than the user id: storage URLs are
 * handed to every voter during an anonymous round, and `…/pookalams/<user-id>/`
 * would let anyone with the users table match a picture to a person.
 */
export async function storeSubmissionImage(image: DecodedImage): Promise<StoredImage> {
  const storage = getSupabaseAdmin().storage;
  const path = `entries/${crypto.randomUUID()}.${image.ext}`;
  const { error } = await storage.from(POOKALAM_BUCKET).upload(path, image.bytes, {
    contentType: image.mime,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error("Could not save that image. Try again in a moment.");

  const { data } = storage.from(POOKALAM_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, width: image.width, height: image.height };
}

/**
 * Best-effort cleanup when an entry's artwork is replaced.
 *
 * Never allowed to fail the request: the new image is already stored and the
 * row already points at it, so a leaked object is a housekeeping problem, while
 * a thrown error here would look to the entrant like their edit did not save.
 */
export async function deleteStoredImage(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await getSupabaseAdmin().storage.from(POOKALAM_BUCKET).remove([path]);
  } catch {
    // orphaned object; harmless
  }
}
