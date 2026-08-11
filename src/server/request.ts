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
    headers?.get("x-vercel-proxied-for")?.split(",")[0]?.trim() ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip") ??
    "";
  const country = headers?.get("x-vercel-ip-country") ?? null;
  const city = headers?.get("x-vercel-ip-city") ?? null;
  return { ip, country, city, userAgent };
}
