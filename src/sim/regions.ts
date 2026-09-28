import type { GameState } from './GameState';
import { FENCE_TYPES, NET, type FenceTypeId } from './data/fences';
import { fenceAt } from './fences';
import { isTileOwned } from './land';
import { isGround, isLand, Terrain } from './terrain';

export type RegionKind = 'public' | 'paddock' | 'wild';

export interface Region {
  id: number;
  kind: RegionKind;
  /** Tile indices (y * width + x). */
  tiles: number[];
  /** Weakest fence type on the boundary, or 0 if bounded only by water/map edge. */
  weakestFence: FenceTypeId | 0;
  /** Fenced all round with aviary net and no open water: flying reptiles can live here. */
  covered: boolean;
}

export interface RegionMap {
  regions: Region[];
  /** Region id per tile, -1 for water (except a pond inside a paddock, which is part of it: a lagoon). */
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
  /** Water tiles touching each region, to tell open water from its own pond. */
  const waterEdges: Set<number>[] = [];

  for (let start = 0; start < tiles.length; start++) {
    if (tileRegion[start] !== -1 || !isGround(tiles[start], state.paths[start] === 1)) continue;

    const id = regions.length;
    const members: number[] = [];
    let allOwned = true;
    let hasGate = false;
    let weakest: FenceTypeId | 0 = 0;
    let allNet = true;
    const water = new Set<number>();
    const noteFence = (f: FenceTypeId | 0) => {
      if (f === 0) return;
      if (weakest === 0 || FENCE_TYPES[f].strength < FENCE_TYPES[weakest].strength) weakest = f;
      if (f !== NET) allNet = false;
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
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          allNet = false; // the map edge is open sky
          continue;
        }
        const n = ny * width + nx;
        // Water edges a region, unless a bridge crosses it.
        if (!isGround(tiles[n], state.paths[n] === 1)) {
          water.add(n);
          continue;
        }
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
    regions.push({ id, kind, tiles: members, weakestFence: weakest, covered: kind === 'paddock' && allNet && weakest !== 0 });
    waterEdges.push(water);
  }

  // A pond whose shore is all one paddock belongs to it: that paddock is a lagoon.
  const pondOwner = new Int32Array(width * height).fill(-1);
  for (let start = 0; start < tiles.length; start++) {
    if (tiles[start] !== Terrain.Pond || pondOwner[start] !== -1) continue;
    const body: number[] = [];
    const shore = new Set<number>();
    stack.push(start);
    pondOwner[start] = -2; // visiting
    while (stack.length > 0) {
      const i = stack.pop()!;
      body.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          shore.add(-1);
          continue;
        }
        const n = ny * width + nx;
        if (tiles[n] === Terrain.Pond) {
          if (pondOwner[n] === -1) {
            pondOwner[n] = -2;
            stack.push(n);
          }
        } else shore.add(isLand(tiles[n]) ? tileRegion[n] : -1);
      }
    }
    const [owner] = shore;
    const enclosed = shore.size === 1 && owner >= 0 && regions[owner].kind === 'paddock';
    for (const i of body) {
      pondOwner[i] = enclosed ? owner : -3;
      if (!enclosed) continue;
      tileRegion[i] = owner;
      regions[owner].tiles.push(i);
    }
  }
  // An aviary can't have open water at its edge (birds, and pterosaurs, fly off over it).
  for (const r of regions) {
    if (r.covered && [...waterEdges[r.id]].some((i) => tileRegion[i] !== r.id)) r.covered = false;
  }

  return { regions, tileRegion };
}

/**
 * True if tile `i` is in a paddock that holds animals or feeders. Land sealed
 * off by fences and water (say a strip of beach below a paddock) is technically
 * enclosed too, but until something lives there it's just ground: paths and
 * buildings may go on it.
 */
export function isOccupiedPaddock(state: GameState, map: RegionMap, i: number): boolean {
  const id = map.tileRegion[i];
  if (map.regions[id]?.kind !== 'paddock') return false;
  const w = state.map.width;
  return (
    state.dinos.some((d) => map.tileRegion[d.y * w + d.x] === id) ||
    state.feeders.some((f) => map.tileRegion[f.y * w + f.x] === id)
  );
}

/** True if the region containing tile `i` has any footpath in it. */
export function regionHasPaths(state: GameState, map: RegionMap, i: number): boolean {
  const id = map.tileRegion[i];
  return id >= 0 && state.paths.some((p, j) => p === 1 && map.tileRegion[j] === id);
}
