import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDrizzle> | undefined;

function getDatabaseUrl(): string {
  // Prefer Hyperdrive binding (Cloudflare Workers idiomatic)
  // Supports both HYPERDRIVE (docs) and SUPABASE_SG (your current binding) + fallbacks
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfEnv =
      (globalThis as any).__cloudflare_env ?? (globalThis as any).env ?? (globalThis as any);
    const candidates = ["HYPERDRIVE", "SUPABASE_SG", "SUPABASE", "DB"] as const;
    for (const key of candidates) {
      const binding = (cfEnv as Record<string, unknown>)?.[key] as
        | { connectionString?: string }
        | string
        | undefined;
      if (typeof binding === "string" && binding.startsWith("postgres")) return binding;
      if (
        binding &&
        typeof binding === "object" &&
        (binding as { connectionString?: string }).connectionString
      ) {
        return (binding as { connectionString: string }).connectionString;
      }
    }
  } catch {
    /* ignore */
  }
  // Also check process.env injected by Cloudflare (Hyperdrive connectionString passthrough as string)
  const envProcess = process.env as Record<string, string | undefined>;
  const hyperdriveString =
    envProcess.HYPERDRIVE ??
    envProcess.SUPABASE_SG ??
    envProcess.HYPERDRIVE_CONNECTION_STRING ??
    envProcess.SUPABASE_SG_CONNECTION_STRING;
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
