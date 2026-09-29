import { hash2 } from './rng';

// Values are saved in park files: only ever append new ones.
export enum Terrain {
  DeepWater = 0,
  Shallows = 1,
  Sand = 2,
  Grass = 3,
  Forest = 4,
  Rock = 5,
  Mountain = 6,
  Volcano = 7,
  Pond = 8,
  /** Fresh water flowing to the sea. A path across it is a bridge. */
  River = 9,
  /** Soggy ground: walkable, but too wet to build on until drained. */
  Marsh = 10,
  /** Old cooled lava near the volcano: bare but solid. */
  LavaRock = 11,
  /** A steaming pool that visitors love to look at. */
  HotSpring = 12,
  /** The rock face at the edge of high ground. Nothing crosses it. */
  Cliff = 13,
  /** A river dropping over a cliff. */
  Waterfall = 14,
  /** Fresh, glowing lava from an eruption. Nothing crosses it; it cools into lava rock. */
  Lava = 15,
}

export const TERRAIN_COUNT = 16;

export const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.DeepWater]: 'Deep water',
  [Terrain.Shallows]: 'Shallows',
  [Terrain.Sand]: 'Beach',
  [Terrain.Grass]: 'Grassland',
  [Terrain.Forest]: 'Forest',
  [Terrain.Rock]: 'Rocky ground',
  [Terrain.Mountain]: 'Mountain',
  [Terrain.Volcano]: 'Volcano',
  [Terrain.Pond]: 'Pond',
  [Terrain.River]: 'River',
  [Terrain.Marsh]: 'Marsh',
  [Terrain.LavaRock]: 'Lava rock',
  [Terrain.HotSpring]: 'Hot spring',
  [Terrain.Cliff]: 'Cliff',
  [Terrain.Waterfall]: 'Waterfall',
  [Terrain.Lava]: 'Hot lava',
};

/** Ground you can walk on (and fence). Mountains, cliffs, the volcano and water are not. */
export function isLand(t: Terrain): boolean {
  return (
    t === Terrain.Sand ||
    t === Terrain.Grass ||
    t === Terrain.Forest ||
    t === Terrain.Rock ||
    t === Terrain.Marsh ||
    t === Terrain.LavaRock
  );
}

/** Land firm enough for buildings, feeders and garden items (marsh must be drained first). */
export function isBuildable(t: Terrain): boolean {
  return isLand(t) && t !== Terrain.Marsh;
}

/** Walkable: land, or a river with a path across it (a bridge). */
export function isGround(t: Terrain, hasPath: boolean): boolean {
  return isLand(t) || (t === Terrain.River && hasPath);
}

export function isWater(t: Terrain): boolean {
  return (
    t === Terrain.DeepWater ||
    t === Terrain.Shallows ||
    t === Terrain.Pond ||
    t === Terrain.River ||
    t === Terrain.HotSpring ||
    t === Terrain.Waterfall
  );
}

export function isSea(t: Terrain): boolean {
  return t === Terrain.DeepWater || t === Terrain.Shallows;
}

export interface TerrainMap {
  width: number;
  height: number;
  /** Row-major, length width * height. */
  tiles: Terrain[];
  /** Crater tile of the island's volcano, if it has one. */
  volcano?: { x: number; y: number };
  /** Ground height per tile, 0 (sea bed) to 15 (peaks): which way water and lava run. */
  heights: number[];
  /** The kind of island this is (see island.ts). */
  shape: string;
}

export function terrainAt(map: TerrainMap, x: number, y: number): Terrain | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.tiles[y * map.width + x];
}

/** Smooth value noise in [0, 1) at a given cell size. */
export function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fractal(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, 16, seed) * 0.55 +
    valueNoise(x, y, 8, seed + 1) * 0.3 +
    valueNoise(x, y, 4, seed + 2) * 0.15
  );
}

/** Rough heights for maps saved before heights were kept. */
export const DEFAULT_HEIGHT: Record<Terrain, number> = {
  [Terrain.DeepWater]: 0,
  [Terrain.Shallows]: 2,
  [Terrain.Sand]: 3,
  [Terrain.Grass]: 5,
  [Terrain.Forest]: 6,
  [Terrain.Rock]: 9,
  [Terrain.Mountain]: 12,
  [Terrain.Volcano]: 15,
  [Terrain.Pond]: 4,
  [Terrain.River]: 4,
  [Terrain.Marsh]: 3,
  [Terrain.LavaRock]: 8,
  [Terrain.HotSpring]: 8,
  [Terrain.Cliff]: 9,
  [Terrain.Waterfall]: 8,
  [Terrain.Lava]: 8,
};
