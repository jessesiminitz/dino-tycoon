import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { computeRegions } from '../src/sim/regions';
import { Terrain } from '../src/sim/terrain';
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


import { GROW_HOURS, HATCH_HOURS, hourlyBreeding, nurseryCap } from '../src/sim/systems/breeding';
import { canEat } from '../src/sim/systems/dinos';
import type { SimContext } from '../src/sim/systems/context';

function ctxFor(s: GameState, seed = 1): SimContext & { events: string[] } {
  const events: string[] = [];
  return { state: s, rng: new Rng(seed), regions: computeRegions(s), emit: (e) => events.push(e.text), invalidateWorld: () => {}, events };
}

/** The test park's two Protoceratops, made blissfully happy and fed. */
function contentedPair(s: GameState) {
  for (const d of s.dinos) Object.assign(d, { happiness: 95, hunger: 10 });
}

/** Run the breeding hour `hours` times, keeping the parents content. */
function breedHours(s: GameState, hours: number, ctx = ctxFor(s)) {
  for (let h = 0; h < hours; h++) {
    contentedPair(s);
    s.hours++;
    hourlyBreeding(ctx);
  }
  return ctx;
}

describe('baby dinosaurs', () => {
  it('a happy pair lays an egg every couple of days, one at a time per paddock', () => {
    const s = openPark();
    // The Protoceratops pair alone (with the Triceratops too, the paddock is too cramped to nest).
    s.dinos = s.dinos.filter((d) => d.species === 'protoceratops');
    const ctx = breedHours(s, 24 * 6);
    expect(s.eggs.length + s.dinos.filter((d) => d.baby).length).toBeGreaterThan(0);
    expect(s.eggs.length).toBeLessThanOrEqual(1);
    expect(ctx.events.some((t) => /^🥚 .* Protoceratops laid an egg/.test(t))).toBe(true);
    // Only the Protoceratops have a partner.
    expect([...s.eggs, ...s.dinos.filter((d) => d.baby)].every((x) => x.species === 'protoceratops')).toBe(true);
  });

  it('a cramped paddock is no place for a nest', () => {
    const s = openPark(); // 2 Protoceratops + a Triceratops want 54 tiles; the paddock has 48
    breedHours(s, 24 * 10);
    expect(s.eggs).toHaveLength(0);
  });

  it('no eggs from unhappy, hungry, lonely or crowded animals', () => {
    const s = openPark();
    const ctx = ctxFor(s);
    for (let h = 0; h < 24 * 10; h++) {
      for (const d of s.dinos) Object.assign(d, { happiness: 60, hunger: 10 });
      s.hours++;
      hourlyBreeding(ctx);
    }
    expect(s.eggs).toHaveLength(0);
    const lonely = openPark();
    lonely.dinos = lonely.dinos.filter((d) => d.species === 'triceratops');
    breedHours(lonely, 24 * 10);
    expect(lonely.eggs).toHaveLength(0);
  });

  it('eggs hatch after two days into a named baby that grows up in a week', () => {
    const s = openPark();
    const ctx = ctxFor(s);
    s.eggs.push({ id: 5000, species: 'protoceratops', x: 4, y: 4, laidHour: s.hours });
    s.hours += HATCH_HOURS - 1;
    hourlyBreeding(ctx);
    expect(s.eggs).toHaveLength(1);
    s.hours++;
    hourlyBreeding(ctx);
    expect(s.eggs).toHaveLength(0);
    const baby = s.dinos.find((d) => d.baby)!;
    expect(baby).toMatchObject({ species: 'protoceratops', x: 4, y: 4 });
    expect(baby.name.length).toBeGreaterThan(0);
    expect(s.stats.hatched).toBe(1);
    expect(ctx.events.some((t) => t.startsWith('🐣 A baby Protoceratops hatched!'))).toBe(true);
    s.hours += GROW_HOURS;
    hourlyBreeding(ctx);
    expect(baby.baby).toBe(false);
    expect(ctx.events.some((t) => /all grown up/.test(t))).toBe(true);
  });

  it('keeps eggs and babies to a sensible share of the park', () => {
    const s = openPark();
    expect(nurseryCap(s)).toBe(4);
    for (let i = 0; i < 4; i++) s.eggs.push({ id: 6000 + i, species: 'protoceratops', x: 3, y: 3, laidHour: s.hours });
    const before = s.eggs.length;
    s.eggs[0].x = 3; // same paddock
    breedHours(s, 30);
    expect(s.eggs.length + s.dinos.filter((d) => d.baby).length).toBeLessThanOrEqual(before);
  });

  it('babies are little: half meals, no fence-pushing, not for sale, and easy prey', () => {
    const s = openPark();
    const [mum] = s.dinos;
    const baby = { ...mum, id: 7000, name: 'Pip', baby: true, bornHour: s.hours };
    s.dinos.push(baby);
    expect(applyCommand(s, { type: 'sellDino', id: 7000 }).ok).toBe(false);
    const rex = { ...mum, id: 7001, species: 'dilophosaurus' as const, baby: false };
    const trikeBaby = { ...baby, id: 7002, species: 'triceratops' as const };
    const trike = { ...mum, id: 7003, species: 'triceratops' as const, baby: false };
    expect(canEat(rex, trike)).toBe(false); // size 3 is too big for a size-2 hunter
    expect(canEat(rex, trikeBaby)).toBe(true); // but the baby isn't
    expect(canEat({ ...rex, baby: true }, trikeBaby)).toBe(false); // baby carnivores don't hunt
  });

  it('visitors coo over babies, and babies make the park more appealing', async () => {
    const { parkAppeal } = await import('../src/sim/systems/visitors');
    const s = openPark();
    const regions = computeRegions(s);
    const before = parkAppeal(s, regions);
    s.dinos.push({ ...s.dinos[0], id: 7100, name: 'Pip', baby: true, bornHour: s.hours });
    expect(parkAppeal(s, regions)).toBeGreaterThan(before);
  });

  it('migrates v12 saves: no eggs, nobody is a baby', () => {
    const s = openPark();
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 12;
    delete raw.eggs;
    delete raw.stats.hatched;
    for (const d of raw.dinos) delete d.baby;
    const m = migrate(raw)!;
    expect(m.version).toBe(19);
    expect(m.eggs).toEqual([]);
    expect(m.dinos.every((d) => d.baby === false)).toBe(true);
    expect(m.stats.hatched).toBe(0);
  });

  it('a whole simulated month: babies arrive at a gentle pace', () => {
    const s = openPark();
    s.dinos = s.dinos.filter((d) => d.species === 'protoceratops');
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    const sim = new Simulation(s);
    run(sim, 24 * 30);
    const hatched = s.stats.hatched;
    expect(hatched).toBeGreaterThan(0);
    expect(hatched).toBeLessThan(12);
  });
});
