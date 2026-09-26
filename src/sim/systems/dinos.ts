import type { Dino, Feeder, GameState } from '../GameState';
import { FEEDER_TYPES } from '../data/feeders';
import { SPECIES } from '../data/species';
import { canStep, findPath, walkableNeighbours } from '../pathfind';
import type { SimContext } from './context';

/** Movement steps per game-hour. */
export const STEPS_PER_HOUR = 4;
/** Hunger at which dinos go looking for food. */
export const HUNGRY = 50;
const STARVING_WARNING = 80;
const WANDER_CHANCE = 0.35;
const WANDER_RADIUS = 5;
const FOOD_SEARCH = 80;
const HUNT_SEARCH = 40;
/** Chase routes are cut short so the hunter re-targets as the prey moves. */
const CHASE_LOOKAHEAD = 3;

export const dinoLabel = (d: Dino) => `${d.name} the ${SPECIES[d.species].name}`;

function tileIndex(state: GameState, x: number, y: number): number {
  return y * state.map.width + x;
}

function feederFor(state: GameState, i: number, d: Dino): Feeder | undefined {
  const diet = SPECIES[d.species].diet;
  const w = state.map.width;
  return state.feeders.find((f) => f.y * w + f.x === i && f.stock > 0 && FEEDER_TYPES[f.kind].diet === diet);
}

function canEat(hunter: Dino, prey: Dino): boolean {
  const h = SPECIES[hunter.species];
  const p = SPECIES[prey.species];
  return h.diet === 'carnivore' && p.diet === 'herbivore' && p.size <= h.size;
}

function eatFromFeeder(ctx: SimContext, d: Dino, f: Feeder): void {
  const meal = SPECIES[d.species].meal;
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
      if (sp.diet === 'carnivore') {
        const reach = new Set([here, ...walkableNeighbours(state, here)]);
        const prey = state.dinos.find((p) => p !== d && canEat(d, p) && reach.has(tileIndex(state, p.x, p.y)));
        if (prey) {
          state.dinos.splice(state.dinos.indexOf(prey), 1);
          d.hunger = 0;
          d.path = [];
          ctx.emit({ text: `${dinoLabel(d)} ate ${dinoLabel(prey)}!`, kind: 'bad' });
          continue;
        }
      }
    }

    // Big animals move less often than small ones; the id offsets keep herds out of lockstep.
    if ((stepNo + d.id) % sp.pace !== 0) continue;
    if (d.path.length === 0) d.path = plan(d, here) ?? [];
    const next = d.path.shift();
    if (next === undefined) continue;
    if (!canStep(state, here, next)) {
      d.path = []; // a fence went up across the route
      continue;
    }
    d.x = next % state.map.width;
    d.y = Math.floor(next / state.map.width);
  }

  function plan(d: Dino, here: number): number[] | null {
    const sp = SPECIES[d.species];
    if (d.hunger >= HUNGRY) {
      const toFood = findPath(state, here, (i) => feederFor(state, i, d) !== undefined, FOOD_SEARCH);
      if (toFood) return toFood;
      if (sp.diet === 'carnivore') {
        const preyTiles = new Set(state.dinos.filter((p) => canEat(d, p)).map((p) => tileIndex(state, p.x, p.y)));
        const chase = preyTiles.size ? findPath(state, here, (i) => preyTiles.has(i), HUNT_SEARCH) : null;
        if (chase) return chase.slice(0, CHASE_LOOKAHEAD);
      }
    }
    if (!rng.chance(WANDER_CHANCE)) return null;
    const { width, height } = state.map;
    const tx = Math.min(width - 1, Math.max(0, d.x + rng.int(-WANDER_RADIUS, WANDER_RADIUS)));
    const ty = Math.min(height - 1, Math.max(0, d.y + rng.int(-WANDER_RADIUS, WANDER_RADIUS)));
    const target = tileIndex(state, tx, ty);
    return findPath(state, here, (i) => i === target, WANDER_RADIUS * 3);
  }
}

/** Hourly needs: hunger, health, starvation and happiness. */
export function hourlyDinos(ctx: SimContext): void {
  const { state, regions } = ctx;

  for (const d of [...state.dinos]) {
    const sp = SPECIES[d.species];
    const before = d.hunger;
    d.hunger = Math.min(100, d.hunger + sp.hungerRate);
    if (before < STARVING_WARNING && d.hunger >= STARVING_WARNING) {
      ctx.emit({ text: `${dinoLabel(d)} is starving!`, kind: 'bad' });
    }
    if (d.hunger >= 100) d.health -= 4;
    else if (d.hunger < 60) d.health = Math.min(100, d.health + 1);
    if (d.health <= 0) {
      state.dinos.splice(state.dinos.indexOf(d), 1);
      ctx.emit({ text: `${dinoLabel(d)} starved to death`, kind: 'bad' });
    }
  }

  // Group by region once, then score each animal.
  const byRegion = new Map<number, Dino[]>();
  for (const d of state.dinos) {
    const r = regions.tileRegion[tileIndex(state, d.x, d.y)];
    byRegion.set(r, [...(byRegion.get(r) ?? []), d]);
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
      d.happiness = Math.round(Math.max(0, Math.min(100, h)));
    }
  }
}
