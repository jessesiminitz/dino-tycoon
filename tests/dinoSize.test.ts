import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_IDS, habitatOf, type SpeciesId } from '../src/sim/data/species';
import { dinoShape } from '../src/render/dinoArt';
import { dinoWorldScale } from '../src/render/dinoSize';

function visibleWidth(id: SpeciesId): number {
  const rows = dinoShape(SPECIES[id], 0, false, 'blender', dinoWorldScale(id, 'blender'));
  const xs = rows.flatMap(row => row.flatMap((pixel, x) => pixel ? [x] : []));
  return Math.max(...xs) - Math.min(...xs) + 1;
}

describe('park dinosaur sizes', () => {
  it('restores a little Compsognathus beside people and the larger animals', () => {
    const comp = dinoShape(SPECIES.compsognathus, 0, false, 'blender', dinoWorldScale('compsognathus', 'blender'));
    expect(comp.length).toBeLessThan(10);
    expect(visibleWidth('compsognathus')).toBeLessThan(25);
    expect(visibleWidth('tyrannosaurus')).toBeGreaterThan(4 * visibleWidth('compsognathus'));
    expect(visibleWidth('diplodocus')).toBeGreaterThan(7 * visibleWidth('compsognathus'));
  });

  it('keeps the small, medium and giant animals visibly different', () => {
    const ordered: SpeciesId[] = ['microraptor', 'velociraptor', 'kentrosaurus', 'stegosaurus', 'tyrannosaurus', 'diplodocus'];
    for (let i = 1; i < ordered.length; i++) expect(visibleWidth(ordered[i])).toBeGreaterThan(visibleWidth(ordered[i - 1]));
    expect(visibleWidth('argentinosaurus')).toBeGreaterThan(visibleWidth('tyrannosaurus'));
  });

  for (const id of SPECIES_IDS) it(`${id} keeps its face, feet and smaller baby across every pose`, () => {
    const scale = dinoWorldScale(id, 'blender');
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(1.15);
    for (let pose = 0; pose < 4; pose++) {
      const adult = dinoShape(SPECIES[id], pose, false, 'blender', scale);
      const baby = dinoShape(SPECIES[id], pose, true, 'blender', scale);
      expect(adult.flat()).toContain('E');
      expect(baby.flat()).toContain('E');
      expect(baby.length).toBeLessThan(adult.length);
      expect(baby[0].length).toBeLessThan(adult[0].length);
      if (habitatOf(id) !== 'air') {
        expect(adult.slice(-2).flat().some(Boolean)).toBe(true);
        expect(baby.slice(-2).flat().some(Boolean)).toBe(true);
      }
    }
  });
});
