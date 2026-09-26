import { calendar, type GameState } from '../GameState';
import { DIG_FIND_CHANCE, MUSEUM_PRICE, ROCK_DIG_BONUS } from '../data/economy';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../data/species';
import { earn } from '../finance';
import { Terrain } from '../terrain';
import type { SimContext } from './context';

/** "a" or "an", by the sound of the next word's first letter (good enough for species names). */
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const BONES = ['claw', 'tooth', 'vertebra', 'rib', 'thigh bone', 'skull fragment', 'toe bone', 'jaw'];

export function lockedSpecies(state: GameState): SpeciesId[] {
  return SPECIES_IDS.filter((id) => !state.unlockedSpecies.includes(id));
}

/** Nightly chance of a find at a dig site: better on rocky ground. */
export function digChance(state: GameState, x: number, y: number): number {
  const rocky = state.map.tiles[y * state.map.width + x] === Terrain.Rock;
  return Math.min(0.9, DIG_FIND_CHANCE * (rocky ? ROCK_DIG_BONUS : 1));
}

/** At midnight each dig site may find a fossil; enough fragments of a species unlock it. */
export function hourlyFossils(ctx: SimContext): void {
  const { state, rng } = ctx;
  if (calendar(state).hour !== 0) return;

  for (const site of state.buildings) {
    if (site.kind !== 'digsite' || !rng.chance(digChance(state, site.x, site.y))) continue;
    const locked = lockedSpecies(state);
    if (locked.length === 0) {
      earn(state, 'sales', MUSEUM_PRICE);
      ctx.emit({ text: `🦴 The dig crew sold a fossil to a museum for $${MUSEUM_PRICE}`, kind: 'good' });
      continue;
    }
    // Rarer species turn up less often.
    const total = locked.reduce((s, id) => s + SPECIES[id].fossilWeight, 0);
    let roll = rng.next() * total;
    const found = locked.find((id) => (roll -= SPECIES[id].fossilWeight) < 0) ?? locked[locked.length - 1];
    const sp = SPECIES[found];
    const have = (state.fossils[found] ?? 0) + 1;
    state.fossils[found] = have;
    const bone = BONES[rng.int(0, BONES.length - 1)];
    if (have >= sp.fossilsNeeded) {
      state.unlockedSpecies.push(found);
      ctx.emit({ text: `🦴 ${sp.name} unlocked! ${article(bone) === 'an' ? 'An' : 'A'} ${bone} completed the find. Buy them in the Dinos catalog.`, kind: 'good' });
    } else {
      ctx.emit({ text: `🦴 Fossil find: ${article(sp.name)} ${sp.name} ${bone} (${have}/${sp.fossilsNeeded})`, kind: 'good' });
    }
  }
}
