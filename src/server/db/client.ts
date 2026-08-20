import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDrizzle> | undefined;

function getDatabaseUrl(): string {
  // Prefer Hyperdrive binding (Cloudflare Pages/Workers idiomatic)
  // Variable name must match wrangler.toml / Dashboard Hyperdrive binding: HYPERDRIVE
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfEnv = (globalThis as any).__cloudflare_env ?? (globalThis as any).env;
    const hyperdrive = (cfEnv as Record<string, unknown>)?.HYPERDRIVE as
      | { connectionString?: string }
      | undefined;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    /* ignore */
  }
  // Also check process.env injected by Cloudflare (Hyperdrive connectionString passthrough)
  const hyperdriveString =
    process.env.HYPERDRIVE ?? (process.env as Record<string, string>).HYPERDRIVE_CONNECTION_STRING;
  if (hyperdriveString && hyperdriveString.startsWith("postgres")) return hyperdriveString;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[DATABASE] ❌ Fatal: DATABASE_URL environment variable is missing!");
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function createDrizzle() {
  const url = getDatabaseUrl();

  const isDev = process.env.NODE_ENV !== "production";
  const poolSize = isDev ? 10 : 5;

  const queryClient = postgres(url, {
    max: poolSize,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 15,
    onnotice: (notice) => {
      if (isDev) console.log("[DB NOTICE]", notice.message);
    },
    debug:
      process.env.SQL_DEBUG || isDev
        ? (_connection, query, params) => {
            const cleanQuery = query.replace(/\s+/g, " ").trim();
            if (
              cleanQuery.startsWith("SELECT") ||
              cleanQuery.startsWith("INSERT") ||
              cleanQuery.startsWith("UPDATE")
            ) {
              console.log(
                `[SQL ${Date.now() % 10000}ms]`,
                cleanQuery.slice(0, 120),
                params?.length ? `(params: ${params.length})` : "",
              );
            }
          }
        : undefined,
  });

  return drizzle(queryClient, { schema });
}

export function getDb() {
  if (!_db) _db = createDrizzle();
  return _db;
}

export type Db = ReturnType<typeof createDrizzle>;
export * from "./schema";
