import { describe, expect, it } from 'vitest';
import { dinoReaction, REACTION_MS } from '../src/render/dinoReaction';
import { SPECIES_IDS } from '../src/sim/data/species';
describe('playful care reactions', () => {
  it('distinguishes happy land hops, wing flutters and swimmer dips', () => {
    expect(dinoReaction('compsognathus','pat',300).lift).toBeGreaterThan(dinoReaction('tyrannosaurus','pat',300).lift);
    expect(dinoReaction('pteranodon','pat',300)).toMatchObject({clip:'walk'});
    expect(dinoReaction('mosasaurus','pat',900).lift).toBeLessThan(0);
  });
  it('shows eight treat-chewing poses and returns cleanly to normal movement', () => {
    for(const id of SPECIES_IDS) {
      expect([...Array(8)].map((_,i)=>dinoReaction(id,'treat',i*REACTION_MS/8).frame)).toEqual([0,1,2,3,4,5,6,7]);
      expect(dinoReaction(id,'treat',REACTION_MS)).toEqual({frame:0,lift:0,angle:0});
      expect(dinoReaction(id,'pat',REACTION_MS)).toEqual({frame:0,lift:0,angle:0});
    }
  });
  it('keeps feedback still when ambient animation is disabled', () => {
    expect(dinoReaction('compsognathus','pat',300,false)).toMatchObject({frame:0,lift:0,angle:0});
    expect(dinoReaction('compsognathus','treat',300,false)).toMatchObject({clip:'eat',frame:0,lift:0,angle:0});
  });
});
