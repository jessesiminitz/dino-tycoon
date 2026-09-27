import { SPECIES_IDS, type SpeciesId } from './species';

export type GoalKind = 'dinos' | 'species' | 'dayVisitors' | 'reputation' | 'cash' | 'unlocked' | 'own';

export interface Goal {
  kind: GoalKind;
  target: number;
  /** For 'own': the species you need at least `target` of. */
  species?: SpeciesId;
}

export type ScenarioId = 'first-steps' | 'fossil-fever' | 'storm-coast' | 'rex-rising' | 'sandbox';

/** What finishing a round of milestones earns. */
export interface Reward {
  /** Species unlocked for the catalog (a cash bonus instead if you already have it). */
  unlock?: SpeciesId[];
  money?: number;
}

/** One round of milestones: goals to meet within `days` of the round starting. */
export interface Round {
  goals: Goal[];
  /** Game days allowed for this round; 0 = no deadline. */
  days: number;
  reward: Reward;
}

export const MEDALS = [
  { icon: '🥉', name: 'Bronze' },
  { icon: '🥈', name: 'Silver' },
  { icon: '🥇', name: 'Gold' },
] as const;

export interface Scenario {
  id: ScenarioId;
  name: string;
  blurb: string;
  /** 1–3 stars; 0 for the sandbox. */
  difficulty: number;
  startMoney: number;
  /** Fixed island so everyone plays the same map; null = random. */
  seed: number | null;
  /** Bronze, Silver and Gold milestones, each harder than the last (empty for the sandbox). */
  rounds: Round[];
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
    rounds: [
      {
        goals: [
          { kind: 'dinos', target: 4 },
          { kind: 'dayVisitors', target: 40 },
          { kind: 'reputation', target: 55 },
        ],
        days: 45,
        reward: { unlock: ['pachycephalosaurus'], money: 5_000 },
      },
      {
        goals: [
          { kind: 'dinos', target: 8 },
          { kind: 'species', target: 4 },
          { kind: 'dayVisitors', target: 80 },
          { kind: 'reputation', target: 65 },
        ],
        days: 60,
        reward: { unlock: ['ankylosaurus'], money: 10_000 },
      },
      {
        goals: [
          { kind: 'dinos', target: 12 },
          { kind: 'species', target: 6 },
          { kind: 'dayVisitors', target: 120 },
          { kind: 'cash', target: 100_000 },
        ],
        days: 90,
        reward: { unlock: ['velociraptor'], money: 25_000 },
      },
    ],
    tutorial: true,
  },
  'fossil-fever': {
    id: 'fossil-fever',
    name: 'Fossil Fever',
    blurb: 'Rumours say this island is rich in fossils. Dig up new species and build a collection worth seeing.',
    difficulty: 2,
    startMoney: 45_000,
    seed: 77113,
    rounds: [
      {
        goals: [
          { kind: 'unlocked', target: 9 },
          { kind: 'species', target: 6 },
          { kind: 'dinos', target: 10 },
        ],
        days: 150,
        reward: { money: 15_000 },
      },
      {
        goals: [
          { kind: 'unlocked', target: 11 },
          { kind: 'species', target: 8 },
          { kind: 'dayVisitors', target: 100 },
        ],
        days: 120,
        reward: { unlock: ['allosaurus'], money: 20_000 },
      },
      {
        goals: [
          { kind: 'unlocked', target: 12 },
          { kind: 'species', target: 10 },
          { kind: 'reputation', target: 80 },
        ],
        days: 150,
        reward: { money: 50_000 },
      },
    ],
  },
  'storm-coast': {
    id: 'storm-coast',
    name: 'Storm Coast',
    blurb: 'Gorgeous island, terrible weather. Storms hit three times as often. Keep your fences standing and your visitors dry.',
    difficulty: 2,
    startMoney: 60_000,
    seed: 5150,
    rounds: [
      {
        goals: [
          { kind: 'dinos', target: 10 },
          { kind: 'reputation', target: 65 },
          { kind: 'cash', target: 100_000 },
        ],
        days: 120,
        reward: { unlock: ['ankylosaurus'], money: 10_000 },
      },
      {
        goals: [
          { kind: 'dinos', target: 16 },
          { kind: 'reputation', target: 72 },
          { kind: 'cash', target: 200_000 },
        ],
        days: 100,
        reward: { unlock: ['allosaurus'], money: 20_000 },
      },
      {
        goals: [
          { kind: 'dinos', target: 22 },
          { kind: 'dayVisitors', target: 150 },
          { kind: 'cash', target: 350_000 },
        ],
        days: 120,
        reward: { unlock: ['brachiosaurus'], money: 40_000 },
      },
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
    rounds: [
      {
        goals: [
          { kind: 'own', target: 1, species: 'tyrannosaurus' },
          { kind: 'reputation', target: 75 },
          { kind: 'dayVisitors', target: 120 },
        ],
        days: 300,
        reward: { unlock: ['brachiosaurus'], money: 40_000 },
      },
      {
        goals: [
          { kind: 'own', target: 2, species: 'tyrannosaurus' },
          { kind: 'species', target: 10 },
          { kind: 'dayVisitors', target: 180 },
        ],
        days: 150,
        reward: { unlock: [...SPECIES_IDS], money: 60_000 },
      },
      {
        goals: [
          { kind: 'dinos', target: 30 },
          { kind: 'reputation', target: 85 },
          { kind: 'cash', target: 500_000 },
        ],
        days: 200,
        reward: { money: 100_000 },
      },
    ],
  },
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'No goals, no deadline, every species available and a healthy budget. Build the park of your dreams.',
    difficulty: 0,
    startMoney: 100_000,
    seed: null,
    rounds: [],
    unlocked: [...SPECIES_IDS],
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

/** A scenario is lost when cash sits below this at midnight (the bank steps in). */
export const BANKRUPT_BELOW = -25_000;
