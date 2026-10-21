import type { GameState } from './GameState';
import { START_HOUR } from './GameState';
import { FERRY_SIZES, FERRY_TYPES, PORT_LEVELS, STARTING_FERRIES, type FerrySize } from './data/port';
import { LAST_ENTRY_HOUR, OPEN_HOUR } from './data/economy';
import { isSea, terrainAt, type TerrainMap } from './terrain';
import type { Point } from './land';
import { STEPS_PER_HOUR } from './systems/dinos';

/** The ferry port: what the player has built and who is on the water this hour. */
export interface PortState {
  /** Index into PORT_LEVELS. */
  level: number;
  ferries: FerrySize[];
  /** Passengers still on board each ferry this hour (they land when it docks). */
  aboard: number[];
  /** Passengers each ferry carried this hour, for the landing animation. */
  loads: number[];
  /** Visitors who wanted to come today but found every ferry full. */
  turnedAway: number;
  /** The same for the last full day. */
  lastTurnedAway: number;
}

export function newPort(level = 0, ferries: FerrySize[] = STARTING_FERRIES): PortState {
  return { level, ferries: [...ferries], aboard: [], loads: [], turnedAway: 0, lastTurnedAway: 0 };
}

/** Visitors the ferries can bring each open hour. */
export function ferryCapacity(port: Pick<PortState, 'ferries'>): number {
  return port.ferries.reduce((sum, f) => sum + FERRY_TYPES[f].seats, 0);
}

export const fitsPort = (level: number, size: FerrySize) => FERRY_SIZES.indexOf(size) <= FERRY_SIZES.indexOf(PORT_LEVELS[level].biggest);

/** Daily running costs of the port and its ferries. */
export function portUpkeep(port: Pick<PortState, 'level' | 'ferries'>): number {
  return PORT_LEVELS[port.level].upkeep + port.ferries.reduce((sum, f) => sum + FERRY_TYPES[f].upkeep, 0);
}

// --- Timetable ------------------------------------------------------------

/** Movement steps from a ferry docking to its passengers reaching the gate. */
export const LANDING_STEPS = 3;

/** The step within the hour at which ferry `k` of `count` docks. Ferries are spaced evenly. */
export const dockStep = (k: number, count: number) => Math.floor((k * STEPS_PER_HOUR) / Math.max(1, count));

/** Hours a ferry spends sailing in, tied up, and sailing out. */
export const FERRY_IN = 0.3;
/** Tied up while passengers walk ashore (a function: STEPS_PER_HOUR comes through an import cycle). */
export const ferryDocked = () => (LANDING_STEPS + 1) / STEPS_PER_HOUR;
export const FERRY_OUT = 0.3;

export type FerryPose =
  | { mode: 'away' }
  /** t runs 0→1 over the trip in or out. */
  | { mode: 'arriving' | 'leaving'; t: number }
  /** t runs 0→1 while passengers walk ashore; overnight the first ferry stays moored (t = 1). */
  | { mode: 'docked'; t: number; passengers: number };

/**
 * Where ferry `k` is at a moment (`time` in game-hours, fractional). Ferries
 * run every open hour from OPEN_HOUR to LAST_ENTRY_HOUR, each docking at its
 * slot in the hour. The first ferry spends the night tied up at the port.
 */
export function ferryPose(state: Pick<GameState, 'port' | 'hours' | 'stats'>, k: number, time: number): FerryPose {
  const count = state.port.ferries.length;
  if (k >= count) return { mode: 'away' };
  const slot = dockStep(k, count) / STEPS_PER_HOUR;
  const FERRY_DOCKED = ferryDocked();
  const clock = time + START_HOUR;
  const dayStart = Math.floor(clock / 24) * 24;
  const closed = state.stats.closedDay === Math.floor(clock / 24) + 1;
  const ofDay = clock - dayStart;
  // The nearest timetabled docking (this hour's or the next hour's).
  for (const hour of [Math.floor(ofDay - slot), Math.floor(ofDay - slot) + 1]) {
    if (hour < OPEN_HOUR || hour > LAST_ENTRY_HOUR || closed) continue;
    const dt = ofDay - (hour + slot);
    if (k === 0 && hour === OPEN_HOUR && dt < 0) break; // still tied up from the night
    if (dt >= -FERRY_IN && dt < 0) return { mode: 'arriving', t: 1 + dt / FERRY_IN };
    if (dt >= 0 && dt < FERRY_DOCKED) {
      const current = Math.floor(time) === state.hours;
      return { mode: 'docked', t: dt / FERRY_DOCKED, passengers: current ? (state.port.loads[k] ?? 0) : 0 };
    }
    // The first ferry ties up for the night after the last run.
    if (k === 0 && hour === LAST_ENTRY_HOUR) return { mode: 'docked', t: 1, passengers: 0 };
    if (dt >= FERRY_DOCKED && dt < FERRY_DOCKED + FERRY_OUT) return { mode: 'leaving', t: (dt - FERRY_DOCKED) / FERRY_OUT };
  }
  if (k === 0 && (ofDay >= LAST_ENTRY_HOUR || ofDay < OPEN_HOUR || closed)) return { mode: 'docked', t: 1, passengers: 0 };
  return { mode: 'away' };
}

// --- Layout ---------------------------------------------------------------

/** Half-width (tiles) of the pier head at each port level: a jetty has none. */
const HEAD_HALF_WIDTH = [0, 4, 6];
/** Berth centres along the head (tiles from the pier), per level. */
const BERTHS = [[0], [-1.85, 1.85], [-3.75, 0, 3.75]];
const MIN_LENGTH = 2;
const MAX_LENGTH = 7;

export interface PortSite {
  /** Pier column (tile x) and the first and last pier rows. */
  x: number;
  y0: number;
  y1: number;
  /** Pier head span (tile x range, inclusive); equal to x for a jetty. */
  headX0: number;
  headX1: number;
  /** Where each berth's ferry ties up: world tile coordinates of the hull's waterline centre. */
  berths: Point[];
}

const seaAt = (map: TerrainMap, x: number, y: number) => {
  const t = terrainAt(map, x, y);
  return t === undefined || isSea(t);
};

/**
 * The port runs straight out to sea from the park gate (gates face the south
 * beach). It is long enough to clear the shallows, so the head and the ferry
 * berths beyond it are open water; it grows as the port is upgraded.
 */
export function portSite(map: TerrainMap, entrance: Point, level: number): PortSite {
  const x = entrance.x;
  const half = HEAD_HALF_WIDTH[level] ?? 0;
  const y0 = entrance.y + 1;
  // Beach between the gate and the water is crossed by boardwalk.
  let shore = y0;
  while (shore < map.height && !seaAt(map, x, shore)) shore++;
  let y1 = shore + MIN_LENGTH - 1;
  const clear = (row: number) => {
    for (let dx = -half - 2; dx <= half + 2; dx++) if (!seaAt(map, x + dx, row) || !seaAt(map, x + dx, row + 1) || !seaAt(map, x + dx, row + 2)) return false;
    return true;
  };
  while (y1 < shore + MAX_LENGTH - 1 && !clear(y1)) y1++;
  return {
    x,
    y0,
    y1,
    headX0: x - half,
    headX1: x + half,
    berths: (BERTHS[level] ?? BERTHS[0]).map((dx) => ({ x: x + 0.5 + dx, y: y1 + 1.55 })),
  };
}

/** Whether a tile is part of the port (for taps on the map). */
export function isPortTile(site: PortSite, tx: number, ty: number): boolean {
  if (tx === site.x && ty >= site.y0 && ty <= site.y1) return true;
  return ty === site.y1 && tx >= site.headX0 && tx <= site.headX1;
}
