import { describe, expect, it } from 'vitest';
import { CARTOON_GEOMETRY } from '../src/render/cartoonArt';
import manifest from '../assets-source/export-manifest.json';
import { SPECIES_IDS } from '../src/sim/data/species';

describe('cartoon source coverage', () => {
  it('covers every dinosaur, building and environment variant without pixel grids', () => {
    for (const [id, spec] of Object.entries(manifest.assets)) {
      if (spec.kind === 'terrain') continue;
      const asset = CARTOON_GEOMETRY[id];
      expect(asset, id).toBeDefined();
      expect(asset.frames.length, id).toBe(spec.frames.length);
      for (const shapes of asset.frames) {
        expect(shapes.length, id).toBeGreaterThan(0);
        for (const [, role, points] of shapes) {
          expect(role, id).toMatch(/^[BDFAGWEM]$/);
          expect(points.length).toBeGreaterThanOrEqual(3);
          expect(points.every(p => p.every(Number.isFinite))).toBe(true);
        }
      }
    }
  });
  it('has editable contour poses for all four clips and every species', () => {
    let count = 0;
    for (const id of SPECIES_IDS) for (const clip of ['walk','idle','eat','rest']) {
      const pose = CARTOON_GEOMETRY[id].motion?.[clip];
      expect(pose, `${id}:${clip}`).toBeDefined();
      expect(pose!.frames.length).toBe(8);
      expect(new Set(pose!.frames.map(frame => JSON.stringify(frame))).size).toBeGreaterThan(1);
      count += pose!.frames.length;
    }
    expect(count).toBe(896);
  });
});
