import { NEVER, type GameState } from './GameState';
import { MEDALS, SCENARIO_IDS, SCENARIOS, type ScenarioId } from './data/scenarios';
import { habitatOf, SPECIES, SPECIES_IDS } from './data/species';

/**
 * Stickers: a collection that lasts across every park on this device. The
 * rules here are pure (state in, sticker ids out); the UI keeps the album.
 */
export type StickerGroup = 'dinos' | 'babies' | 'medals' | 'moments';

export interface Sticker {
  id: string;
  group: StickerGroup;
  name: string;
  /** How to earn it, shown while it's still locked. */
  hint: string;
  /** Emoji for stickers that aren't a dinosaur picture. */
  icon?: string;
  species?: (typeof SPECIES_IDS)[number];
  scenario?: ScenarioId;
  round?: number;
}

interface Moment {
  id: string;
  name: string;
  icon: string;
  hint: string;
  earned: (s: GameState) => boolean;
}

const MOMENTS: Moment[] = [
  { id: 'moment:first-dino', name: 'First dinosaur', icon: '🦕', hint: 'Welcome your first dinosaur to the park.', earned: (s) => s.dinos.length > 0 },
  { id: 'moment:visitors', name: 'Open for business', icon: '🎟️', hint: 'Welcome your first visitors.', earned: (s) => s.stats.bestDayVisitors > 0 || s.visitors.length > 0 },
  { id: 'moment:crowd', name: 'Big crowd', icon: '👨‍👩‍👧', hint: 'Welcome 100 visitors in one day.', earned: (s) => Math.max(s.stats.bestDayVisitors, s.finance.today.visitors) >= 100 },
  { id: 'moment:treat', name: 'Treat time', icon: '🍖', hint: 'Give a dinosaur a treat.', earned: (s) => s.dinos.some((d) => d.lastTreatHour > NEVER) },
  { id: 'moment:photo', name: 'Say cheese!', icon: '📷', hint: 'Take a photo of a dinosaur.', earned: (s) => s.stats.photos > 0 },
  { id: 'moment:hatch', name: 'Hatchling', icon: '🐣', hint: 'Hatch a baby dinosaur.', earned: (s) => s.stats.hatched > 0 },
  { id: 'moment:five-stars', name: 'Five stars', icon: '⭐', hint: 'Get a 5-star review from a visitor.', earned: (s) => s.reviews.some((r) => r.stars === 5) },
  { id: 'moment:request', name: 'Happy to help', icon: '📋', hint: 'Complete a park request.', earned: (s) => s.stats.requestsDone > 0 },
  { id: 'moment:requests-10', name: 'Park favourite', icon: '🏅', hint: 'Complete 10 park requests.', earned: (s) => s.stats.requestsDone >= 10 },
  { id: 'moment:safari', name: 'On safari', icon: '🚙', hint: 'Take visitors on a safari jeep ride.', earned: (s) => s.visitors.some((v) => v.rode.includes('jeep')) || s.jeeps.some((j) => j.riders.length > 0) },
  { id: 'moment:lagoon', name: 'Splash!', icon: '🌊', hint: 'Keep a sea reptile in a lagoon.', earned: (s) => s.dinos.some((d) => habitatOf(d.species) === 'water') },
  { id: 'moment:aviary', name: 'Taking flight', icon: '🪽', hint: 'Keep a flying reptile in an aviary.', earned: (s) => s.dinos.some((d) => habitatOf(d.species) === 'air') },
  { id: 'moment:fossil', name: 'Fossil hunter', icon: '🦴', hint: 'Dig up a fossil by brushing away the sand.', earned: () => false }, // awarded by the dig mini-game
  { id: 'moment:all-species', name: 'The whole collection', icon: '🏛️', hint: 'Unlock every species.', earned: (s) => s.unlockedSpecies.length >= SPECIES_IDS.length },
];

/** Every sticker in the book, in page order. */
export const STICKERS: Sticker[] = [
  ...SPECIES_IDS.map((id) => ({ id: `dino:${id}`, group: 'dinos' as const, species: id, name: SPECIES[id].name, hint: `Keep a ${SPECIES[id].name} in your park.` })),
  ...SPECIES_IDS.map((id) => ({
    id: `baby:${id}`,
    group: 'babies' as const,
    species: id,
    name: `Baby ${SPECIES[id].name}`,
    hint: `Raise a baby ${SPECIES[id].name}: a happy pair with room to spare will have one.`,
  })),
  ...SCENARIO_IDS.filter((id) => SCENARIOS[id].rounds.length).flatMap((scenario) =>
    MEDALS.map((m, round) => ({
      id: `medal:${scenario}:${round}`,
      group: 'medals' as const,
      scenario,
      round,
      icon: m.icon,
      name: `${SCENARIOS[scenario].name}: ${m.name}`,
      hint: `Reach the ${m.name} milestone in ${SCENARIOS[scenario].name}.`,
    })),
  ),
  ...MOMENTS.map((m) => ({ id: m.id, group: 'moments' as const, name: m.name, icon: m.icon, hint: m.hint })),
];

export const STICKER_GROUPS: { id: StickerGroup; name: string }[] = [
  { id: 'dinos', name: 'Dinosaurs' },
  { id: 'babies', name: 'Babies' },
  { id: 'medals', name: 'Trophy room' },
  { id: 'moments', name: 'Park moments' },
];

/** Stickers this park has earned (whether or not they're already in the album). */
export function earnedStickers(state: GameState): string[] {
  const out = new Set<string>();
  for (const d of state.dinos) {
    out.add(`dino:${d.species}`);
    if (d.baby) out.add(`baby:${d.species}`);
  }
  // A baby sticker is earned while the baby is little (the album keeps it after it grows up).
  for (let round = 0; round < state.scenario.round; round++) out.add(`medal:${state.scenario.id}:${round}`);
  for (const m of MOMENTS) if (m.earned(state)) out.add(m.id);
  return [...out].filter((id) => STICKERS.some((s) => s.id === id));
}
