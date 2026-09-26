import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { FEEDER_TYPES } from '../src/sim/data/feeders';
import { MEDICINE_COST, STAFF_TYPES } from '../src/sim/data/staff';
import type { FenceTypeId } from '../src/sim/data/fences';
import { fenceAt, fenceHp, setFenceHp } from '../src/sim/fences';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { Terrain } from '../src/sim/terrain';
import type { GameEvent } from '../src/sim/systems/context';

const W = 20;
const H = 14;

/** 20×14 grass, all owned, gate at (0, 13), paddock over tiles [2,10) × [2,8) with the given fence. */
function park(fence: FenceTypeId = 4): GameState {
  const s = newGame(21);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass) };
  s.entrance = { x: 0, y: 13 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  applyCommand(s, { type: 'buildFences', edges: box(), fence });
  s.money = 1_000_000;
  return s;
}

function box(): Edge[] {
  return [...pathEdges(2, 2, 10, 8, true), ...pathEdges(2, 2, 10, 8, false)];
}

const inPaddock = (d: { x: number; y: number }) => d.x >= 2 && d.x < 10 && d.y >= 2 && d.y < 8;

function run(sim: Simulation, hours: number, each?: () => void): void {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) {
    sim.step();
    each?.();
  }
}

function withEvents(sim: Simulation): GameEvent[] {
  const events: GameEvent[] = [];
  sim.onEvent((e) => events.push(e));
  return events;
}

describe('fence wear', () => {
  it('fences lose condition every day, wood faster than concrete', () => {
    const wood = park(1);
    const concrete = park(4);
    run(new Simulation(wood), 24 * 5);
    run(new Simulation(concrete), 24 * 5);
    const e: Edge = { dir: 'h', x: 4, y: 2 };
    expect(fenceHp(wood, e)).toBeLessThan(90);
    expect(fenceHp(wood, e)).toBeGreaterThan(70);
    expect(fenceHp(concrete, e)).toBeGreaterThan(fenceHp(wood, e));
  });

  it('a broken fence opens the paddock and the dino escapes', () => {
    const s = park(2);
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 9, y: 4 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 8, y: 4 });
    for (let y = 2; y < 8; y++) setFenceHp(s, { dir: 'v', x: 10, y }, 0.01); // east side about to go
    const sim = new Simulation(s);
    const events = withEvents(sim);
    let escaped = false;
    run(sim, 48, () => {
      escaped ||= s.dinos[0].escaped;
      s.feeders[0].stock = 100;
    });
    expect(fenceAt(s, { dir: 'v', x: 10, y: 4 })).toBe(0);
    expect(computeRegions(s).regions.some((r) => r.kind === 'paddock')).toBe(false);
    expect(escaped).toBe(true);
    expect(events.some((e) => /rotted through/.test(e.text))).toBe(true);
    expect(events.some((e) => /has escaped/.test(e.text))).toBe(true);
  });

  it('a hungry dino smashes a fence weaker than it needs, but not a strong one', () => {
    const results = ([1, 4] as FenceTypeId[]).map((fence) => {
      const s = park(fence);
      applyCommand(s, { type: 'buyDino', species: 'dilophosaurus', x: 2, y: 2 }); // needs steel (2)
      const sim = new Simulation(s);
      const events = withEvents(sim);
      run(sim, 24, () => {
        s.dinos[0].hunger = 90; // keep it desperate
        s.dinos[0].health = 100;
      });
      return events.some((e) => /smashed through/.test(e.text));
    });
    expect(results).toEqual([true, false]);
  });
});

describe('staff', () => {
  it('hiring and firing; wages are paid at midnight', () => {
    const s = park();
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    applyCommand(s, { type: 'hireStaff', role: 'vet' });
    expect(s.staff.map((m) => m.role)).toEqual(['worker', 'vet']);
    for (let i = 0; i < 10; i++) applyCommand(s, { type: 'hireStaff', role: 'guide' });
    expect(new Set(s.staff.map((m) => m.name)).size).toBe(12); // no duplicate names while the pool lasts
    s.staff = s.staff.slice(0, 2);
    run(new Simulation(s), 16); // 08:00 → 00:00
    expect(s.finance.month.expenses.wages).toBe(STAFF_TYPES.worker.wage + STAFF_TYPES.vet.wage);
    applyCommand(s, { type: 'fireStaff', id: s.staff[0].id });
    expect(s.staff.map((m) => m.role)).toEqual(['vet']);
  });

  it('workers refill low feeders and charge for the food', () => {
    const s = park();
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    s.feeders[0].stock = 10;
    const sim = new Simulation(s);
    run(sim, 4);
    expect(s.feeders[0].stock).toBe(FEEDER_TYPES.plants.capacity);
    expect(s.finance.month.expenses.feed).toBe(90 * FEEDER_TYPES.plants.unitCost);
  });

  it('workers mend worn and broken fences, closing the paddock again', () => {
    const s = park(2);
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    setFenceHp(s, { dir: 'h', x: 5, y: 2 }, 30);
    setFenceHp(s, { dir: 'v', x: 10, y: 5 }, 0);
    const sim = new Simulation(s);
    sim.worldRevision++; // the direct edit above changed the paddock
    expect(sim.regions().regions.some((r) => r.kind === 'paddock')).toBe(false);
    run(sim, 8);
    // Repaired to 100, then a little everyday wear.
    expect(fenceHp(s, { dir: 'h', x: 5, y: 2 })).toBeGreaterThan(97);
    expect(fenceHp(s, { dir: 'v', x: 10, y: 5 })).toBeGreaterThan(97);
    expect(sim.regions().regions.some((r) => r.kind === 'paddock')).toBe(true);
    expect(s.finance.month.expenses.maintenance).toBeGreaterThan(0);
  });

  it('guards bring escaped dinos home once the fence is fixed', () => {
    const s = park(4);
    applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 9, y: 4 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    applyCommand(s, { type: 'hireStaff', role: 'guard' });
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    const sim = new Simulation(s);
    const events = withEvents(sim);
    // Break a fence and walk the dino out.
    setFenceHp(s, { dir: 'v', x: 10, y: 4 }, 0);
    sim.worldRevision++;
    const d = s.dinos[0];
    d.x = d.px = 14;
    d.y = d.py = 4;
    d.path = [];
    run(sim, 24, () => (s.feeders[0].stock = 100));
    expect(d.escaped).toBe(false);
    expect(inPaddock(d)).toBe(true);
    expect(events.some((e) => /returned .* to its paddock/.test(e.text))).toBe(true);
  });
});

describe('disease', () => {
  it('sickness drains health and spreads; a vet cures it', () => {
    const noVet = park();
    for (const x of [3, 5, 7]) applyCommand(noVet, { type: 'buyDino', species: 'protoceratops', x, y: 4 });
    applyCommand(noVet, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    noVet.dinos[0].sick = true;
    const sim = new Simulation(noVet);
    const everSick = new Set<number>();
    const patientZero = noVet.dinos[0];
    run(sim, 24 * 20, () => {
      noVet.feeders[0].stock = 100;
      patientZero.sick = true; // stays contagious for the whole test
      patientZero.health = 100;
      for (const d of noVet.dinos) if (d.sick) everSick.add(d.id);
    });
    expect(everSick.size).toBeGreaterThan(1);

    const withVet = park();
    for (const x of [3, 5, 7]) applyCommand(withVet, { type: 'buyDino', species: 'protoceratops', x, y: 4 });
    applyCommand(withVet, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    applyCommand(withVet, { type: 'hireStaff', role: 'vet' });
    // Weak as well as sick, so the vet has a patient even if the illness clears by itself.
    withVet.dinos[0].sick = true;
    withVet.dinos[0].health = 40;
    run(new Simulation(withVet), 6, () => (withVet.feeders[0].stock = 100));
    expect(withVet.dinos[0].sick).toBe(false);
    expect(withVet.dinos[0].health).toBeGreaterThan(55);
    expect(withVet.finance.month.expenses.maintenance).toBe(MEDICINE_COST);
  });

  it('untreated illness can kill', () => {
    const s = park();
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 4 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    s.dinos[0].sick = true;
    s.dinos[0].health = 5;
    const sim = new Simulation(s);
    const events = withEvents(sim);
    run(sim, 12, () => {
      s.feeders[0].stock = 100;
      if (s.dinos[0]) s.dinos[0].sick = true; // no lucky recovery for this test
    });
    expect(s.dinos).toHaveLength(0);
    expect(events.some((e) => /died of illness/.test(e.text))).toBe(true);
  });
});

describe('visitors and incidents', () => {
  function openGate(s: GameState): void {
    const tiles = [];
    for (let y = 9; y <= 13; y++) tiles.push(y * W);
    for (let x = 1; x <= 14; x++) tiles.push(9 * W + x);
    applyCommand(s, { type: 'buildPaths', tiles });
  }

  it('an escaped carnivore sends visitors running and can hurt them', () => {
    const s = park();
    openGate(s);
    applyCommand(s, { type: 'buyDino', species: 'dilophosaurus', x: 4, y: 4 });
    const d = s.dinos[0];
    const sim = new Simulation(s);
    run(sim, 4); // visitors arrive
    const before = s.visitors.length;
    expect(before).toBeGreaterThan(0);
    const events = withEvents(sim);
    // Let it loose on the path.
    setFenceHp(s, { dir: 'h', x: 4, y: 8 }, 0);
    sim.worldRevision++;
    d.x = d.px = 3;
    d.y = d.py = 10;
    d.hunger = 0;
    run(sim, 6, () => {
      d.x = d.px = 3; // keep it by the path
      d.y = d.py = 10;
    });
    expect(events.some((e) => /escaped/.test(e.text))).toBe(true);
    expect(s.reputation).toBeLessThan(50);
  });

  it('tour guides make nearby visitors happier', () => {
    const measure = (guide: boolean) => {
      const s = park();
      openGate(s);
      s.ticketPrice = 5; // nothing to see yet, so keep it cheap enough for visitors to come
      if (guide) for (let i = 0; i < 3; i++) applyCommand(s, { type: 'hireStaff', role: 'guide' });
      const sim = new Simulation(s);
      let total = 0;
      let n = 0;
      run(sim, 8, () => {
        for (const v of s.visitors) {
          total += v.satisfaction;
          n++;
        }
      });
      return total / n;
    };
    expect(measure(true)).toBeGreaterThan(measure(false));
  });

  it('you can repair a fence yourself', () => {
    const s = park(2);
    const e: Edge = { dir: 'h', x: 5, y: 2 };
    setFenceHp(s, e, 50);
    const before = s.money;
    const r = applyCommand(s, { type: 'repairFence', edge: e });
    expect(r.ok).toBe(true);
    expect(fenceHp(s, e)).toBe(100);
    expect(s.money).toBeLessThan(before);
    expect(applyCommand(s, { type: 'repairFence', edge: e }).ok).toBe(false);
  });
});

describe('event batching', () => {
  it('merges simultaneous escapes and summarises floods', async () => {
    const { batchEvents } = await import('../src/ui/hud');
    const out = batchEvents([
      { text: '🚨 Moss the Protoceratops has escaped!', kind: 'bad' },
      { text: '🚨 Spike the Protoceratops has escaped!', kind: 'bad' },
      { text: '🚨 Olive the Triceratops has escaped!', kind: 'bad' },
      { text: 'a', kind: 'info' },
      { text: 'b', kind: 'info' },
      { text: 'c', kind: 'info' },
    ]);
    expect(out.map((e) => e.text)).toEqual([
      '🚨 Moss, Spike and Olive have escaped!',
      'a',
      'b',
      '…and 1 more thing happened',
    ]);
  });
});
