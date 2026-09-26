import type { GameState } from './GameState';
import { fenceAt } from './fences';
import { isLand } from './terrain';

/**
 * Tiles reachable in one step from tile index `i`: land neighbours not
 * separated by a fence. Dinosaurs never swim.
 */
export function walkableNeighbours(state: GameState, i: number): number[] {
  const { width, height, tiles } = state.map;
  const x = i % width;
  const y = (i - x) / width;
  const out: number[] = [];
  if (x + 1 < width && isLand(tiles[i + 1]) && !fenceAt(state, { dir: 'v', x: x + 1, y })) out.push(i + 1);
  if (x > 0 && isLand(tiles[i - 1]) && !fenceAt(state, { dir: 'v', x, y })) out.push(i - 1);
  if (y + 1 < height && isLand(tiles[i + width]) && !fenceAt(state, { dir: 'h', x, y: y + 1 })) out.push(i + width);
  if (y > 0 && isLand(tiles[i - width]) && !fenceAt(state, { dir: 'h', x, y })) out.push(i - width);
  return out;
}

export function canStep(state: GameState, from: number, to: number): boolean {
  return walkableNeighbours(state, from).includes(to);
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
): number[] | null {
  if (isGoal(start)) return [];
  const prev = new Map<number, number>([[start, -1]]);
  let frontier = [start];
  for (let d = 0; d < maxDist && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const n of walkableNeighbours(state, i)) {
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
