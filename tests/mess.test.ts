import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState, type Visitor } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { computeRegions } from '../src/sim/regions';
import { Terrain } from '../src/sim/terrain';
import { dinoConcerns, staffConcerns, whatVisitorsSay } from '../src/sim/concerns';
import { spawnVisitor, think } from '../src/sim/systems/visitors';
import { Rng } from '../src/sim/rng';

const W = 20;
const H = 14;
const idx = (x: number, y: number) => y * W + x;

/**
 * 20×14 grass park, gate at (0, 13). Paddock over [2,10) × [2,8) with a
 * Protoceratops pair, Triceratops and feeders. Path from the gate up x = 0
 * and along y = 9 to x = 12. Restaurant at (5, 10), gift shop at (7, 10).
 */
function openPark(): GameState {
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


/** A visitor dropped at a path tile, for scripted scenarios. */
function visitorAt(s: GameState, x: number, y: number, extra: Partial<Visitor> = {}): Visitor {
  const ctx = { state: s, rng: new Rng(1), regions: computeRegions(s), emit: () => {}, invalidateWorld: () => {} };
  const v = spawnVisitor(ctx, 60, 0);
  Object.assign(v, { x, y, px: x, py: y, leaveHour: s.hours + 50, ...extra });
  return v;
}

const ctx0 = (s: GameState) => ({ state: s, rng: new Rng(1), regions: computeRegions(s), emit: () => {}, invalidateWorld: () => {} });

describe('mess', () => {
  it('desperate visitors with no restroom have accidents that gross out people nearby', () => {
    const s = openPark();
    const sim = new Simulation(s);
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.text));
    const bursting = Array.from({ length: 10 }, (_, i) => visitorAt(s, 1 + i, 9, { bladder: 100 }));
    const bystander = visitorAt(s, 6, 9, { bladder: 0 });
    run(sim, 1, () => (bystander.path = [])); // keep the bystander in place
    const messes = s.messes.filter((m) => m.kind === 'mess');
    expect(messes.length).toBeGreaterThan(0);
    expect(events.some((t) => /^(💦|💩) A visitor couldn't find a restroom in time and (peed|pooped) on the path/.test(t))).toBe(true);
    expect(bursting.some((v) => v.thoughts.some((t) => /I (peed|pooped)!/.test(t.text)))).toBe(true);
    // Another hour next to the mess and the bystander is grossed out.
    Object.assign(bystander, { x: messes[0].x, y: messes[0].y });
    run(sim, 1, () => {
      bystander.path = [];
      bystander.x = messes[0].x;
    });
    expect(bystander.thoughts.some((t) => t.topic === 'mess' && !t.good)).toBe(true);
    expect(bystander.thoughts.find((t) => t.topic === 'mess')!.text).not.toMatch(/\{/); // placeholders filled in
  });

  it('a restroom in reach prevents accidents', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'restroom', x: 3, y: 10 }).ok).toBe(true);
    const sim = new Simulation(s);
    for (let i = 0; i < 10; i++) visitorAt(s, 1 + i, 9, { bladder: 75 });
    run(sim, 3);
    expect(s.messes.filter((m) => m.kind === 'mess')).toHaveLength(0);
  });

  it('finished snacks become litter without a trash can, and go in the bin with one', () => {
    const litterAfter = (withCan: boolean) => {
      const s = openPark();
      if (withCan) expect(applyCommand(s, { type: 'placeBuilding', kind: 'trashcan', x: 9, y: 10 }).ok).toBe(true);
      const sim = new Simulation(s);
      for (let i = 0; i < 20; i++) visitorAt(s, 7 + (i % 5), 9, { snack: 'popcorn', snackUntil: s.hours + 1, sodaUntil: s.hours + 1 });
      // Keep them near the (possible) bin while they finish.
      run(sim, 2, () => {
        for (const v of s.visitors) {
          v.path = [];
          v.x = Math.max(7, Math.min(11, v.x));
          v.y = 9;
        }
      });
      return s.messes.filter((m) => m.kind === 'litter').length;
    };
    expect(litterAfter(false)).toBeGreaterThan(5);
    expect(litterAfter(true)).toBe(0);
  });

  it('janitors clean up, accidents first, sweeping everything around the spot', () => {
    const s = openPark();
    applyCommand(s, { type: 'hireStaff', role: 'janitor' });
    const j = s.staff[0];
    s.messes.push(
      { id: 9001, kind: 'litter', x: 1, y: 9, hour: 0 },
      { id: 9002, kind: 'litter', x: 2, y: 9, hour: 0 },
      { id: 9003, kind: 'mess', x: 11, y: 9, hour: 0 },
      { id: 9004, kind: 'litter', x: 12, y: 9, hour: 0 },
    );
    const sim = new Simulation(s);
    sim.step();
    expect(j.task).toEqual({ kind: 'clean', messId: 9003 });
    for (let i = 0; i < 40 && s.messes.length; i++) sim.step();
    expect(s.messes).toHaveLength(0);
    expect(staffConcerns(s, j)[0].text).toMatch(/spotless/);
  });

  it('a filthy park fails inspection', async () => {
    const { safetyIssues } = await import('../src/sim/systems/events');
    const s = openPark();
    for (let i = 0; i < 40; i++) s.messes.push({ id: 9000 + i, kind: 'litter', x: 1 + (i % 10), y: 9, hour: 0 });
    expect(safetyIssues(ctx0(s)).some((t) => /filthy/.test(t))).toBe(true);
    s.messes.length = 39;
    expect(safetyIssues(ctx0(s)).some((t) => /filthy/.test(t))).toBe(false); // a bit of litter is tolerated
  });
});

describe('thirst and umbrellas', () => {
  it('thirsty visitors buy sodas at snack stalls', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'snackstall', x: 9, y: 10 }).ok).toBe(true);
    const sim = new Simulation(s);
    const thirsty = Array.from({ length: 12 }, (_, i) => visitorAt(s, 8 + (i % 3), 9, { thirst: 80, hunger: 0 }));
    run(sim, 1, () => thirsty.forEach((v) => (v.path = [])));
    expect(thirsty.filter((v) => v.sodaUntil > 0).length).toBeGreaterThan(3);
    expect(s.finance.today.income.snacks).toBeGreaterThan(0);
  });

  it('umbrellas keep visitors dry in a storm', () => {
    const s = openPark();
    s.stormHours = 5;
    const sim = new Simulation(s);
    const dry = visitorAt(s, 3, 9, { items: ['umbrella'], bladder: 0, hunger: 0, thirst: 0 });
    const wet = visitorAt(s, 4, 9, { bladder: 0, hunger: 0, thirst: 0 });
    run(sim, 1, () => {
      dry.path = [];
      wet.path = [];
    });
    expect(dry.thoughts.some((t) => t.topic === 'weather' && t.good)).toBe(true);
    expect(wet.thoughts.some((t) => t.topic === 'weather' && !t.good)).toBe(true);
    expect(dry.satisfaction).toBeGreaterThan(wet.satisfaction);
  });
});

describe('people', () => {
  it('visitors leave reviews, and complaints are summed up with advice', () => {
    const s = openPark();
    const v = visitorAt(s, 0, 13, { satisfaction: 10 });
    think(s, v, 'restroom', false);
    v.leaveHour = s.hours;
    s.hours = 10; // 18:00, still open
    new Simulation(s).step();
    const r = s.reviews.at(-1)!;
    expect(r).toMatchObject({ name: v.name, stars: 1, topic: 'restroom', good: false });
    const say = whatVisitorsSay(s);
    expect(say.complaints[0]).toMatchObject({ topic: 'restroom', count: 1 });
    expect(say.complaints[0].advice).toMatch(/restroom/i);
  });

  it('renames visitors, dinos and staff (trimmed, never blank)', () => {
    const s = openPark();
    const v = visitorAt(s, 1, 9);
    applyCommand(s, { type: 'hireStaff', role: 'vet' });
    const d = s.dinos[0];
    expect(applyCommand(s, { type: 'rename', kind: 'dino', id: d.id, name: '  Big   Bertha  ' }).ok).toBe(true);
    expect(d.name).toBe('Big Bertha');
    expect(applyCommand(s, { type: 'rename', kind: 'visitor', id: v.id, name: 'Alan Grant' }).ok).toBe(true);
    expect(v.name).toBe('Alan Grant');
    expect(applyCommand(s, { type: 'rename', kind: 'staff', id: s.staff[0].id, name: 'x'.repeat(50) }).ok).toBe(true);
    expect(s.staff[0].name).toHaveLength(20);
    expect(applyCommand(s, { type: 'rename', kind: 'staff', id: s.staff[0].id, name: '   ' }).ok).toBe(false);
    expect(applyCommand(s, { type: 'rename', kind: 'dino', id: 424242, name: 'Ghost' }).ok).toBe(false);
  });

  it('dinos say what is wrong with their paddock', () => {
    const s = openPark();
    const regions = computeRegions(s);
    const trike = s.dinos.find((d) => d.species === 'triceratops')!;
    const texts = dinoConcerns(s, regions, trike).map((c) => c.tag);
    expect(texts).toContain('lonely'); // the only Triceratops
    s.feeders = [];
    expect(dinoConcerns(s, regions, trike).some((c) => c.tag === 'feeder')).toBe(true);
    trike.hunger = 90;
    expect(dinoConcerns(s, regions, trike).some((c) => c.tag === 'hungry')).toBe(true);
  });

  it('migrates version 10 visitors with names, thirst and no thoughts', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 3);
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 10;
    delete raw.messes;
    delete raw.reviews;
    for (const v of raw.visitors) {
      for (const k of ['snack', 'sodaUntil', 'thirst', 'name', 'thoughts']) delete v[k];
    }
    const m = migrate(raw)!;
    expect(m.version).toBe(21);
    expect(m.messes).toEqual([]);
    expect(m.visitors.length).toBeGreaterThan(0);
    for (const v of m.visitors) {
      expect(v.name).toMatch(/^\w+ [A-Z]\.$/);
      expect(v.thoughts).toEqual([]);
      expect(v.thirst).toBe(0);
    }
    new Simulation(m).step(); // and it runs
  });
});

it('fresh games start clean', () => {
  const s = newGame(5);
  expect(s.messes).toEqual([]);
  expect(s.reviews).toEqual([]);
});

describe('dino droppings', () => {
  it('dinos leave droppings now and then, which crumble away after a few days', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 48);
    const dung = s.messes.filter((m) => m.kind === 'dung');
    expect(dung.length).toBeGreaterThan(0);
    expect(dung.length).toBeLessThan(s.dinos.length * 4); // a trickle, not a flood
    const first = dung[0].id;
    run(sim, 80);
    expect(s.messes.some((m) => m.id === first)).toBe(false);
  });

  it('workers shovel dung; janitors leave it alone; visitors never notice it', () => {
    const s = openPark();
    applyCommand(s, { type: 'hireStaff', role: 'janitor' });
    s.messes.push({ id: 9100, kind: 'dung', x: 5, y: 6, hour: s.hours });
    const sim = new Simulation(s);
    sim.step();
    expect(s.staff[0].task).toBeNull();
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    for (let i = 0; i < 30 && s.messes.some((m) => m.id === 9100); i++) sim.step();
    expect(s.messes.some((m) => m.id === 9100)).toBe(false);
  });

  it('a paddock piled with dung makes its animals unhappy and says so', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 1);
    const before = s.dinos.map((d) => d.happiness);
    for (let i = 0; i < 12; i++) s.messes.push({ id: 9200 + i, kind: 'dung', x: 3 + (i % 6), y: 3 + Math.floor(i / 6), hour: s.hours });
    run(sim, 1);
    expect(s.dinos.every((d, i) => d.happiness < before[i] + 1)).toBe(true);
    expect(dinoConcerns(s, computeRegions(s), s.dinos[0]).some((c) => c.tag === 'dung')).toBe(true);
  });
});
