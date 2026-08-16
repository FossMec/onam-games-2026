import { describe, expect, it } from "vite-plus/test";
import {
  FPS,
  Level,
  MAX_FRAMES,
  MAX_INPUTS,
  PLATFORM_MOVING,
  PLATFORM_W,
  WORLD_W,
  type JumpInput,
  initialState,
  packInput,
  packInputs,
  platformX,
  simulate,
  step,
  unpackInputs,
} from "~/lib/jump-sim";
import { generate, verify } from "./jump";
import type { JumpView } from "./jump";

/** The one level everybody plays. Read from `generate` so it cannot drift. */
const SEED = (generate().view as JumpView).seed;

/**
 * The bot the anti-cheat has to survive, and the proof the game is winnable at
 * all: aim for the highest platform the current jump can still reach.
 *
 * Targeting "the next platform up" does not work - Maveli passes platforms on
 * the way up and only lands on the way down, so a bot chasing what is above him
 * is steering away from where he is about to be. Predicting the apex is the
 * whole trick, and it is also roughly what a human is doing by eye.
 */
function autoplay(seed: string, frames: number): number[] {
  const state = initialState(seed);
  const inputs: JumpInput[] = [];
  let dir = 0;

  while (state.alive && state.frame < frames) {
    // Apex of the current arc: whatever upward velocity is left, converted to
    // height. `1/15` is the simulation's gravity.
    const apex = state.py + (state.vy > 0 ? (state.vy * state.vy) / (2 * (1 / 15)) : 0);
    state.level.ensure(apex + 60);

    let target = null;
    for (const platform of state.level.platforms) {
      if (platform.y > apex) break;
      if (platform.y < state.py - 8) continue;
      if (platform.enemy?.type === 1) continue; // avoid spiked platforms
      target = platform;
    }
    if (!target) {
      for (const platform of state.level.platforms) {
        if (platform.y > apex) break;
        if (platform.y < state.cameraY) continue;
        if (platform.enemy?.type === 1) continue;
        target = platform;
      }
    }

    let wanted = 0;
    if (target) {
      const centre = platformX(target, state.frame) + 6;
      let dx = centre - state.px;
      // Aim through the wrap seam when that is the shorter way round.
      if (dx > WORLD_W / 2) dx -= WORLD_W;
      if (dx < -WORLD_W / 2) dx += WORLD_W;
      wanted = dx > 1.2 ? 1 : dx < -1.2 ? -1 : 0;
    }
    if (wanted !== dir) {
      dir = wanted;
      inputs.push({ f: state.frame, d: dir });
    }
    step(state, dir);
  }
  return packInputs(inputs);
}

describe("level generation", () => {
  it("is identical for a seed no matter how far it is generated", () => {
    const shallow = new Level(SEED);
    shallow.ensure(400);
    const deep = new Level(SEED);
    deep.ensure(4_000);
    // The server may replay further than the client ever rendered; platform
    // 40 has to be the same platform in both.
    expect(JSON.stringify(deep.platforms.slice(0, shallow.platforms.length))).toBe(
      JSON.stringify(shallow.platforms),
    );
  });

  it("gives different players different levels", () => {
    const levels = new Set(
      Array.from({ length: 6 }, (_, i) => {
        const level = new Level(`player-${i}`);
        level.ensure(800);
        return JSON.stringify(level.platforms);
      }),
    );
    expect(levels.size).toBe(6);
  });

  it("keeps every platform on the board and in ascending order", () => {
    const level = new Level(SEED);
    level.ensure(5_000);
    for (let i = 1; i < level.platforms.length; i += 1) {
      const platform = level.platforms[i];
      expect(platform.y).toBeGreaterThan(level.platforms[i - 1].y);
      expect(platform.x).toBeGreaterThanOrEqual(0);
      // Moving platforms must stay inside the world across their whole travel.
      for (const frame of [0, 37, 91, 150, 233]) {
        const x = platformX(platform, frame);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + PLATFORM_W).toBeLessThanOrEqual(WORLD_W);
      }
    }
  });

  it("never places an unreachable gap, however high the climb goes", () => {
    // A normal jump apexes at 30 units. A gap at or near that is a coin flip,
    // not a skill check, and the difficulty ramp must never produce one no
    // matter how far it runs.
    const level = new Level(SEED);
    level.ensure(60_000);
    for (let i = 1; i < level.platforms.length; i += 1) {
      expect(level.platforms[i].y - level.platforms[i - 1].y).toBeLessThanOrEqual(26);
    }
  });

  it("holds back the tricky platforms until the player is off the ground", () => {
    const level = new Level(SEED);
    level.ensure(4_000);
    for (const platform of level.platforms) {
      if (platform.y === 0) expect(platform.type).toBe(0);
    }
    expect(level.platforms.some((p) => p.type === PLATFORM_MOVING)).toBe(true);
  });
});

describe("simulate", () => {
  it("is deterministic - the same trace always scores the same", () => {
    const inputs = autoplay(SEED, 900);
    const first = simulate(SEED, inputs);
    const second = simulate(SEED, inputs);
    expect(first).toEqual(second);
  });

  it("scores a run that actually climbs", () => {
    const run = simulate(SEED, autoplay(SEED, 1_800))!;
    expect(run.score).toBeGreaterThan(80);
  });

  it("ends a run that never steers", () => {
    // Standing still on the start ledge is survivable; the ledge is directly
    // underneath. Climbing requires input, so the score stays at the apex.
    const run = simulate(SEED, [])!;
    expect(run.score).toBeLessThan(60);
  });

  it("scores a trace differently under a different seed", () => {
    const inputs = autoplay(SEED, 1_800);
    expect(simulate("some-other-seed", inputs)!.score).not.toBe(simulate(SEED, inputs)!.score);
  });

  it("rejects malformed traces rather than repairing them", () => {
    expect(simulate(SEED, "nope")).toBeNull();
    // A delta of zero - two changes on one frame. Unrepresentable by design.
    expect(simulate(SEED, [packInput(4, 1), 1])).toBeNull();
    expect(simulate(SEED, [-3])).toBeNull();
    expect(simulate(SEED, [7.5])).toBeNull();
    expect(simulate(SEED, [packInput(MAX_FRAMES + 2, 0)])).toBeNull();
    expect(
      simulate(
        SEED,
        Array.from({ length: MAX_INPUTS + 1 }, () => packInput(1, 1)),
      ),
    ).toBeNull();
  });

  it("terminates on the frame cap even if the player never dies", () => {
    const run = simulate(SEED, autoplay(SEED, MAX_FRAMES))!;
    expect(run.frames).toBeLessThanOrEqual(MAX_FRAMES);
  });
});

describe("verify", () => {
  /** A duration generous enough that only the trace itself is under test. */
  const run = (submission: unknown, durationMs = 10 * 60_000) =>
    verify({ seed: SEED, difficulty: "hard", submission, durationMs });

  it("derives the score from the replay, not from the client", () => {
    const inputs = autoplay(SEED, 1_800);
    const result = run({ inputs, score: 999_999 });
    expect(result.valid).toBe(true);
    expect(result.score).toBe(simulate(SEED, inputs)!.score);
  });

  it("rejects a trace claiming more play time than actually elapsed", () => {
    // The bot case: a full run handed over four seconds after starting.
    const inputs = autoplay(SEED, 1_800);
    const played = simulate(SEED, inputs)!;
    expect(played.frames).toBeGreaterThan(600);
    expect(run({ inputs }, 4_000).valid).toBe(false);
  });

  it("accepts a run whose length matches the clock", () => {
    const inputs = autoplay(SEED, 1_800);
    const played = simulate(SEED, inputs)!;
    expect(run({ inputs }, (played.frames / FPS) * 1000).valid).toBe(true);
  });

  it("accepts a run slower than its frame count - a struggling phone is not a cheat", () => {
    const inputs = autoplay(SEED, 1_800);
    const played = simulate(SEED, inputs)!;
    // Three times as long on the clock as the simulation implies. A device
    // that cannot hold 60fps simulates behind real time, and that direction
    // must never be treated as suspicious.
    expect(run({ inputs }, (played.frames / FPS) * 3_000).valid).toBe(true);
  });

  it("survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ inputs: "nope" }).valid).toBe(false);
    expect(run({ inputs: ["3"] }).valid).toBe(false);
  });
});

describe("wire format", () => {
  const trace: JumpInput[] = [
    { f: 0, d: 1 },
    { f: 7, d: 0 },
    { f: 8, d: -1 },
    { f: 900, d: 1 },
  ];

  it("round-trips", () => {
    expect(unpackInputs(packInputs(trace))).toEqual(trace);
  });

  it("fits a maximal run inside the endpoint's byte cap", () => {
    // 128,000 bytes on the registry entry. A six-minute run produces a few
    // thousand direction changes and this is the whole reason the format is
    // packed integers rather than objects.
    const bytes = JSON.stringify({ inputs: autoplay(SEED, MAX_FRAMES) }).length;
    expect(bytes).toBeLessThan(128_000);
  });
});
