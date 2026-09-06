import postgres, { type Sql } from "postgres";

import { getServerEnv } from "~/server/env";
import { getRequestEvent } from "solid-js/web";

let _cachedDb: Sql | undefined;
let _cachedUrl: string | undefined;

function getDatabaseUrl(): string {
  if (_cachedUrl) return _cachedUrl;

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
  if (hyperdriveString && hyperdriveString.startsWith("postgres")) {
    _cachedUrl = hyperdriveString;
    return hyperdriveString;
  }

  const url = getServerEnv("DATABASE_URL");
  if (!url) {
    console.error("[DATABASE] ❌ Fatal: DATABASE_URL environment variable is missing!");
    throw new Error("DATABASE_URL is not set");
  }
  _cachedUrl = url;
  return url;
}

function createPostgresForUrl(url: string): Sql {
  const isDev = process.env.NODE_ENV !== "production";
  const isCloudflare = Boolean(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocketPair || process.env.CF_PAGES || process.env.WORKERS_ENV,
  );
  const isHyperdrive =
    url.includes("hyperdrive") ||
    url.includes("cloudflare") ||
    Boolean(getServerEnv("HYPERDRIVE", "SUPABASE_SG"));

  // Crucial: Hyperdrive terminates SSL at the edge proxy, so worker -> Hyperdrive MUST be plaintext (ssl: false).
  // If ssl is not false, postgres.js sends an SSLRequest (0x04D2162F) packet which workerd's Cap'n Proto RPC layer
  // misinterprets as a massive message length header (e.g. 62949523777 words), causing traversalLimitInWords crash.
  const ssl =
    isHyperdrive || url.includes("127.0.0.1")
      ? false
      : url.includes("sslmode=require")
        ? "require"
        : false;

  return postgres(url, {
    max: isCloudflare ? 1 : 10,
    prepare: false, // Hyperdrive does not support server-side prepared statements
    ssl,
    connect_timeout: 10,
    idle_timeout: isCloudflare ? 0 : 20,
    max_lifetime: isCloudflare ? 0 : 3600,
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
}

export function getDb(): Sql {
  const isCloudflare = Boolean(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocketPair || process.env.CF_PAGES || process.env.WORKERS_ENV,
  );

  if (isCloudflare) {
    const event = getRequestEvent();
    if (event) {
      if (!event.locals._db) {
        const url = getDatabaseUrl();
        event.locals._db = createPostgresForUrl(url);
      }
      return event.locals._db as Sql;
    }
  }

  if (!_cachedDb) {
    const url = getDatabaseUrl();
    _cachedDb = createPostgresForUrl(url);
  }
  return _cachedDb;
}

export type Db = Sql;
export { type Sql } from "postgres";
export * from "./schema";
