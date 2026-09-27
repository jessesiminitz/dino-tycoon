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
}

export const TERRAIN_COUNT = 9;

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
};

/** Ground you can walk and build on. Mountains, the volcano and water are not. */
export function isLand(t: Terrain): boolean {
  return t === Terrain.Sand || t === Terrain.Grass || t === Terrain.Forest || t === Terrain.Rock;
}

export function isWater(t: Terrain): boolean {
  return t === Terrain.DeepWater || t === Terrain.Shallows || t === Terrain.Pond;
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
}

export function terrainAt(map: TerrainMap, x: number, y: number): Terrain | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.tiles[y * map.width + x];
}

/** Smooth value noise in [0, 1) at a given cell size. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
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

function fractal(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, 16, seed) * 0.55 +
    valueNoise(x, y, 8, seed + 1) * 0.3 +
    valueNoise(x, y, 4, seed + 2) * 0.15
  );
}

/**
 * Generates an island: noise-based elevation with a radial falloff so the
 * edges are always ocean, a separate moisture noise for forests, mountains on
 * the high ground with a volcano on the highest peak, and a few inland ponds.
 */
export function generateIsland(width: number, height: number, seed: number): TerrainMap {
  const tiles: Terrain[] = new Array(width * height);
  const elevations: number[] = new Array(width * height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = 1 - Math.min(1, dist) ** 2.2;
      // Taper to zero near the border so the map edge is always open ocean.
      const raw = fractal(x, y, seed) * 0.6 + falloff * 0.7 - 0.35;
      const elevation = Math.max(0, raw) * Math.min(1, falloff * 4);
      const moisture = fractal(x + 1000, y + 1000, seed + 7);
      const pond = valueNoise(x + 500, y + 2000, 5, seed + 13);
      elevations[y * width + x] = elevation;

      let t: Terrain;
      if (elevation < 0.08) t = Terrain.DeepWater;
      else if (elevation < 0.17) t = Terrain.Shallows;
      else if (elevation < 0.22) t = Terrain.Sand;
      else if (pond > 0.9 && elevation > 0.3 && elevation < 0.6) t = Terrain.Pond;
      else if (moisture > 0.64) t = Terrain.Forest;
      else t = Terrain.Grass;

      tiles[y * width + x] = t;
    }
  }

  // Relative heights, so every island gets a range: the highest few percent of
  // the land becomes mountains, ringed by rocky ground.
  const land = elevations.filter((_, i) => isLand(tiles[i])).sort((a, b) => a - b);
  const mountainCut = land[Math.floor(land.length * 0.96)] ?? Infinity;
  const rockCut = land[Math.floor(land.length * 0.9)] ?? Infinity;
  for (let i = 0; i < tiles.length; i++) {
    if (!isLand(tiles[i]) || tiles[i] === Terrain.Sand) continue;
    if (elevations[i] >= mountainCut) tiles[i] = Terrain.Mountain;
    else if (elevations[i] >= rockCut) tiles[i] = Terrain.Rock;
  }

  // The highest peak becomes a volcano (a 3×3 cone).
  let peak = -1;
  for (let i = 0; i < tiles.length; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) continue;
    if (tiles[i] === Terrain.Mountain && (peak < 0 || elevations[i] > elevations[peak])) peak = i;
  }
  let volcano: TerrainMap['volcano'];
  if (peak >= 0) {
    volcano = { x: peak % width, y: Math.floor(peak / width) };
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) tiles[(volcano.y + dy) * width + volcano.x + dx] = Terrain.Volcano;
  }
  return { width, height, tiles, volcano };
}
