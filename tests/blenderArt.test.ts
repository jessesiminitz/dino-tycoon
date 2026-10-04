import { describe, expect, it } from 'vitest';
import { BLENDER_ART } from '../src/render/generated/blenderArt';
import { dinoFrameCount, dinoShape } from '../src/render/dinoArt';
import { SPECIES, SPECIES_IDS } from '../src/sim/data/species';
import { walkFrame } from '../src/render/dinoAnimation';

describe('Blender sprite contracts', () => {
  for (const id of ['tyrannosaurus', 'triceratops'] as const) {
    it(`${id} keeps its registered footprint and baby face in all four poses`, () => {
      const asset = BLENDER_ART[id];
      expect(dinoFrameCount(id, 'blender')).toBe(4);
      expect(dinoFrameCount(id, 'original')).toBe(2);
      expect(new Set(asset.frames.map((rows) => rows.join('\n'))).size).toBe(4);
      const original = dinoShape(SPECIES[id], 0, false, 'original');
      for (let frame = 0; frame < 4; frame++) {
        const grown = dinoShape(SPECIES[id], frame, false, 'blender');
        expect(grown.length).toBe(original.length);
        expect(grown.every((row) => row.length === original[0].length)).toBe(true);
        expect(grown.at(-1)?.some(Boolean)).toBe(true);
        expect(grown.flat().includes('E')).toBe(true);
        const baby = dinoShape(SPECIES[id], frame, true, 'blender');
        expect(baby.flat().includes('E')).toBe(true);
        expect(baby.length).toBe(Math.ceil(asset.height * 0.6));
      }
    });
  }

  it('preserves procedural fallback art for every species outside the pilot', () => {
    for (const id of SPECIES_IDS.filter((id) => !(id in BLENDER_ART))) {
      expect(dinoFrameCount(id, 'blender')).toBe(2);
      for (const frame of [0, 1]) {
        expect(dinoShape(SPECIES[id], frame, false, 'blender')).toEqual(dinoShape(SPECIES[id], frame, false, 'original'));
      }
    }
  });

  it('returns independent masks and rejects invalid poses', () => {
    const shape = dinoShape(SPECIES.tyrannosaurus, 0, false, 'blender');
    const unchanged = shape[10][57];
    shape[10][57] = null;
    expect(dinoShape(SPECIES.tyrannosaurus, 0, false, 'blender')[10][57]).toBe(unchanged);
    for (const frame of [-1, 0.5, 4, NaN]) expect(() => dinoShape(SPECIES.tyrannosaurus, frame, false, 'blender')).toThrow(RangeError);
  });
});

describe('movement pose selection', () => {
  it('selects every pose over one movement step and holds at idle, pause or sleep', () => {
    expect([0, 0.25, 0.5, 0.75].map((p) => walkFrame(4, true, p, false, false))).toEqual([0, 1, 2, 3]);
    expect(walkFrame(4, true, 1, false, false)).toBe(3);
    expect(walkFrame(4, false, 0.75, false, false)).toBe(0);
    expect(walkFrame(4, true, 0.75, true, false)).toBe(0);
    expect(walkFrame(4, true, 0.75, false, true)).toBe(0);
    expect(walkFrame(2, true, 0.75, false, false)).toBe(1);
  });
});
