import type { GameState } from './GameState';
import { isLand, isSea, Terrain, terrainAt, type TerrainMap } from './terrain';

/** Land is bought in square parcels of PARCEL × PARCEL tiles. */
export const PARCEL = 8;
export const LAND_PRICE_PER_TILE = 40;

export interface Point {
  x: number;
  y: number;
}

export function parcelGrid(map: TerrainMap): { cols: number; rows: number } {
  return { cols: Math.ceil(map.width / PARCEL), rows: Math.ceil(map.height / PARCEL) };
}

export function parcelOf(x: number, y: number): Point {
  return { x: Math.floor(x / PARCEL), y: Math.floor(y / PARCEL) };
}

export function isParcelOwned(state: GameState, px: number, py: number): boolean {
  const { cols, rows } = parcelGrid(state.map);
  if (px < 0 || py < 0 || px >= cols || py >= rows) return false;
  return state.parcelsOwned[py * cols + px];
}

export function isTileOwned(state: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return false;
  return isParcelOwned(state, Math.floor(x / PARCEL), Math.floor(y / PARCEL));
}

export function parcelLandTiles(map: TerrainMap, px: number, py: number): number {
  let n = 0;
  for (let y = py * PARCEL; y < Math.min((py + 1) * PARCEL, map.height); y++)
    for (let x = px * PARCEL; x < Math.min((px + 1) * PARCEL, map.width); x++)
      if (isLand(map.tiles[y * map.width + x])) n++;
  return n;
}

export function parcelPrice(map: TerrainMap, px: number, py: number): number {
  return parcelLandTiles(map, px, py) * LAND_PRICE_PER_TILE;
}

/** A parcel can be bought if it has land, isn't owned, and touches an owned parcel. */
export function parcelBuyBlocker(state: GameState, px: number, py: number): string | null {
  const { cols, rows } = parcelGrid(state.map);
  if (px < 0 || py < 0 || px >= cols || py >= rows) return 'Off the map';
  if (isParcelOwned(state, px, py)) return 'You already own this land';
  if (parcelLandTiles(state.map, px, py) === 0) return 'Nothing here but water';
  const adjacent =
    isParcelOwned(state, px - 1, py) ||
    isParcelOwned(state, px + 1, py) ||
    isParcelOwned(state, px, py - 1) ||
    isParcelOwned(state, px, py + 1);
  if (!adjacent) return 'Must border land you already own';
  return null;
}

/**
 * The park gate goes on the southernmost beach tile that touches water (where the
 * visitor ferry docks), preferring tiles near the horizontal centre.
 */
export function findEntrance(map: TerrainMap): Point {
  const cx = map.width / 2;
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (terrainAt(map, x, y) !== Terrain.Sand) continue;
      const touchesWater = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const t = terrainAt(map, x + dx, y + dy);
        return t !== undefined && isSea(t);
      });
      if (!touchesWater) continue;
      const score = y * 4 - Math.abs(x - cx);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  // Generated islands always have a beach; fall back to the centre just in case.
  return best ?? { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
}

/** Starting land: a 3 × 2 block of parcels around and above the entrance. */
export function initialParcels(map: TerrainMap, entrance: Point): boolean[] {
  const { cols, rows } = parcelGrid(map);
  const owned = new Array<boolean>(cols * rows).fill(false);
  const e = parcelOf(entrance.x, entrance.y);
  for (let py = e.y - 1; py <= e.y; py++)
    for (let px = e.x - 1; px <= e.x + 1; px++)
      if (px >= 0 && py >= 0 && px < cols && py < rows) owned[py * cols + px] = true;
  return owned;
}
