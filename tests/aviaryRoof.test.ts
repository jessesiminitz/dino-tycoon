import { describe, it, expect } from 'vitest';
import { aviaryRoof } from '../src/render/aviaryRoof';

describe('aviary dome footprint', () => {
  it('rises above the wall toward the middle, without exceeding the enclosure width', () => {
    const tiles = Array.from({length: 24}, (_, i) => (2 + Math.floor(i / 6)) * 20 + 3 + i % 6);
    const panels = aviaryRoof(tiles, 20);
    const points = panels.flatMap(p => p.corners);
    expect(Math.min(...points.map(p => p.x))).toBe(48);
    expect(Math.max(...points.map(p => p.x))).toBe(144);
    const middle = points.filter(p => p.x === 96 && p.y < 3 * 16 - 13);
    expect(middle.length).toBeGreaterThan(0);
    expect(middle.some(p => p.y < 3 * 16 - 13 - 20)).toBe(true);
    expect(panels.filter(p => !p.cap).length).toBe(48);
    expect(panels.filter(p => p.cap).length).toBe(24);
  });
  it('leaves holes and indented sides uncovered instead of roofing a bounding rectangle', () => {
    const tiles = [22,23,24,42,44,62,63];
    const panels = aviaryRoof(tiles,20).filter(p => !p.cap);
    expect(panels.length).toBe(tiles.length * 2);
    // The middle row has a hole at column 3: no panel may bridge it.
    const middle = panels.slice(6,10);
    expect(middle.every(p => p.corners[1].x <= 48 || p.corners[0].x >= 64)).toBe(true);
    expect(aviaryRoof([],20)).toEqual([]);
  });
});
