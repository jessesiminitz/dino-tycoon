import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState } from '../src/sim/GameState';
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



import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { addRequests, onShow, updateRequests, MAX_ACTIVE } from '../src/sim/systems/requests';
import type { GameEvent } from '../src/sim/systems/context';
import type { ParkRequest } from '../src/sim/GameState';

function board(s: GameState, seed = 1) {
  const events: GameEvent[] = [];
  const added = addRequests(s, computeRegions(s), new Rng(seed), (e) => events.push(e));
  return { added, events };
}

function request(s: GameState, r: Partial<ParkRequest>): ParkRequest {
  const full: ParkRequest = {
    id: s.nextId++, kind: 'treats', icon: '🍖', text: 'test', target: 1, progress: 0,
    createdHour: s.hours, expiresHour: s.hours + 6, reward: { money: 500, reputation: 1 }, status: 'active', ...r,
  };
  s.requests.push(full);
  return full;
}

describe('park requests', () => {
  it('up to three at a time, each a different kind, none already met', () => {
    const s = openPark();
    for (const seed of [1, 2, 3, 4, 5]) {
      s.requests = [];
      const { added, events } = board(s, seed);
      expect(added.length).toBeGreaterThan(0);
      expect(added.length).toBeLessThanOrEqual(MAX_ACTIVE);
      expect(new Set(added.map((r) => r.kind)).size).toBe(added.length);
      expect(events[0].text).toMatch(/^📋/);
      const before = s.money;
      updateRequests(s, () => {});
      expect(s.money).toBe(before); // nothing pays out just for turning up
    }
    // Topping up a full board adds nothing.
    s.requests = [];
    for (let i = 0; i < MAX_ACTIVE; i++) request(s, { kind: (['treats', 'photo', 'feeders'] as const)[i] });
    expect(board(s, 9).added).toHaveLength(0);
  });

  it('only asks for what the park can manage', () => {
    const s = newGame(3); // bare island: no paths, dinos or feeders
    const { added } = board(s);
    for (const r of added) expect(['see', 'visitors', 'review', 'food', 'clean', 'photo', 'treats', 'feeders']).toContain(r.kind);
    expect(added.every((r) => r.kind !== 'photo' && r.kind !== 'treats' && r.kind !== 'feeders')).toBe(true);
    expect(added.every((r) => r.kind !== 'visitors' && r.kind !== 'food')).toBe(true);
  });

  it('treats and photos count as they happen, and pay out', () => {
    const s = openPark();
    const sim = new Simulation(s);
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.text));
    const treats = request(s, { kind: 'treats', target: 2, reward: { money: 250, reputation: 1 } });
    const photo = request(s, { kind: 'photo', species: 'triceratops', reward: { money: 500, reputation: 1 } });
    const money = s.money;
    const [a, b] = s.dinos;
    sim.dispatch({ type: 'treatDino', id: a.id });
    expect(treats.progress).toBe(1);
    sim.dispatch({ type: 'treatDino', id: b.id });
    expect(treats.status).toBe('done');
    sim.dispatch({ type: 'photoDino', id: a.id }); // a Protoceratops: not the one wanted
    expect(photo.status).toBe('active');
    sim.dispatch({ type: 'photoDino', id: s.dinos.find((d) => d.species === 'triceratops')!.id });
    expect(photo.status).toBe('done');
    expect(s.money).toBe(money - 2 * 25 + 250 + 500);
    expect(s.stats.requestsDone).toBe(2);
    expect(events.filter((t) => t.startsWith('✅ Request complete'))).toHaveLength(2);
  });

  it('building a place to eat meets the food critic straight away', () => {
    const s = openPark();
    const sim = new Simulation(s);
    const food = request(s, { kind: 'food', target: 2 }); // the park has one restaurant
    expect(sim.dispatch({ type: 'placeBuilding', kind: 'snackstall', x: 9, y: 10 }).ok).toBe(true);
    expect(food.status).toBe('done');
  });

  it('a species on show: visible from a path', () => {
    const s = openPark();
    expect(onShow(s, 'protoceratops')).toBe(true); // the paddock is beside the path
    expect(onShow(s, 'stegosaurus')).toBe(false);
  });

  it('the mayor and the vet judge when they arrive; unmet requests quietly expire', () => {
    const s = openPark();
    s.messes.push({ id: 9990, kind: 'litter', x: 3, y: 9, hour: 0 });
    const clean = request(s, { kind: 'clean', expiresHour: s.hours + 2 });
    const vet = request(s, { kind: 'feeders', target: 1, expiresHour: s.hours + 2 });
    const see = request(s, { kind: 'see', species: 'stegosaurus', expiresHour: s.hours + 2 });
    updateRequests(s, () => {});
    expect([clean.status, vet.status]).toEqual(['active', 'active']); // not until they arrive
    s.messes = [];
    s.hours += 2;
    for (const f of s.feeders) f.stock = 100;
    const events: string[] = [];
    updateRequests(s, (e) => events.push(e.text));
    expect(clean.status).toBe('done');
    expect(vet.status).toBe('done');
    expect(see.status).toBe('missed');
    expect(events.some((t) => /ran out of time/.test(t))).toBe(true);
  });

  it('a month of play: requests keep coming and the board stays tidy', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 24 * 10);
    expect(s.requests.length).toBeGreaterThan(0);
    expect(s.requests.filter((r) => r.status === 'active').length).toBeLessThanOrEqual(MAX_ACTIVE);
    expect(s.requests.length).toBeLessThan(20); // old ones are cleared away
  });

  it('migrates v14 saves', () => {
    const s = openPark();
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 14;
    delete raw.requests;
    delete raw.stats.requestsDone;
    const m = migrate(raw)!;
    expect(m.version).toBe(21);
    expect(m.requests).toEqual([]);
    expect(m.stats.requestsDone).toBe(0);
  });
});
