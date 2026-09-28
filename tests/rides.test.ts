import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState, type Visitor } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { Terrain } from '../src/sim/terrain';

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
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass) };
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



import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { JEEP_SEATS, onTrack, stepJeeps, tryAttractions } from '../src/sim/systems/rides';
import { spawnVisitor } from '../src/sim/systems/visitors';
import type { SimContext } from '../src/sim/systems/context';
import { walkableNeighbours } from '../src/sim/pathfind';

function ctxFor(s: GameState): SimContext {
  return { state: s, rng: new Rng(7), regions: computeRegions(s), emit: () => {}, invalidateWorld: () => {} };
}

/**
 * The test park plus a safari: a loop of track hugging the paddock's east fence (columns
 * 10–13, rows 2–8), a spur down to (13, 10), and the station at (12, 10) beside the path.
 */
function safariPark(): GameState {
  const s = openPark();
  const loop: number[] = [idx(13, 9), idx(13, 10)];
  for (let x = 10; x <= 13; x++) loop.push(idx(x, 2), idx(x, 8));
  for (let y = 3; y <= 7; y++) loop.push(idx(10, y), idx(13, y));
  expect(applyCommand(s, { type: 'buildTracks', tiles: loop }).ok).toBe(true);
  expect(applyCommand(s, { type: 'placeBuilding', kind: 'station', x: 12, y: 10 }).ok).toBe(true);
  return s;
}

function visitorAt(s: GameState, x: number, y: number): Visitor {
  const v = spawnVisitor(ctxFor(s), 60, 0);
  Object.assign(v, { x, y, px: x, py: y, leaveHour: s.hours + 50 });
  return v;
}

describe('jeep track', () => {
  it('goes where paths could, but not on a path, and fences stop jeeps', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'buildTracks', tiles: [idx(5, 9)] }).message).toMatch(/path/); // the footpath
    expect(applyCommand(s, { type: 'buildTracks', tiles: [idx(4, 4)] }).message).toMatch(/paddock/); // inside, with animals
    const money = s.money;
    expect(applyCommand(s, { type: 'buildTracks', tiles: [idx(15, 3), idx(15, 4)] }).ok).toBe(true);
    expect(s.money).toBe(money - 30);
    expect(walkableNeighbours(s, idx(15, 3), onTrack)).toEqual([idx(15, 4)]);
    expect(applyCommand(s, { type: 'removeTracks', tiles: [idx(15, 3)] }).ok).toBe(true);
    expect(s.tracks[idx(15, 3)]).toBe(0);
  });
});

describe('safari jeep', () => {
  it('a station with track beside it gets a jeep; riders pay, tour, see dinos, and come back', () => {
    const s = safariPark();
    const ctx = ctxFor(s);
    stepJeeps(ctx);
    expect(s.jeeps).toHaveLength(1);
    const jeep = s.jeeps[0];
    const riders = Array.from({ length: JEEP_SEATS }, () => visitorAt(s, 12, 9));
    const income = s.finance.today.income.rides;
    for (let i = 0; i < 40 && riders.some((v) => v.riding === null); i++) for (const v of riders) if (v.riding === null) tryAttractions(ctx, v, false);
    expect(riders.every((v) => v.riding === jeep.id)).toBe(true);
    expect(s.finance.today.income.rides).toBe(income + 8 * JEEP_SEATS);
    const seenBefore = riders[0].seen.length;
    // Full, so off it goes at once; round the loop and home again.
    let left = false;
    for (let i = 0; i < 80 && (jeep.riders.length > 0 || !left); i++) {
      stepJeeps(ctx);
      if (jeep.steps > 0) left = true;
    }
    expect(left).toBe(true);
    expect(jeep.riders).toHaveLength(0);
    expect(riders.every((v) => v.riding === null && v.x === 12 && v.y === 9)).toBe(true);
    expect(riders[0].seen.length).toBeGreaterThan(seenBefore); // passed the paddock
    expect(riders[0].thoughts.some((t) => t.topic === 'rides')).toBe(true);
    // Once a visit is enough.
    for (let i = 0; i < 40; i++) tryAttractions(ctx, riders[0], false);
    expect(riders[0].riding).toBeNull();
  });

  it('a lone rider still sets off after a short wait', () => {
    const s = safariPark();
    const ctx = ctxFor(s);
    stepJeeps(ctx);
    const v = visitorAt(s, 12, 9);
    for (let i = 0; i < 40 && v.riding === null; i++) tryAttractions(ctx, v, false);
    for (let i = 0; i < 10; i++) stepJeeps(ctx);
    expect(s.jeeps[0].steps).toBeGreaterThan(0);
  });

  it('removing the station lets riders off where they got on', () => {
    const s = safariPark();
    const ctx = ctxFor(s);
    stepJeeps(ctx);
    const v = visitorAt(s, 12, 9);
    for (let i = 0; i < 40 && v.riding === null; i++) tryAttractions(ctx, v, false);
    for (let i = 0; i < 12; i++) stepJeeps(ctx);
    s.buildings = s.buildings.filter((b) => b.kind !== 'station');
    stepJeeps(ctx);
    expect(s.jeeps).toHaveLength(0);
    expect(v).toMatchObject({ riding: null, x: 12, y: 9 });
  });

  it('visitors on a jeep are left alone by the rest of the visitor system', () => {
    const s = safariPark();
    const sim = new Simulation(s);
    run(sim, 3); // mornings bring visitors; some will ride
    for (const v of s.visitors.filter((q) => q.riding !== null)) {
      const jeep = s.jeeps.find((j) => j.id === v.riding)!;
      expect(jeep.riders.some((r) => r.id === v.id)).toBe(true);
    }
  });
});

describe('tower and petting pen', () => {
  it('the tower lets visitors spot dinosaurs far from the path', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'tower', x: 11, y: 10 }).ok).toBe(true);
    const v = visitorAt(s, 11, 9); // on the path right beside it
    const ctx = ctxFor(s);
    for (let i = 0; i < 60 && !v.rode.includes('tower'); i++) tryAttractions(ctx, v, false);
    expect(v.rode).toContain('tower');
    expect(v.seen.length).toBeGreaterThan(0);
    expect(s.finance.today.income.rides).toBe(3);
  });

  it('the petting pen needs a worker as keeper, and kids love it most', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'petting', x: 11, y: 10 }).ok).toBe(true);
    const ctx = ctxFor(s);
    const kid = visitorAt(s, 11, 9);
    kid.kid = true;
    kid.satisfaction = 50;
    for (let i = 0; i < 60; i++) tryAttractions(ctx, kid, false);
    expect(kid.rode).not.toContain('petting'); // no keeper yet
    applyCommand(s, { type: 'hireStaff', role: 'worker' });
    for (let i = 0; i < 60 && !kid.rode.includes('petting'); i++) tryAttractions(ctx, kid, false);
    expect(kid.rode).toContain('petting');
    expect(kid.satisfaction).toBe(62);
  });
});

it('migrates v15 saves: no tracks or jeeps, no rides yet', () => {
  const s = openPark();
  visitorAt(s, 12, 9);
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 15;
  delete raw.tracks;
  delete raw.jeeps;
  for (const v of raw.visitors) {
    delete v.rode;
    delete v.riding;
  }
  const m = migrate(raw)!;
  expect(m.version).toBe(16);
  expect(m.tracks.every((t) => t === 0)).toBe(true);
  expect(m.jeeps).toEqual([]);
  expect(m.visitors.every((v) => v.rode.length === 0 && v.riding === null)).toBe(true);
});
