import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDrizzle> | undefined;

function createDrizzle() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[DATABASE] ❌ Fatal: DATABASE_URL environment variable is missing!");
    throw new Error("DATABASE_URL is not set");
  }

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
