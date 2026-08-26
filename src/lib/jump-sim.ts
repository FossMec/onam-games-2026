/**
 * Maveli Jump - the deterministic simulation, shared verbatim by the browser
 * and the server.
 *
 * THIS IS THE ANTI-CHEAT.
 *
 * The client never reports a score. It reports the *inputs* it received - a
 * delta-encoded list of "at frame F the player was steering direction D" - and
 * the server re-runs this exact simulation over those inputs to derive the
 * height itself.
 *
 * For that to hold, the simulation must be bit-identical in both places:
 *   - Fixed timestep (60 FPS).
 *   - Pure IEEE-754 arithmetic (no Math.random, no Math.sin, deterministic RNG).
 */

/* ------------------------------------------------------------------ world */

export const WORLD_W = 100;
export const VIEW_H = 170;
export const PLAYER_W = 7;
export const PLAYER_H = 9;
export const PLATFORM_W = 12;
export const PLATFORM_H = 1.8;

export const FPS = 60;
export const MAX_FRAMES = 6 * 60 * FPS;

export const GRAVITY = 1 / 20;
/** Normal jump: apex = JUMP_V^2 / (2 * GRAVITY) = ~44.5 units */
const JUMP_V = 2.11;
/** Special Umbrella/Spring floor: max jump reaches ~178 units */
const SPRING_MULT = 2.0;
const BALLOON_VY = 2.1;
// Balloon now equals spring height: spring apex ≈178, so 178/2.1 ≈85 frames
const BALLOON_DURATION = 85; // 1.42s climb, matches spring apex
const MAX_VX = 1.5;

/** Constant vertical gap — every platform is exactly this far above the last.
 *  Both N+1 (18) and N+2 (36) are < normal apex 44.5, so from any normal
 *  platform the next two are always reachable. Difficulty comes from breakable/moving/spring. */
export const PLATFORM_GAP = 18;

const CAMERA_ANCHOR = VIEW_H * 0.55;

export const PLATFORM_NORMAL = 0;
export const PLATFORM_BREAKABLE = 1;
export const PLATFORM_MOVING = 2;
export const PLATFORM_SPRING = 3;

export const ITEM_NONE = 0;
export const ITEM_BALLOON = 1;

export const ENEMY_NONE = 0;
export const ENEMY_SPIKES = 1; // Pointy ground with 3 sharp spikes on platform
export const ENEMY_SPIKED_ORB = 2; // Moving circular orb with retracting/extending spikes

export interface Item {
  type: number;
  x: number;
  y: number;
}

export interface Enemy {
  id: number;
  type: number;
  x: number;
  y: number;
  range: number;
  period: number;
  phase: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number;
  type: number;
  range: number;
  period: number;
  phase: number;
  item: Item | null;
  enemy: Enemy | null;
}

/* -------------------------------------------------------------------- rng */

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

export class Level {
  readonly platforms: Platform[] = [];
  private readonly rand: () => number;
  private nextId = 0;
  private lastBalloonY = -999;

  constructor(seed: string) {
    // The seed is a SHA256 hash computed in attempts.ts — it already encodes
    // game type, slug, user ID and attempt number. Do NOT append a version
    // suffix here: changing it mid-event invalidates all in-flight games
    // (client runs one level, server re-simulates on a different one →
    // score mismatch). If level generation ever needs a breaking change,
    // update the hash formula in attempts.ts so the DB stores a new seed.
    this.rand = makeRng(seed);
    // Starting base platform
    this.platforms.push({
      id: this.nextId++,
      x: (WORLD_W - PLATFORM_W) / 2,
      y: 0,
      type: PLATFORM_NORMAL,
      range: 0,
      period: 0,
      phase: 0,
      item: null,
      enemy: null,
    });
  }

  ensure(y: number): void {
    const target = y + 400;
    while (this.platforms[this.platforms.length - 1].y < target) this.append();
  }

  private append(): void {
    const last = this.platforms[this.platforms.length - 1];
    const height = last.y;

    // Constant gap — every platform is exactly PLATFORM_GAP above the last,
    // so from any normal platform both N+1 and N+2 are reachable. Progressive
    // difficulty now comes from breakable/moving/spring frequencies only.
    const gap = PLATFORM_GAP;

    const roll = this.rand();
    let type = PLATFORM_NORMAL;
    let range = 0;
    let period = 0;
    let phase = 0;

    if (height > 25) {
      // Exponential difficulty ramp → logarithmic score distribution.
      // Target 5k ceiling (high-skill ~5k, not 10k): many die early, few reach 5k.
      // Uses 1 - exp(-h/scale) so growth is slow early, fast mid, saturates by 5k.
      // Math.exp is deterministic and cheap (~1 call per platform, ~300 calls per verify).
      const spring = height < 1200 ? 0.07 : 0.05; // slightly rarer at altitude
      const movingCap = 0.3;
      const breakableCap = 0.36;
      const movingProb = height > 25 ? movingCap * (1 - Math.exp(-(height - 25) / 1800)) : 0;
      const breakableProb = height > 25 ? breakableCap * (1 - Math.exp(-(height - 25) / 1400)) : 0;
      const moving = spring + movingProb;
      const breakable = moving + breakableProb;

      if (roll < spring) type = PLATFORM_SPRING;
      else if (roll < moving) type = PLATFORM_MOVING;
      else if (roll < breakable) type = PLATFORM_BREAKABLE;
    }

    let x: number;
    if (type === PLATFORM_MOVING) {
      range = 14 + Math.floor(this.rand() * 20);
      x = Math.floor(this.rand() * (WORLD_W - PLATFORM_W - range + 1));
      // Speed increases gradually with height: exponential period decay, 90 → ~32 at 5k
      const periodBase = 90 - 58 * (1 - Math.exp(-height / 1800));
      const fastest = Math.max(32, Math.floor(periodBase));
      period = fastest + Math.floor(this.rand() * 8) * 16;
      phase = Math.floor(this.rand() * period);
    } else {
      // Pure random uniform — no horizontal constraints based on previous position
      x = Math.floor(this.rand() * (WORLD_W - PLATFORM_W + 1));
    }

    const platY = height + gap;

    // Collectible Balloon (rare power-up, minimum 140m spacing)
    let item: Item | null = null;
    if (platY > 30 && type === PLATFORM_NORMAL && platY - this.lastBalloonY >= 140) {
      const itemRoll = this.rand();
      // Guaranteed 1 early balloon around height 40m, then rare 5% chance every 140m+
      if (this.lastBalloonY < 0 && platY >= 35 && platY <= 55) {
        this.lastBalloonY = platY;
        item = { type: ITEM_BALLOON, x: x + PLATFORM_W / 2, y: platY + 6 };
      } else if (itemRoll < 0.05) {
        this.lastBalloonY = platY;
        item = { type: ITEM_BALLOON, x: x + PLATFORM_W / 2, y: platY + 6 };
      }
    }

    // Underworld Hazards (Moving Retracting Spiked Orbs) — separate entity by design:
    // Orbs float *between* platforms (platY+10) and move independently of the platform
    // they are attached to, creating a timing hazard. If merged into the platform
    // they would move with it (for moving platforms) or be trivial to avoid. Kept
    // separate for 5k-target log distribution; cheap: one exp per platform.
    let enemy: Enemy | null = null;
    if (platY > 80 && item === null && type === PLATFORM_NORMAL) {
      const enemyRoll = this.rand();
      // Exponential: 8% at ground → ~28% at 5k (harder, 5k target)
      const enemyCap = 0.2;
      const enemyChance = 0.08 + enemyCap * (1 - Math.exp(-(platY - 80) / 2200));
      if (enemyRoll < enemyChance) {
        // Moving geometric orb floating in the airspace between platforms
        const eRange = 16 + Math.floor(this.rand() * 18);
        const ePeriod = 90 + Math.floor(this.rand() * 4) * 20;
        const eX = Math.floor(this.rand() * (WORLD_W - 16 - eRange + 1));
        enemy = {
          id: this.nextId++,
          type: ENEMY_SPIKED_ORB,
          x: eX,
          y: platY + 10,
          range: eRange,
          period: ePeriod,
          phase: Math.floor(this.rand() * ePeriod),
        };
      }
    }

    this.platforms.push({
      id: this.nextId++,
      x,
      y: platY,
      type,
      range,
      period,
      phase,
      item,
      enemy,
    });
  }
}

export function isSpikesExtended(enemy: Enemy, frame: number): boolean {
  if (enemy.type === ENEMY_SPIKES) return true;
  if (enemy.type === ENEMY_SPIKED_ORB) {
    // Extended for first 55% of period, retracted inside for remaining 45%
    const at = (frame + enemy.phase) % enemy.period;
    return at < enemy.period * 0.55;
  }
  return true;
}

export function platformX(platform: Platform, frame: number): number {
  if (platform.type !== PLATFORM_MOVING) return platform.x;
  const half = platform.period / 2;
  const at = (frame + platform.phase) % platform.period;
  const t = at < half ? at / half : 2 - at / half;
  return platform.x + t * platform.range;
}

export function enemyX(enemy: Enemy, frame: number): number {
  if (enemy.range === 0 || enemy.period === 0) return enemy.x;
  const half = enemy.period / 2;
  const at = (frame + enemy.phase) % enemy.period;
  const t = at < half ? at / half : 2 - at / half;
  return enemy.x + t * enemy.range;
}

/* ---------------------------------------------------------------- inputs */

export interface JumpInput {
  f: number;
  d: number;
}

export const MAX_INPUTS = 12_000;
export const INPUT_RESOLUTION = 15;
export const INPUT_LEVELS = INPUT_RESOLUTION * 2 + 1;

export const packInput = (deltaFrames: number, direction: number): number => {
  const clamped = Math.max(-INPUT_RESOLUTION, Math.min(INPUT_RESOLUTION, Math.round(direction)));
  return deltaFrames * INPUT_LEVELS + (clamped + INPUT_RESOLUTION);
};

export function unpackInputs(packed: unknown): JumpInput[] | null {
  if (!Array.isArray(packed) || packed.length > MAX_INPUTS) return null;
  const inputs: JumpInput[] = [];
  let frame = -1;
  for (let i = 0; i < packed.length; i += 1) {
    const value = packed[i];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
    frame += Math.floor(value / INPUT_LEVELS);
    if (frame > MAX_FRAMES) return null;
    inputs.push({ f: frame, d: (value % INPUT_LEVELS) - INPUT_RESOLUTION });
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

/* ---------------------------------------------------------------- sim state */

export interface SimResult {
  score: number;
  frames: number;
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
  broken: Set<number>;
  collectedItems: Set<number>;
  defeatedEnemies: Set<number>;
  balloonFrames: number;
  umbrellaFrames: number;
  level: Level;
  floor: number;
}

export function initialState(seed: string): SimState {
  const level = new Level(seed);
  return {
    px: WORLD_W / 2,
    py: 0,
    vx: 0,
    vy: JUMP_V,
    cameraY: -CAMERA_ANCHOR,
    maxY: 0,
    frame: 0,
    dir: 0,
    alive: true,
    broken: new Set<number>(),
    collectedItems: new Set<number>(),
    defeatedEnemies: new Set<number>(),
    balloonFrames: 0,
    umbrellaFrames: 0,
    level,
    floor: 0,
  };
}

export function step(state: SimState, dir: number): void {
  if (!state.alive) return;
  state.dir = dir;

  // Doodle Jump pattern: tilt angle maps directly to horizontal velocity
  // No easing here — smoothing is done once at the sensor level
  state.vx = (dir / INPUT_RESOLUTION) * MAX_VX;
  state.px += state.vx;
  if (state.px < 0) state.px += WORLD_W;
  else if (state.px >= WORLD_W) state.px -= WORLD_W;

  const previousFeet = state.py;

  // Handle Balloon Auto-Climb Power-up
  if (state.balloonFrames > 0) {
    state.balloonFrames -= 1;
    state.vy = BALLOON_VY;
    state.py += state.vy;
  } else {
    state.vy -= GRAVITY;
    state.py += state.vy;
  }

  if (state.umbrellaFrames > 0) {
    state.umbrellaFrames -= 1;
  }

  const platforms = state.level.platforms;
  if (state.py + VIEW_H >= platforms[platforms.length - 1].y) {
    state.level.ensure(state.py + VIEW_H);
  }

  // 1. Platform Landing Check
  if (state.vy < 0 && state.balloonFrames === 0) {
    for (let i = state.floor; i < platforms.length; i += 1) {
      const platform = platforms[i];
      if (platform.y > previousFeet) break;
      if (platform.y < state.py || platform.y > previousFeet) continue;
      if (state.broken.has(platform.id)) continue;

      const left = platformX(platform, state.frame);
      const centre = left + PLATFORM_W / 2;
      let dx = state.px - centre;
      if (dx < 0) dx = -dx;
      if (dx > WORLD_W - dx) dx = WORLD_W - dx;
      if (dx > (PLAYER_W + PLATFORM_W) / 2) continue;

      state.py = platform.y;
      if (platform.type === PLATFORM_SPRING) {
        state.vy = JUMP_V * SPRING_MULT;
        state.umbrellaFrames = 40;
      } else {
        state.vy = JUMP_V;
      }

      if (platform.type === PLATFORM_BREAKABLE) {
        state.broken.add(platform.id);
      }
      break;
    }
  }

  // 2. Item Collection Check (Balloon)
  for (let i = state.floor; i < platforms.length; i += 1) {
    const platform = platforms[i];
    if (platform.y > state.py + VIEW_H) break;
    const item = platform.item;
    if (item && !state.collectedItems.has(platform.id)) {
      const itemX = platformX(platform, state.frame) + PLATFORM_W / 2;
      let dx = state.px - itemX;
      if (dx < 0) dx = -dx;
      if (dx > WORLD_W - dx) dx = WORLD_W - dx;
      const dy = Math.abs(state.py + PLAYER_H / 2 - item.y);

      if (dx <= (PLAYER_W + 4) / 2 && dy <= (PLAYER_H + 4) / 2) {
        state.collectedItems.add(platform.id);
        state.balloonFrames = BALLOON_DURATION;
      }
    }
  }

  // 3. Enemy / Obstacle Collision Check
  for (let i = state.floor; i < platforms.length; i += 1) {
    const platform = platforms[i];
    if (platform.y > state.py + VIEW_H) break;
    const enemy = platform.enemy;
    if (enemy && !state.defeatedEnemies.has(enemy.id)) {
      const eX = enemyX(enemy, state.frame);
      let dx = state.px - eX;
      if (dx < 0) dx = -dx;
      if (dx > WORLD_W - dx) dx = WORLD_W - dx;

      const playerBottom = state.py;
      const playerTop = state.py + PLAYER_H;

      if (enemy.type === ENEMY_SPIKES) {
        // Pointy Spikes Platform Obstacle
        const spikeBottom = enemy.y;
        const spikeTop = enemy.y + 5;
        if (dx <= (PLAYER_W + 8) / 2 && playerBottom <= spikeTop && playerTop >= spikeBottom) {
          if (state.balloonFrames > 0) {
            // Balloon passes safely
          } else if (state.vy <= 0) {
            // Landed on sharp pointy spikes: hazard!
            state.alive = false;
            break;
          }
        }
      } else if (enemy.type === ENEMY_SPIKED_ORB) {
        // Moving Retracting Spiked Orb Obstacle
        const orbBottom = enemy.y - 4;
        const orbTop = enemy.y + 6;
        const spikesActive = isSpikesExtended(enemy, state.frame);

        if (dx <= (PLAYER_W + 8) / 2 && playerBottom <= orbTop && playerTop >= orbBottom) {
          if (state.balloonFrames > 0) {
            // Invincible: smash orb
            state.defeatedEnemies.add(enemy.id);
          } else if (state.vy <= 0) {
            if (spikesActive) {
              // Spikes extended outward: deadly hazard!
              state.alive = false;
              break;
            } else {
              // Spikes safely retracted inside: bounce off smooth orb top!
              state.defeatedEnemies.add(enemy.id);
              state.vy = JUMP_V * 1.4;
              state.py = orbTop;
            }
          }
        }
      }
    }
  }

  if (state.py > state.maxY) state.maxY = state.py;

  const wanted = state.py - CAMERA_ANCHOR;
  if (wanted > state.cameraY) {
    state.cameraY = wanted;
    while (state.floor < platforms.length && platforms[state.floor].y < state.cameraY) {
      state.broken.delete(platforms[state.floor].id);
      state.collectedItems.delete(platforms[state.floor].id);
      state.floor += 1;
    }
  }

  // Below screen bottom = fallen into Paathalam
  if (state.py < state.cameraY) state.alive = false;

  state.frame += 1;
}

/**
 * Replay a packed input trace and return the score the server derives.
 *
 * @param frameCap  Optional upper bound on frames to simulate.
 *
 * The server passes `ceil(durationMs * FPS / 1000)` here so replay cost is
 * proportional to how long the player actually played:
 *
 *   ~2 min session  →  ~7 200 frames  (vs 21 600 uncapped) — 3× faster
 *   ~4 min session  →  ~14 400 frames (vs 21 600 uncapped) — 1.5× faster
 *
 * The cap never makes a legitimate run invalid: the player cannot have reached
 * frame N+1 if their wall-clock session ended before frame N, so capping the
 * replay at the session length produces the same score as running to MAX_FRAMES.
 *
 * The browser never passes a cap — client-side preview scoring is unchanged.
 */
export function simulate(
  seed: string,
  packed: unknown,
  frameCap: number = MAX_FRAMES,
): SimResult | null {
  const inputs = unpackInputs(packed);
  if (!inputs) return null;
  for (const input of inputs) {
    if (
      typeof input.d !== "number" ||
      !Number.isInteger(input.d) ||
      input.d < -INPUT_RESOLUTION ||
      input.d > INPUT_RESOLUTION
    ) {
      return null;
    }
  }

  const cap = Math.min(MAX_FRAMES, Math.max(0, Math.ceil(frameCap)));
  const state = initialState(seed);
  let cursor = 0;
  let dir = 0;

  while (state.alive && state.frame < cap) {
    while (cursor < inputs.length && inputs[cursor].f === state.frame) {
      dir = inputs[cursor].d;
      cursor += 1;
    }
    step(state, dir);
  }

  return {
    score: Math.floor(state.maxY),
    frames: state.frame,
    died: !state.alive,
  };
}
