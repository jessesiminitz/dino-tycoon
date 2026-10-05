import { describe, expect, it } from 'vitest';
import { BLENDER_MOTION } from '../src/render/generated/blenderMotion';
import { MOTION_SPECIES, motionFrame, motionWalkSpeed, type MotionClip } from '../src/render/immersionMotion';

describe('Blender prototype motion',()=>{
  for(const id of MOTION_SPECIES) {
    it(`${id} retains pixel contours, a readable face and grounded feet in every clip`,()=>{
      for(const name of Object.keys(BLENDER_MOTION[id]) as MotionClip[]) {
        const clip=BLENDER_MOTION[id][name];
        expect(clip.frames).toHaveLength(8);
        for(const [i,rows] of clip.frames.entries()) {
          expect(rows).toHaveLength(clip.height);
          expect(rows.every(row=>row.length===clip.width && /^[.BDFAGWEM]+$/.test(row))).toBe(true);
          expect(rows.join('')).toContain('E');
          expect(rows.at(-1)).toMatch(/[BDFAGWEM]/);
          expect(clip.contacts[i].some(foot=>foot.planted)).toBe(true);
        }
        expect(new Set(clip.frames.map(rows=>rows.join('\n'))).size).toBeGreaterThanOrEqual(3);
        const type=name as MotionClip;
        expect(motionFrame(id,type,clip.durationMs-1)).toBe(7);
        expect(motionFrame(id,type,clip.durationMs)).toBe(0);
        expect(motionFrame(id,type,-1)).toBe(0);
      }
    });
    it(`${id} keeps planted feet stationary in world space in both directions`,()=>{
      const walk=BLENDER_MOTION[id].walk;
      const movement=motionWalkSpeed(id)*walk.durationMs/8000;
      expect(movement).toBeGreaterThan(0);
      let checked=0;
      for(let i=0;i<8;i++)for(const before of walk.contacts[i]) {
        const after=walk.contacts[(i+1)%8].find(foot=>foot.name===before.name)!;
        if(!before.planted||!after.planted)continue;
        for(const direction of [-1,1])expect(Math.abs((movement+after.x-before.x)*direction)).toBeLessThan(.01);
        checked++;
      }
      expect(checked).toBeGreaterThan(4);
      expect(walk.contacts.flat().some(foot=>!foot.planted)).toBe(true);
    });
  }
});
