import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand, type Command } from '../src/sim/commands';
import { boxEdges } from '../src/sim/grid';
import { Terrain } from '../src/sim/terrain';
import { Simulation } from '../src/sim/Simulation';
import { fenceHp, setFenceHp } from '../src/sim/fences';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { stormHour } from '../src/sim/systems/events';
import { BADLY_DAMAGED } from '../src/sim/data/staff';
import type { GameEvent, SimContext } from '../src/sim/systems/context';

// 2026-10-24 audit: a broken fence section used to mark every animal in the paddock escaped at once.

const W = 24;
const H = 20;

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

function ok(s: GameState, cmd: Command): void {
  const r = applyCommand(s, cmd);
  expect(r.ok, `${cmd.type}: ${r.message}`).toBe(true);
}

/** A steel paddock (2..7 × 2..7) with three Triceratops standing still in it. */
function paddock() {
  const s = flat();
  const edges = boxEdges(2, 2, 7, 7);
  ok(s, { type: 'buildFences', edges, fence: 4 });
  for (const [x, y] of [[3, 3], [4, 4], [5, 5]]) ok(s, { type: 'buyDino', species: 'triceratops', x, y });
  const sim = new Simulation(s);
  const events: string[] = [];
  sim.onEvent((e) => events.push(e.text));
  // Keep them still, so only the test moves them.
  const hold = () => { for (const d of s.dinos) { d.path = []; d.hunger = 0; d.happiness = 90; } };
  return { s, sim, edges, events, hold };
}

describe('escapes need a real gap and a real step through it', () => {
  it('a broken section frees nobody until an animal walks out', () => {
    const { s, sim, edges, events, hold } = paddock();
    const gap = edges.find((e) => e.dir === 'v' && e.x === 7)!;
    setFenceHp(s, gap, 0);
    for (let i = 0; i < 20; i++) { hold(); sim.step(); }
    expect(s.dinos.every((d) => !d.escaped)).toBe(true);
    expect(events.filter((t) => /escaped/.test(t))).toEqual([]);

    // One steps out through the gap: only that one is loose, with one alarm.
    s.dinos[0].x = 7;
    s.dinos[0].y = gap.y;
    hold();
    sim.step();
    expect(s.dinos.map((d) => d.escaped)).toEqual([true, false, false]);
    expect(events.filter((t) => /escaped/.test(t))).toHaveLength(1);
  });

  it('home tiles keep updating inside a broken paddock, so a guard brings strays back inside', () => {
    const { s, sim, edges, hold } = paddock();
    setFenceHp(s, edges[0], 0);
    s.dinos[1].x = 6;
    s.dinos[1].y = 6;
    hold();
    sim.step();
    expect(s.dinos[1]).toMatchObject({ escaped: false, homeX: 6, homeY: 6 });
  });

  it('removing a fence on purpose still lets them out at once', () => {
    const { s, sim, edges, hold } = paddock();
    ok(s, { type: 'removeFences', edges: [edges[0]] });
    hold();
    sim.step();
    expect(s.dinos.every((d) => d.escaped)).toBe(true);
  });
});

describe('storms', () => {
  function ctx(s: GameState, events: GameEvent[]): SimContext {
    return { state: s, rng: new Rng(3), regions: computeRegions(s), emit: (e: GameEvent) => events.push(e), invalidateWorld() {} } as unknown as SimContext;
  }

  it('one hit never knocks down a sound wooden fence; it leaves it badly damaged, with a warning', () => {
    const s = flat();
    const edges = boxEdges(2, 2, 7, 7);
    ok(s, { type: 'buildFences', edges, fence: 1 });
    const events: GameEvent[] = [];
    const c = ctx(s, events);
    // Hundreds of storm hours, restoring the fence each time: no single hour may break it.
    for (let h = 0; h < 400; h++) {
      for (const e of edges) setFenceHp(s, e, 60);
      stormHour(c);
      for (const e of edges) expect(fenceHp(s, e)).toBeGreaterThan(0);
    }
    expect(events.some((e) => /badly damaged/.test(e.text))).toBe(true);
    expect(events.some((e) => /knocked down/.test(e.text))).toBe(false);
  });

  it('an already badly damaged fence can still fall', () => {
    const s = flat();
    const edges = boxEdges(2, 2, 7, 7);
    ok(s, { type: 'buildFences', edges, fence: 1 });
    const c = ctx(s, []);
    for (const e of edges) setFenceHp(s, e, 2);
    stormHour(c);
    expect(edges.some((e) => fenceHp(s, e) <= 0)).toBe(true);
    expect(BADLY_DAMAGED).toBeGreaterThan(2);
  });
});
