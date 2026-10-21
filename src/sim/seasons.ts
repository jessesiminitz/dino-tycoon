import type { GameState } from './GameState';
import { START_HOUR } from './GameState';

/**
 * The park's year: four seasons of a week each. Seasons are pure calendar
 * data derived from `state.hours`, so they need no save fields. Day 1 falls
 * mid-spring, so a new park opens green and in blossom.
 */
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];
export const DAYS_PER_SEASON = 7;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
/** Year-day (0 = first morning of spring) of the park's first day. */
export const FIRST_DAY_OF_YEAR = 3;

export const SEASON_INFO: Record<Season, { name: string; icon: string }> = {
  spring: { name: 'Spring', icon: '🌸' },
  summer: { name: 'Summer', icon: '☀️' },
  fall: { name: 'Fall', icon: '🍂' },
  winter: { name: 'Winter', icon: '❄️' },
};

/** Days since the start of spring, with the hour as a fraction (0 ≤ t < 28). */
export function yearDay(state: Pick<GameState, 'hours'>, hourFraction = 0): number {
  const days = (state.hours + START_HOUR + hourFraction) / 24 + FIRST_DAY_OF_YEAR;
  return ((days % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
}

export function seasonAt(t: number): { season: Season; day: number } {
  const i = Math.floor(t / DAYS_PER_SEASON) % SEASONS.length;
  return { season: SEASONS[i], day: Math.floor(t - i * DAYS_PER_SEASON) + 1 };
}

export function currentSeason(state: Pick<GameState, 'hours'>): { season: Season; day: number } {
  return seasonAt(yearDay(state));
}

// --- Scenery --------------------------------------------------------------

const smooth = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/**
 * Snow on open ground, 0–1. The first flakes settle late in fall, winter is
 * white, and early spring melts it away.
 */
export function snowCover(t: number): number {
  if (t < 4) return 0.9 * (1 - smooth(0, 3, t)); // spring thaw
  if (t < 18.5) return 0;
  if (t < 21) return 0.4 * smooth(18.5, 21, t); // first snow
  return 0.4 + 0.5 * smooth(21, 23.5, t); // winter
}

/** Whether snow is still settling (for falling flakes). */
export function snowFalling(t: number): boolean {
  return t >= 18.5 && t < 24;
}

/** How a leafy plant looks: from buds through summer green, autumn colour and bare winter twigs. */
export type LeafStage = 'bare' | 'buds' | 'blossom' | 'fresh' | 'green' | 'turning' | 'autumn' | 'falling';

/**
 * Leaf stage for a deciduous plant. `offset` (−1…1 days) staggers each plant,
 * so a forest turns and greens up gradually rather than all at once.
 */
export function leafStage(t: number, offset: number): LeafStage {
  const d = (((t + offset) % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  if (d < 1.5) return 'bare';
  if (d < 3.2) return 'buds';
  if (d < 5.5) return 'blossom';
  if (d < 8) return 'fresh';
  if (d < 14.5) return 'green';
  if (d < 16) return 'turning';
  if (d < 18) return 'autumn';
  if (d < 19.5) return 'falling';
  return 'bare';
}

/** Ground tone: fresh in spring, rich in summer, golden in fall, dull under winter snow. */
export type GroundTone = 'fresh' | 'summer' | 'golden' | 'dull';
export function groundTone(t: number): GroundTone {
  if (t < 3) return 'dull';
  if (t < 8) return 'fresh';
  if (t < 15) return 'summer';
  if (t < 19.5) return 'golden';
  return 'dull';
}
