import { describe, expect, it } from 'vitest';
import { hash2, Rng } from '../src/sim/rng';
import { isLand, Terrain } from '../src/sim/terrain';
import { generateIsland } from '../src/sim/island';
import { calendar, newGame } from '../src/sim/GameState';
import { MS_PER_HOUR, MS_PER_STEP, Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';

function advanceFor(sim: Simulation, ms: number): void {
  while (ms > 0) {
    const frame = Math.min(ms, 125);
    sim.advance(frame);
    ms -= frame;
  }
}

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
    // Frame-sized chunks (the sim ignores any single gap longer than 250 ms).
    const frame = MS_PER_HOUR / 50;
    for (let i = 0; i < 100; i++) sim.advance(frame);
    expect(sim.state.hours).toBe(2);

    sim.setSpeed(8);
    for (let i = 0; i < 50; i++) sim.advance(frame);
    expect(sim.state.hours).toBe(10);

    sim.setSpeed(0);
    sim.advance(10_000);
    expect(sim.state.hours).toBe(10);
  });

  it('a normal-speed day takes about three minutes with shorter nights', () => {
    const sim = new Simulation(newGame(1));
    // Sixteen daytime hours and eight nighttime hours at triple speed.
    advanceFor(sim, MS_PER_HOUR * (16 + 8 / 3) + 0.01);
    expect(calendar(sim.state)).toEqual({ day: 2, hour: 8 });
    expect(sim.state.stepInHour).toBe(0);
    expect(sim.stepProgress).toBeCloseTo(0, 3);
  });

  it('runs every nighttime movement and hourly system, matching direct steps', () => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = 13; // 21:00
    const reference = new Simulation(structuredClone(sim.state));
    advanceFor(sim, MS_PER_HOUR);
    for (let i = 0; i < 3 * STEPS_PER_HOUR; i++) reference.step();
    expect(sim.state).toEqual(reference.state);
    expect(calendar(sim.state)).toEqual({ day: 2, hour: 0 });
  });

  it.each([1, 3, 8] as const)('multiplies selected %s× speed at night without changing the selection', (speed) => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = 13;
    sim.setSpeed(speed);
    advanceFor(sim, 1000);
    expect(sim.speed).toBe(speed);
    expect(sim.effectiveSpeed).toBe(speed * 3);
    expect(sim.state.hours * STEPS_PER_HOUR + sim.state.stepInHour + sim.stepProgress)
      .toBeCloseTo(13 * STEPS_PER_HOUR + 1000 * speed * 3 / MS_PER_STEP);
  });

  it.each([
    { hours: 12, nextHours: 13, before: 8, after: 24 }, // 20:59 → 21:00
    { hours: 20, nextHours: 21, before: 24, after: 8 }, // 04:59 → 05:00
  ])('changes rate inside a frame at hour $nextHours', ({ hours, nextHours, before, after }) => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = hours;
    sim.state.stepInHour = STEPS_PER_HOUR - 1;
    sim.setSpeed(8);
    sim.advance(MS_PER_STEP / before - 10);
    expect(sim.advance(20)).toBe(1);
    expect(sim.state.hours).toBe(nextHours);
    expect(sim.effectiveSpeed).toBe(after);
    expect(sim.stepProgress).toBeCloseTo(10 * after / MS_PER_STEP);
  });

  it('pauses nighttime time and resumes the partially completed step', () => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = 13;
    sim.advance(100);
    sim.setSpeed(0);
    const snapshot = structuredClone(sim.state);
    expect(sim.effectiveSpeed).toBe(0);
    expect(sim.advance(10_000)).toBe(0);
    expect(sim.state).toEqual(snapshot);
    sim.setSpeed(1);
    expect(sim.advance(100)).toBe(0);
    expect(sim.stepProgress).toBeCloseTo(600 / MS_PER_STEP);
  });

  it('still clamps background-tab gaps during night fast-forward', () => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = 13;
    sim.setSpeed(8);
    expect(sim.advance(60_000)).toBe(9);
    expect(sim.state.hours).toBe(13);
    expect(sim.state.stepInHour).toBe(9);
    expect(sim.stepProgress).toBeCloseTo(0.6);
  });

  it('night fast-forward switches off at dawn without changing selected speed', () => {
    const sim = new Simulation(newGame(1));
    sim.state.hours = 13;
    advanceFor(sim, MS_PER_HOUR * 8 / 3 + 0.01);
    expect(calendar(sim.state)).toEqual({ day: 2, hour: 5 });
    expect(sim.speed).toBe(1);
    expect(sim.effectiveSpeed).toBe(1);
    advanceFor(sim, MS_PER_HOUR);
    expect(calendar(sim.state)).toEqual({ day: 2, hour: 6 });
  });

  it('calendar starts at day 1, 08:00 and rolls over', () => {
    const s = newGame(1);
    expect(calendar(s)).toEqual({ day: 1, hour: 8 });
    s.hours = 16;
    expect(calendar(s)).toEqual({ day: 2, hour: 0 });
  });
});
