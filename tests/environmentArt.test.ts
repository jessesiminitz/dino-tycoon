import { describe, expect, it } from 'vitest';
import { BLENDER_ENVIRONMENT, BLENDER_TERRAIN } from '../src/render/generated/blenderEnvironment';
import { environmentVariant, VOLCANO_CRATER_ABOVE_BASE } from '../src/render/sceneryArt';
import { TERRAIN_ART_IDS, TERRAIN_TILE_SIZE } from '../src/render/terrainArt';
import { TERRAIN_COUNT } from '../src/sim/terrain';

const footprints = {
  conifer: [18,30], broadleaf: [20,26], cycad: [20,20], treefern: [22,28], giant: [20,40], palm: [22,30],
  mountain: [30,34], volcano: [84,70], bush: [14,12], reeds: [12,16], flowers: [16,12],
  fountain: [18,20], lamp: [10,24], bench: [16,12], skeleton: [22,12],
} as const;

describe('Blender environment contracts', () => {
  for (const id of Object.keys(footprints) as (keyof typeof footprints)[]) {
    it(`${id} preserves its footprint, outline space and seeded variation`, () => {
      const asset = BLENDER_ENVIRONMENT[id];
      expect([asset.width,asset.height]).toEqual(footprints[id]);
      expect(new Set(asset.frames.map(rows => rows.join('\n'))).size).toBe(asset.frames.length);
      for (const rows of asset.frames) {
        expect(rows.length).toBe(asset.height);
        expect(rows.every(row => row.length === asset.width)).toBe(true);
        expect(rows[0]+rows.at(-1)).toMatch(/^\.+$/);
        expect(rows.every(row => row[0] === '.' && row.at(-1) === '.')).toBe(true);
        const roles = new Set(rows.join('').replaceAll('.', ''));
        expect(roles.size).toBeGreaterThan(2);
        for (const role of roles) expect((asset.colors as Record<string,string>)[role]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      const count = asset.frames.length;
      expect(new Set(Array.from({length:count},(_,i)=>environmentVariant(id,i))).size).toBe(count);
      for (const seed of [-31,0,1,7,99,4242]) {
        const variant = environmentVariant(id,seed);
        expect(variant).toBe(environmentVariant(id,seed));
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(count);
      }
    });
  }

  it('keeps the volcano opening aligned with existing smoke and glow', () => {
    const asset = BLENDER_ENVIRONMENT.volcano;
    const crater = asset.height - VOLCANO_CRATER_ABOVE_BASE;
    expect(crater).toBe(10);
    expect(asset.frames[0][crater].slice(34,50)).toMatch(/[AW]/);
  });

  it('covers every saved terrain ID with four opaque, distinct 16-pixel tiles', () => {
    expect(Object.keys(TERRAIN_ART_IDS).length).toBe(TERRAIN_COUNT);
    expect(new Set(Object.values(TERRAIN_ART_IDS)).size).toBe(TERRAIN_COUNT);
    for (const id of Object.values(TERRAIN_ART_IDS)) {
      const asset = BLENDER_TERRAIN[id];
      expect([asset.width,asset.height,asset.frames.length]).toEqual([TERRAIN_TILE_SIZE,TERRAIN_TILE_SIZE,4]);
      expect(new Set(asset.frames.map(rows=>rows.join('\n'))).size).toBe(4);
      for (const rows of asset.frames) {
        expect(rows.length).toBe(16);
        expect(rows.every(row=>row.length===16 && !row.includes('.'))).toBe(true);
        for (const role of new Set(rows.join(''))) expect((asset.colors as Record<string,string>)[role]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
