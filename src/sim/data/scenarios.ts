import { SPECIES_IDS, type SpeciesId } from './species';
import type { IslandShape } from '../island';

export type GoalKind =
  | 'dinos'
  | 'species'
  | 'dayVisitors'
  | 'reputation'
  | 'cash'
  | 'unlocked'
  | 'own'
  /** Days in a row ending in profit. */
  | 'profitStreak'
  /** Every bank loan paid off (target 1). */
  | 'debtFree'
  /** Percent of dinosaurs back inside their paddocks. */
  | 'dinosHome'
  /** Days since the last escape. */
  | 'calmDays'
  /** Percent of fence sections in good repair. */
  | 'fencesOk';

export interface Goal {
  kind: GoalKind;
  target: number;
  /** For 'own': the species you need at least `target` of. */
  species?: SpeciesId;
}

export type ScenarioId = 'first-steps' | 'fossil-fever' | 'storm-coast' | 'rex-rising' | 'sandbox' | 'great-escape' | 'money-pit';

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

/** A message (and maybe a nudge to the park) at a set hour after the scenario starts. */
export interface StoryEvent {
  hour: number;
  text: string;
  kind: 'info' | 'good' | 'bad';
}

export interface Scenario {
  id: ScenarioId;
  /** New Builds start on an empty island; Challenges start in a prebuilt park in trouble. */
  category?: 'build' | 'challenge';
  name: string;
  blurb: string;
  /** 1–3 stars; 0 for the sandbox. */
  difficulty: number;
  startMoney: number;
  /** Fixed island so everyone plays the same map; null = random. */
  seed: number | null;
  /** The kind of island (classic when left out; Sandbox lets you choose). */
  island?: IslandShape;
  /** Bronze, Silver and Gold milestones, each harder than the last (empty for the sandbox). */
  rounds: Round[];
  /** Species available from the start (defaults to the six starters). */
  unlocked?: SpeciesId[];
  /** Multiplier on how often storms roll in. */
  stormRate?: number;
  tutorial?: boolean;
  /** A big 96 × 72 island. */
  big?: boolean;
  /** The story card shown when a challenge starts. */
  briefing?: { icon: string; story: string; tip: string };
  /** Scripted story messages, in hour order. */
  timeline?: StoryEvent[];
  /** Extra ways to lose, checked at midnight. */
  loseIf?: { reputationBelow?: number; dinosLostAbove?: number };
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
    island: 'river',
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
    island: 'crescent',
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
    island: 'fire',
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
  'great-escape': {
    id: 'great-escape',
    category: 'challenge',
    name: 'The Great Escape',
    blurb: 'A storm knocked the power out overnight and every paddock is open. Round up the dinosaurs before the day is out!',
    difficulty: 1,
    startMoney: 30_000,
    seed: 4242,
    briefing: {
      icon: '🚨',
      story:
        'Last night a storm knocked out the power and broke the fences. This morning every dinosaur is wandering the park, and visitors are hiding in the gift shop! Your one guard can’t catch them all alone, and your only worker is off sick.',
      tip: 'Hire more 👮 guards (📊 Park → Staff) to bring dinosaurs home, and 🔧 workers to fix the fences. You can 🚪 close the park (📊 Park → Overview) to send visitors home while you sort it out.',
    },
    timeline: [
      { hour: 2, text: '📻 Keeper’s radio: guards bring loose dinos home. The more guards, the faster it goes!', kind: 'info' },
      { hour: 8, text: '📻 Keeper’s radio: broken fences let dinos straight back out. Workers fix them.', kind: 'info' },
      { hour: 30, text: '📻 Keeper’s radio: the hungry raptor is looking for a snack. Get it home first!', kind: 'bad' },
    ],
    loseIf: { dinosLostAbove: 3 },
    rounds: [
      {
        goals: [{ kind: 'dinosHome', target: 100 }],
        days: 2,
        reward: { money: 10_000 },
      },
      {
        goals: [
          { kind: 'fencesOk', target: 90 },
          { kind: 'calmDays', target: 5 },
        ],
        days: 15,
        reward: { unlock: ['ankylosaurus'], money: 15_000 },
      },
      {
        goals: [
          { kind: 'reputation', target: 65 },
          { kind: 'dayVisitors', target: 60 },
        ],
        days: 30,
        reward: { money: 30_000 },
      },
    ],
  },
  'money-pit': {
    id: 'money-pit',
    category: 'challenge',
    name: 'The Money Pit',
    blurb: 'A grand old park that loses money every single day. Cut the waste, win back the crowds, and pay off the bank.',
    difficulty: 2,
    startMoney: 12_000,
    seed: 8014,
    big: true,
    briefing: {
      icon: '💸',
      story:
        'The last owner spent big: crowds of staff, fancy buildings, huge loans. Then they sold most of the dinosaurs to pay the bank, so paddocks stand empty and hardly anyone visits. The park loses money every day. If it runs out, the bank takes over!',
      tip: 'Open 📊 Park → Finances to see where the money goes: too many staff, buildings nobody can reach, tickets too dear. Stop the losses first, then fill those empty paddocks.',
    },
    timeline: [
      { hour: 6, text: '🏦 The bank: “We’re watching your accounts closely.”', kind: 'info' },
      { hour: 40, text: '💡 Tip: a building visitors can’t reach still costs upkeep every night.', kind: 'info' },
      { hour: 90, text: '🏦 The bank: “Paying off your loans early saves a lot of interest.”', kind: 'info' },
    ],
    rounds: [
      {
        goals: [{ kind: 'profitStreak', target: 3 }],
        days: 14,
        reward: { money: 10_000 },
      },
      {
        goals: [
          { kind: 'debtFree', target: 1 },
          { kind: 'reputation', target: 65 },
        ],
        days: 75,
        reward: { unlock: ['brachiosaurus'], money: 20_000 },
      },
      {
        goals: [
          { kind: 'cash', target: 250_000 },
          { kind: 'dinos', target: 30 },
        ],
        days: 90,
        reward: { money: 50_000 },
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
/** Challenges in unlock order, easiest first: any medal on one opens the next. */
export const CHALLENGE_IDS: ScenarioId[] = ['great-escape', 'money-pit'];
export const BUILD_IDS = SCENARIO_IDS.filter((id) => SCENARIOS[id].category !== 'challenge');

/** A scenario is lost when cash sits below this at midnight (the bank steps in). */
export const BANKRUPT_BELOW = -25_000;
