import { deleteCookie, getCookie, setCookie, useSession } from "@solidjs/start/http";
import { getServerEnv } from "~/server/env";
import { requestMemo } from "~/server/cache";

const SESSION_NAME = "og_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export interface AuthCookieData {
  sid?: string;
  deviceId?: string;
}

let _cachedKeyPromise: Promise<CryptoKey> | null = null;

function getSecret(): string {
  const secret = getServerEnv("SESSION_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

function getCryptoKey(): Promise<CryptoKey> {
  if (!_cachedKeyPromise) {
    const rawKey = new TextEncoder().encode(getSecret().slice(0, 32));
    _cachedKeyPromise = crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }
  return _cachedKeyPromise;
}

async function fastSeal(data: AuthCookieData): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64url");
}

async function fastUnseal(raw: string): Promise<AuthCookieData | null> {
  try {
    const key = await getCryptoKey();
    const combined = Buffer.from(raw, "base64url");
    if (combined.length <= 12) return null;
    const iv = combined.subarray(0, 12);
    const ciphertext = combined.subarray(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const json = new TextDecoder().decode(decrypted);
    const data = JSON.parse(json) as AuthCookieData;
    return data?.sid ? data : null;
  } catch {
    return null;
  }
}

async function legacyUnseal(): Promise<AuthCookieData | null> {
  try {
    const session = await useSession<AuthCookieData>({
      name: SESSION_NAME,
      password: getSecret(),
      maxAge: MAX_AGE_S,
    });
    return session.data.sid ? session.data : null;
  } catch {
    return null;
  }
}

export async function readAuthCookie(): Promise<AuthCookieData | null> {
  return requestMemo("auth:cookie", async () => {
    try {
      const rawCookie = getCookie(SESSION_NAME);
      if (!rawCookie) return null;

      // 1. Fast AES-GCM (0.2ms)
      const data = await fastUnseal(rawCookie);
      if (data) return data;

      // 2. Legacy fallback for old session cookies
      return await legacyUnseal();
    } catch {
      return null;
    }
  });
}

export async function writeAuthCookie(data: AuthCookieData): Promise<void> {
  const sealed = await fastSeal(data);
  setCookie(SESSION_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearAuthCookie(): Promise<void> {
  deleteCookie(SESSION_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
