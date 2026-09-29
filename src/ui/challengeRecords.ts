import { CHALLENGE_IDS, type ScenarioId } from '../sim/data/scenarios';

/**
 * Best medals earned in each challenge on this device (0–3), kept apart from
 * park saves: they decide which challenges are unlocked.
 */
const KEY = 'dino-tycoon-challenges';

type Records = Partial<Record<ScenarioId, number>>;

function load(): Records {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Records) ?? {};
  } catch {
    return {};
  }
}

export function bestMedals(id: ScenarioId): number {
  return load()[id] ?? 0;
}

/** Remembers a new best (never lowers it). */
export function recordMedals(id: ScenarioId, medals: number): void {
  if (!CHALLENGE_IDS.includes(id)) return;
  const records = load();
  if ((records[id] ?? 0) >= medals) return;
  records[id] = medals;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Private mode or storage full: the medal still counts in the park itself.
  }
}

/** The first challenge is always open; each later one opens with any medal on the one before. */
export function challengeUnlocked(id: ScenarioId): boolean {
  const i = CHALLENGE_IDS.indexOf(id);
  return i <= 0 || bestMedals(CHALLENGE_IDS[i - 1]) >= 1;
}
