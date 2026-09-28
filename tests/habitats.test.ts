import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { NET, type FenceTypeId } from '../src/sim/data/fences';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { setFenceHp } from '../src/sim/fences';
import { Terrain } from '../src/sim/terrain';

const W = 30;
const H = 20;
const idx = (x: number, y: number) => y * W + x;

function field(): GameState {
  const s = newGame(5);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: "classic" };
  s.entrance = { x: 0, y: H - 1 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 10_000_000;
  s.unlockedSpecies = [...s.unlockedSpecies, 'plesiosaurus', 'mosasaurus', 'pteranodon', 'dimorphodon'];
  return s;
}

/** Fence the box [x0, x1) × [y0, y1). */
function box(s: GameState, x0: number, y0: number, x1: number, y1: number, fence: FenceTypeId): Edge[] {
  const edges = [...pathEdges(x0, y0, x1, y1, true), ...pathEdges(x0, y0, x1, y1, false)];
  expect(applyCommand(s, { type: 'buildFences', edges, fence }).ok).toBe(true);
  return edges;
}

function dig(s: GameState, x0: number, y0: number, x1: number, y1: number) {
  const tiles = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) tiles.push(idx(x, y));
  return applyCommand(s, { type: 'digPonds', tiles });
}

describe('lagoons', () => {
  it('digging a pond costs money, and filling it in refunds a little', () => {
    const s = field();
    const money = s.money;
    const r = dig(s, 5, 5, 8, 7);
    expect(r.ok).toBe(true);
    expect(s.map.tiles[idx(6, 6)]).toBe(Terrain.Pond);
    expect(s.money).toBe(money - 6 * 250);
    expect(applyCommand(s, { type: 'fillPonds', tiles: [idx(6, 6)] }).ok).toBe(true);
    expect(s.map.tiles[idx(6, 6)]).toBe(Terrain.Grass);
    // Not on paths, or on land you don't own.
    s.paths[idx(2, 2)] = 1;
    expect(applyCommand(s, { type: 'digPonds', tiles: [idx(2, 2)] }).ok).toBe(false);
  });

  it('a pond inside a paddock is part of it: a lagoon for sea reptiles', () => {
    const s = field();
    box(s, 3, 3, 13, 11, 3);
    dig(s, 5, 5, 11, 9);
    const regions = computeRegions(s);
    const land = regions.tileRegion[idx(4, 4)];
    expect(regions.tileRegion[idx(7, 7)]).toBe(land);
    expect(regions.regions[land].kind).toBe('paddock');
    // Sea reptiles go in the water; dinosaurs stay on land.
    expect(applyCommand(s, { type: 'buyDino', species: 'plesiosaurus', x: 4, y: 4 }).message).toMatch(/water/);
    expect(applyCommand(s, { type: 'buyDino', species: 'plesiosaurus', x: 7, y: 7 }).ok).toBe(true);
    expect(applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 7, y: 6 }).message).toMatch(/dry land/);
    // A pond in open ground isn't a lagoon.
    dig(s, 20, 3, 24, 6);
    expect(applyCommand(s, { type: 'buyDino', species: 'plesiosaurus', x: 21, y: 4 }).message).toMatch(/inside a fenced paddock/);
  });

  it('swimmers stay in the water, eat from floating fish feeders, and are born live', () => {
    const s = field();
    box(s, 3, 3, 13, 11, 3);
    dig(s, 5, 5, 11, 9);
    expect(applyCommand(s, { type: 'placeFeeder', kind: 'fish', x: 5, y: 5 }).ok).toBe(true);
    expect(applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 6, y: 6 }).ok).toBe(false);
    for (const [x, y] of [[7, 7], [9, 6]]) applyCommand(s, { type: 'buyDino', species: 'plesiosaurus', x, y });
    const sim = new Simulation(s);
    const [p] = s.dinos;
    for (let i = 0; i < STEPS_PER_HOUR * 24 * 3; i++) {
      sim.step();
      for (const d of s.dinos) expect(s.map.tiles[idx(d.x, d.y)]).toBe(Terrain.Pond);
      s.feeders[0].stock = 100;
      for (const d of s.dinos) Object.assign(d, { happiness: 95, hunger: Math.min(d.hunger, 40) });
    }
    expect(p.hunger).toBeLessThan(60); // it found the fish
    // Babies arrive without an egg sitting around for two days.
    expect(s.eggs.every((e) => e.laidHour <= s.hours - 48)).toBe(true);
    expect(s.messes.filter((m) => m.kind === 'dung')).toHaveLength(0);
  });
});

describe('aviaries', () => {
  it('flying reptiles need a paddock netted all round', () => {
    const s = field();
    box(s, 3, 3, 10, 9, 2); // steel: not an aviary
    expect(applyCommand(s, { type: 'buyDino', species: 'pteranodon', x: 5, y: 5 }).message).toMatch(/aviary/);
    const edges = box(s, 15, 3, 22, 9, NET);
    const regions = computeRegions(s);
    expect(regions.regions[regions.tileRegion[idx(17, 5)]].covered).toBe(true);
    expect(regions.regions[regions.tileRegion[idx(5, 5)]].covered).toBe(false);
    expect(applyCommand(s, { type: 'buyDino', species: 'pteranodon', x: 17, y: 5 }).ok).toBe(true);
    // Break one net segment and it's no longer an aviary: the flyer is out.
    setFenceHp(s, edges[0], 0);
    const sim = new Simulation(s);
    sim.step();
    expect(s.dinos[0].escaped).toBe(true);
  });

  it('an aviary with open water at its edge is not covered', () => {
    const s = field();
    // Net on three sides, the fourth side open to a pond that runs out of the box.
    const edges = [...pathEdges(15, 3, 22, 9, true), ...pathEdges(15, 3, 22, 9, false)].filter((e) => !(e.dir === 'v' && e.x === 22));
    applyCommand(s, { type: 'buildFences', edges, fence: NET });
    dig(s, 22, 3, 24, 9);
    const regions = computeRegions(s);
    expect(regions.regions[regions.tileRegion[idx(17, 5)]].covered).toBe(false);
  });

  it('net counts as steel-strength for other animals', () => {
    const s = field();
    box(s, 3, 3, 10, 9, NET);
    const regions = computeRegions(s);
    expect(regions.regions[regions.tileRegion[idx(5, 5)]].weakestFence).toBe(NET);
    expect(applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 5, y: 5 }).ok).toBe(true);
  });
});
