import type { GameState } from '../GameState';
import { SCENARIOS } from '../data/scenarios';
import { FENCE_TYPES, SANDBAGS } from '../data/fences';
import { fenceAt, fenceHp, setFenceHp, tileEdges } from '../fences';
import { edgeKey, type Edge } from '../grid';
import { spend } from '../finance';
import { isLand, Terrain } from '../terrain';
import type { SimContext } from './context';
import { dinoLabel } from './dinos';
import { startStorm } from './events';

/** Tiles within this many steps (each way) of a pump house stay dry. */
export const PUMP_RADIUS = 4;
/** Cleaning up a building the flood got into. */
export const FLOOD_CLEANUP = 250;
/** Each wet hour: chance a dinosaur standing in flood water catches a chill. */
const CHILL_CHANCE = 0.04;
/** Fence condition lost per wet hour (for the weakest fence; stronger ones lose less). */
const ROT_PER_HOUR = 3;

/** Where the river's water comes from. */
const isRiverWater = (t: Terrain) => t === Terrain.River || t === Terrain.Pond || t === Terrain.Waterfall;

/** A standing sandbag wall between two neighbouring tiles holds the water back. */
function sandbagged(state: GameState, a: number, b: number): boolean {
  const w = state.map.width;
  const ax = a % w;
  const ay = Math.floor(a / w);
  const bx = b % w;
  const by = Math.floor(b / w);
  const edge = bx !== ax ? { dir: 'v' as const, x: Math.max(ax, bx), y: ay } : { dir: 'h' as const, x: ax, y: Math.max(ay, by) };
  return fenceAt(state, edge) === SANDBAGS;
}

/** Tiles kept dry by a pump house. */
function pumped(state: GameState): Uint8Array {
  const { width, height } = state.map;
  const dry = new Uint8Array(width * height);
  for (const b of state.buildings) {
    if (b.kind !== 'pump') continue;
    for (let y = Math.max(0, b.y - PUMP_RADIUS); y <= Math.min(height - 1, b.y + PUMP_RADIUS); y++)
      for (let x = Math.max(0, b.x - PUMP_RADIUS); x <= Math.min(width - 1, b.x + PUMP_RADIUS); x++) dry[y * width + x] = 1;
  }
  return dry;
}

/**
 * The tiles under water when the river is `level` above its usual height.
 * Water spreads from the river and ponds over any connected ground no higher
 * than the flood, but not across a sandbag wall or into pumped ground. A
 * bridge over the river is swamped too.
 */
export function floodTiles(state: GameState, level: number): number[] {
  if (level <= 0) return [];
  const { width, height, tiles, heights } = state.map;
  const dry = pumped(state);
  const seen = new Uint8Array(tiles.length);
  const stack: number[] = [];
  const wet: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (!isRiverWater(tiles[i])) continue;
    seen[i] = 1;
    stack.push(i);
    if (state.paths[i] && !dry[i]) wet.push(i); // a bridge
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (seen[j] || !isLand(tiles[j]) || heights[j] > level || dry[j] || sandbagged(state, i, j)) continue;
      seen[j] = 1;
      wet.push(j);
      stack.push(j);
    }
  }
  return wet;
}

/** Wet tiles as a fast lookup, cached per flood-water list. */
const wetCache = new WeakMap<number[], Uint8Array>();
export function isFlooded(state: GameState, i: number): boolean {
  const wet = state.flood?.wet;
  if (!wet || wet.length === 0) return false;
  let map = wetCache.get(wet);
  if (!map) {
    map = new Uint8Array(state.map.tiles.length);
    for (const t of wet) map[t] = 1;
    wetCache.set(wet, map);
  }
  return map[i] === 1;
}

/** Where the water will reach at the season's usual peak, if nothing changes (for the forecast overlay). */
export function floodForecast(state: GameState): Set<number> {
  const cfg = SCENARIOS[state.scenario.id].floods;
  if (!state.flood || !cfg || state.flood.level > 0) return new Set();
  const next = cfg.starts[state.flood.survived];
  if (next === undefined || next - state.hours > 12) return new Set();
  return new Set(floodTiles(state, cfg.peak));
}

/** The water level this hour, from the season's schedule. */
export function scheduledLevel(state: GameState): { level: number; flood: number } {
  const cfg = SCENARIOS[state.scenario.id].floods;
  if (!cfg) return { level: 0, flood: -1 };
  for (let k = 0; k < cfg.starts.length; k++) {
    const t = state.hours - cfg.starts[k];
    const total = cfg.rise + cfg.hold + cfg.drain;
    if (t < 0 || t >= total) continue;
    const level = t < cfg.rise ? Math.ceil(((t + 1) / cfg.rise) * cfg.peak) : t < cfg.rise + cfg.hold ? cfg.peak : Math.ceil(((total - t - 1) / cfg.drain) * cfg.peak);
    return { level, flood: k };
  }
  return { level: 0, flood: -1 };
}

/**
 * Hourly: rain warnings, the river rising and falling on schedule, and what
 * flood water does: dinosaurs wade out to dry ground (and may catch a chill),
 * visitors go home, feeders spoil, fences rot, buildings close until cleaned up.
 */
export function hourlyFlood(ctx: SimContext): void {
  const { state, rng } = ctx;
  const f = state.flood;
  const cfg = SCENARIOS[state.scenario.id].floods;
  if (!f || !cfg) return;
  const w = state.map.width;
  const next = cfg.starts[f.survived];
  if (f.level === 0 && next !== undefined) {
    const toGo = next - state.hours;
    if (toGo === 12) {
      ctx.emit({ text: '🌧️ Heavy rain forecast! The river will flood in about 12 hours. The blue stripes show where the water will reach.', kind: 'bad' });
      ctx.invalidateWorld(); // draw the forecast
    }
    if (toGo === 1) startStorm(ctx);
  }

  const { level } = scheduledLevel(state);
  const was = f.level;
  f.level = level;
  if (was === 0 && level > 0) {
    f.damage = 0;
    f.soaked = [];
    ctx.emit({ text: '🌊 The river has burst its banks! Low ground is flooding.', kind: 'bad' });
  }
  const before = f.wet;
  f.wet = floodTiles(state, level);
  if (was !== level || f.wet.length !== before.length || f.wet.some((t, k) => t !== before[k])) ctx.invalidateWorld();

  if (level > 0) {
    const wet = new Set(f.wet);
    let spoiled = 0;
    // A fence between two wet tiles still only rots once an hour.
    const soggy = new Map<string, Edge>();
    for (const i of f.wet) {
      const x = i % w;
      const y = Math.floor(i / w);
      if (state.paths[i]) f.damage++;
      for (const b of state.buildings)
        if (b.x === x && b.y === y && !f.soaked.includes(b.id)) {
          f.soaked.push(b.id);
          f.damage++;
        }
      for (const feeder of state.feeders)
        if (feeder.x === x && feeder.y === y && feeder.stock > 0) {
          feeder.stock = 0;
          spoiled++;
        }
      for (const e of tileEdges(x, y)) soggy.set(edgeKey(e), e);
    }
    let broke = false;
    for (const e of soggy.values()) {
      const type = fenceAt(state, e);
      if (!type || type === SANDBAGS) continue;
      setFenceHp(state, e, fenceHp(state, e) - ROT_PER_HOUR / FENCE_TYPES[type].strength);
      if (!fenceAt(state, e)) broke = true;
    }
    // A fence that rots through opens a paddock, so regions must be worked out again.
    if (broke) ctx.invalidateWorld();
    if (spoiled) ctx.emit({ text: `🌊 Flood water spoiled the food in ${spoiled === 1 ? 'a feeder' : `${spoiled} feeders`}.`, kind: 'bad' });
    // Visitors caught by the water head home; staff retreat to the gate.
    state.visitors = state.visitors.filter((v) => v.riding !== null || !wet.has(v.y * w + v.x));
    for (const m of state.staff)
      if (wet.has(Math.round(m.y) * w + Math.round(m.x))) {
        m.x = m.px = state.entrance.x;
        m.y = m.py = state.entrance.y;
        m.task = null;
      }
    // Dinosaurs wade to the nearest dry ground they can reach; standing in water is miserable.
    for (const d of state.dinos) {
      if (!wet.has(d.y * w + d.x)) continue;
      f.damage++;
      const dryTile = wadeOut(state, d.y * w + d.x, wet);
      if (dryTile !== null) {
        d.x = d.px = dryTile % w;
        d.y = d.py = Math.floor(dryTile / w);
        d.path = [];
        continue;
      }
      d.happiness = Math.max(0, d.happiness - 5);
      if (!d.sick && rng.chance(CHILL_CHANCE)) {
        d.sick = true;
        ctx.emit({ text: `🤧 ${dinoLabel(d)} caught a chill standing in the flood. A vet would help.`, kind: 'bad' });
      }
    }
  } else if (was > 0) {
    // The water has gone: clean-up, and the tally.
    f.survived++;
    f.lastDry = f.damage === 0;
    const soaked = f.soaked.filter((id) => state.buildings.some((b) => b.id === id)).length;
    if (soaked) spend(state, 'maintenance', soaked * FLOOD_CLEANUP);
    f.soaked = [];
    ctx.emit({
      text: f.lastDry
        ? '🌤️ The flood has drained away, and nothing that matters got wet. Flood-proof!'
        : `🌤️ The flood has drained away.${soaked ? ` Cleaning up ${soaked} building${soaked === 1 ? '' : 's'} cost $${soaked * FLOOD_CLEANUP}.` : ''}`,
      kind: f.lastDry ? 'good' : 'info',
    });
  }
}

/** Nearest dry tile a wading dinosaur can reach (through water, but not through fences). */
function wadeOut(state: GameState, from: number, wet: Set<number>): number | null {
  const { width, height, tiles } = state.map;
  const seen = new Set([from]);
  let frontier = [from];
  for (let step = 0; step < 12 && frontier.length; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width;
      const y = Math.floor(i / width);
      for (const [nx, ny, dir, ex, ey] of [
        [x + 1, y, 'v', x + 1, y],
        [x - 1, y, 'v', x, y],
        [x, y + 1, 'h', x, y + 1],
        [x, y - 1, 'h', x, y],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (seen.has(j) || !isLand(tiles[j]) || fenceAt(state, { dir, x: ex, y: ey })) continue;
        seen.add(j);
        if (!wet.has(j)) return j;
        next.push(j);
      }
    }
    frontier = next;
  }
  return null;
}
