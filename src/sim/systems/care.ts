import type { Dino, GameState } from '../GameState';
import type { CommandResult } from '../commands';
import { SPECIES } from '../data/species';
import { spend } from '../finance';
import { dinoLabel } from './dinos';

export type CareEffect = 'hearts' | 'snap';

export const TREAT_COST = 25;
/** A treat lifts happiness this much, for this many game-hours; one per animal per hour. */
export const TREAT_JOY = 10;
export const TREAT_HOURS = 6;
/** A pat: a smaller, shorter lift, counted once an hour (the hearts are free any time). */
export const PAT_JOY = 4;
export const PAT_HOURS = 3;
/** Meat-eaters this hungry would rather bite the hand than be patted. */
const SNAPPY_HUNGER = 50;

/** Happiness still owed to recent treats and pats (added on top of the hourly mood). */
export function careJoy(state: GameState, d: Dino): number {
  return (state.hours - d.lastTreatHour < TREAT_HOURS ? TREAT_JOY : 0) + (state.hours - d.lastPatHour < PAT_HOURS ? PAT_JOY : 0);
}

function reachable(state: GameState, id: number): Dino | string {
  const d = state.dinos.find((x) => x.id === id);
  if (!d) return 'That dinosaur is gone';
  if (d.escaped) return `${d.name} is running loose! Send a guard first.`;
  return d;
}

/** Hungry meat-eaters (grown-ups) snap instead of enjoying a pat. */
export function wouldSnap(d: Dino): boolean {
  return SPECIES[d.species].diet === 'carnivore' && !d.baby && d.hunger >= SNAPPY_HUNGER;
}

export function treatDino(state: GameState, id: number): CommandResult {
  const d = reachable(state, id);
  if (typeof d === 'string') return { ok: false, message: d };
  if (state.hours - d.lastTreatHour < 1) return { ok: false, message: `${d.name} has just had a treat. Try again in a little while.` };
  if (state.money < TREAT_COST) return { ok: false, message: `Not enough money: treats cost $${TREAT_COST}` };
  spend(state, 'treats', TREAT_COST);
  d.lastTreatHour = state.hours;
  d.happiness = Math.min(100, d.happiness + TREAT_JOY);
  d.hunger = Math.max(0, d.hunger - 5);
  const yum = SPECIES[d.species].diet === 'carnivore' ? 'gobbled up a meaty treat' : 'munched a crunchy treat';
  return { ok: true, cost: TREAT_COST, message: `${dinoLabel(d)} ${yum}!`, effect: 'hearts' };
}

export function patDino(state: GameState, id: number): CommandResult {
  const d = reachable(state, id);
  if (typeof d === 'string') return { ok: false, message: d };
  if (wouldSnap(d)) return { ok: true, cost: 0, message: `Nope! ${d.name} is too hungry for cuddles. Try a treat!`, effect: 'snap' };
  if (state.hours - d.lastPatHour >= 1) {
    d.lastPatHour = state.hours;
    d.happiness = Math.min(100, d.happiness + PAT_JOY);
  }
  return { ok: true, cost: 0, message: d.baby ? `${d.name} snuggles up happily!` : `${d.name} loves that!`, effect: 'hearts' };
}
