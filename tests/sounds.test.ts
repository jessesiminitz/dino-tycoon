import { describe, expect, it } from 'vitest';
import { CALLS, callFor } from '../src/audio/calls';
import { SPECIES_IDS } from '../src/sim/data/species';

describe('animal calls', () => {
  it('every species has its own call, within hearing range', () => {
    for (const id of SPECIES_IDS) {
      const c = CALLS[id];
      expect(c, id).toBeDefined();
      expect(c.pitch).toBeGreaterThan(40);
      expect(c.pitch).toBeLessThan(4000);
      expect(c.length).toBeGreaterThan(0.1);
      expect(c.length).toBeLessThanOrEqual(1.5);
    }
  });

  it('big animals sound deeper than small ones, and babies higher, shorter and softer', () => {
    expect(CALLS.tyrannosaurus.pitch).toBeLessThan(CALLS.velociraptor.pitch);
    expect(CALLS.brachiosaurus.pitch).toBeLessThan(CALLS.parasaurolophus.pitch);
    const grown = callFor('triceratops', false);
    const baby = callFor('triceratops', true);
    expect(baby.pitch).toBeGreaterThan(grown.pitch);
    expect(baby.length).toBeLessThan(grown.length);
    expect(baby.volume).toBeLessThan(grown.volume);
  });
});
