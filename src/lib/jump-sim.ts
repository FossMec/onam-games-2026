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
export const PLATFORM_H = 2.5;

export const FPS = 60;
export const MAX_FRAMES = 6 * 60 * FPS;

const GRAVITY = 1 / 15;
/** Normal jump: apex = JUMP_V^2 / (2 * GRAVITY) = ~46.9 units (clears missed middle platform) */
const JUMP_V = 2.5;
/** Special Umbrella/Spring floor: max jump reaches ~150 units */
const SPRING_MULT = 2.0;
const BALLOON_VY = 2.4;
const BALLOON_DURATION = 150; // 2.5 seconds of auto-climb glide
const MAX_VX = 1.6;
const VX_EASE = 0.25;

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
    this.rand = makeRng(`${seed}:maveli-jump-v5`);
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
    while (this.platforms[this.platforms.length - 1].y < y) this.append();
  }

  private append(): void {
    const last = this.platforms[this.platforms.length - 1];
    const height = last.y;

    // Progressive platform spacing: gaps grow from 14 to 26 units
    const spread = Math.min(4 + Math.floor(height / 350) * 3, 12);
    const gap = 14 + Math.floor(this.rand() * (spread + 1));

    const roll = this.rand();
    let type = PLATFORM_NORMAL;
    let range = 0;
    let period = 0;
    let phase = 0;

    if (height > 25) {
      const spring = 0.1; // Umbrella spring appears right away (10% chance)
      const moving = spring + (height > 60 ? Math.min((height - 60) / 800, 0.35) : 0);
      const breakable = moving + (height > 90 ? Math.min((height - 90) / 1000, 0.28) : 0);

      if (roll < spring) type = PLATFORM_SPRING;
      else if (roll < moving) type = PLATFORM_MOVING;
      else if (roll < breakable) type = PLATFORM_BREAKABLE;
    }

    let x: number;
    if (type === PLATFORM_MOVING) {
      range = 14 + Math.floor(this.rand() * 20);
      x = Math.floor(this.rand() * (WORLD_W - PLATFORM_W - range + 1));
      const fastest = Math.max(35, 90 - Math.floor(height / 600) * 12);
      period = fastest + Math.floor(this.rand() * 8) * 16;
      phase = Math.floor(this.rand() * period);
    } else {
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

    // Underworld Hazards (Moving Retracting Spiked Orbs & Aerial Spikes)
    // NEVER placed on Spring platforms, Moving platforms, or Breakable platforms!
    let enemy: Enemy | null = null;
    if (platY > 80 && item === null && type === PLATFORM_NORMAL) {
      const enemyRoll = this.rand();
      if (enemyRoll < 0.12) {
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

export const packInput = (deltaFrames: number, direction: number): number =>
  deltaFrames * 3 + (direction + 1);

export function unpackInputs(packed: unknown): JumpInput[] | null {
  if (!Array.isArray(packed) || packed.length > MAX_INPUTS) return null;
  const inputs: JumpInput[] = [];
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

  // Horizontal motion with wrapping
  state.vx += (dir * MAX_VX - state.vx) * VX_EASE;
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

  state.level.ensure(state.py + VIEW_H);

  const platforms = state.level.platforms;

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
