import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { SPECIES_IDS, STARTER_SPECIES } from '../src/sim/data/species';
import { FREE_PLAY_GOALS, freePlayProgress, hasFreePlayGoals } from '../src/sim/freePlayGoals';
import { STICKERS } from '../src/sim/stickers';
import { lockedSpecies } from '../src/sim/systems/fossils';

describe('free play', () => {
  it('can start with the starter species and dig up the rest, or with every species', () => {
    const dig = newPark('sandbox', 7, {}, { discover: true });
    expect([...dig.unlockedSpecies].sort()).toEqual([...STARTER_SPECIES].sort());
    expect(lockedSpecies(dig)).toHaveLength(SPECIES_IDS.length - STARTER_SPECIES.length);
    expect(dig.fossilBeds.length).toBeGreaterThan(0);
    const all = newPark('sandbox', 7);
    expect(all.unlockedSpecies).toHaveLength(SPECIES_IDS.length);
    // Goal parks and challenges keep their own species lists.
    expect(newPark('first-steps', 7, {}, { discover: true }).unlockedSpecies).toEqual(newPark('first-steps', 7).unlockedSpecies);
  });

  it('has a goal track with a sticker for each goal, worked out from the park', () => {
    const s = newPark('sandbox', 7);
    expect(hasFreePlayGoals(s)).toBe(true);
    expect(hasFreePlayGoals(newPark('first-steps', 7))).toBe(false);
    for (const g of FREE_PLAY_GOALS) expect(STICKERS.some((st) => st.id === g.sticker), g.sticker).toBe(true);
    expect(freePlayProgress(s).every((g) => !g.done)).toBe(true);
    s.stats.hatched = 1;
    s.stats.bestDayVisitors = 200;
    const done = freePlayProgress(s).filter((g) => g.done).map((g) => g.goal.id);
    expect(done).toEqual(['first-baby', 'crowd']);
  });
});
