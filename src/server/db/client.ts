import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDrizzle> | undefined;

function createDrizzle() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const queryClient = postgres(url, {
    max: 1,
    prepare: false,
    // Set SQL_DEBUG=1 to print every statement — the way to count a page's
    // round trips without guessing at them.
    debug: process.env.SQL_DEBUG
      ? (_connection, query) => console.log("[SQL]", query.replace(/\s+/g, " "))
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
