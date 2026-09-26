import type { GameState } from './GameState';
import type { FenceTypeId } from './data/fences';
import { fenceAt } from './fences';
import { isTileOwned } from './land';
import { isLand } from './terrain';

export type RegionKind = 'public' | 'paddock' | 'wild';

export interface Region {
  id: number;
  kind: RegionKind;
  /** Tile indices (y * width + x). */
  tiles: number[];
  /** Weakest fence type on the boundary, or 0 if bounded only by water/map edge. */
  weakestFence: FenceTypeId | 0;
}

export interface RegionMap {
  regions: Region[];
  /** Region id per tile, -1 for water. */
  tileRegion: Int32Array;
}

/**
 * Splits the land into connected areas that walkers can move between without
 * crossing a fence or water.
 *  - 'public'  contains the park gate: the visitor grounds.
 *  - 'paddock' lies entirely on land you own and is closed off from the gate.
 *  - 'wild'    touches land you don't own, so it isn't enclosed.
 */
export function computeRegions(state: GameState): RegionMap {
  const { width, height, tiles } = state.map;
  const tileRegion = new Int32Array(width * height).fill(-1);
  const regions: Region[] = [];
  const stack: number[] = [];

  for (let start = 0; start < tiles.length; start++) {
    if (tileRegion[start] !== -1 || !isLand(tiles[start])) continue;

    const id = regions.length;
    const members: number[] = [];
    let allOwned = true;
    let hasGate = false;
    let weakest: FenceTypeId | 0 = 0;
    const noteFence = (f: FenceTypeId | 0) => {
      if (f !== 0 && (weakest === 0 || f < weakest)) weakest = f;
    };

    tileRegion[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % width;
      const y = (i - x) / width;
      if (!isTileOwned(state, x, y)) allOwned = false;
      if (x === state.entrance.x && y === state.entrance.y) hasGate = true;

      // Each neighbour and the edge crossed to reach it.
      const steps: [number, number, 'h' | 'v', number, number][] = [
        [x + 1, y, 'v', x + 1, y],
        [x - 1, y, 'v', x, y],
        [x, y + 1, 'h', x, y + 1],
        [x, y - 1, 'h', x, y],
      ];
      for (const [nx, ny, dir, ex, ey] of steps) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!isLand(tiles[n])) continue;
        const fence = fenceAt(state, { dir, x: ex, y: ey });
        if (fence !== 0) {
          noteFence(fence);
          continue;
        }
        if (tileRegion[n] === -1) {
          tileRegion[n] = id;
          stack.push(n);
        }
      }
    }

    const kind: RegionKind = hasGate ? 'public' : allOwned ? 'paddock' : 'wild';
    regions.push({ id, kind, tiles: members, weakestFence: weakest });
  }

  return { regions, tileRegion };
}
