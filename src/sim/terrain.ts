import { hash2 } from './rng';

export enum Terrain {
  DeepWater = 0,
  Shallows = 1,
  Sand = 2,
  Grass = 3,
  Forest = 4,
  Rock = 5,
}

export const TERRAIN_COUNT = 6;

export const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.DeepWater]: 'Deep water',
  [Terrain.Shallows]: 'Shallows',
  [Terrain.Sand]: 'Beach',
  [Terrain.Grass]: 'Grassland',
  [Terrain.Forest]: 'Forest',
  [Terrain.Rock]: 'Rocky ground',
};

export function isLand(t: Terrain): boolean {
  return t >= Terrain.Sand;
}

export interface TerrainMap {
  width: number;
  height: number;
  /** Row-major, length width * height. */
  tiles: Terrain[];
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
 * edges are always ocean, plus a separate moisture noise for forests.
 */
export function generateIsland(width: number, height: number, seed: number): TerrainMap {
  const tiles: Terrain[] = new Array(width * height);
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

      let t: Terrain;
      if (elevation < 0.08) t = Terrain.DeepWater;
      else if (elevation < 0.17) t = Terrain.Shallows;
      else if (elevation < 0.22) t = Terrain.Sand;
      else if (elevation > 0.8) t = Terrain.Rock;
      else if (moisture > 0.64) t = Terrain.Forest;
      else t = Terrain.Grass;

      tiles[y * width + x] = t;
    }
  }
  return { width, height, tiles };
}
