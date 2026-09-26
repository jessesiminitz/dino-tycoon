import { hEdgeCount, vEdgeCount } from './grid';
import { findEntrance, initialParcels, type Point } from './land';
import { generateIsland, type TerrainMap } from './terrain';

export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 48;
export const STARTING_MONEY = 50_000;
export const START_HOUR = 8;
export const SAVE_VERSION = 2;

/** Single serializable state tree. Everything the game needs to resume lives here. */
export interface GameState {
  version: typeof SAVE_VERSION;
  seed: number;
  rngState: number;
  /** Total game-hours elapsed since the park opened. */
  hours: number;
  money: number;
  map: TerrainMap;
  /** Park gate, where visitors arrive. */
  entrance: Point;
  /** Row-major over the parcel grid (see land.ts). */
  parcelsOwned: boolean[];
  /** Fence type per edge (0 = none); indexed as in grid.ts. */
  hFences: number[];
  vFences: number[];
}

export function newGame(seed: number): GameState {
  const map = generateIsland(MAP_WIDTH, MAP_HEIGHT, seed);
  const entrance = findEntrance(map);
  return {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    hours: 0,
    money: STARTING_MONEY,
    map,
    entrance,
    parcelsOwned: initialParcels(map, entrance),
    hFences: new Array<number>(hEdgeCount(map)).fill(0),
    vFences: new Array<number>(vEdgeCount(map)).fill(0),
  };
}

export function calendar(state: GameState): { day: number; hour: number } {
  const total = state.hours + START_HOUR;
  return { day: Math.floor(total / 24) + 1, hour: total % 24 };
}
