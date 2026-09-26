import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { stressPark } from '../src/dev/stressPark';

describe('performance', () => {
  it('a worst-case park simulates well within a frame budget', () => {
    const s = stressPark();
    expect(s.dinos.length).toBe(30);
    expect(s.visitors.length).toBe(150);
    const sim = new Simulation(s);
    // Warm up, then time two game days (at 4× speed that's ~48 s of play).
    for (let i = 0; i < STEPS_PER_HOUR * 6; i++) sim.step();
    const steps = STEPS_PER_HOUR * 48;
    const times: number[] = [];
    for (let i = 0; i < steps; i++) {
      const a = performance.now();
      sim.step();
      times.push(performance.now() - a);
      for (const f of s.feeders) f.stock = 100;
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p99 = times[Math.floor(times.length * 0.99)];
    console.log(`stress park: ${avg.toFixed(3)} ms per step, p99 ${p99.toFixed(2)} ms (${s.visitors.length} visitors, ${s.dinos.length} dinos)`);
    // Alone this runs at ~0.6 ms average and ~4 ms p99 on a 2015 desktop. The limits leave room for
    // other test files running in parallel (and GC pauses) while still catching a real slowdown.
    // At 4× speed the game runs 16 steps a second, so even 4 ms per step is a small slice of a frame.
    expect(avg).toBeLessThan(4);
    expect(p99).toBeLessThan(25);
  });
});
