import type { GameState } from '../GameState';
import { SCENARIOS } from '../data/scenarios';
import { fenceAt, setFenceHp, tileEdges } from '../fences';
import { hash2 } from '../rng';
import { isLand, isWater, Terrain } from '../terrain';
import type { SimContext } from './context';
import { dinoLabel } from './dinos';
import { walkableNeighbours } from '../pathfind';
import { volcanoRumble } from './events';

/** Fence type that holds lava back (while it stands). */
export const LAVA_PROOF_FENCE = 4;
/** Hours fresh lava glows before it cools into lava rock. */
export const LAVA_COOL_HOURS = 30;
/** Visitors stay away this long after the lava stops (ash in the air). */
const ASH_HOURS_AFTER = 48;
/** How much ash cuts visitor numbers. */
export const ASH_ARRIVALS = 0.25;
/** A dino in the lava's way bolts up to this many steps to safety. */
const FLEE_STEPS = 8;

/** The volcano and its mountain are crossed by lava without changing (it runs down between the peaks). */
const passThrough = (t: Terrain) => t === Terrain.Volcano || t === Terrain.Mountain || t === Terrain.Cliff;

/** A standing concrete fence between two neighbouring tiles holds the lava back. */
function walled(state: GameState, a: number, b: number): boolean {
  const w = state.map.width;
  const ax = a % w;
  const ay = Math.floor(a / w);
  const bx = b % w;
  const by = Math.floor(b / w);
  const edge = bx !== ax ? { dir: 'v' as const, x: Math.max(ax, bx), y: ay } : { dir: 'h' as const, x: ax, y: Math.max(ay, by) };
  return fenceAt(state, edge) === LAVA_PROOF_FENCE;
}

/**
 * The next `budget` tiles lava will cover, in order. Lava pours out of the
 * crater and always takes the lowest ground at its edge (with a little
 * randomness, so flows wander), which sends it running downhill in streams
 * and pooling in hollows. It stops at water and at concrete walls, and runs
 * unseen through the mountain rock around the crater.
 */
export function nextLava(state: GameState, budget: number): number[] {
  const { width, height, tiles, heights } = state.map;
  const v = state.map.volcano;
  if (!v || budget <= 0) return [];
  const key = (i: number) => heights[i] + hash2(i, state.seed, 97) * 0.9;
  const seen = new Uint8Array(tiles.length);
  const open: number[] = [];
  const push = (i: number) => {
    if (seen[i]) return;
    seen[i] = 1;
    open.push(i);
  };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) push((v.y + dy) * width + v.x + dx);
  const out: number[] = [];
  while (open.length && out.length < budget) {
    // Lowest key first (the open list stays small, so a scan is fine).
    let best = 0;
    for (let k = 1; k < open.length; k++) if (key(open[k]) < key(open[best])) best = k;
    const i = open.splice(best, 1)[0];
    const t = tiles[i];
    if (!passThrough(t) && t !== Terrain.Lava) out.push(i);
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      const tj = tiles[j];
      if (seen[j] || isWater(tj) || walled(state, i, j)) continue;
      if (!isLand(tj) && !passThrough(tj) && tj !== Terrain.Lava) continue;
      push(j);
    }
  }
  return out;
}

/** Where the rest of the eruption's lava will go, if nothing changes: the danger zone. */
export function lavaPreview(state: GameState): Set<number> {
  const e = state.eruption;
  const cfg = SCENARIOS[state.scenario.id].eruption;
  if (!e || !cfg || (e.stage !== 'rumbling' && e.stage !== 'erupting')) return new Set();
  return new Set(nextLava(state, cfg.volume - e.lava.length));
}

/**
 * Nearest safe tile a dino can bolt to, avoiding lava and where it's about to
 * go. Fences still stand in its way, so a dino hemmed in by lava and fence is trapped.
 */
function escapeRoute(state: GameState, from: number, danger: Set<number>): number | null {
  const seen = new Set([from]);
  let frontier = [from];
  for (let step = 0; step < FLEE_STEPS; step++) {
    const next: number[] = [];
    for (const i of frontier)
      for (const j of walkableNeighbours(state, i)) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (!danger.has(j)) return j;
        next.push(j);
      }
    frontier = next;
  }
  return null;
}

/** Lava covers one tile: whatever was built there is lost, and anyone there gets out of the way. */
function cover(ctx: SimContext, i: number, danger: Set<number>, losses: string[]): void {
  const { state } = ctx;
  const w = state.map.width;
  const x = i % w;
  const y = Math.floor(i / w);
  state.map.tiles[i] = Terrain.Lava;
  state.paths[i] = 0;
  state.tracks[i] = 0;
  for (const b of state.buildings.filter((o) => o.x === x && o.y === y)) {
    state.buildings.splice(state.buildings.indexOf(b), 1);
    losses.push(b.kind);
  }
  state.feeders = state.feeders.filter((f) => f.x !== x || f.y !== y);
  state.decor = state.decor.filter((d) => d.x !== x || d.y !== y);
  state.eggs = state.eggs.filter((egg) => egg.x !== x || egg.y !== y);
  // Fences round it burn through (concrete holds). They're left broken, so workers can mend them once it cools.
  for (const e of tileEdges(x, y)) {
    const type = fenceAt(state, e);
    if (type && type !== LAVA_PROOF_FENCE) setFenceHp(state, e, 0);
  }
  // Visitors nearby hurry to the exit; staff step back to the gate.
  state.visitors = state.visitors.filter((v) => Math.abs(v.x - x) > 1 || Math.abs(v.y - y) > 1 || v.riding !== null);
  for (const m of state.staff)
    if (Math.round(m.x) === x && Math.round(m.y) === y) {
      m.x = m.px = state.entrance.x;
      m.y = m.py = state.entrance.y;
      m.task = null;
    }
  for (const d of state.dinos.filter((o) => o.x === x && o.y === y)) {
    const safe = escapeRoute(state, i, danger);
    if (safe !== null) {
      d.x = d.px = safe % w;
      d.y = d.py = Math.floor(safe / w);
      d.path = [];
      continue;
    }
    // Trapped: the rescue helicopter lifts it out, and it goes to live in another park.
    state.dinos.splice(state.dinos.indexOf(d), 1);
    state.stats.dinosLost++;
    ctx.emit({ text: `🚁 ${dinoLabel(d)} was trapped by the lava! The rescue helicopter lifted it out, but it has to live in another park now.`, kind: 'bad' });
  }
}

/**
 * Hourly: the volcano rumbles (with warnings) until it erupts, lava flows a
 * few tiles an hour until the eruption is spent, then cools into lava rock.
 */
export function hourlyEruption(ctx: SimContext): void {
  const { state } = ctx;
  const e = state.eruption;
  const cfg = SCENARIOS[state.scenario.id].eruption;
  if (!e || !cfg) return;
  const toGo = e.eruptHour - state.hours;

  if (e.stage === 'rumbling') {
    if (toGo === 24 || toGo === 6) ctx.emit({ text: `🌋 The volcano is rumbling louder! Scientists expect it to erupt in about ${toGo} hours. See the red danger zone.`, kind: 'bad' });
    if (toGo > 0 && toGo % 12 === 0) volcanoRumble(ctx);
    if (toGo <= 0) {
      e.stage = 'erupting';
      ctx.emit({ text: '🌋 ERUPTION! Lava is pouring down the mountain. Keep everyone out of its way!', kind: 'bad' });
    }
  } else if (e.stage === 'erupting') {
    state.volcanoActivity = Math.max(state.volcanoActivity, 2); // glowing and smoking
    const flow = nextLava(state, Math.min(cfg.perHour, cfg.volume - e.lava.length));
    const upcoming = new Set([...flow, ...nextLava(state, cfg.perHour * 3)]);
    const losses: string[] = [];
    for (const i of flow) {
      cover(ctx, i, upcoming, losses);
      e.lava.push({ tile: i, hour: state.hours });
    }
    if (losses.length) ctx.emit({ text: `🔥 The lava destroyed ${losses.length === 1 ? 'a building' : `${losses.length} buildings`}.`, kind: 'bad' });
    if (flow.length) ctx.invalidateWorld();
    e.ashUntil = state.hours + ASH_HOURS_AFTER;
    if (flow.length === 0 || e.lava.length >= cfg.volume) {
      e.stage = 'cooling';
      ctx.emit({ text: '🌋 The eruption is over. The lava will cool into solid rock over the next day or so.', kind: 'info' });
    }
  }

  if (e.stage === 'erupting' || e.stage === 'cooling') {
    let cooled = 0;
    for (const l of e.lava)
      if (state.map.tiles[l.tile] === Terrain.Lava && state.hours - l.hour >= LAVA_COOL_HOURS) {
        state.map.tiles[l.tile] = Terrain.LavaRock;
        cooled++;
      }
    if (cooled) ctx.invalidateWorld();
    if (e.stage === 'cooling' && !e.lava.some((l) => state.map.tiles[l.tile] === Terrain.Lava)) {
      e.stage = 'over';
      ctx.emit({ text: '🪨 The lava has cooled into rock. Time to rebuild!', kind: 'good' });
    }
  }
}
