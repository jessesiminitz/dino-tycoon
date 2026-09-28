import type { GameState } from './GameState';
import { fenceAt } from './fences';
import { isGround } from './terrain';

export type CanEnter = (state: GameState, i: number) => boolean;

/** Dinosaurs and staff walk on any land (and over bridges); they never swim. */
export const onLand: CanEnter = (state, i) => isGround(state.map.tiles[i], state.paths[i] === 1);

/**
 * Tiles reachable in one step from tile index `i`: neighbours that `canEnter`
 * allows and that aren't separated by a fence.
 */
export function walkableNeighbours(state: GameState, i: number, canEnter: CanEnter = onLand): number[] {
  const { width, height } = state.map;
  const x = i % width;
  const y = (i - x) / width;
  const out: number[] = [];
  if (x + 1 < width && canEnter(state, i + 1) && !fenceAt(state, { dir: 'v', x: x + 1, y })) out.push(i + 1);
  if (x > 0 && canEnter(state, i - 1) && !fenceAt(state, { dir: 'v', x, y })) out.push(i - 1);
  if (y + 1 < height && canEnter(state, i + width) && !fenceAt(state, { dir: 'h', x, y: y + 1 })) out.push(i + width);
  if (y > 0 && canEnter(state, i - width) && !fenceAt(state, { dir: 'h', x, y })) out.push(i - width);
  return out;
}

export function canStep(state: GameState, from: number, to: number, canEnter: CanEnter = onLand): boolean {
  return walkableNeighbours(state, from, canEnter).includes(to);
}

/**
 * Breadth-first search from `start` to the nearest tile satisfying `isGoal`,
 * up to `maxDist` steps. Returns the route (excluding start), or null.
 */
export function findPath(
  state: GameState,
  start: number,
  isGoal: (i: number) => boolean,
  maxDist = Infinity,
  canEnter: CanEnter = onLand,
): number[] | null {
  if (isGoal(start)) return [];
  const prev = new Map<number, number>([[start, -1]]);
  let frontier = [start];
  for (let d = 0; d < maxDist && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const n of walkableNeighbours(state, i, canEnter)) {
        if (prev.has(n)) continue;
        prev.set(n, i);
        if (isGoal(n)) {
          const path = [n];
          for (let p = i; p !== start; p = prev.get(p)!) path.push(p);
          return path.reverse();
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}
