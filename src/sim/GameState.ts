import { hEdgeCount, vEdgeCount } from './grid';
import { findEntrance, initialParcels, type Point } from './land';
import { DEFAULT_HEIGHT, type TerrainMap } from './terrain';
import { generateIsland, type IslandShape } from './island';
import { STARTER_SPECIES, type SpeciesId } from './data/species';
import type { FeederKind } from './data/feeders';
import { DEFAULT_TICKET_PRICE, type BuildingKind, type ItemKind } from './data/economy';
import { newFinance, normalizeFinance, type Finance } from './finance';
import type { StaffRole } from './data/staff';
import { SCENARIOS, type ScenarioId } from './data/scenarios';
import type { DecorKind } from './data/decor';
import { generateFossilBeds, type FossilBed } from './fossilBeds';
import { isParcelOwned, PARCEL } from './land';
import { visitorName, type Topic } from './data/thoughts';
import { hash2 } from './rng';

export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 48;
/** Big islands, for challenges and a roomier Sandbox. */
export const BIG_MAP_WIDTH = 96;
export const BIG_MAP_HEIGHT = 72;
export const STARTING_MONEY = 50_000;
export const START_HOUR = 8;
export const SAVE_VERSION = 18;

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
  sick: boolean;
  /** Out of its paddock (a fence broke). */
  escaped: boolean;
  /** Last tile it stood on inside a paddock; guards bring it back here. */
  homeX: number;
  homeY: number;
  /** Hatched in the park and not yet grown up (see systems/breeding.ts). */
  baby: boolean;
  /** Game-hours of the last treat and the last pat that cheered it up (see systems/care.ts). */
  lastTreatHour: number;
  lastPatHour: number;
}

export type RequestKind = 'see' | 'food' | 'visitors' | 'review' | 'photo' | 'treats' | 'clean' | 'feeders';

/** A short goal from someone visiting the park (see systems/requests.ts). */
export interface ParkRequest {
  id: number;
  kind: RequestKind;
  icon: string;
  text: string;
  /** How much is needed (visitors, treats, places to eat...). */
  target: number;
  progress: number;
  species?: SpeciesId;
  /** For photo requests: any baby will do. */
  baby?: boolean;
  /** For review requests: the star rating needed. */
  stars?: number;
  createdHour: number;
  expiresHour: number;
  reward: { money: number; reputation: number };
  status: 'active' | 'done' | 'missed';
}

/** A decision waiting for the player (see systems/choices.ts). */
export interface PendingChoice {
  eventId: string;
  createdHour: number;
  /** Past this game-hour the default answer is taken. */
  expiresHour: number;
  /** Whatever the event is about: an animal, a species, a name, an amount. */
  dinoId?: number;
  species?: SpeciesId;
  name?: string;
  amount?: number;
}

/** Long ago: never treated or patted. */
export const NEVER = -1_000_000;

/** An egg laid by a happy pair; it hatches where it lies. */
export interface Egg {
  id: number;
  species: SpeciesId;
  x: number;
  y: number;
  laidHour: number;
}

export type StaffTask =
  | { kind: 'refill'; feederId: number }
  | { kind: 'repair'; dir: 'h' | 'v'; x: number; y: number }
  | { kind: 'recapture'; dinoId: number }
  | { kind: 'treat'; dinoId: number }
  | { kind: 'clean'; messId: number };

export interface Staff {
  id: number;
  role: StaffRole;
  name: string;
  /** Position in tiles (fractional while travelling). */
  x: number;
  y: number;
  px: number;
  py: number;
  task: StaffTask | null;
  /** Steps of work done on site for the current task. */
  progress: number;
  /** Tour guides walk the paths like visitors. */
  from: number;
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
  /** Souvenirs bought, shown on the sprite. */
  items: ItemKind[];
  /** What they're eating, and until which game-hour. */
  snack: SnackKind | null;
  snackUntil: number;
  /** Carrying a soda until this game-hour. */
  sodaUntil: number;
  /** 0 = fine … 100 = parched. */
  thirst: number;
  name: string;
  /** Recent thoughts, oldest first. */
  thoughts: Thought[];
  /** Attractions already enjoyed this visit (each is done once). */
  rode: RideKind[];
  /** Aboard this safari jeep (hidden from the paths until it's back), or null. */
  riding: number | null;
  /** 0 = fine … 100 = desperate for a restroom. */
  bladder: number;
  kid: boolean;
  /** Sprite variant. */
  look: number;
}

export type SnackKind = 'icecream' | 'popcorn' | 'hotdog';

export type RideKind = 'jeep' | 'tower' | 'petting';

/** A safari jeep: waits at its station for riders, tours the track, brings them back. */
export interface Jeep {
  id: number;
  stationId: number;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Track tile driven from, so it doesn't turn round. */
  from: number;
  /** Riders and the path tile each got on at (where they're dropped off). */
  riders: { id: number; tile: number }[];
  /** Steps into the current tour (0 = parked at the station). */
  steps: number;
  /** Steps spent waiting at the station with someone aboard. */
  waiting: number;
  /** Route home at the end of a tour. */
  path: number[];
}

export interface Thought {
  hour: number;
  topic: Topic;
  good: boolean;
  text: string;
}

/** A departed visitor's verdict. */
export interface Review {
  hour: number;
  name: string;
  /** 1–5. */
  stars: number;
  text: string;
  topic: Topic | null;
  good: boolean;
}

/** Something on the ground to clean up: litter and accidents (janitors), dino droppings (workers). */
export interface Mess {
  id: number;
  kind: 'litter' | 'mess' | 'dung';
  x: number;
  y: number;
  hour: number;
}

export const MAX_REVIEWS = 60;

/** Whether a visitor's accident was a puddle of pee or a poop (fixed by its id; more often pee). */
export function accidentKind(id: number): 'pee' | 'poop' {
  return hash2(id, 7, 13) < 0.6 ? 'pee' : 'poop';
}

export interface Decor {
  id: number;
  kind: DecorKind;
  x: number;
  y: number;
}

export interface LogEntry {
  /** Game-hour it happened. */
  hour: number;
  text: string;
  kind: 'info' | 'good' | 'bad';
}

/** Park log entries kept in the save (oldest dropped first). */
export const MAX_LOG = 300;

export interface ScenarioState {
  id: ScenarioId;
  /** 'free' = no goals (sandbox); 'won' = all three rounds done; either way play carries on. */
  status: 'playing' | 'won' | 'lost' | 'free';
  /** Rounds of milestones completed so far (0–3), which is also the index of the current round. */
  round: number;
  /** Game day the current round began (its deadline counts from here). */
  roundStart: number;
  /** What each finished round actually paid out, in words. */
  earned: string[][];
}

export interface Stats {
  bestDayVisitors: number;
  escapes: number;
  inspectionsPassed: number;
  /** Last game day visitors complained about the lack of restrooms (at most once a day). */
  restroomComplaintDay: number;
  /** Babies hatched in this park. */
  hatched: number;
  /** Dino photos taken. */
  photos: number;
  /** Park requests completed. */
  requestsDone: number;
  /** Game day the gates were closed early (for a storm), or 0. */
  closedDay: number;
  /** Last game day the park was warned about accidents, and about litter. */
  messDay: number;
  litterDay: number;
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
  /** Fence condition per edge, 0–100 (0 with a fence type = broken). */
  hFenceHp: number[];
  vFenceHp: number[];
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
  staff: Staff[];
  /** Fossil fragments found so far, per locked species. */
  fossils: Partial<Record<SpeciesId, number>>;
  /** Hours of storm left (0 = clear skies). */
  stormHours: number;
  scenario: ScenarioState;
  stats: Stats;
  /** Current tutorial step, or null when there's no tutorial (or it's finished). */
  tutorialStep: number | null;
  fossilBeds: FossilBed[];
  /** Gardens: trees, flower beds, fountains and benches the player placed. */
  decor: Decor[];
  /** Hours the volcano stays visibly active after a rumble. */
  volcanoActivity: number;
  /** Every park alert, oldest first. */
  log: LogEntry[];
  /** Litter and accidents waiting for a janitor. */
  messes: Mess[];
  /** What departed visitors said, oldest first. */
  reviews: Review[];
  /** Eggs waiting to hatch. */
  eggs: Egg[];
  /** Today's park requests, plus recently finished ones. */
  requests: ParkRequest[];
  /** 1 where a tile has a safari jeep track. */
  tracks: number[];
  jeeps: Jeep[];
  /** A decision card waiting for an answer, or null. */
  pendingChoice: PendingChoice | null;
  /** Next id for dinos, feeders and other entities. */
  nextId: number;
}

export interface IslandOptions {
  shape?: IslandShape;
  big?: boolean;
}

export function newGame(seed: number, island: IslandOptions = {}): GameState {
  const map = generateIsland(island.big ? BIG_MAP_WIDTH : MAP_WIDTH, island.big ? BIG_MAP_HEIGHT : MAP_HEIGHT, seed, island.shape ?? 'classic');
  const entrance = findEntrance(map);
  const state: GameState = {
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
    hFenceHp: new Array<number>(hEdgeCount(map)).fill(0),
    vFenceHp: new Array<number>(vEdgeCount(map)).fill(0),
    dinos: [],
    feeders: [],
    unlockedSpecies: [...STARTER_SPECIES],
    paths: new Array<number>(map.width * map.height).fill(0),
    buildings: [],
    visitors: [],
    ticketPrice: DEFAULT_TICKET_PRICE,
    reputation: 50,
    finance: newFinance(),
    staff: [],
    fossils: {},
    stormHours: 0,
    scenario: { id: 'sandbox', status: 'free', round: 0, roundStart: 1, earned: [] },
    stats: { bestDayVisitors: 0, escapes: 0, inspectionsPassed: 0, restroomComplaintDay: 0, hatched: 0, photos: 0, requestsDone: 0, closedDay: 0, messDay: 0, litterDay: 0 },
    tutorialStep: null,
    fossilBeds: [],
    decor: [],
    volcanoActivity: 0,
    log: [],
    messes: [],
    reviews: [],
    eggs: [],
    requests: [],
    tracks: new Array<number>(map.width * map.height).fill(0),
    jeeps: [],
    pendingChoice: null,
    nextId: 1,
  };
  state.fossilBeds = bedsFor(state);
  return state;
}

/** Fossil beds for a park's island, one of them on its starting land. */
function bedsFor(state: GameState): FossilBed[] {
  return generateFossilBeds(state.map, state.seed, state.entrance, (x, y) =>
    isParcelOwned(state, Math.floor(x / PARCEL), Math.floor(y / PARCEL)),
  );
}

/** A fresh park set up for a scenario: its island, budget, unlocked species and tutorial. */
export function startScenario(id: ScenarioId, randomSeed: number, island: IslandOptions = {}): GameState {
  const sc = SCENARIOS[id];
  const state = newGame(sc.seed ?? randomSeed, { shape: sc.island, ...island });
  state.money = sc.startMoney;
  if (sc.unlocked) state.unlockedSpecies = [...sc.unlocked];
  state.scenario = { id, status: sc.rounds.length > 0 ? 'playing' : 'free', round: 0, roundStart: 1, earned: [] };
  state.tutorialStep = sc.tutorial ? 0 : null;
  return state;
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
  if (raw.version === 4) {
    const hFences = raw.hFences as number[];
    const vFences = raw.vFences as number[];
    for (const d of raw.dinos as Dino[]) {
      Object.assign(d, { sick: false, escaped: false, homeX: d.x, homeY: d.y });
    }
    Object.assign(raw, {
      version: 5,
      hFenceHp: hFences.map((f) => (f ? 100 : 0)),
      vFenceHp: vFences.map((f) => (f ? 100 : 0)),
      staff: [],
    });
    normalizeFinance(raw.finance as Finance);
  }
  if (raw.version === 5) {
    Object.assign(raw, { version: 6, fossils: {}, stormHours: 0 });
    normalizeFinance(raw.finance as Finance);
  }
  if (raw.version === 6) {
    Object.assign(raw, {
      version: 7,
      scenario: { id: 'sandbox', status: 'free' },
      stats: { bestDayVisitors: 0, escapes: 0, inspectionsPassed: 0 },
      tutorialStep: null,
    });
  }
  if (raw.version === 7) {
    for (const v of raw.visitors as (Visitor & { boughtSouvenir?: boolean })[]) {
      Object.assign(v, { items: v.boughtSouvenir ? ['plush'] : [], snackUntil: 0, bladder: 0, kid: false });
      delete v.boughtSouvenir;
    }
    (raw.stats as Stats).restroomComplaintDay = 0;
    raw.version = 8;
    normalizeFinance(raw.finance as Finance);
  }
  if (raw.version === 8) {
    const state = raw as unknown as GameState;
    state.decor = [];
    state.volcanoActivity = 0;
    state.fossilBeds = bedsFor(state);
    // Dig sites built before fossil beds existed keep working: each gets a small bed of its own.
    for (const b of state.buildings) {
      if (b.kind === 'digsite' && !state.fossilBeds.some((f) => Math.max(Math.abs(f.x - b.x), Math.abs(f.y - b.y)) <= f.radius)) {
        state.fossilBeds.push({ x: b.x, y: b.y, radius: 1, richness: 1 });
      }
    }
    raw.version = 9;
  }
  if (raw.version === 9) {
    Object.assign(raw, { version: 10, log: [] });
  }
  if (raw.version === 10) {
    const state = raw as unknown as GameState;
    for (const v of state.visitors) {
      Object.assign(v, {
        snack: v.snackUntil > state.hours ? 'icecream' : null,
        sodaUntil: 0,
        thirst: 0,
        name: visitorName(v.id, hash2(v.id, 3, 11)),
        thoughts: [],
      });
    }
    Object.assign(state.stats, { messDay: 0, litterDay: 0 });
    Object.assign(raw, { version: 11, messes: [], reviews: [] });
  }
  if (raw.version === 11) {
    // Scenarios gained Silver and Gold rounds: parks that already won carry on into Silver.
    const state = raw as unknown as GameState;
    const sc = state.scenario as ScenarioState;
    const won = sc.status === 'won';
    Object.assign(sc, { status: won ? 'playing' : sc.status, round: won ? 1 : 0, roundStart: won ? calendar(state).day : 1, earned: won ? [[]] : [] });
    raw.version = 12;
  }
  if (raw.version === 12) {
    const state = raw as unknown as GameState;
    for (const d of state.dinos) d.baby = false;
    state.eggs = [];
    state.stats.hatched = 0;
    raw.version = 13;
  }
  if (raw.version === 13) {
    const state = raw as unknown as GameState;
    for (const d of state.dinos) Object.assign(d, { lastTreatHour: NEVER, lastPatHour: NEVER });
    state.stats.photos = 0;
    raw.version = 14;
  }
  if (raw.version === 14) {
    const state = raw as unknown as GameState;
    state.requests = [];
    state.stats.requestsDone = 0;
    raw.version = 15;
  }
  if (raw.version === 15) {
    const state = raw as unknown as GameState;
    state.tracks = new Array<number>(state.map.width * state.map.height).fill(0);
    state.jeeps = [];
    for (const v of state.visitors) Object.assign(v, { rode: [], riding: null });
    raw.version = 16;
  }
  if (raw.version === 16) {
    const state = raw as unknown as GameState;
    state.pendingChoice = null;
    state.stats.closedDay = 0;
    raw.version = 17;
  }
  if (raw.version === 17) {
    // Islands now keep a height per tile and remember their shape.
    const map = (raw as unknown as GameState).map;
    map.heights = map.tiles.map((t) => DEFAULT_HEIGHT[t]);
    map.shape = 'classic';
    raw.version = 18;
  }
  return raw.version === SAVE_VERSION ? (raw as unknown as GameState) : null;
}

export function calendar(state: GameState): { day: number; hour: number } {
  const total = state.hours + START_HOUR;
  return { day: Math.floor(total / 24) + 1, hour: total % 24 };
}
