import { calendar, type Building, type GameState, type Visitor } from '../GameState';
import { BUILDING_TYPES, CLOSE_HOUR, LAST_ENTRY_HOUR, MAX_VISITORS, OPEN_HOUR, type BuildingKind } from '../data/economy';
import { SPECIES } from '../data/species';
import { earn } from '../finance';
import { canStep, findPath, walkableNeighbours } from '../pathfind';
import { onWalkway } from '../paths';
import type { RegionMap } from '../regions';
import type { SimContext } from './context';

/** Tiles (Chebyshev distance) within which a visitor can see a dinosaur. */
const VIEW_RADIUS = 4;
/** A day out starts out fun; what they see (or don't) moves it from here. */
const START_SATISFACTION = 60;
const HUNGRY = 60;
const SOUVENIR_CHANCE = 0.3;
const PAUSE_CHANCE = 0.2;
const LOOKS = 6;
/** Visitors within this many tiles of an escaped carnivore run for the gate. */
const PANIC_RADIUS = 3;
const INJURY_CHANCE = 0.1;
const GUIDE_RADIUS = 3;
/** Fraction of the usual arrivals who still come in a storm. */
const STORM_ARRIVALS = 0.4;

/**
 * How much there is to see: each dino in a paddock adds its species' appeal,
 * scaled by how lively (happy) it is, plus a bonus per distinct species.
 */
export function parkAppeal(state: GameState, regions: RegionMap): number {
  const species = new Set<string>();
  let appeal = 0;
  for (const d of state.dinos) {
    if (regions.regions[regions.tileRegion[d.y * state.map.width + d.x]]?.kind !== 'paddock') continue;
    appeal += SPECIES[d.species].appeal * (0.5 + d.happiness / 200);
    species.add(d.species);
  }
  return appeal + species.size * 3;
}

/** The ticket price visitors consider fair for what's on show. */
export function fairPrice(appeal: number): number {
  return Math.round(8 + appeal * 0.6);
}

/** Expected new visitors per open hour. */
export function expectedArrivals(state: GameState, regions: RegionMap): number {
  const appeal = parkAppeal(state, regions);
  const priceFactor = Math.max(0, Math.min(1.5, 2 - state.ticketPrice / fairPrice(appeal)));
  const weather = state.stormHours > 0 ? STORM_ARRIVALS : 1;
  return (2 + appeal * 0.25) * (0.5 + state.reputation / 100) * priceFactor * weather;
}

function buildingNear(state: GameState, x: number, y: number, kind: BuildingKind): Building | undefined {
  return state.buildings.find((b) => b.kind === kind && Math.abs(b.x - x) + Math.abs(b.y - y) <= 1);
}

/** Each departing visitor nudges reputation toward their satisfaction: a slow moving average. */
const REPUTATION_WEIGHT = 0.005;

function leave(state: GameState, v: Visitor): void {
  state.visitors.splice(state.visitors.indexOf(v), 1);
  state.reputation += (v.satisfaction - state.reputation) * REPUTATION_WEIGHT;
}

/** Hourly: new arrivals pay at the gate; everyone gets hungrier. */
export function hourlyVisitors(ctx: SimContext): void {
  const { state, rng, regions } = ctx;
  const { hour } = calendar(state);

  const guides = state.staff.filter((m) => m.role === 'guide');
  for (const v of state.visitors) {
    if (guides.some((g) => Math.abs(g.x - v.x) <= GUIDE_RADIUS && Math.abs(g.y - v.y) <= GUIDE_RADIUS)) {
      v.satisfaction = Math.min(100, v.satisfaction + 3);
    }
    v.hunger = Math.min(100, v.hunger + 8);
    if (v.hunger >= 90) v.satisfaction -= 3;
    if (v.seen.length === 0) v.satisfaction -= 4; // bored: nothing to see
    if (state.stormHours > 0) v.satisfaction -= 2; // soaked
    v.satisfaction = Math.max(0, v.satisfaction);
  }

  if (hour < OPEN_HOUR || hour > LAST_ENTRY_HOUR) return;
  const expected = expectedArrivals(state, regions);
  let n = Math.floor(expected) + (rng.chance(expected % 1) ? 1 : 0);
  n = Math.min(n, MAX_VISITORS - state.visitors.length);
  const fair = fairPrice(parkAppeal(state, regions));
  const pricePenalty = state.ticketPrice > fair ? Math.min(30, (state.ticketPrice / fair - 1) * 40) : 0;

  for (let i = 0; i < n; i++) spawnVisitor(ctx, START_SATISFACTION - pricePenalty, state.ticketPrice);
}

/** A new visitor at the gate who pays `ticket` for admission. */
export function spawnVisitor(ctx: SimContext, satisfaction: number, ticket: number): void {
  const { state, rng } = ctx;
  const { x, y } = state.entrance;
  state.visitors.push({
    id: state.nextId++,
    x,
    y,
    px: x,
    py: y,
    from: -1,
    path: [],
    hunger: rng.int(0, 40),
    satisfaction,
    seen: [],
    leaveHour: state.hours + rng.int(3, 6),
    boughtSouvenir: false,
    look: rng.int(0, LOOKS - 1),
  });
  earn(state, 'admissions', ticket);
  state.finance.today.visitors++;
  state.finance.month.visitors++;
}

/** One movement step for every visitor: look, shop, eat, walk, or head home. */
export function stepVisitors(ctx: SimContext): void {
  const { state, rng } = ctx;
  const { width } = state.map;
  const gate = state.entrance.y * width + state.entrance.x;
  const { hour } = calendar(state);
  const closing = hour >= CLOSE_HOUR || hour < OPEN_HOUR;
  const hasRestaurant = state.buildings.some((b) => b.kind === 'restaurant');

  const loose = state.dinos.filter((d) => d.escaped);

  for (const v of [...state.visitors]) {
    v.px = v.x;
    v.py = v.y;
    const here = v.y * width + v.x;

    // Escaped dinosaurs: carnivores send visitors fleeing (some get hurt); herbivores unsettle them.
    const near = (r: number) => loose.filter((d) => Math.abs(d.x - v.x) <= r && Math.abs(d.y - v.y) <= r);
    const predator = near(PANIC_RADIUS).find((d) => SPECIES[d.species].diet === 'carnivore');
    if (predator) {
      v.satisfaction = Math.max(0, v.satisfaction - 40);
      if (rng.chance(INJURY_CHANCE)) {
        state.reputation = Math.max(0, state.reputation - 2);
        ctx.emit({ text: `🚑 A visitor was hurt by an escaped ${SPECIES[predator.species].name}!`, kind: 'bad' });
      }
      leave(state, v);
      continue;
    }
    if (near(2).length > 0) v.satisfaction = Math.max(0, v.satisfaction - 2);

    for (const d of state.dinos) {
      if (Math.abs(d.x - v.x) <= VIEW_RADIUS && Math.abs(d.y - v.y) <= VIEW_RADIUS && !v.seen.includes(d.id)) {
        v.seen.push(d.id);
        v.satisfaction = Math.min(100, v.satisfaction + Math.max(4, SPECIES[d.species].appeal * 3));
      }
    }
    if (!v.boughtSouvenir && buildingNear(state, v.x, v.y, 'giftshop') && rng.chance(SOUVENIR_CHANCE)) {
      v.boughtSouvenir = true;
      v.satisfaction = Math.min(100, v.satisfaction + 3);
      earn(state, 'souvenirs', BUILDING_TYPES.giftshop.salePrice);
    }
    if (v.hunger >= HUNGRY && buildingNear(state, v.x, v.y, 'restaurant')) {
      v.hunger = 0;
      v.path = [];
      v.satisfaction = Math.min(100, v.satisfaction + 5);
      earn(state, 'food', BUILDING_TYPES.restaurant.salePrice);
    }

    const leaving = closing || state.hours >= v.leaveHour;
    if (leaving && here === gate) {
      leave(state, v);
      continue;
    }

    if (v.path.length === 0) {
      if (leaving) {
        const home = findPath(state, here, (i) => i === gate, Infinity, onWalkway);
        if (!home) {
          // Stranded (the path home was removed): they find their own way out, unhappily.
          v.satisfaction = Math.max(0, v.satisfaction - 20);
          leave(state, v);
          continue;
        }
        v.path = home;
      } else if (v.hunger >= HUNGRY && hasRestaurant) {
        v.path =
          findPath(state, here, (i) => buildingNear(state, i % width, Math.floor(i / width), 'restaurant') !== undefined, 60, onWalkway) ?? [];
      }
      if (v.path.length === 0 && !leaving && !rng.chance(PAUSE_CHANCE)) {
        // Wander the path network, avoiding doubling back unless at a dead end.
        const options = walkableNeighbours(state, here, onWalkway);
        const forward = options.filter((n) => n !== v.from);
        const choices = forward.length > 0 ? forward : options;
        if (choices.length > 0) v.path = [choices[rng.int(0, choices.length - 1)]];
      }
    }

    const next = v.path.shift();
    if (next === undefined) continue;
    if (!canStep(state, here, next, onWalkway)) {
      v.path = [];
      continue;
    }
    v.from = here;
    v.x = next % width;
    v.y = Math.floor(next / width);
  }
}
