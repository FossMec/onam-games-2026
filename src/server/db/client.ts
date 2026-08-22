import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

import { getServerEnv } from "~/server/env";
import { getRequestEvent } from "solid-js/web";

let _cachedDb: Db | undefined;
let _cachedUrl: string | undefined;

function getDatabaseUrl(): string {
  // Prefer Hyperdrive binding (Cloudflare Pages/Workers idiomatic)
  // Supports both HYPERDRIVE (docs) and SUPABASE_SG (current binding) + fallbacks
  try {
    const event = getRequestEvent();
    const nativeEvent = event?.nativeEvent as unknown as Record<string, unknown> | undefined;
    const nativeContext = nativeEvent?.context as Record<string, unknown> | undefined;
    const cfContext = nativeContext?.cloudflare as { env?: Record<string, unknown> } | undefined;
    const requestRuntime = (
      event?.request as unknown as {
        runtime?: { cloudflare?: { env?: Record<string, unknown> } };
      }
    )?.runtime;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const envCandidates = [
      cfContext?.env,
      requestRuntime?.cloudflare?.env,
      g.__env__,
      g.__cloudflare_env__,
      g.env,
      g,
    ];

    const candidates = ["HYPERDRIVE", "SUPABASE_SG", "SUPABASE", "DB"] as const;
    for (const envObj of envCandidates) {
      if (envObj && typeof envObj === "object") {
        for (const key of candidates) {
          const binding = envObj[key] as { connectionString?: string } | string | undefined;
          if (typeof binding === "string" && binding.startsWith("postgres")) {
            return binding;
          }
          if (
            binding &&
            typeof binding === "object" &&
            (binding as { connectionString?: string }).connectionString
          ) {
            return (binding as { connectionString: string }).connectionString;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Also check process.env / getServerEnv injected by Cloudflare (Hyperdrive connectionString passthrough as string)
  const hyperdriveString = getServerEnv(
    "HYPERDRIVE",
    "SUPABASE_SG",
    "HYPERDRIVE_CONNECTION_STRING",
    "SUPABASE_SG_CONNECTION_STRING",
  );
  if (hyperdriveString && hyperdriveString.startsWith("postgres")) return hyperdriveString;

  const url = getServerEnv("DATABASE_URL");
  if (!url) {
    console.error("[DATABASE] ❌ Fatal: DATABASE_URL environment variable is missing!");
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function createDrizzleForUrl(url: string) {
  const isDev = process.env.NODE_ENV !== "production";

  const queryClient = postgres(url, {
    max: 1, // Edge isolates / Hyperdrive require 1 connection per request
    prepare: false, // Hyperdrive does not support server-side prepared statements
    fetch_types: false, // Disable background type discovery query that hangs on Cloudflare Isolates
    connect_timeout: 5,
    idle_timeout: 0, // Disable background timers on edge isolates
    max_lifetime: 0,
    onnotice: (notice) => {
      if (isDev) console.log("[DB NOTICE]", notice.message);
    },
    debug: process.env.SQL_DEBUG
      ? (_connection, query, params) => {
          const cleanQuery = query.replace(/\s+/g, " ").trim();
          console.log(
            `[SQL ${Date.now() % 10000}ms]`,
            cleanQuery.slice(0, 120),
            params?.length ? `(params: ${params.length})` : "",
          );
        }
      : undefined,
  });

  return drizzle(queryClient, { schema });
}

export function getDb(): Db {
  const url = getDatabaseUrl();
  if (_cachedDb && _cachedUrl === url) {
    return _cachedDb;
  }

  _cachedDb = createDrizzleForUrl(url);
  _cachedUrl = url;
  return _cachedDb;
}

export type Db = ReturnType<typeof createDrizzleForUrl>;
export * from "./schema";
