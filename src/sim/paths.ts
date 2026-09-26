import type { GameState } from './GameState';
import { isTileOwned } from './land';
import type { RegionMap } from './regions';
import { isLand } from './terrain';
import type { CanEnter } from './pathfind';

export function isPath(state: GameState, i: number): boolean {
  return state.paths[i] === 1;
}

/** Visitors walk on paths and the gate tile. */
export const onWalkway: CanEnter = (state, i) =>
  state.paths[i] === 1 || i === state.entrance.y * state.map.width + state.entrance.x;

/** Something already standing on a tile (feeder or building), if any. */
export function tileOccupant(state: GameState, x: number, y: number): string | null {
  if (state.feeders.some((f) => f.x === x && f.y === y)) return 'There is a feeder here';
  if (state.buildings.some((b) => b.x === x && b.y === y)) return 'There is a building here';
  return null;
}

/** Why a path can't go on this tile, or null if it can. */
export function pathBlocker(state: GameState, regions: RegionMap, x: number, y: number): string | null {
  const { width, height, tiles } = state.map;
  if (x < 0 || y < 0 || x >= width || y >= height) return 'Off the map';
  const i = y * width + x;
  if (!isLand(tiles[i])) return 'Paths need dry land';
  if (!isTileOwned(state, x, y)) return "You don't own this land";
  if (regions.regions[regions.tileRegion[i]]?.kind === 'paddock') return "Paths can't go inside paddocks";
  return tileOccupant(state, x, y);
}

/** True if any 4-neighbour of (x, y) is a walkway. */
export function touchesWalkway(state: GameState, x: number, y: number): boolean {
  const { width, height } = state.map;
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < width && ny < height && onWalkway(state, ny * width + nx);
  });
}
