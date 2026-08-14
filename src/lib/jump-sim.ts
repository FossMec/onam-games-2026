/**
 * Maveli Jump — the deterministic simulation, shared verbatim by the browser
 * and the server.
 *
 * THIS IS THE ANTI-CHEAT. Read this before touching any number below.
 *
 * The client never reports a score. It reports the *inputs* it received — a
 * delta-encoded list of "at frame F the player was steering direction D" — and
 * the server re-runs this exact simulation over those inputs to derive the
 * height itself. A forged submission therefore has to be an input trace that
 * genuinely survives to the claimed height under real physics, which is not
 * "edit a number in devtools", it is "write a bot that plays well".
 *
 * And a bot still has to wait: `verify` cross-checks simulated frames against
 * the server-measured wall clock, so 21,600 frames of trace cannot be handed
 * over four seconds after starting. Grinding costs a cheater the same clock as
 * playing, which is the point.
 *
 * For that to hold, the simulation must be bit-identical in both places:
 *
 *   - Fixed timestep. No delta-time, ever. The browser's frame rate changes
 *     nothing about the physics; a 30fps phone and a 144Hz laptop simulate the
 *     same run at the same speed, which also happens to be the only fair way
 *     to run this as a competition.
 *   - No `Math.random`, no `Date.now`, no trigonometry inside the sim. IEEE-754
 *     +, -, *, / are exactly specified and agree across engines; `Math.sin` is
 *     not and does not have to.
 *   - The PRNG is deliberately duplicated here instead of imported from the
 *     shared `rng` module. This one is part of the simulation's determinism
 *     contract and must never change once the event is live, even if the
 *     shared generator RNG is someday replaced. It also keeps `node:crypto`
 *     out of the browser bundle.
 *
 * Changing ANY constant in this file invalidates every score already recorded.
 */

/* ------------------------------------------------------------------ world */

/** Logical world units. The renderer scales; the physics never does. */
export const WORLD_W = 100;
/** How much of the world is on screen at once. */
export const VIEW_H = 170;
/** Maveli's hitbox. */
export const PLAYER_W = 9;
export const PLAYER_H = 10;
export const PLATFORM_W = 22;
export const PLATFORM_H = 3;

export const FPS = 60;
/** Six minutes. Matches `maxDurationMs` on the registry entry. */
export const MAX_FRAMES = 6 * 60 * FPS;

const GRAVITY = 1 / 15;
/** Tuned together: apex = JUMP_V^2 / (2 * GRAVITY) = 30 units, ~30 frames up. */
const JUMP_V = 2;
/** Pookalam trampoline. Reaches ~108 units — three or four platforms. */
const SPRING_MULT = 1.9;
const MAX_VX = 1.6;
/** Steering lag. Instant velocity feels robotic; this is a quarter-step ease. */
const VX_EASE = 0.25;

/** The camera never descends, so the world below is gone for good. */
const CAMERA_ANCHOR = VIEW_H * 0.55;

export const PLATFORM_NORMAL = 0;
/** Banana chip. One bounce and it is gone. */
export const PLATFORM_BREAKABLE = 1;
/** Slides side to side on a fixed triangle wave. */
export const PLATFORM_MOVING = 2;
/** Pookalam trampoline. */
export const PLATFORM_SPRING = 3;

export interface Platform {
  /** Left edge at rest. Moving platforms travel right from here. */
  x: number;
  y: number;
  type: number;
  /** Moving platforms only: travel distance and wave period in frames. */
  range: number;
  period: number;
  phase: number;
}

/* -------------------------------------------------------------------- rng */

/** mulberry32. Frozen: see the file header. */
function makeRng(seed: string) {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  state >>>= 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- the level */

/**
 * Platforms are generated lazily, in index order, from one sequential stream.
 * Order is what makes it deterministic: however far the client got and however
 * far the server needs to replay, platform 400 is always the same platform.
 */
export class Level {
  readonly platforms: Platform[] = [];
  private readonly rand: () => number;

  constructor(seed: string) {
    this.rand = makeRng(`${seed}:maveli-jump`);
    // The ledge Maveli starts on, centred and always plain — nobody should die
    // to a breakable platform before they have touched a control.
    this.platforms.push({
      x: (WORLD_W - PLATFORM_W) / 2,
      y: 0,
      type: PLATFORM_NORMAL,
      range: 0,
      period: 0,
      phase: 0,
    });
  }

  /** Ensures every platform up to world height `y` exists. */
  ensure(y: number): void {
    while (this.platforms[this.platforms.length - 1].y < y) this.append();
  }

  private append(): void {
    const last = this.platforms[this.platforms.length - 1];
    const height = last.y;

    /*
     * Difficulty ramp. Two things get harder, and they have to get harder
     * forever — an earlier version saturated at 2,800 units and a competent
     * player then climbed indefinitely, so every good run tied at the frame
     * cap and the leaderboard stopped separating anyone.
     */

    /*
     * 1. Gaps. The apex of a normal jump is 30 units, so a gap must stay
     *    meaningfully under that or the run ends on a coin flip rather than on
     *    a mistake. Hard stop at 26, leaving four units of margin — the
     *    difficulty past this point comes from what the platforms *are*, not
     *    from how far apart they sit.
     */
    const spread = Math.min(4 + Math.floor(height / 400) * 3, 14);
    const gap = 12 + Math.floor(this.rand() * (spread + 1));

    /*
     * 2. What the platforms are. The first stretch is plain ones only — a
     *    player's first ten seconds decide whether they play again, and dying
     *    to a mechanic nobody explained is how you lose them. After that,
     *    solid ground keeps getting rarer, without limit. It approaches but
     *    never reaches "no normal platforms at all", so the climb stays
     *    survivable in principle and merely becomes absurd.
     */
    const roll = this.rand();
    let type = PLATFORM_NORMAL;
    let range = 0;
    let period = 0;
    let phase = 0;
    if (height > 300) {
      const ramp = Math.min((height - 300) / 2500, 1);
      // Second ramp, deliberately unbounded above the first one's ceiling.
      const late = height / (height + 4000);
      const spring = 0.06;
      const moving = spring + 0.24 * ramp + 0.18 * late;
      const breakable = moving + 0.2 * ramp + 0.18 * late;
      if (roll < spring) type = PLATFORM_SPRING;
      else if (roll < moving) type = PLATFORM_MOVING;
      else if (roll < breakable) type = PLATFORM_BREAKABLE;
    }

    let x: number;
    if (type === PLATFORM_MOVING) {
      range = 18 + Math.floor(this.rand() * 20);
      x = Math.floor(this.rand() * (WORLD_W - PLATFORM_W - range + 1));
      // Movers speed up with height. This is what eventually beats a bot that
      // aims at where a platform is now rather than where it will be on the
      // frame Maveli actually lands.
      const fastest = Math.max(40, 100 - Math.floor(height / 900) * 10);
      period = fastest + Math.floor(this.rand() * 8) * 20;
      phase = Math.floor(this.rand() * period);
    } else {
      x = Math.floor(this.rand() * (WORLD_W - PLATFORM_W + 1));
    }

    this.platforms.push({ x, y: height + gap, type, range, period, phase });
  }
}

/**
 * Where a platform's left edge is on a given frame.
 *
 * A triangle wave, not a sine: `Math.sin` is not required to be identical
 * across JavaScript engines, and a platform that sits one pixel differently on
 * the server than in the browser is a wrongly-rejected run.
 */
export function platformX(platform: Platform, frame: number): number {
  if (platform.type !== PLATFORM_MOVING) return platform.x;
  const half = platform.period / 2;
  const at = (frame + platform.phase) % platform.period;
  const t = at < half ? at / half : 2 - at / half;
  return platform.x + t * platform.range;
}

/* ---------------------------------------------------------------- inputs */

/** "From frame `f` onward the player steers `d`." `d` is -1, 0 or 1. */
export interface JumpInput {
  f: number;
  d: number;
}

/**
 * A full six-minute run is a lot of steering — measured runs produce 2,500 to
 * 6,000 direction changes — and it all has to fit inside the endpoint's
 * `maxSubmissionBytes`. As `[{"f":12345,"d":-1}, …]` that is well over 200KB.
 *
 * So the wire format is a flat array of packed integers: each entry is
 * `framesSinceLastChange * 3 + (direction + 1)`. Frame deltas are small, so
 * most entries are two or three digits, and a maximal trace lands around 50KB.
 *
 * The encoding is also self-validating in a useful way: a delta is a positive
 * integer by construction, so "inputs out of order" and "two inputs on the same
 * frame" become unrepresentable rather than something `verify` has to catch.
 */
export const MAX_INPUTS = 12_000;

/** Encodes one direction change. `deltaFrames` must be >= 1. */
export const packInput = (deltaFrames: number, direction: number): number =>
  deltaFrames * 3 + (direction + 1);

export function unpackInputs(packed: unknown): JumpInput[] | null {
  if (!Array.isArray(packed) || packed.length > MAX_INPUTS) return null;
  const inputs: JumpInput[] = [];
  // Starts at -1 so a first input on frame 0 encodes as a delta of 1 and stays
  // representable; a delta of 0 is what the "value < 3" check exists to reject.
  let frame = -1;
  for (const value of packed) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 3) return null;
    frame += Math.floor(value / 3);
    if (frame > MAX_FRAMES) return null;
    inputs.push({ f: frame, d: (value % 3) - 1 });
  }
  return inputs;
}

export function packInputs(inputs: JumpInput[]): number[] {
  let previous = -1;
  return inputs.map((input) => {
    const packed = packInput(input.f - previous, input.d);
    previous = input.f;
    return packed;
  });
}

export interface SimResult {
  /** Height above Paathalam, in whole units. This is the score. */
  score: number;
  /** Frames actually simulated — the run's true length. */
  frames: number;
  /** False only if the run hit the frame cap while still alive. */
  died: boolean;
}

export interface SimState {
  px: number;
  py: number;
  vx: number;
  vy: number;
  cameraY: number;
  maxY: number;
  frame: number;
  dir: number;
  alive: boolean;
  /** Indices of breakable platforms already used up. */
  broken: Set<number>;
  level: Level;
  /** Lowest platform index still worth testing; platforms below are gone. */
  floor: number;
}

export function initialState(seed: string): SimState {
  const level = new Level(seed);
  return {
    px: WORLD_W / 2,
    // `py` is Maveli's feet, and a platform's `y` is its top surface, so
    // standing on the start ledge is exactly zero.
    py: 0,
    vx: 0,
    vy: JUMP_V,
    cameraY: -CAMERA_ANCHOR,
    maxY: 0,
    frame: 0,
    dir: 0,
    alive: true,
    broken: new Set<number>(),
    level,
    floor: 0,
  };
}

/**
 * Advances exactly one frame. The browser calls this from its render loop and
 * the server calls it in a tight loop; they must agree on every field.
 */
export function step(state: SimState, dir: number): void {
  if (!state.alive) return;
  state.dir = dir;

  // Horizontal, with wraparound. Maveli leaving stage right returns stage left.
  state.vx += (dir * MAX_VX - state.vx) * VX_EASE;
  state.px += state.vx;
  if (state.px < 0) state.px += WORLD_W;
  else if (state.px >= WORLD_W) state.px -= WORLD_W;

  const previousFeet = state.py;
  state.vy -= GRAVITY;
  state.py += state.vy;

  // Unconditionally, not just when falling: the renderer draws a screenful
  // above Maveli, and generation order is what keeps the level deterministic.
  state.level.ensure(state.py + VIEW_H);

  if (state.vy < 0) {
    const platforms = state.level.platforms;
    for (let i = state.floor; i < platforms.length; i += 1) {
      const platform = platforms[i];
      if (platform.y > previousFeet) break;
      // Only a downward crossing of the platform's top counts. Landing is
      // tested against the span travelled this frame, so a fast fall cannot
      // tunnel straight through a platform.
      if (platform.y < state.py || platform.y > previousFeet) continue;
      if (state.broken.has(i)) continue;

      const left = platformX(platform, state.frame);
      const centre = left + PLATFORM_W / 2;
      // Wrapped horizontal distance, so the seam is not a dead zone.
      let dx = state.px - centre;
      if (dx < 0) dx = -dx;
      if (dx > WORLD_W - dx) dx = WORLD_W - dx;
      if (dx > (PLAYER_W + PLATFORM_W) / 2) continue;

      state.py = platform.y;
      state.vy = platform.type === PLATFORM_SPRING ? JUMP_V * SPRING_MULT : JUMP_V;
      if (platform.type === PLATFORM_BREAKABLE) state.broken.add(i);
      break;
    }
  }

  if (state.py > state.maxY) state.maxY = state.py;

  const wanted = state.py - CAMERA_ANCHOR;
  if (wanted > state.cameraY) {
    state.cameraY = wanted;
    // Everything below the camera is unreachable forever, so stop scanning it.
    // Without this the landing loop degrades to O(platforms) on a long run.
    const platforms = state.level.platforms;
    while (state.floor < platforms.length && platforms[state.floor].y < state.cameraY) {
      state.broken.delete(state.floor);
      state.floor += 1;
    }
  }

  // Below the bottom of the view is Paathalam. Maveli has been there.
  if (state.py < state.cameraY) state.alive = false;

  state.frame += 1;
}

/**
 * Replays a packed input trace and returns the run it describes.
 *
 * This is the function the server trusts; the client's on-screen counter merely
 * mirrors it. A malformed trace makes the whole submission invalid rather than
 * being silently repaired — "fix the cheater's payload until it parses" is not
 * a verification strategy.
 *
 * Note that a trace shorter than the run is not malformed. If the last recorded
 * change is at frame 300 and the player died at 600, the replay simply holds
 * that direction through to the same death, because death is deterministic too.
 */
export function simulate(seed: string, packed: unknown): SimResult | null {
  const inputs = unpackInputs(packed);
  if (!inputs) return null;
  for (const input of inputs) {
    if (input.d !== -1 && input.d !== 0 && input.d !== 1) return null;
  }

  const state = initialState(seed);
  let cursor = 0;
  let dir = 0;

  while (state.alive && state.frame < MAX_FRAMES) {
    while (cursor < inputs.length && inputs[cursor].f === state.frame) {
      dir = inputs[cursor].d;
      cursor += 1;
    }
    step(state, dir);
  }

  return { score: Math.floor(state.maxY), frames: state.frame, died: !state.alive };
}
