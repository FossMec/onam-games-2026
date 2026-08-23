import { describe, expect, it } from "vite-plus/test";
import { resolveSchedule } from "./service";
import type { Game } from "~/server/db/schema";

/**
 * The status machine, exercised without a database.
 *
 * `resolveSchedule` only touches the DB to read the schedule settings, and it
 * takes them as an argument - so passing them here keeps these tests pure and
 * lets each case pin an exact release instant instead of depending on when the
 * suite runs.
 */

const HOUR = 60 * 60 * 1000;

type GameRow = Game;

/** A published game whose release is `hoursFromNow` away (negative = past). */
function gameAt(hoursFromNow: number, overrides: Partial<GameRow> = {}): GameRow {
  return {
    releaseAt: new Date(Date.now() + hoursFromNow * HOUR),
    endAt: null,
    previewAt: null,
    testerEarlyHours: 24,
    day: 3,
    ...overrides,
  } as GameRow;
}

const settings = {
  eventStartDate: "2026-08-10",
  releaseTime: "19:00",
  durationHours: 24,
  previewHours: 24,
};

const statusOf = async (game: GameRow, role: "player" | "tester" = "player") =>
  (await resolveSchedule(game, role, settings)).status;

describe("resolveSchedule", () => {
  it("hides a game that is further out than the preview window", async () => {
    expect(await statusOf(gameAt(30))).toBe("upcoming");
  });

  it("reveals a game once it is inside the preview window", async () => {
    expect(await statusOf(gameAt(6))).toBe("preview");
    expect(await statusOf(gameAt(23.9))).toBe("preview");
  });

  it("opens it at the release instant and closes it after the duration", async () => {
    expect(await statusOf(gameAt(-1))).toBe("live");
    expect(await statusOf(gameAt(-25))).toBe("closed");
  });

  it("keeps tester early access ahead of the preview", async () => {
    // Inside both windows, a tester must still get the playable status - a
    // preview would take away access they already had.
    expect(await statusOf(gameAt(6), "tester")).toBe("tester");
    expect(await statusOf(gameAt(6), "player")).toBe("preview");
  });

  it("lets a per-game previewAt override the global window", async () => {
    const early = gameAt(30, { previewAt: new Date(Date.now() - HOUR) });
    expect(await statusOf(early)).toBe("preview");

    const late = gameAt(6, { previewAt: new Date(Date.now() + 2 * HOUR) });
    expect(await statusOf(late)).toBe("upcoming");
  });

  it("switches the reveal off entirely at zero hours", async () => {
    const noPreview = { ...settings, previewHours: 0 };
    const status = (await resolveSchedule(gameAt(6), "player", noPreview)).status;
    expect(status).toBe("upcoming");
  });

  it("reports the preview instant so the UI can count down to it", async () => {
    const schedule = await resolveSchedule(gameAt(30), "player", settings);
    expect(schedule.previewAt).not.toBeNull();
    expect(schedule.previewAt!.getTime()).toBe(schedule.releaseAt!.getTime() - 24 * HOUR);
  });

  it("stays upcoming when there is no release date at all", async () => {
    const undated = gameAt(0, { releaseAt: null });
    const schedule = await resolveSchedule(undated, "player", {
      ...settings,
      eventStartDate: "",
    });
    expect(schedule.status).toBe("upcoming");
    expect(schedule.previewAt).toBeNull();
  });
});
