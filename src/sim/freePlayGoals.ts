import type { GameState } from './GameState';
import { SPECIES_IDS } from './data/species';

/**
 * Free play has no deadline or medals, but a short track of things to aim
 * for, each with its sticker. Progress is worked out live from the park, so
 * nothing extra is saved.
 */
export interface FreePlayGoal {
  id: string;
  icon: string;
  label: string;
  target: number;
  value(state: GameState): number;
  /** The sticker that marks it in the sticker book. */
  sticker: string;
}

/** Different species living in the park right now (runaways don't count). */
export const speciesOnShow = (s: GameState) => new Set(s.dinos.filter((d) => !d.escaped).map((d) => d.species)).size;

export const FREE_PLAY_GOALS: FreePlayGoal[] = [
  { id: 'first-dino', icon: '🦕', label: 'Welcome your first dinosaur', target: 1, value: (s) => s.dinos.length, sticker: 'moment:first-dino' },
  { id: 'first-baby', icon: '🐣', label: 'Hatch a baby dinosaur', target: 1, value: (s) => s.stats.hatched, sticker: 'moment:hatch' },
  { id: 'crowd', icon: '👨‍👩‍👧', label: 'Welcome 200 visitors in one day', target: 200, value: (s) => Math.max(s.stats.bestDayVisitors, s.finance.today.visitors), sticker: 'moment:crowd-200' },
  { id: 'species', icon: '🦖', label: 'Show 10 different species', target: 10, value: speciesOnShow, sticker: 'moment:ten-species' },
  { id: 'every', icon: '🏛️', label: `Keep all ${SPECIES_IDS.length} species in your park`, target: SPECIES_IDS.length, value: speciesOnShow, sticker: 'moment:every-species' },
];

/** Whether this park follows the free-play track (free play, not a goal park or challenge). */
export const hasFreePlayGoals = (state: GameState): boolean => state.scenario.id === 'sandbox';

export function freePlayProgress(state: GameState): { goal: FreePlayGoal; value: number; done: boolean }[] {
  return FREE_PLAY_GOALS.map((goal) => {
    const value = goal.value(state);
    return { goal, value, done: value >= goal.target };
  });
}
