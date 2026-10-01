import type { Building, GameState, Jeep, Visitor } from '../GameState';
import { BUILDING_TYPES } from '../data/economy';
import { SPECIES } from '../data/species';
import { earn } from '../finance';
import { findPath, walkableNeighbours, type CanEnter } from '../pathfind';
import type { SimContext } from './context';
import { perStep } from './dinos';
import { isFlooded } from './flood';

/** Seats in a jeep. */
export const JEEP_SEATS = 4;
/** A jeep with someone aboard sets off after this many steps even if not full. */
const DEPART_AFTER = 6;
/** Steps of touring before heading back (16 steps to a game-hour). */
const TOUR_STEPS = 32;
/** Riders see every animal this close to the jeep (Chebyshev). */
const JEEP_VIEW = 5;
/** Seeing an animal from the jeep, up close, thrills more than from a path. */
const JEEP_THRILL = 1.3;
/** From the top of the tower you can see this far. */
const TOWER_VIEW = 8;
/** Chance (per hour's worth of steps nearby) that a visitor gives an attraction a go. */
const TRY_CHANCE = 0.5;
const PETTING_KID = 12;
const PETTING_ADULT = 5;

/** Jeeps drive only on dry track, and fences stop them like everything else. */
export const onTrack: CanEnter = (state, i) => state.tracks[i] === 1 && !isFlooded(state, i);

/** Safaris are closed while flood water covers any of the track. */
export const safariFlooded = (state: GameState): boolean => !!state.flood?.wet.some((i) => state.tracks[i] === 1);

const w = (state: GameState) => state.map.width;
/** Visitors keep their last few thoughts (as in the visitor system). */
const MAX_THOUGHTS = 6;

function remember(v: Visitor, hour: number, text: string): void {
  v.thoughts.push({ hour, topic: 'rides', good: true, text });
  if (v.thoughts.length > MAX_THOUGHTS) v.thoughts.shift();
}

/** Track tiles next to a station, where its jeep parks. */
function stationBays(state: GameState, b: Building): number[] {
  const out: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = b.x + dx;
    const y = b.y + dy;
    if (x >= 0 && y >= 0 && x < state.map.width && y < state.map.height && state.tracks[y * w(state) + x]) out.push(y * w(state) + x);
  }
  return out;
}

/** What a station's jeep is doing, for the info panel. */
export function stationStatus(state: GameState, b: Building): string {
  const jeep = state.jeeps.find((j) => j.stationId === b.id);
  if (!jeep) return stationBays(state, b).length ? 'the jeep is on its way' : 'needs a jeep track next to it (Path tool → Track)';
  if (jeep.steps > 0) return `jeep out on safari with ${jeep.riders.length} aboard`;
  if (safariFlooded(state)) return 'safari closed: the track is flooded';
  return jeep.riders.length ? `jeep boarding (${jeep.riders.length}/${JEEP_SEATS})` : 'jeep waiting for riders';
}

/** Lets riders off where they got on, glad of the trip. */
function unload(state: GameState, jeep: Jeep, happy: boolean): void {
  for (const r of jeep.riders) {
    const v = state.visitors.find((x) => x.id === r.id);
    if (!v) continue;
    v.riding = null;
    v.x = v.px = r.tile % w(state);
    v.y = v.py = Math.floor(r.tile / w(state));
    v.path = [];
    if (happy) v.satisfaction = Math.min(100, v.satisfaction + 4);
  }
  jeep.riders = [];
  jeep.steps = 0;
  jeep.waiting = 0;
  jeep.path = [];
}

/** Adds any animals within `range` of (x, y) to what a visitor has seen, with the usual delight (times `thrill`). */
function spot(state: GameState, v: Visitor, x: number, y: number, range: number, thrill: number): number {
  let spotted = 0;
  for (const d of state.dinos) {
    if (d.escaped || v.seen.includes(d.id) || Math.abs(d.x - x) > range || Math.abs(d.y - y) > range) continue;
    v.seen.push(d.id);
    v.satisfaction = Math.min(100, v.satisfaction + Math.max(4, SPECIES[d.species].appeal * 3) * thrill);
    spotted++;
  }
  return spotted;
}

/** Every step: make sure each station has its jeep, and drive them. */
export function stepJeeps(ctx: SimContext): void {
  const { state } = ctx;
  const stations = state.buildings.filter((b) => b.kind === 'station');
  // A station that's gone (or lost its track) takes its jeep with it; riders get off first.
  for (const jeep of [...state.jeeps]) {
    const station = stations.find((b) => b.id === jeep.stationId);
    if (station && state.tracks[jeep.y * w(state) + jeep.x]) continue;
    unload(state, jeep, false);
    state.jeeps.splice(state.jeeps.indexOf(jeep), 1);
  }
  for (const b of stations) {
    if (state.jeeps.some((j) => j.stationId === b.id)) continue;
    const [bay] = stationBays(state, b);
    if (bay === undefined) continue;
    const x = bay % w(state);
    const y = Math.floor(bay / w(state));
    state.jeeps.push({ id: state.nextId++, stationId: b.id, x, y, px: x, py: y, from: -1, riders: [], steps: 0, waiting: 0, path: [] });
  }

  const flooded = safariFlooded(state);
  for (const jeep of state.jeeps) {
    jeep.px = jeep.x;
    jeep.py = jeep.y;
    const station = stations.find((b) => b.id === jeep.stationId)!;
    const here = jeep.y * w(state) + jeep.x;
    const bays = new Set(stationBays(state, station));
    if (jeep.steps === 0) {
      // Parked: set off when full, or when the first riders have waited long enough.
      if (jeep.riders.length === 0) continue;
      // No tours while the track is under water: anyone aboard gets off again.
      if (flooded) {
        unload(state, jeep, false);
        continue;
      }
      jeep.waiting++;
      if (jeep.riders.length < JEEP_SEATS && jeep.waiting < DEPART_AFTER) continue;
    }
    jeep.steps++;
    if (jeep.steps > TOUR_STEPS) {
      // Heading home.
      if (bays.has(here)) {
        for (const r of jeep.riders) {
          const v = state.visitors.find((x) => x.id === r.id);
          if (v) remember(v, state.hours, 'That safari ride was the best part of the day!');
        }
        unload(state, jeep, true);
        continue;
      }
      if (jeep.path.length === 0) jeep.path = findPath(state, here, (i) => bays.has(i), Infinity, onTrack) ?? [];
      const next = jeep.path.shift();
      if (next === undefined) {
        unload(state, jeep, true); // no way back: everyone walks home from here
        continue;
      }
      jeep.from = here;
      jeep.x = next % w(state);
      jeep.y = Math.floor(next / w(state));
    } else {
      // Touring: follow the track, turning round only at a dead end.
      const options = walkableNeighbours(state, here, onTrack);
      const forward = options.filter((n) => n !== jeep.from);
      const choices = forward.length ? forward : options;
      if (choices.length) {
        const next = choices[ctx.rng.int(0, choices.length - 1)];
        jeep.from = here;
        jeep.x = next % w(state);
        jeep.y = Math.floor(next / w(state));
      }
    }
    for (const r of jeep.riders) {
      const v = state.visitors.find((x) => x.id === r.id);
      if (v) spot(state, v, jeep.x, jeep.y, JEEP_VIEW, JEEP_THRILL);
    }
  }
}

const near = (state: GameState, v: Visitor, kind: Building['kind']) =>
  state.buildings.find(
    (b) => b.kind === kind && Math.abs(b.x - v.x) + Math.abs(b.y - v.y) <= 1 && !isFlooded(state, b.y * state.map.width + b.x),
  );

/**
 * A visitor beside an attraction may give it a go (each once per visit):
 * board a waiting jeep, climb the tower, or pat the little dinos.
 * Returns true if they got into a jeep (and so leave the paths for now).
 */
export function tryAttractions(ctx: SimContext, v: Visitor, leaving: boolean): boolean {
  const { state, rng } = ctx;
  if (leaving) return false;
  const station = !v.rode.includes('jeep') && near(state, v, 'station');
  if (station && !safariFlooded(state)) {
    const jeep = state.jeeps.find((j) => j.stationId === station.id && j.steps === 0 && j.riders.length < JEEP_SEATS);
    if (jeep && rng.chance(perStep(TRY_CHANCE))) {
      earn(state, 'rides', BUILDING_TYPES.station.salePrice);
      v.rode.push('jeep');
      v.riding = jeep.id;
      v.path = [];
      jeep.riders.push({ id: v.id, tile: v.y * w(state) + v.x });
      return true;
    }
  }
  const tower = !v.rode.includes('tower') && near(state, v, 'tower');
  if (tower && rng.chance(perStep(TRY_CHANCE))) {
    earn(state, 'rides', BUILDING_TYPES.tower.salePrice);
    v.rode.push('tower');
    const n = spot(state, v, tower.x, tower.y, TOWER_VIEW, 1);
    v.satisfaction = Math.min(100, v.satisfaction + 3);
    remember(v, state.hours, n ? `What a view from the tower! I spotted ${n} more dinosaur${n === 1 ? '' : 's'}.` : 'What a view from the tower!');
  }
  const pen = !v.rode.includes('petting') && near(state, v, 'petting');
  if (pen && state.staff.some((m) => m.role === 'worker') && rng.chance(perStep(TRY_CHANCE))) {
    earn(state, 'rides', BUILDING_TYPES.petting.salePrice);
    v.rode.push('petting');
    v.satisfaction = Math.min(100, v.satisfaction + (v.kid ? PETTING_KID : PETTING_ADULT));
    remember(v, state.hours, v.kid ? 'I got to pat a baby dinosaur!!' : 'The little dinos in the petting pen are so sweet.');
  }
  return false;
}
