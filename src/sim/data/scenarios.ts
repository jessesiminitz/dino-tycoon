import { SPECIES_IDS, type SpeciesId } from './species';

export type GoalKind = 'dinos' | 'species' | 'dayVisitors' | 'reputation' | 'cash' | 'unlocked' | 'own';

export interface Goal {
  kind: GoalKind;
  target: number;
  /** For 'own': the species you need at least `target` of. */
  species?: SpeciesId;
}

export type ScenarioId = 'first-steps' | 'fossil-fever' | 'storm-coast' | 'rex-rising' | 'sandbox';

export interface Scenario {
  id: ScenarioId;
  name: string;
  blurb: string;
  /** 1–3 stars; 0 for the sandbox. */
  difficulty: number;
  startMoney: number;
  /** Fixed island so everyone plays the same map; null = random. */
  seed: number | null;
  /** Game days to meet the goals; 0 = no deadline. */
  days: number;
  goals: Goal[];
  /** Species available from the start (defaults to the six starters). */
  unlocked?: SpeciesId[];
  /** Multiplier on how often storms roll in. */
  stormRate?: number;
  tutorial?: boolean;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  'first-steps': {
    id: 'first-steps',
    name: 'First Steps',
    blurb: 'A gentle start with a guided tour. Build your first paddock, welcome your first dinosaurs and open the gates.',
    difficulty: 1,
    startMoney: 50_000,
    seed: 20231,
    days: 45,
    goals: [
      { kind: 'dinos', target: 4 },
      { kind: 'dayVisitors', target: 40 },
      { kind: 'reputation', target: 55 },
    ],
    tutorial: true,
  },
  'fossil-fever': {
    id: 'fossil-fever',
    name: 'Fossil Fever',
    blurb: 'Rumours say this island is rich in fossils. Dig up three new species and build a collection worth seeing.',
    difficulty: 2,
    startMoney: 45_000,
    seed: 77113,
    days: 150,
    goals: [
      { kind: 'unlocked', target: 9 },
      { kind: 'species', target: 6 },
      { kind: 'dinos', target: 10 },
    ],
  },
  'storm-coast': {
    id: 'storm-coast',
    name: 'Storm Coast',
    blurb: 'Gorgeous island, terrible weather. Storms hit three times as often. Keep your fences standing and your visitors dry.',
    difficulty: 2,
    startMoney: 60_000,
    seed: 5150,
    days: 120,
    goals: [
      { kind: 'dinos', target: 10 },
      { kind: 'reputation', target: 65 },
      { kind: 'cash', target: 100_000 },
    ],
    stormRate: 3,
  },
  'rex-rising': {
    id: 'rex-rising',
    name: 'Rex Rising',
    blurb: 'Start small and aim for the king. Find, house and show off a Tyrannosaurus rex to crowds of adoring fans.',
    difficulty: 3,
    startMoney: 40_000,
    seed: 1905,
    days: 300,
    goals: [
      { kind: 'own', target: 1, species: 'tyrannosaurus' },
      { kind: 'reputation', target: 75 },
      { kind: 'dayVisitors', target: 120 },
    ],
  },
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'No goals, no deadline, every species available and a healthy budget. Build the park of your dreams.',
    difficulty: 0,
    startMoney: 100_000,
    seed: null,
    days: 0,
    goals: [],
    unlocked: [...SPECIES_IDS],
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

/** A scenario is lost when cash sits below this at midnight (the bank steps in). */
export const BANKRUPT_BELOW = -25_000;
