import { describe, expect, it } from 'vitest';
import { calendar, newGame, SAVE_VERSION, type GameState } from '../src/sim/GameState';
import { applyCommand, type Command } from '../src/sim/commands';
import { boxEdges, type Edge } from '../src/sim/grid';
import { Terrain } from '../src/sim/terrain';
import { Simulation } from '../src/sim/Simulation';
import { parseImport } from '../src/save/storage';
import { fencesOkPercent, hourlyScenario } from '../src/sim/goals';
import { fenceHp, setFenceHp } from '../src/sim/fences';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { hourlyFlood } from '../src/sim/systems/flood';
import { onTrack, stationStatus, stepJeeps } from '../src/sim/systems/rides';
import { newPark } from '../src/sim/challenges';
import type { SimContext } from '../src/sim/systems/context';
import { holdPause, releasePause } from '../src/ui/pause';

// Fixes for the 2026-09-30 bug audit (docs/BUG_AUDIT-2026-09-30.md), one block per finding.

const W = 24;
const H = 20;

/** A flat, owned, empty grass island with plenty of money. */
function flat(): GameState {
  const s = newGame(11);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: 'classic' };
  s.entrance = { x: 12, y: 19 };
  s.parcelsOwned = new Array(20).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.tracks = new Array(W * H).fill(0);
  s.money = 1e6;
  return s;
}

function context(s: GameState, invalidateWorld = () => {}): SimContext {
  return { state: s, rng: new Rng(7), regions: computeRegions(s), emit: () => {}, invalidateWorld } as unknown as SimContext;
}

function ok(s: GameState, cmd: Command): void {
  const r = applyCommand(s, cmd);
  expect(r.ok, `${cmd.type}: ${r.message}`).toBe(true);
}

/** Flood Season state with the given tiles under water at level 3. */
function flooded(s: GameState, wet: number[]): void {
  s.scenario.id = 'flood-season';
  s.hours = 34;
  s.flood = { level: 3, wet, survived: 0, lastDry: false, damage: 0, soaked: [] };
}

describe('B01: damaged save files', () => {
  it('rejects a current-version file with nothing in it', () => {
    const r = parseImport(JSON.stringify({ version: SAVE_VERSION }));
    expect(r).toEqual({ error: expect.stringMatching(/damaged or incomplete/) });
  });

  it('rejects saves with a misshapen map or missing collections, bare or as a record', () => {
    const good = newGame(3);
    const noTiles = { ...structuredClone(good), map: { ...good.map, tiles: [] } };
    const noDinos = { ...structuredClone(good), dinos: undefined };
    const badScenario = { ...structuredClone(good), scenario: { ...good.scenario, id: 'nowhere' } };
    for (const bad of [noTiles, noDinos, badScenario]) {
      expect('error' in parseImport(JSON.stringify(bad))).toBe(true);
      expect('error' in parseImport(JSON.stringify({ slot: 1, savedAt: 0, state: bad }))).toBe(true);
    }
  });

  it('still accepts a real save, and explains saves from a newer game', () => {
    const r = parseImport(JSON.stringify(newGame(3)));
    if (!('state' in r)) throw new Error('a real save was rejected');
    expect(() => new Simulation(r.state).step()).not.toThrow();
    expect(parseImport(JSON.stringify({ version: SAVE_VERSION + 1 }))).toEqual({ error: expect.stringMatching(/version/) });
  });
});

describe('B02: jeep tracks are occupied ground', () => {
  const i = 10 * W + 10;
  it('paths, buildings and ponds cannot go on a track', () => {
    const s = flat();
    ok(s, { type: 'buildTracks', tiles: [i] });
    ok(s, { type: 'buildPaths', tiles: [i + 1] });
    applyCommand(s, { type: 'buildPaths', tiles: [i] });
    expect(s.paths[i]).toBe(0);
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 10, y: 10 }).ok).toBe(false);
    applyCommand(s, { type: 'digPonds', tiles: [i] });
    expect(s.map.tiles[i]).toBe(Terrain.Grass);
    expect(s.tracks[i]).toBe(1);
  });
});

describe('B03: moving a dinosaur clears the paddock like buying one', () => {
  it('clears visitor paths in the new paddock, and won’t drop a dinosaur on a building', () => {
    const s = flat();
    ok(s, { type: 'buildFences', edges: boxEdges(2, 2, 7, 7), fence: 4 });
    ok(s, { type: 'buyDino', species: 'protoceratops', x: 3, y: 3 });
    ok(s, { type: 'buildFences', edges: boxEdges(10, 2, 16, 8), fence: 4 });
    const i = 4 * W + 12;
    ok(s, { type: 'buildPaths', tiles: [i] });
    ok(s, { type: 'placeBuilding', kind: 'restaurant', x: 13, y: 4 });
    const id = s.dinos[0].id;
    expect(applyCommand(s, { type: 'moveDino', id, x: 13, y: 4 }).ok).toBe(false);
    ok(s, { type: 'moveDino', id, x: 12, y: 4 });
    expect(s.paths[i]).toBe(0);
  });
});

describe('B04: broken fences need repair', () => {
  it('counts broken sections against the repair percentage', () => {
    const s = flat();
    const edges = boxEdges(2, 2, 7, 7);
    ok(s, { type: 'buildFences', edges, fence: 4 });
    expect(fencesOkPercent(s)).toBe(100);
    for (const e of edges.slice(0, edges.length / 2)) setFenceHp(s, e, 0);
    expect(fencesOkPercent(s)).toBe(50);
    for (const e of edges) setFenceHp(s, e, 0);
    expect(fencesOkPercent(s)).toBe(0);
    expect(fencesOkPercent(flat())).toBe(100); // no fences at all
  });
});

describe('B05 and B11: flood rot', () => {
  it('a fence the flood rots through redraws the paddocks, even when the water holds steady', () => {
    const s = flat();
    s.map.tiles[10 * W + 10] = Terrain.River;
    s.map.heights[10 * W + 11] = 2;
    ok(s, { type: 'buildFences', edges: boxEdges(11, 10, 13, 12), fence: 1 });
    const edge: Edge = { dir: 'v', x: 11, y: 10 };
    setFenceHp(s, edge, 1);
    flooded(s, [10 * W + 11]);
    let invalidations = 0;
    hourlyFlood(context(s, () => invalidations++));
    expect(fenceHp(s, edge)).toBe(0);
    expect(invalidations).toBeGreaterThan(0);
  });

  it('a fence between two wet tiles rots once an hour, not twice', () => {
    const s = flat();
    s.map.tiles[10 * W + 10] = Terrain.River;
    for (const i of [10 * W + 11, 10 * W + 12]) s.map.heights[i] = 2;
    const edge: Edge = { dir: 'v', x: 12, y: 10 };
    ok(s, { type: 'buildFences', edges: [edge], fence: 1 });
    flooded(s, [10 * W + 11, 10 * W + 12]);
    hourlyFlood(context(s));
    expect(fenceHp(s, edge)).toBe(97);
  });
});

describe('B06: safaris close in a flood', () => {
  function park() {
    const s = flat();
    const i = 10 * W + 10;
    ok(s, { type: 'buildTracks', tiles: [i, i + 1] });
    ok(s, { type: 'buildPaths', tiles: [9 * W + 9] });
    ok(s, { type: 'placeBuilding', kind: 'station', x: 9, y: 10 });
    stepJeeps(context(s));
    return { s, i };
  }

  it('a touring jeep won’t drive into flood water', () => {
    const { s, i } = park();
    flooded(s, [i + 1]);
    expect(onTrack(s, i + 1)).toBe(false);
    const j = s.jeeps[0];
    j.steps = 1;
    stepJeeps(context(s));
    expect(j.x).toBe(10);
  });

  it('a parked jeep lets its riders off instead of setting out', () => {
    const { s, i } = park();
    const j = s.jeeps[0];
    j.riders.push({ id: 999, tile: 9 * W + 9 });
    j.waiting = 1000;
    flooded(s, [i + 1]);
    stepJeeps(context(s));
    expect(j.steps).toBe(0);
    expect(j.riders).toEqual([]);
    expect(stationStatus(s, s.buildings[0])).toMatch(/flooded/);
  });
});

describe('B07: hard losses come before medals', () => {
  it('no medal for a park that has lost too many dinosaurs, and the game ends at midnight', () => {
    const s = newPark('great-escape', 1);
    Object.assign(s.scenario, { round: 2 });
    Object.assign(s.stats, { dinosLost: 4, bestDayVisitors: 100 });
    s.reputation = 80;
    s.hours = 15;
    expect(calendar(s).hour).toBe(23);
    hourlyScenario(context(s));
    expect(s.scenario.status).toBe('playing');
    s.hours = 16;
    hourlyScenario(context(s));
    expect(s.scenario.status).toBe('lost');
    expect(s.scenario.round).toBe(2);
  });
});

describe('B08–B10: popups share the pause', () => {
  it('closing a popup keeps a park the player paused, paused', () => {
    const sim = new Simulation(newGame(3));
    const menu = {};
    sim.setSpeed(0);
    holdPause(sim, menu);
    releasePause(sim, menu);
    expect(sim.speed).toBe(0);
  });

  it('the park stays paused until the last of two popups closes, then goes back to its old speed', () => {
    const sim = new Simulation(newGame(3));
    const choice = {};
    const outcome = {};
    sim.setSpeed(3);
    holdPause(sim, choice);
    holdPause(sim, choice); // reopening the same card changes nothing
    holdPause(sim, outcome);
    releasePause(sim, outcome);
    expect(sim.speed).toBe(0);
    releasePause(sim, choice);
    expect(sim.speed).toBe(3);
    releasePause(sim, choice); // closing twice changes nothing
    expect(sim.speed).toBe(3);
  });

  it('a speed the player picks while a popup is open is kept', () => {
    const sim = new Simulation(newGame(3));
    const dig = {};
    sim.setSpeed(1);
    holdPause(sim, dig);
    sim.setSpeed(8);
    releasePause(sim, dig);
    expect(sim.speed).toBe(8);
  });
});

describe('B12: escaped dinosaurs can’t be sold', () => {
  it('selling the Great Escape’s runaways doesn’t earn the rescue medal', () => {
    const s = newPark('great-escape', 1);
    const runaways = s.dinos.filter((d) => d.escaped);
    expect(runaways.length).toBeGreaterThan(0);
    for (const d of runaways) expect(applyCommand(s, { type: 'sellDino', id: d.id }).ok).toBe(false);
    for (const d of [...s.dinos]) applyCommand(s, { type: 'sellDino', id: d.id });
    hourlyScenario(context(s));
    expect(s.scenario.round).toBe(0);
  });
});
