import { calendar, type Dino, type Feeder, type GameState } from '../GameState';
import { FEEDER_TYPES } from '../data/feeders';
import { habitatOf, SPECIES } from '../data/species';
import { isLand, Terrain } from '../terrain';
import { canStep, findPath, onLand, walkableNeighbours, type CanEnter } from '../pathfind';
import { fenceAt, tileEdges } from '../fences';
import type { SimContext } from './context';
import type { RegionMap } from '../regions';
import { careJoy } from './care';

/** Movement steps per game-hour. */
export const STEPS_PER_HOUR = 16;
/** Steps per hour the per-step odds below were first tuned for. */
const TUNED_STEPS_PER_HOUR = 4;

/**
 * Converts a chance tuned for one step at the old pace into the equivalent
 * per-step chance now, so the odds per game-hour stay the same.
 */
export function perStep(chance: number): number {
  return 1 - (1 - chance) ** (TUNED_STEPS_PER_HOUR / STEPS_PER_HOUR);
}
/** Hunger at which dinos go looking for food. */
export const HUNGRY = 50;
const STARVING_WARNING = 80;
const WANDER_CHANCE = 0.35;
const WANDER_RADIUS = 5;
const FOOD_SEARCH = 80;
const HUNT_SEARCH = 40;
/**
 * Meat-eaters rarely manage a catch. A hungry one that reaches its prey gets
 * one pounce: usually it misses, the prey bolts, and the hunter rests a few
 * hours before trying again; after a catch it rests for days. So one hungry
 * raptor can't work its way through a whole park, and there's time to step in.
 */
export const POUNCE_SUCCESS = 0.2;
export const MISS_REST_HOURS = 5;
export const CATCH_REST_HOURS = 72;
export const canHunt = (state: GameState, d: Dino) => state.hours >= d.huntRestUntil;
/** Chase routes are cut short so the hunter re-targets as the prey moves. */
const CHASE_LOOKAHEAD = 3;
const FENCE_SEARCH = 40;
/** Health lost per hour while sick: about a week from full health to death if untreated. */
const SICK_HEALTH_LOSS = 0.6;
/** Hours between droppings for the smallest species; each size step down from that is quicker. */
const DUNG_HOURS_SMALL = 30;
const DUNG_HOURS_PER_SIZE = 3;
/** Droppings dry out and crumble away by themselves after this long. */
const DUNG_LIFETIME = 72;
/** Paddocks stop getting dirtier past this many droppings per animal (they're trampled in). */
const MAX_DUNG_PER_DINO = 4;
/** Droppings per animal before the paddock bothers them. */
const DUNG_BOTHERS = 2;
const DUNG_UNHAPPY = 8;

/** Night-time, when most animals sleep: from 21:00 until 05:00. */
export function isNight(state: GameState): boolean {
  const { hour } = calendar(state);
  return hour >= 21 || hour < 5;
}

/** Asleep: night-time, not a night-owl, not on the loose, and not hungry enough to get up for food. */
export function isAsleep(state: GameState, d: Dino): boolean {
  return isNight(state) && !SPECIES[d.species].nocturnal && !d.escaped && d.hunger < HUNGRY;
}

/** Starving or miserable animals go looking for a way out. */
export function isRestless(d: Dino): boolean {
  return d.hunger >= 80 || d.happiness < 40;
}

/** Where an animal can move: land walkers on land, swimmers in pond water, flyers over either. */
export function enterFor(d: Dino): CanEnter {
  const habitat = habitatOf(d.species);
  if (habitat === 'water') return swims;
  if (habitat === 'air') return flies;
  return onLand;
}
const swims: CanEnter = (state, i) => state.map.tiles[i] === Terrain.Pond;
const flies: CanEnter = (state, i) => isLand(state.map.tiles[i]) || state.map.tiles[i] === Terrain.Pond;

export const dinoLabel = (d: Dino) => `${d.name} the ${d.baby ? 'baby ' : ''}${SPECIES[d.species].name}`;

/** Droppings lying in each region. */
export function dungByRegion(state: GameState, regions: RegionMap): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of state.messes) {
    if (m.kind !== 'dung') continue;
    const r = regions.tileRegion[m.y * state.map.width + m.x];
    out.set(r, (out.get(r) ?? 0) + 1);
  }
  return out;
}

/** Whether a paddock has enough droppings to bother the animals in it. */
export function paddockIsFilthy(dung: number, animals: number): boolean {
  return dung > animals * DUNG_BOTHERS;
}

function tileIndex(state: GameState, x: number, y: number): number {
  return y * state.map.width + x;
}

function feederFor(state: GameState, i: number, d: Dino): Feeder | undefined {
  const diet = SPECIES[d.species].diet;
  const w = state.map.width;
  return state.feeders.find((f) => f.y * w + f.x === i && f.stock > 0 && FEEDER_TYPES[f.kind].diet === diet);
}

/** Babies count as this much smaller than grown-ups when it comes to being hunted. */
const BABY_SIZE_DROP = 2;

export function canEat(hunter: Dino, prey: Dino): boolean {
  const h = SPECIES[hunter.species];
  const p = SPECIES[prey.species];
  if (hunter.baby || h.diet !== 'carnivore') return false;
  // Babies of any other species are fair game if they're small enough, even little carnivores.
  const size = prey.baby ? Math.max(1, p.size - BABY_SIZE_DROP) : p.size;
  return (p.diet === 'herbivore' || prey.baby) && prey.species !== hunter.species && size <= h.size;
}

function eatFromFeeder(ctx: SimContext, d: Dino, f: Feeder): void {
  const meal = SPECIES[d.species].meal * (d.baby ? 0.5 : 1);
  const eaten = Math.min(meal, f.stock);
  f.stock -= eaten;
  d.hunger = Math.max(0, d.hunger - (100 * eaten) / meal);
  d.path = [];
  if (f.stock === 0) ctx.emit({ text: `A ${FEEDER_TYPES[f.kind].name.toLowerCase()} is empty`, kind: 'bad' });
}

/** One movement step for every dinosaur: eat, hunt, or walk. */
export function stepDinos(ctx: SimContext): void {
  const { state, rng } = ctx;
  const stepNo = state.hours * STEPS_PER_HOUR + state.stepInHour;
  // Escaped animals a guard has reached stay put while they're calmed.
  const held = new Set(
    state.staff.filter((m) => m.task?.kind === 'recapture' && m.progress > 0).map((m) => (m.task as { dinoId: number }).dinoId),
  );

  for (const d of [...state.dinos]) {
    if (!state.dinos.includes(d)) continue; // eaten earlier this step
    const sp = SPECIES[d.species];
    d.px = d.x;
    d.py = d.y;
    const here = tileIndex(state, d.x, d.y);

    if (d.hunger >= HUNGRY) {
      const f = feederFor(state, here, d);
      if (f) {
        eatFromFeeder(ctx, d, f);
        continue;
      }
      if (sp.diet === 'carnivore' && canHunt(state, d)) {
        const reach = new Set([here, ...walkableNeighbours(state, here)]);
        const prey = state.dinos.find((p) => p !== d && canEat(d, p) && reach.has(tileIndex(state, p.x, p.y)));
        if (prey && rng.chance(POUNCE_SUCCESS)) {
          catchPrey(ctx, d, prey);
          continue;
        }
        if (prey) {
          // A miss: the prey bolts and the hunter needs a rest.
          flee(prey, d);
          d.huntRestUntil = state.hours + MISS_REST_HOURS;
          d.path = [];
        }
      }
    }

    // Big animals move less often than small ones; the id offsets keep herds out of lockstep.
    if (held.has(d.id) || (stepNo + d.id) % sp.pace !== 0) continue;
    if (isAsleep(state, d)) {
      d.path = []; // curled up for the night
      continue;
    }
    if (d.path.length === 0) d.path = plan(d, here) ?? [];
    const next = d.path.shift();
    if (next === undefined) continue;
    if (!canStep(state, here, next, enterFor(d))) {
      d.path = []; // a fence went up across the route
      continue;
    }
    d.x = next % state.map.width;
    d.y = Math.floor(next / state.map.width);
  }

  /** The prey bolts one step away from the hunter (if it can). */
  function flee(prey: Dino, hunter: Dino): void {
    const from = tileIndex(state, prey.x, prey.y);
    const w = state.map.width;
    const away = walkableNeighbours(state, from, enterFor(prey))
      .map((i) => ({ i, d: Math.abs((i % w) - hunter.x) + Math.abs(Math.floor(i / w) - hunter.y) }))
      .sort((a, b) => b.d - a.d)[0];
    if (away) prey.path = [away.i];
  }

  function plan(d: Dino, here: number): number[] | null {
    const sp = SPECIES[d.species];
    if (d.hunger >= HUNGRY) {
      const toFood = findPath(state, here, (i) => feederFor(state, i, d) !== undefined, FOOD_SEARCH, enterFor(d));
      if (toFood) return toFood;
      if (sp.diet === 'carnivore' && canHunt(state, d)) {
        const preyTiles = new Set(state.dinos.filter((p) => canEat(d, p)).map((p) => tileIndex(state, p.x, p.y)));
        const chase = preyTiles.size ? findPath(state, here, (i) => preyTiles.has(i), HUNT_SEARCH) : null;
        if (chase) return chase.slice(0, CHASE_LOOKAHEAD);
      }
    }
    if (isRestless(d) && !d.escaped) {
      // Pace the fence line, and stay put once there, testing it (see hourlyFences).
      const w = state.map.width;
      const atFence = (i: number) => tileEdges(i % w, Math.floor(i / w)).some((e) => fenceAt(state, e) !== 0);
      if (atFence(here)) return null;
      const toFence = findPath(state, here, atFence, FENCE_SEARCH, enterFor(d));
      if (toFence) return toFence;
    }
    if (!rng.chance(WANDER_CHANCE)) return null;
    const { width, height } = state.map;
    const tx = Math.min(width - 1, Math.max(0, d.x + rng.int(-WANDER_RADIUS, WANDER_RADIUS)));
    const ty = Math.min(height - 1, Math.max(0, d.y + rng.int(-WANDER_RADIUS, WANDER_RADIUS)));
    const target = tileIndex(state, tx, ty);
    return findPath(state, here, (i) => i === target, WANDER_RADIUS * 3, enterFor(d));
  }
}

/**
 * A rare catch: the prey is gone, and a fossil skeleton lies where it fell.
 * The hunter is full and rests for a few days.
 */
function catchPrey(ctx: SimContext, hunter: Dino, prey: Dino): void {
  const { state } = ctx;
  state.dinos.splice(state.dinos.indexOf(prey), 1);
  state.stats.dinosLost++;
  hunter.hunger = 0;
  hunter.path = [];
  hunter.huntRestUntil = state.hours + CATCH_REST_HOURS;
  const taken = state.decor.some((o) => o.x === prey.x && o.y === prey.y) || state.paths[prey.y * state.map.width + prey.x] === 1;
  if (!taken && isLand(state.map.tiles[prey.y * state.map.width + prey.x])) {
    state.decor.push({ id: state.nextId++, kind: 'skeleton', x: prey.x, y: prey.y });
  }
  ctx.emit({ text: `🦴 ${dinoLabel(hunter)} caught ${dinoLabel(prey)}! All that’s left is a fossil skeleton.`, kind: 'bad' });
}

/** Hourly needs: hunger, health, starvation and happiness. */
export function hourlyDinos(ctx: SimContext): void {
  const { state, regions } = ctx;

  for (const d of [...state.dinos]) {
    const sp = SPECIES[d.species];
    const before = d.hunger;
    d.hunger = Math.min(100, d.hunger + sp.hungerRate * (d.baby ? 0.6 : 1));
    if (before < STARVING_WARNING && d.hunger >= STARVING_WARNING) {
      ctx.emit({ text: `${dinoLabel(d)} is starving!`, kind: 'bad' });
    }
    if (d.hunger >= 100) d.health -= 4;
    else if (d.hunger < 60 && !d.sick) d.health = Math.min(100, d.health + 1);
    if (d.sick) d.health -= SICK_HEALTH_LOSS;
    if (d.health <= 0) {
      state.dinos.splice(state.dinos.indexOf(d), 1);
      state.stats.dinosLost++;
      ctx.emit({ text: `${dinoLabel(d)} ${d.hunger >= 100 ? 'starved to death' : 'died of illness'}`, kind: 'bad' });
    }
  }

  // Group by region once, then score each animal.
  const byRegion = new Map<number, Dino[]>();
  for (const d of state.dinos) {
    const r = regions.tileRegion[tileIndex(state, d.x, d.y)];
    byRegion.set(r, [...(byRegion.get(r) ?? []), d]);
  }

  // Droppings: old ones crumble away; each animal in a paddock goes now and then.
  state.messes = state.messes.filter((m) => m.kind !== 'dung' || state.hours - m.hour < DUNG_LIFETIME);
  const dung = dungByRegion(state, regions);
  for (const [regionId, group] of byRegion) {
    if (regions.regions[regionId]?.kind !== 'paddock') continue;
    for (const d of group) {
      if ((dung.get(regionId) ?? 0) >= group.length * MAX_DUNG_PER_DINO) break;
      if (habitatOf(d.species) === 'water') continue; // it all washes away
      const every = DUNG_HOURS_SMALL - (SPECIES[d.species].size - 1) * DUNG_HOURS_PER_SIZE;
      if (!ctx.rng.chance(1 / every)) continue;
      state.messes.push({ id: state.nextId++, kind: 'dung', x: d.x, y: d.y, hour: state.hours });
      dung.set(regionId, (dung.get(regionId) ?? 0) + 1);
    }
  }
  for (const [regionId, group] of byRegion) {
    const region = regions.regions[regionId];
    const spaceWanted = group.reduce((sum, d) => sum + SPECIES[d.species].space, 0);
    const crowding = region ? Math.max(0, spaceWanted / region.tiles.length - 1) : 0;
    for (const d of group) {
      const sp = SPECIES[d.species];
      let h = 100;
      if (d.hunger > 40) h -= (d.hunger - 40) * 0.8;
      if (region?.kind !== 'paddock') h -= 15;
      h -= Math.min(40, crowding * 40);
      if (sp.social && !group.some((o) => o !== d && o.species === d.species)) h -= 15;
      if (sp.diet === 'herbivore' && group.some((o) => canEat(o, d))) h -= 30;
      if (region?.kind === 'paddock' && paddockIsFilthy(dung.get(regionId) ?? 0, group.length)) h -= DUNG_UNHAPPY;
      h += careJoy(state, d);
      d.happiness = Math.round(Math.max(0, Math.min(100, h)));
    }
  }
}
