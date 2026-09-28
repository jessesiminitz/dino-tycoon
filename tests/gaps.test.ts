import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { findFenceGaps } from '../src/sim/gaps';
import { setFenceHp } from '../src/sim/fences';
import { Terrain } from '../src/sim/terrain';

const W = 24;
const H = 18;

function field(): GameState {
  const s = newGame(3);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: "classic" };
  s.entrance = { x: 0, y: H - 1 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 1_000_000;
  return s;
}

/** Paddock [3,12) × [2,9) in steel, minus `skip`. */
function paddock(s: GameState, skip: (e: Edge) => boolean = () => false): void {
  const box = [...pathEdges(3, 2, 12, 9, true), ...pathEdges(3, 2, 12, 9, false)].filter((e) => !skip(e));
  expect(applyCommand(s, { type: 'buildFences', edges: box, fence: 2 }).ok).toBe(true);
}

describe('fence gaps', () => {
  it('finds a missing segment, even on the row that was tapped', () => {
    const s = field();
    paddock(s, (e) => e.dir === 'v' && e.x === 3 && e.y === 5);
    expect(applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 6, y: 5 }).ok).toBe(false);
    const gaps = findFenceGaps(s, 6, 5)!;
    expect(gaps.box).toEqual({ x0: 3, y0: 2, x1: 12, y1: 9 });
    expect(gaps.missing).toEqual([{ dir: 'v', x: 3, y: 5 }]);
    expect(gaps.fence).toBe(2);
    // Close it and the dinosaur can go in.
    expect(applyCommand(s, { type: 'buildFences', edges: gaps.missing, fence: gaps.fence }).ok).toBe(true);
    expect(applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 6, y: 5 }).ok).toBe(true);
  });

  it('finds broken segments that need repair', () => {
    const s = field();
    paddock(s);
    setFenceHp(s, { dir: 'h', x: 5, y: 9 }, 0);
    setFenceHp(s, { dir: 'h', x: 6, y: 9 }, 0);
    expect(applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 3 }).ok).toBe(false);
    const gaps = findFenceGaps(s, 4, 3)!;
    expect(gaps.missing).toEqual([]);
    expect(gaps.broken).toHaveLength(2);
    for (const edge of gaps.broken) expect(applyCommand(s, { type: 'repairFence', edge }).ok).toBe(true);
    expect(applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 3 }).ok).toBe(true);
  });

  it('a corner left open is found too', () => {
    const s = field();
    paddock(s, (e) => (e.dir === 'h' && e.x === 11 && e.y === 2) || (e.dir === 'v' && e.x === 12 && e.y === 2));
    const gaps = findFenceGaps(s, 10, 3)!;
    expect(gaps.missing).toHaveLength(2);
  });

  it('open ground or a half-built box is not a gap', () => {
    const s = field();
    expect(findFenceGaps(s, 6, 5)).toBeNull();
    // Only two sides built.
    const edges = [...pathEdges(3, 2, 12, 9, true)];
    applyCommand(s, { type: 'buildFences', edges, fence: 1 });
    expect(findFenceGaps(s, 6, 5)).toBeNull();
  });
});
