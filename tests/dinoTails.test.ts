import { describe, expect, it } from 'vitest';
import { BLENDER_ART } from '../src/render/generated/blenderArt';
import { BLENDER_MOTION } from '../src/render/generated/blenderMotion';
import manifest from '../assets-source/export-manifest.json';
import contacts from '../assets-source/walk-contacts.json';

const tails = {
  stegosaurus: { rump:9, visible:24, feet:[-8.35,-10.3,-12.25,-10.3] },
  spinosaurus: { rump:15, visible:37, feet:[-.4,-3.12,-5.84,-3.12] },
  brachiosaurus: { rump:14, visible:32, feet:[-6.73,-8.94,-11.15,-8.94] },
  kentrosaurus: { rump:11, visible:25, feet:[-5.125,-6.75,-8.375,-6.75] },
} as const;

describe('long tail silhouettes', () => {
  for (const id of Object.keys(tails) as (keyof typeof tails)[]) {
    it(`${id} has a visible elevated tail in every canonical and animated pose`, () => {
      const spec = manifest.assets[id] as {modelOffsetX:number};
      const samples = [
        ...BLENDER_ART[id].frames.map(rows => ({rows,padding:spec.modelOffsetX})),
        ...Object.values(BLENDER_MOTION[id]).flatMap(clip => clip.frames.map(rows => ({rows,padding:spec.modelOffsetX+8}))),
      ];
      for (const {rows,padding} of samples) {
        const rump = tails[id].rump+padding;
        const tailPixels = rows.flatMap((row,y) => [...row].flatMap((role,x) => role!=='.' && x<rump ? [{x,y}] : []));
        expect(rump-Math.min(...tailPixels.map(p=>p.x))).toBeGreaterThanOrEqual(tails[id].visible);
        expect(Math.max(...tailPixels.map(p=>p.y))).toBeLessThan(rows.length-4);
        expect(rows.every(row => row[0]==='.' && row.at(-1)==='.')).toBe(true);
      }
    });
    it(`${id} preserves its foot positions relative to the world centre`, () => {
      contacts[id].forEach((foot,index) => {
        expect(foot.x-BLENDER_ART[id].width/2).toBeCloseTo(tails[id].feet[index],4);
      });
    });
  }
});
