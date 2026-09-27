import { calendar, type Building, type GameState, type Visitor } from '../GameState';
import {
  BUILDING_TYPES,
  CLOSE_HOUR,
  LAST_ENTRY_HOUR,
  MAX_VISITORS,
  OPEN_HOUR,
  SOUVENIRS,
  type BuildingKind,
  type ItemKind,
} from '../data/economy';
import { SPECIES } from '../data/species';
import { DECOR_RADIUS, DECOR_TYPES, MAX_DECOR_CHARM } from '../data/decor';
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
/** Peckish enough to buy a snack in passing. */
const PECKISH = 25;
const SNACK_CHANCE = 0.5;
const SNACK_FILLS = 35;
const SNACK_HOURS = 2;
const SOUVENIR_CHANCE = 0.3;
/** Most visitors caught in a storm near a souvenir shop buy a poncho. */
const PONCHO_CHANCE = 0.7;
const MAX_SOUVENIRS = 2;
/** Bladder: rises every hour and after eating; visitors look for restrooms past NEEDS_RESTROOM. */
const BLADDER_PER_HOUR = 12;
const NEEDS_RESTROOM = 70;
const DESPERATE = 90;
/** Desperate visitors at one time before they complain (once a day) about missing restrooms. */
const RESTROOM_COMPLAINT = 4;
const KID_CHANCE = 0.25;
const MASCOT_RADIUS = 3;
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
  // Gardens make the whole park more inviting, a little.
  const charm = state.decor.reduce((sum, d) => sum + DECOR_TYPES[d.kind].charm, 0);
  return appeal + species.size * 3 + Math.min(8, charm * 0.15);
}

/** Mood lift per hour from gardens around a spot. */
export function sceneryCharm(state: GameState, x: number, y: number): number {
  let charm = 0;
  for (const d of state.decor) {
    if (Math.abs(d.x - x) <= DECOR_RADIUS && Math.abs(d.y - y) <= DECOR_RADIUS) charm += DECOR_TYPES[d.kind].charm;
  }
  return Math.min(MAX_DECOR_CHARM, charm);
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

  const near = (role: string, v: Visitor, r: number) =>
    state.staff.some((m) => m.role === role && Math.abs(m.x - v.x) <= r && Math.abs(m.y - v.y) <= r);
  let desperate = 0;
  for (const v of state.visitors) {
    if (near('guide', v, GUIDE_RADIUS)) v.satisfaction += 3;
    // Meeting the mascot is a highlight, especially for kids.
    if (near('mascot', v, MASCOT_RADIUS)) v.satisfaction += v.kid ? 8 : 4;
    v.satisfaction += sceneryCharm(state, v.x, v.y);
    v.hunger = Math.min(100, v.hunger + 8);
    v.bladder = Math.min(100, v.bladder + BLADDER_PER_HOUR);
    if (v.hunger >= 90) v.satisfaction -= 3;
    if (v.bladder >= DESPERATE) {
      v.satisfaction -= 8;
      desperate++;
    } else if (v.bladder >= NEEDS_RESTROOM) v.satisfaction -= 2; // uncomfortable
    if (v.seen.length === 0) v.satisfaction -= 4; // bored: nothing to see
    if (state.stormHours > 0 && !v.items.includes('poncho')) v.satisfaction -= 2; // soaked
    v.satisfaction = Math.max(0, Math.min(100, v.satisfaction));
  }
  const day = calendar(state).day;
  if (desperate >= RESTROOM_COMPLAINT && !state.buildings.some((b) => b.kind === 'restroom') && state.stats.restroomComplaintDay !== day) {
    state.stats.restroomComplaintDay = day;
    ctx.emit({ text: '🚻 Visitors are desperate for restrooms! Build some next to your paths.', kind: 'bad' });
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
export function spawnVisitor(ctx: SimContext, satisfaction: number, ticket: number, kid?: boolean): void {
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
    items: [],
    snackUntil: 0,
    bladder: rng.int(0, 30),
    kid: kid ?? rng.chance(KID_CHANCE),
    look: rng.int(0, LOOKS - 1),
  });
  earn(state, 'admissions', ticket);
  state.finance.today.visitors++;
  state.finance.month.visitors++;
}

/** Souvenir shopping: ponchos when it's pouring, otherwise a plush, cap or balloon (kids love balloons). */
function shop(ctx: SimContext, v: Visitor): void {
  const { state, rng } = ctx;
  const buy = (item: ItemKind) => {
    v.items.push(item);
    v.satisfaction = Math.min(100, v.satisfaction + 3);
    earn(state, 'souvenirs', SOUVENIRS[item].price);
  };
  if (state.stormHours > 0 && !v.items.includes('poncho')) {
    if (rng.chance(PONCHO_CHANCE)) buy('poncho');
    return;
  }
  const extras = v.items.filter((i) => i !== 'poncho');
  if (extras.length >= MAX_SOUVENIRS) return;
  const mascotNearby = state.staff.some((m) => m.role === 'mascot' && Math.abs(m.x - v.x) <= 4 && Math.abs(m.y - v.y) <= 4);
  if (!rng.chance(SOUVENIR_CHANCE * (mascotNearby ? 1.5 : 1))) return;
  const wants: [ItemKind, number][] = (
    v.kid
      ? [['balloon', 3], ['plush', 2], ['hat', 1]]
      : [['plush', 2], ['hat', 2], ['balloon', 1]]
  ).filter(([item]) => !v.items.includes(item as ItemKind)) as [ItemKind, number][];
  if (wants.length === 0) return;
  let roll = rng.next() * wants.reduce((sum, [, w]) => sum + w, 0);
  buy(wants.find(([, w]) => (roll -= w) < 0)?.[0] ?? wants[0][0]);
}

/** One movement step for every visitor: look, shop, eat, walk, or head home. */
export function stepVisitors(ctx: SimContext): void {
  const { state, rng } = ctx;
  const { width } = state.map;
  const gate = state.entrance.y * width + state.entrance.x;
  const { hour } = calendar(state);
  const closing = hour >= CLOSE_HOUR || hour < OPEN_HOUR;
  const has = (kind: BuildingKind) => state.buildings.some((b) => b.kind === kind);
  const routeTo = (from: number, kind: BuildingKind) =>
    findPath(state, from, (i) => buildingNear(state, i % width, Math.floor(i / width), kind) !== undefined, 60, onWalkway);

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
    if (buildingNear(state, v.x, v.y, 'giftshop')) shop(ctx, v);
    if (v.bladder >= 40 && buildingNear(state, v.x, v.y, 'restroom')) {
      v.bladder = 0;
      v.path = [];
      v.satisfaction = Math.min(100, v.satisfaction + 4); // relief!
    }
    if (v.hunger >= HUNGRY && buildingNear(state, v.x, v.y, 'restaurant')) {
      v.hunger = 0;
      v.bladder = Math.min(100, v.bladder + 15);
      v.path = [];
      v.satisfaction = Math.min(100, v.satisfaction + 5);
      earn(state, 'food', BUILDING_TYPES.restaurant.salePrice);
    } else if (
      v.hunger >= PECKISH &&
      state.hours >= v.snackUntil &&
      buildingNear(state, v.x, v.y, 'snackstall') &&
      rng.chance(SNACK_CHANCE)
    ) {
      v.hunger = Math.max(0, v.hunger - SNACK_FILLS);
      v.bladder = Math.min(100, v.bladder + 10);
      v.snackUntil = state.hours + SNACK_HOURS;
      v.satisfaction = Math.min(100, v.satisfaction + 3);
      earn(state, 'snacks', BUILDING_TYPES.snackstall.salePrice);
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
      } else if (v.bladder >= NEEDS_RESTROOM && has('restroom')) {
        v.path = routeTo(here, 'restroom') ?? [];
      } else if (v.hunger >= HUNGRY && (has('restaurant') || has('snackstall'))) {
        v.path = (has('restaurant') ? routeTo(here, 'restaurant') : null) ?? routeTo(here, 'snackstall') ?? [];
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
