import { Rng } from './rng';
import { isLand, Terrain, type TerrainMap } from './terrain';

export interface FossilBed {
  x: number;
  y: number;
  /** Tiles (Chebyshev) from the centre that count as the bed. */
  radius: number;
  /** 1 ordinary, 2 good (rocky ground), 3 rich (near the volcano: rare species more likely). */
  richness: 1 | 2 | 3;
}

const BEDS = 5;
const BED_RADIUS = 2;
const MIN_SPACING = 9;
const MIN_FROM_GATE = 6;
const RICH_NEAR_VOLCANO = 9;

export const RICHNESS_LABEL = { 1: 'ordinary', 2: 'good', 3: 'rich' } as const;

/**
 * Scatters a few fossil beds over the island: one inside the starting land
 * (so digging can begin early) and the rest wherever, usually on land you'd
 * have to buy. Deterministic for a seed.
 */
export function generateFossilBeds(
  map: TerrainMap,
  seed: number,
  gate: { x: number; y: number },
  inStartArea: (x: number, y: number) => boolean,
): FossilBed[] {
  const rng = new Rng((seed ^ 0x5eed) >>> 0);
  const { width, height, tiles } = map;
  const candidates: { x: number; y: number }[] = [];
  for (let y = BED_RADIUS; y < height - BED_RADIUS; y++)
    for (let x = BED_RADIUS; x < width - BED_RADIUS; x++) {
      if (!isLand(tiles[y * width + x]) || tiles[y * width + x] === Terrain.Sand) continue;
      if (Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y)) < MIN_FROM_GATE) continue;
      candidates.push({ x, y });
    }
  const beds: FossilBed[] = [];
  const pick = (pool: { x: number; y: number }[]) => {
    const ok = pool.filter((c) => beds.every((b) => Math.max(Math.abs(b.x - c.x), Math.abs(b.y - c.y)) >= MIN_SPACING));
    if (ok.length === 0) return;
    const c = ok[rng.int(0, ok.length - 1)];
    const v = map.volcano;
    const richness: FossilBed['richness'] =
      v && Math.max(Math.abs(v.x - c.x), Math.abs(v.y - c.y)) <= RICH_NEAR_VOLCANO
        ? 3
        : tiles[c.y * width + c.x] === Terrain.Rock
          ? 2
          : 1;
    beds.push({ x: c.x, y: c.y, radius: BED_RADIUS, richness });
  };
  pick(candidates.filter((c) => inStartArea(c.x, c.y)));
  // Make sure there's a rich bed near the volcano to aim for.
  if (map.volcano) {
    const v = map.volcano;
    pick(candidates.filter((c) => Math.max(Math.abs(v.x - c.x), Math.abs(v.y - c.y)) <= RICH_NEAR_VOLCANO));
  }
  while (beds.length < BEDS) {
    const before = beds.length;
    pick(candidates);
    if (beds.length === before) break;
  }
  return beds;
}

export function bedAt(beds: FossilBed[], x: number, y: number): FossilBed | undefined {
  return beds.find((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= b.radius);
}
