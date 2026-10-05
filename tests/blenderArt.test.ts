import walkContacts from '../assets-source/walk-contacts.json';
import { describe, expect, it } from 'vitest';
import { BLENDER_ART, BLENDER_BUILDING_COLORS } from '../src/render/generated/blenderArt';
import { dinoFrameCount, dinoShape } from '../src/render/dinoArt';
import { SPECIES, SPECIES_IDS } from '../src/sim/data/species';
import { BUILDING_TYPES } from '../src/sim/data/economy';
import { walkFrame } from '../src/render/dinoAnimation';

describe('Blender sprite contracts', () => {
  for (const id of SPECIES_IDS) {
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
        if (!['water','air'].includes(SPECIES[id].habitat ?? 'land')) expect(grown.at(-1)?.some(Boolean)).toBe(true);
        expect(grown.flat().includes('E')).toBe(true);
        const baby = dinoShape(SPECIES[id], frame, true, 'blender');
        expect(baby.flat().includes('E')).toBe(true);
        expect(baby.length).toBe(Math.ceil(asset.height * 0.6));
      }
    });
  }

  it('covers every species and park building', () => {
    expect(SPECIES_IDS.every((id) => id in BLENDER_ART)).toBe(true);
    for (const id of Object.keys(BUILDING_TYPES)) {
      expect(id in BLENDER_ART).toBe(true);
      const asset = BLENDER_ART[id as keyof typeof BLENDER_ART];
      expect(asset.frames.length).toBe(1);
      expect(asset.frames[0].join('').replaceAll('.', '').length).toBeGreaterThan(20);
      const palette = BLENDER_BUILDING_COLORS[id];
      for (const key of new Set(asset.frames[0].join('').replaceAll('.', ''))) expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('plants feet while they move backward and lifts them to swing forward, facing either way', () => {
    const contacts = walkContacts as Record<string, {x:number;y:number;right:number}[]>;
    const land = SPECIES_IDS.filter((id) => !['water','air'].includes(SPECIES[id].habitat ?? 'land'));
    expect(Object.keys(contacts).sort()).toEqual([...land].sort());
    for (const id of land) {
      const [front, middle, back, swing] = contacts[id];
      const asset = BLENDER_ART[id];
      expect(front.y).toBe(asset.height);
      expect(middle.y).toBe(front.y);
      expect(back.y).toBe(front.y);
      expect(swing.y).toBeLessThan(front.y - 1);
      expect(front.x).toBeGreaterThan(middle.x);
      expect(middle.x).toBeGreaterThan(back.x);
      expect(swing.x).toBeGreaterThan(back.x);
      // Confirm the actual exported toe pixels touch the ground during stance.
      for (const f of [0,1,2]) expect(asset.frames[f][asset.height-1][Math.floor(contacts[id][f].x)], `${id}:${f} planted toe`).not.toBe('.');
      for (const facing of [1,-1]) {
        const stride = front.x - back.x;
        const worldContacts = [front,middle,back].map((foot,i) => facing * (foot.x + i*stride/2));
        expect(Math.abs(worldContacts[0]-worldContacts[2])).toBeLessThan(.001);
        const relativeTravel = facing*(back.x-front.x);
        expect(Math.sign(relativeTravel)).toBe(-facing);
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
