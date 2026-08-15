import { describe, expect, it } from "vite-plus/test";
import { readOrDegrade } from "./degrade";
import { HttpError } from "./errors";

describe("readOrDegrade", () => {
  it("returns the value when the read answers", async () => {
    expect(await readOrDegrade("t", "fallback", async () => "real")).toBe("real");
  });

  it("serves the fallback when the read throws", async () => {
    const result = await readOrDegrade("t", "fallback", async () => {
      throw new Error("database is on fire");
    });
    expect(result).toBe("fallback");
  });

  it("serves the fallback when the read never answers", async () => {
    /*
     * The failure that actually took the site down. `postgres` has no query
     * timeout, so a statement written to a socket that died while the instance
     * was frozen never settles — and a fallback that only triggers on rejection
     * never fires. The render hangs, the stream stays open, and the platform
     * bills five minutes before killing it.
     */
    const started = Date.now();
    const result = await readOrDegrade("t", "fallback", () => new Promise(() => {}), 50);
    expect(result).toBe("fallback");
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not wait for a slow read past its deadline", async () => {
    const result = await readOrDegrade(
      "t",
      "fallback",
      () => new Promise((resolve) => setTimeout(() => resolve("too late"), 5_000)),
      50,
    );
    expect(result).toBe("fallback");
  });

  it("rethrows deliberate refusals instead of hiding them", async () => {
    // A 403 is an answer, not an outage. Swallowing it would silently show a
    // signed-out page to somebody who was actually forbidden.
    await expect(
      readOrDegrade("t", "fallback", async () => {
        throw new HttpError(403, "Forbidden");
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
