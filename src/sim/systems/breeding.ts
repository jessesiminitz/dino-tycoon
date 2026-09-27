import { NEVER, type Dino, type GameState } from '../GameState';
import { DINO_NAMES, SPECIES } from '../data/species';
import { pickName } from '../commands';
import type { RegionMap } from '../regions';
import type { SimContext } from './context';
import { dinoLabel } from './dinos';

/** Both parents need to be at least this happy, and not too hungry, to lay. */
const LAY_HAPPINESS = 75;
const LAY_MAX_HUNGER = 50;
/** Chance per qualifying pair per hour: roughly an egg every other day from a contented pair. */
export const LAY_CHANCE = 1 / 48;
export const HATCH_HOURS = 48;
/** Babies grow up after a week. */
export const GROW_HOURS = 24 * 7;
/** Eggs wobble for this long before hatching. */
export const WOBBLE_HOURS = 6;
/** Park-wide cap on eggs plus babies: a quarter of the grown-ups, but always room for a few. */
const NURSERY_SHARE = 0.25;
const NURSERY_MIN = 4;

export function nurseryCap(state: GameState): number {
  const adults = state.dinos.filter((d) => !d.baby).length;
  return Math.max(NURSERY_MIN, Math.floor(adults * NURSERY_SHARE));
}

const regionOf = (state: GameState, regions: RegionMap, x: number, y: number) => regions.tileRegion[y * state.map.width + x];

/** Hours until an egg hatches (0 when it's about to). */
export function hoursToHatch(state: GameState, laidHour: number): number {
  return Math.max(0, laidHour + HATCH_HOURS - state.hours);
}

/** Hours until a baby is grown up. */
export function hoursToGrow(state: GameState, d: Dino): number {
  return Math.max(0, d.bornHour + GROW_HOURS - state.hours);
}

/**
 * Hourly: babies grow up, eggs hatch, and happy pairs lay. A pair is two
 * grown-ups of the same species in the same paddock, both happy and fed, in a
 * paddock with room to spare. Each paddock holds at most one egg at a time,
 * and the park keeps a cap on eggs and babies together.
 */
export function hourlyBreeding(ctx: SimContext): void {
  const { state, rng, regions } = ctx;

  for (const d of state.dinos) {
    if (d.baby && hoursToGrow(state, d) === 0) {
      d.baby = false;
      ctx.emit({ text: `🦕 ${d.name} the ${SPECIES[d.species].name} is all grown up!`, kind: 'good' });
    }
  }

  for (const egg of [...state.eggs]) {
    if (hoursToHatch(state, egg.laidHour) > 0) continue;
    state.eggs.splice(state.eggs.indexOf(egg), 1);
    const name = pickName(state, DINO_NAMES, state.dinos.map((d) => d.name));
    const baby: Dino = {
      id: state.nextId++,
      species: egg.species,
      name,
      x: egg.x,
      y: egg.y,
      px: egg.x,
      py: egg.y,
      path: [],
      hunger: 20,
      health: 100,
      happiness: 90,
      bornHour: state.hours,
      sick: false,
      escaped: false,
      homeX: egg.x,
      homeY: egg.y,
      baby: true,
      lastTreatHour: NEVER,
      lastPatHour: NEVER,
    };
    state.dinos.push(baby);
    state.stats.hatched++;
    ctx.emit({ text: `🐣 A baby ${SPECIES[egg.species].name} hatched! Say hello to ${name}.`, kind: 'good' });
  }

  if (state.eggs.length + state.dinos.filter((d) => d.baby).length >= nurseryCap(state)) return;
  const withEgg = new Set(state.eggs.map((e) => regionOf(state, regions, e.x, e.y)));
  const byRegion = new Map<number, Dino[]>();
  for (const d of state.dinos) {
    const r = regionOf(state, regions, d.x, d.y);
    if (regions.regions[r]?.kind !== 'paddock') continue;
    byRegion.set(r, [...(byRegion.get(r) ?? []), d]);
  }
  for (const [regionId, group] of byRegion) {
    if (withEgg.has(regionId)) continue;
    const region = regions.regions[regionId];
    const spaceWanted = group.reduce((sum, d) => sum + SPECIES[d.species].space, 0);
    if (spaceWanted > region.tiles.length) continue; // too crowded to nest
    const ready = group.filter((d) => !d.baby && !d.sick && !d.escaped && d.happiness >= LAY_HAPPINESS && d.hunger < LAY_MAX_HUNGER);
    const bySpecies = new Map<string, Dino[]>();
    for (const d of ready) bySpecies.set(d.species, [...(bySpecies.get(d.species) ?? []), d]);
    for (const parents of bySpecies.values()) {
      const pairs = Math.floor(parents.length / 2);
      if (pairs === 0 || !rng.chance(1 - (1 - LAY_CHANCE) ** pairs)) continue;
      const mum = parents[rng.int(0, parents.length - 1)];
      state.eggs.push({ id: state.nextId++, species: mum.species, x: mum.x, y: mum.y, laidHour: state.hours });
      ctx.emit({ text: `🥚 ${dinoLabel(mum)} laid an egg! It should hatch in 2 days.`, kind: 'good' });
      break; // one egg per paddock at a time
    }
  }
}
