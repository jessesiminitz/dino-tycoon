import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { depthAt, obscuringFenceKeys, fenceDepth, tileDepth } from '../src/render/worldDepth';

const bounds = { left: 40, right: 90, top: 30, bottom: 77 };
function park() {
  const s = newGame(1);
  s.hFences.fill(0); s.vFences.fill(0);
  s.hFenceHp.fill(0); s.vFenceHp.fill(0);
  return s;
}

describe('world drawing order', () => {
  it('uses the same ground anchor for people and tile-based objects', () => {
    const frontWall = fenceDepth(5, 'h');
    expect(tileDepth(4)).toBe(depthAt(77));
    expect(depthAt(77)).toBeLessThan(frontWall);
    expect(tileDepth(4)).toBeLessThan(frontWall);
    expect(depthAt(93)).toBeGreaterThan(frontWall);
    expect(tileDepth(5)).toBeGreaterThan(frontWall);
  });

  it('sorts end-on walls by their midpoint so the whole tile is not hidden', () => {
    expect(fenceDepth(4, 'v')).toBeLessThan(depthAt(77));
    expect(fenceDepth(4, 'v')).toBeGreaterThan(depthAt(67));
  });

  it('softens only the live front fence intersecting a dinosaur, without lifting its feet', () => {
    const s = park(), i = 5 * s.map.width + 3;
    s.hFences[i] = 4; s.hFenceHp[i] = 100;
    expect(obscuringFenceKeys(s, 77, bounds)).toEqual(['h3,5']);
    expect(depthAt(77)).toBeLessThan(fenceDepth(5, 'h'));
  });

  it('does not boost dinosaurs for broken fences or distant fences in the same row', () => {
    const s = park(), near = 5 * s.map.width + 3, far = 5 * s.map.width + 30;
    s.hFences[near] = 4;
    s.hFences[far] = 4; s.hFenceHp[far] = 100;
    expect(obscuringFenceKeys(s, 77, bounds)).toEqual([]);
  });

  it('only softens a fence for a lifted flyer or baby if visible pixels can reach it', () => {
    const s = park(), i = 5 * s.map.width + 3;
    s.hFences[i] = 4; s.hFenceHp[i] = 100;
    expect(obscuringFenceKeys(s, 77, { ...bounds, bottom: 62 })).toEqual([]);
    expect(obscuringFenceKeys(s, 77, { ...bounds, bottom: 73 })).toEqual(['h3,5']);
  });

  it('softens an end-on wall obscuring a moving dinosaur in its upper half', () => {
    const s = park(), i = 4 * (s.map.width + 1) + 3;
    s.vFences[i] = 2; s.vFenceHp[i] = 100;
    expect(obscuringFenceKeys(s, 67, { ...bounds, bottom: 67 })).toEqual(['v3,4']);
    expect(obscuringFenceKeys(s, 67, { ...bounds, left: 90, right: 110, bottom: 67 })).toEqual([]);
  });

  it('handles silhouettes extending outside the map without changing order', () => {
    const s = park();
    expect(obscuringFenceKeys(s, -3, { left: -100, right: 120, top: -70, bottom: -3 })).toEqual([]);
    expect(obscuringFenceKeys(s, s.map.height * 16 + 13, { left: 5, right: 2000, top: 700, bottom: 2000 })).toEqual([]);
  });
});
