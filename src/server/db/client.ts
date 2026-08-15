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
    /*
     * Every one of these is a deadline, and the deadlines are the point.
     *
     * Without them `postgres` waits forever: a connection that is dropped
     * silently — a blackholed route, a firewall that discards instead of
     * refusing, a pooler that closed the socket while the function was frozen
     * between invocations — never rejects, so nothing downstream can fall back
     * or even log. The whole degrade-instead-of-crash layer is built on failed
     * reads *throwing*, and a query that hangs throws nothing. This is what
     * turned an unreachable database into a page that streamed its header and
     * then held the connection open until the platform killed it at 300s: a
     * spinner that never resolves, which is strictly worse than an error.
     *
     * Ten seconds is far past a healthy in-region query (the whole page needs
     * about one) and far short of a visitor giving up.
     */
    connect_timeout: 10,
    /*
     * Serverless hygiene. Instances are frozen between requests and the pooler
     * hands out short-lived connections, so a socket held across a freeze is
     * usually already dead by the time the next request tries to use it.
     * Closing them while idle means the next request opens a fresh one instead
     * of discovering the corpse.
     */
    idle_timeout: 20,
    max_lifetime: 60 * 15,
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
