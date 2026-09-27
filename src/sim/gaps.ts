import type { GameState } from './GameState';
import { FENCE_TYPES, type FenceTypeId } from './data/fences';
import { fenceBlocker, fenceHp, fenceTypeAt } from './fences';
import type { Edge } from './grid';

export interface FenceGaps {
  /** The fenced rectangle the tap was in: tiles [x0, x1) × [y0, y1). */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** Edges with no fence at all. */
  missing: Edge[];
  /** Fences knocked down (by a storm or an animal) that need repairing. */
  broken: Edge[];
  /** Fence type to fill the gap with: the one most of the paddock already uses. */
  fence: FenceTypeId;
  /** Why the gap can't be closed (e.g. it runs over water), if it can't. */
  blocker: string | null;
}

/** How far to look for the fence line in each direction. */
const REACH = 30;
/** Rows or columns sampled either side of the tap on the first pass. */
const SPREAD = 3;

const mode = (xs: number[]): number | null => {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [x, n] of counts) if (n > bestN) [best, bestN] = [x, n];
  return best;
};

/**
 * A tile that "should" be in a paddock but isn't usually sits in a fenced
 * rectangle with a segment or two missing or broken. Finds that rectangle by
 * scanning out to the fence lines along several rows and columns (so a gap
 * on the tapped row doesn't fool it), then lists the holes in its perimeter.
 * Returns null when the tile isn't in anything that looks like a nearly-closed box.
 */
export function findFenceGaps(state: GameState, x: number, y: number): FenceGaps | null {
  const { width, height } = state.map;
  const fenced = (e: Edge) => fenceTypeAt(state, e) !== 0;
  const scan = (from: number, step: 1 | -1, edgeAt: (i: number) => Edge, limit: number): number | null => {
    for (let i = from, n = 0; n < REACH && i >= 0 && i <= limit; i += step, n++) if (fenced(edgeAt(i))) return i;
    return null;
  };
  const bounds = (rows: number[], cols: number[]) => {
    const found = (vals: (number | null)[]) => mode(vals.filter((v): v is number => v !== null));
    return {
      x0: found(rows.map((r) => scan(x, -1, (i) => ({ dir: 'v', x: i, y: r }), width))),
      x1: found(rows.map((r) => scan(x + 1, 1, (i) => ({ dir: 'v', x: i, y: r }), width))),
      y0: found(cols.map((c) => scan(y, -1, (i) => ({ dir: 'h', x: c, y: i }), height))),
      y1: found(cols.map((c) => scan(y + 1, 1, (i) => ({ dir: 'h', x: c, y: i }), height))),
    };
  };
  const around = (c: number, max: number) => Array.from({ length: SPREAD * 2 + 1 }, (_, k) => c - SPREAD + k).filter((v) => v >= 0 && v < max);
  let b = bounds(around(y, height), around(x, width));
  if (b.x0 === null || b.x1 === null || b.y0 === null || b.y1 === null) return null;
  // Second pass: sample every row and column inside the first guess.
  const range = (a: number, z: number) => Array.from({ length: z - a }, (_, k) => a + k);
  b = bounds(range(b.y0, b.y1), range(b.x0, b.x1));
  const { x0, x1, y0, y1 } = b;
  if (x0 === null || x1 === null || y0 === null || y1 === null) return null;
  if (x1 - x0 < 1 || y1 - y0 < 1 || x < x0 || x >= x1 || y < y0 || y >= y1) return null;

  const perimeter: Edge[] = [];
  for (let i = x0; i < x1; i++) perimeter.push({ dir: 'h', x: i, y: y0 }, { dir: 'h', x: i, y: y1 });
  for (let j = y0; j < y1; j++) perimeter.push({ dir: 'v', x: x0, y: j }, { dir: 'v', x: x1, y: j });
  const missing = perimeter.filter((e) => !fenced(e));
  const broken = perimeter.filter((e) => fenced(e) && fenceHp(state, e) <= 0);
  const holes = missing.length + broken.length;
  // Mostly fenced, with a few holes: that's a paddock with a gap. Otherwise it's just open ground.
  if (holes === 0 || holes > Math.max(3, Math.ceil(perimeter.length * 0.25))) return null;
  const fence = (mode(perimeter.map((e) => fenceTypeAt(state, e)).filter((t) => t !== 0)) ?? 1) as FenceTypeId;
  const blocker = missing.map((e) => fenceBlocker(state, e)).find((r) => r) ?? null;
  return { box: { x0, y0, x1, y1 }, missing, broken, fence, blocker };
}

export function gapCost(gaps: FenceGaps, repairCost: (e: Edge) => number): number {
  return gaps.missing.length * FENCE_TYPES[gaps.fence].cost + gaps.broken.reduce((s, e) => s + repairCost(e), 0);
}
