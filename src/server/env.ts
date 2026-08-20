import { getRequestEvent } from "solid-js/web";

/**
 * Universal environment variable and Cloudflare binding reader.
 * Works seamlessly across:
 * 1. Cloudflare Workers / Pages runtime (via requestEvent nativeEvent / runtime env or global context)
 * 2. Node.js processes / CLI scripts (via process.env)
 * 3. Vite dev server / preview server
 */
export function getServerEnv(key: string, ...fallbackKeys: string[]): string | undefined {
  const keys = [key, ...fallbackKeys];

  // 1. Try Cloudflare request event context (SolidStart request lifecycle)
  try {
    const event = getRequestEvent();
    if (event) {
      const nativeEvent = event.nativeEvent as unknown as Record<string, unknown> | undefined;
      const nativeContext = nativeEvent?.context as Record<string, unknown> | undefined;
      const cfContext = nativeContext?.cloudflare as { env?: Record<string, unknown> } | undefined;
      const requestRuntime = (
        event.request as unknown as {
          runtime?: { cloudflare?: { env?: Record<string, unknown> } };
        }
      )?.runtime;

      const envObj = cfContext?.env ?? requestRuntime?.cloudflare?.env;
      if (envObj) {
        for (const k of keys) {
          const val = envObj[k];
          if (typeof val === "string" && val.length > 0) return val;
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 2. Try globalThis Cloudflare / Nitro injected globals
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const globalEnvs = [g.__env__, g.__cloudflare_env__, g.cloudflare?.env, g.env];
    for (const envObj of globalEnvs) {
      if (envObj && typeof envObj === "object") {
        for (const k of keys) {
          const val = envObj[k];
          if (typeof val === "string" && val.length > 0) return val;
        }
      }
    }
    for (const k of keys) {
      const val = g[k];
      if (typeof val === "string" && val.length > 0) return val;
    }
  } catch {
    /* ignore */
  }

  // 3. Fallback to process.env (Node.js / Nodejs compat polyfill)
  try {
    if (typeof process !== "undefined" && process.env) {
      for (const k of keys) {
        const val = process.env[k];
        if (typeof val === "string" && val.length > 0) return val;
      }
    }
  } catch {
    /* ignore */
  }

  return undefined;
}
