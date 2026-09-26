import { generateIsland, type TerrainMap } from './terrain';

export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 48;
export const STARTING_MONEY = 50_000;
export const START_HOUR = 8;

/** Single serializable state tree. Everything the game needs to resume lives here. */
export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  /** Total game-hours elapsed since the park opened. */
  hours: number;
  money: number;
  map: TerrainMap;
}

export function newGame(seed: number): GameState {
  return {
    version: 1,
    seed,
    rngState: seed,
    hours: 0,
    money: STARTING_MONEY,
    map: generateIsland(MAP_WIDTH, MAP_HEIGHT, seed),
  };
}

export function calendar(state: GameState): { day: number; hour: number } {
  const total = state.hours + START_HOUR;
  return { day: Math.floor(total / 24) + 1, hour: total % 24 };
}
