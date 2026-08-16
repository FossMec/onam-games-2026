import { getRequestEvent } from "solid-js/web";

export interface RequestMeta {
  ip: string;
  country: string | null;
  city: string | null;
  userAgent: string;
}

export function getRequestMeta(): RequestMeta {
  const event = getRequestEvent();
  const headers = event?.request.headers;
  const userAgent = headers?.get("user-agent") ?? "";
  const ip =
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip") ??
    headers?.get("x-vercel-proxied-for")?.split(",")[0]?.trim() ??
    "";
  const country =
    headers?.get("cf-ipcountry") ??
    headers?.get("x-country") ??
    headers?.get("x-vercel-ip-country") ??
    null;
  const city =
    headers?.get("cf-ipcity") ?? headers?.get("x-city") ?? headers?.get("x-vercel-ip-city") ?? null;
  return { ip, country, city, userAgent };
}
