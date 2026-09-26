import { hEdgeCount, vEdgeCount } from './grid';
import { findEntrance, initialParcels, type Point } from './land';
import { generateIsland, type TerrainMap } from './terrain';
import { STARTER_SPECIES, type SpeciesId } from './data/species';
import type { FeederKind } from './data/feeders';
import { DEFAULT_TICKET_PRICE, type BuildingKind } from './data/economy';
import { newFinance, type Finance } from './finance';

export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 48;
export const STARTING_MONEY = 50_000;
export const START_HOUR = 8;
export const SAVE_VERSION = 4;

export interface Dino {
  id: number;
  species: SpeciesId;
  name: string;
  /** Current tile. */
  x: number;
  y: number;
  /** Tile at the previous movement step, for smooth rendering. */
  px: number;
  py: number;
  /** Remaining route as tile indices (next step first). */
  path: number[];
  /** 0 = full … 100 = starving. */
  hunger: number;
  health: number;
  happiness: number;
  /** Game-hour the dino arrived. */
  bornHour: number;
}

export interface Feeder {
  id: number;
  kind: FeederKind;
  x: number;
  y: number;
  stock: number;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
}

export interface Visitor {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Tile index walked from, so wandering doesn't double back. */
  from: number;
  path: number[];
  hunger: number;
  /** 0–100; on leaving, above 50 raises the park's reputation, below lowers it. */
  satisfaction: number;
  /** Dino ids already seen, each worth a satisfaction boost once. */
  seen: number[];
  leaveHour: number;
  boughtSouvenir: boolean;
  /** Sprite variant. */
  look: number;
}

/** Single serializable state tree. Everything the game needs to resume lives here. */
export interface GameState {
  version: typeof SAVE_VERSION;
  seed: number;
  rngState: number;
  /** Total game-hours elapsed since the park opened. */
  hours: number;
  /** Movement steps elapsed within the current hour. */
  stepInHour: number;
  money: number;
  map: TerrainMap;
  /** Park gate, where visitors arrive. */
  entrance: Point;
  /** Row-major over the parcel grid (see land.ts). */
  parcelsOwned: boolean[];
  /** Fence type per edge (0 = none); indexed as in grid.ts. */
  hFences: number[];
  vFences: number[];
  dinos: Dino[];
  feeders: Feeder[];
  unlockedSpecies: SpeciesId[];
  /** 1 where a tile has a footpath. */
  paths: number[];
  buildings: Building[];
  visitors: Visitor[];
  ticketPrice: number;
  /** 0–100: a running average of how satisfied departing visitors were. */
  reputation: number;
  finance: Finance;
  /** Next id for dinos, feeders and other entities. */
  nextId: number;
}

export function newGame(seed: number): GameState {
  const map = generateIsland(MAP_WIDTH, MAP_HEIGHT, seed);
  const entrance = findEntrance(map);
  return {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    hours: 0,
    stepInHour: 0,
    money: STARTING_MONEY,
    map,
    entrance,
    parcelsOwned: initialParcels(map, entrance),
    hFences: new Array<number>(hEdgeCount(map)).fill(0),
    vFences: new Array<number>(vEdgeCount(map)).fill(0),
    dinos: [],
    feeders: [],
    unlockedSpecies: [...STARTER_SPECIES],
    paths: new Array<number>(map.width * map.height).fill(0),
    buildings: [],
    visitors: [],
    ticketPrice: DEFAULT_TICKET_PRICE,
    reputation: 50,
    finance: newFinance(),
    nextId: 1,
  };
}

/** Upgrades older saves in place. Returns null for saves too old to carry over. */
export function migrate(raw: { version?: number } & Record<string, unknown>): GameState | null {
  if (raw.version === 2) {
    Object.assign(raw, {
      version: 3,
      stepInHour: 0,
      dinos: [],
      feeders: [],
      unlockedSpecies: [...STARTER_SPECIES],
      nextId: 1,
    });
  }
  if (raw.version === 3) {
    const map = raw.map as TerrainMap;
    Object.assign(raw, {
      version: 4,
      paths: new Array<number>(map.width * map.height).fill(0),
      buildings: [],
      visitors: [],
      ticketPrice: DEFAULT_TICKET_PRICE,
      reputation: 50,
      finance: newFinance(),
    });
  }
  return raw.version === SAVE_VERSION ? (raw as unknown as GameState) : null;
}

export function calendar(state: GameState): { day: number; hour: number } {
  const total = state.hours + START_HOUR;
  return { day: Math.floor(total / 24) + 1, hour: total % 24 };
}
