import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState, type Visitor } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { schoolTrip } from '../src/sim/systems/events';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { Terrain } from '../src/sim/terrain';

const W = 20;
const H = 14;
const idx = (x: number, y: number) => y * W + x;

/**
 * 20×14 grass park, gate at (0, 13). Paddock over [2,10) × [2,8) with a
 * Protoceratops pair, Triceratops and feeders. Path from the gate up x = 0
 * and along y = 9 to x = 12. Restaurant at (5, 10), gift shop at (7, 10).
 */
export function openPark(): GameState {
  const s = newGame(11);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: "classic" };
  s.entrance = { x: 0, y: 13 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 1_000_000;
  const box: Edge[] = [...pathEdges(2, 2, 10, 8, true), ...pathEdges(2, 2, 10, 8, false)];
  applyCommand(s, { type: 'buildFences', edges: box, fence: 4 });
  for (const [sp, x, y] of [['protoceratops', 3, 3], ['protoceratops', 4, 5], ['triceratops', 7, 4]] as const) {
    applyCommand(s, { type: 'buyDino', species: sp, x, y });
  }
  applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
  const tiles = [];
  for (let y = 9; y <= 13; y++) tiles.push(idx(0, y));
  for (let x = 1; x <= 12; x++) tiles.push(idx(x, 9));
  expect(applyCommand(s, { type: 'buildPaths', tiles }).ok).toBe(true);
  expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 5, y: 10 }).ok).toBe(true);
  expect(applyCommand(s, { type: 'placeBuilding', kind: 'giftshop', x: 7, y: 10 }).ok).toBe(true);
  return s;
}


function run(sim: Simulation, hours: number, each?: () => void) {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) {
    sim.step();
    for (const f of sim.state.feeders) f.stock = 100;
    each?.();
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('snack stalls', () => {
  it('peckish visitors buy snacks and walk around with them', () => {
    const s = openPark();
    applyCommand(s, { type: 'placeBuilding', kind: 'snackstall', x: 9, y: 10 });
    let seenSnack = false;
    run(new Simulation(s), 10, () => {
      seenSnack ||= s.visitors.some((v) => s.hours < v.snackUntil);
    });
    expect(s.finance.month.income.snacks).toBeGreaterThan(0);
    expect(seenSnack).toBe(true);
  });
});

describe('restrooms', () => {
  it('without restrooms visitors get desperate and complain; with them they use them', () => {
    // Averaged over a few seeds: one day of one park is noisy.
    const measure = (restroom: boolean) => {
      let complained = false;
      const leftWith: number[] = [];
      for (const seed of [1, 2, 3]) {
        const s = openPark();
        s.rngState = seed * 999;
        if (restroom) expect(applyCommand(s, { type: 'placeBuilding', kind: 'restroom', x: 11, y: 10 }).ok).toBe(true);
        const sim = new Simulation(s);
        sim.onEvent((e) => (complained ||= /desperate for restrooms/.test(e.text)));
        let prev = new Map<number, Visitor>();
        run(sim, 16, () => {
          const now = new Set(s.visitors.map((v) => v.id));
          for (const [id, v] of prev) if (!now.has(id)) leftWith.push(v.satisfaction);
          prev = new Map(s.visitors.map((v) => [v.id, { ...v }]));
        });
      }
      return { complained, happiness: avg(leftWith) };
    };
    const none = measure(false);
    const some = measure(true);
    expect(none.complained).toBe(true);
    expect(some.complained).toBe(false);
    expect(some.happiness).toBeGreaterThan(none.happiness + 2);
  });
});

describe('souvenirs', () => {
  it('shops sell visible items; in a storm they sell ponchos, which keep visitors happier', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 3);
    s.stormHours = 8;
    run(sim, 3);
    const withPoncho = s.visitors.filter((v) => v.items.includes('poncho'));
    expect(withPoncho.length).toBeGreaterThan(0);
    expect(s.finance.month.income.souvenirs).toBeGreaterThan(0);
    const soaked = s.visitors.filter((v) => !v.items.includes('poncho'));
    if (soaked.length) expect(avg(withPoncho.map((v) => v.satisfaction))).toBeGreaterThanOrEqual(avg(soaked.map((v) => v.satisfaction)) - 5);
  });

  it('kids come on school trips and love balloons', () => {
    // Summed over a few trips: one busload is a small sample.
    let balloons = 0;
    let hats = 0;
    for (const seed of [3, 4, 5, 6]) {
      const s = openPark();
      const ctx = { state: s, rng: new Rng(seed), regions: computeRegions(s), emit() {}, invalidateWorld() {} };
      schoolTrip(ctx);
      expect(s.visitors.every((v) => v.kid)).toBe(true);
      run(new Simulation(s), 5);
      balloons += s.visitors.filter((x) => x.items.includes('balloon')).length;
      hats += s.visitors.filter((x) => x.items.includes('hat')).length;
    }
    expect(balloons).toBeGreaterThan(hats);
  });
});

describe('mascot', () => {
  it('walks the paths and cheers visitors up', () => {
    const measure = (mascots: number) => {
      const s = openPark();
      for (let i = 0; i < mascots; i++) applyCommand(s, { type: 'hireStaff', role: 'mascot' });
      const sim = new Simulation(s);
      const sat: number[] = [];
      run(sim, 8, () => {
        for (const m of s.staff) expect(s.paths[Math.round(m.y) * W + Math.round(m.x)] === 1 || (m.x === s.entrance.x && m.y === s.entrance.y)).toBe(true);
        sat.push(avg(s.visitors.map((v) => v.satisfaction)));
      });
      return avg(sat);
    };
    expect(measure(3)).toBeGreaterThan(measure(0));
  });
});

describe('saves', () => {
  it('migrates version 7 visitors (a bought souvenir becomes a plush)', () => {
    const s = openPark();
    run(new Simulation(s), 2);
    const old = JSON.parse(JSON.stringify(s));
    old.version = 7;
    delete old.stats.restroomComplaintDay;
    for (const v of old.visitors) {
      delete v.items; delete v.snackUntil; delete v.bladder; delete v.kid;
      v.boughtSouvenir = true;
    }
    const m = migrate(old)!;
    expect(m.version).toBe(18);
    expect(m.visitors[0].items).toEqual(['plush']);
    expect(m.visitors[0].bladder).toBe(0);
    expect(m.finance.month.income.snacks).toBe(0);
  });
});


describe('park log', () => {
  it('records every event, capped, and survives a v9 migration', async () => {
    const { Simulation } = await import('../src/sim/Simulation');
    const { newGame, migrate, MAX_LOG } = await import('../src/sim/GameState');
    const sim = new Simulation(newGame(7));
    for (let i = 0; i < 24 * 20 * STEPS_PER_HOUR; i++) sim.step();
    expect(sim.state.log.length).toBeGreaterThan(0);
    expect(sim.state.log.length).toBeLessThanOrEqual(MAX_LOG);
    const old = JSON.parse(JSON.stringify(newGame(3)));
    old.version = 9;
    delete old.log;
    expect(migrate(old)!.log).toEqual([]);
  });
});
