import { describe, expect, it } from 'vitest';
import { hash2, Rng } from '../src/sim/rng';
import { generateIsland, isLand, Terrain } from '../src/sim/terrain';
import { calendar, newGame } from '../src/sim/GameState';
import { MS_PER_HOUR, Simulation } from '../src/sim/Simulation';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('int stays within bounds', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('hash2 is in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = hash2(i, -i * 3, 77);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateIsland', () => {
  it('is deterministic for a seed', () => {
    expect(generateIsland(64, 48, 42).tiles).toEqual(generateIsland(64, 48, 42).tiles);
  });

  it('has ocean on every edge and a decent amount of land', () => {
    for (const seed of [1, 2, 3, 42, 999, 123456]) {
      const m = generateIsland(64, 48, seed);
      for (let x = 0; x < m.width; x++) {
        expect(isLand(m.tiles[x])).toBe(false);
        expect(isLand(m.tiles[(m.height - 1) * m.width + x])).toBe(false);
      }
      for (let y = 0; y < m.height; y++) {
        expect(isLand(m.tiles[y * m.width])).toBe(false);
        expect(isLand(m.tiles[y * m.width + m.width - 1])).toBe(false);
      }
      const land = m.tiles.filter(isLand).length / m.tiles.length;
      expect(land).toBeGreaterThan(0.25);
      expect(m.tiles).toContain(Terrain.Grass);
    }
  });
});

describe('Simulation clock', () => {
  it('advances one game-hour per MS_PER_HOUR at 1× and scales with speed', () => {
    const sim = new Simulation(newGame(1));
    for (let i = 0; i < 10; i++) sim.advance(MS_PER_HOUR / 5);
    expect(sim.state.hours).toBe(2);

    sim.setSpeed(4);
    for (let i = 0; i < 10; i++) sim.advance(MS_PER_HOUR / 5);
    expect(sim.state.hours).toBe(10);

    sim.setSpeed(0);
    sim.advance(10_000);
    expect(sim.state.hours).toBe(10);
  });

  it('calendar starts at day 1, 08:00 and rolls over', () => {
    const s = newGame(1);
    expect(calendar(s)).toEqual({ day: 1, hour: 8 });
    s.hours = 16;
    expect(calendar(s)).toEqual({ day: 2, hour: 0 });
  });
});
