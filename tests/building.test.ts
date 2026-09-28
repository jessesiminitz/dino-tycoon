import { describe, expect, it } from 'vitest';
import { newGame, STARTING_MONEY, type GameState } from '../src/sim/GameState';
import { applyCommand, planFences } from '../src/sim/commands';
import { FENCE_TYPES } from '../src/sim/data/fences';
import { fenceAt } from '../src/sim/fences';
import { pathEdges, type Edge } from '../src/sim/grid';
import { isTileOwned, parcelBuyBlocker, parcelGrid, parcelLandTiles, parcelPrice, PARCEL } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { isLand, Terrain } from '../src/sim/terrain';

/** A 12×10 all-grass world, fully owned, gate at (0, 9). Keeps tests independent of island generation. */
function flatWorld(): GameState {
  const s = newGame(1);
  const width = 12;
  const height = 10;
  s.map = { width, height, tiles: new Array(width * height).fill(Terrain.Grass), heights: new Array(width * height).fill(5), shape: "classic" };
  s.entrance = { x: 0, y: 9 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(width * (height + 1)).fill(0);
  s.vFences = new Array((width + 1) * height).fill(0);
  return s;
}

/** Closed rectangle of edges around tiles [x0, x1) × [y0, y1). */
function box(x0: number, y0: number, x1: number, y1: number): Edge[] {
  return [...pathEdges(x0, y0, x1, y1, true), ...pathEdges(x0, y0, x1, y1, false)];
}

describe('pathEdges', () => {
  it('builds an L-shaped path in the requested order', () => {
    expect(pathEdges(0, 0, 2, 1, true)).toEqual([
      { dir: 'h', x: 0, y: 0 },
      { dir: 'h', x: 1, y: 0 },
      { dir: 'v', x: 2, y: 0 },
    ]);
    expect(pathEdges(0, 0, 2, 1, false)).toEqual([
      { dir: 'v', x: 0, y: 0 },
      { dir: 'h', x: 0, y: 1 },
      { dir: 'h', x: 1, y: 1 },
    ]);
  });

  it('works when dragging up/left', () => {
    expect(pathEdges(3, 2, 1, 2, true)).toEqual([
      { dir: 'h', x: 1, y: 2 },
      { dir: 'h', x: 2, y: 2 },
    ]);
  });

  it('a box has 2(w+h) edges', () => {
    expect(box(2, 2, 5, 4)).toHaveLength(2 * (3 + 2));
  });
});

describe('fences', () => {
  it('building charges per segment and places the fence', () => {
    const s = flatWorld();
    const r = applyCommand(s, { type: 'buildFences', edges: pathEdges(0, 0, 4, 0, true), fence: 2 });
    expect(r.ok).toBe(true);
    expect(s.money).toBe(STARTING_MONEY - 4 * FENCE_TYPES[2].cost);
    expect(fenceAt(s, { dir: 'h', x: 3, y: 0 })).toBe(2);
    expect(fenceAt(s, { dir: 'h', x: 4, y: 0 })).toBe(0);
  });

  it('does not charge again for identical fences, but does for upgrades', () => {
    const s = flatWorld();
    const edges = pathEdges(0, 0, 3, 0, true);
    applyCommand(s, { type: 'buildFences', edges, fence: 1 });
    const after = s.money;
    expect(applyCommand(s, { type: 'buildFences', edges, fence: 1 }).ok).toBe(false);
    expect(s.money).toBe(after);
    applyCommand(s, { type: 'buildFences', edges, fence: 3 });
    expect(s.money).toBe(after - 3 * FENCE_TYPES[3].cost);
    expect(fenceAt(s, edges[0])).toBe(3);
  });

  it('rejects the whole build when money is short', () => {
    const s = flatWorld();
    s.money = FENCE_TYPES[4].cost * 2;
    const r = applyCommand(s, { type: 'buildFences', edges: pathEdges(0, 0, 3, 0, true), fence: 4 });
    expect(r.ok).toBe(false);
    expect(s.money).toBe(FENCE_TYPES[4].cost * 2);
    expect(fenceAt(s, { dir: 'h', x: 0, y: 0 })).toBe(0);
  });

  it('skips edges that do not touch owned land', () => {
    const s = flatWorld();
    s.parcelsOwned = s.parcelsOwned.map(() => false);
    s.parcelsOwned[0] = true; // only tiles [0, PARCEL) × [0, PARCEL)
    const plan = planFences(s, pathEdges(PARCEL - 2, 1, PARCEL + 2, 1, true), 1);
    // Edges h(6,1) and h(7,1) touch owned tiles; h(8,1), h(9,1) don't.
    expect(plan.build).toHaveLength(2);
    expect(plan.blocked).toBe(2);
  });

  it('removing refunds a quarter of the cost', () => {
    const s = flatWorld();
    const edges = pathEdges(0, 0, 4, 0, true);
    applyCommand(s, { type: 'buildFences', edges, fence: 1 });
    const before = s.money;
    const r = applyCommand(s, { type: 'removeFences', edges });
    expect(r.ok).toBe(true);
    expect(s.money).toBe(before + Math.floor(4 * FENCE_TYPES[1].cost * 0.25));
    expect(fenceAt(s, edges[0])).toBe(0);
  });
});

describe('regions', () => {
  it('with no fences, all land is one public area', () => {
    const { regions } = computeRegions(flatWorld());
    expect(regions).toHaveLength(1);
    expect(regions[0].kind).toBe('public');
  });

  it('a closed fence box becomes a paddock with its weakest fence', () => {
    const s = flatWorld();
    applyCommand(s, { type: 'buildFences', edges: box(2, 2, 5, 5), fence: 3 });
    applyCommand(s, { type: 'buildFences', edges: [{ dir: 'h', x: 3, y: 2 }], fence: 1 });
    const { regions, tileRegion } = computeRegions(s);
    const paddock = regions.find((r) => r.kind === 'paddock');
    expect(paddock?.tiles).toHaveLength(9);
    expect(paddock?.weakestFence).toBe(1);
    expect(regions[tileRegion[3 * s.map.width + 3]].kind).toBe('paddock');
  });

  it('a gap in the fence means no paddock', () => {
    const s = flatWorld();
    const edges = box(2, 2, 5, 5).filter((e) => !(e.dir === 'v' && e.x === 5 && e.y === 3));
    applyCommand(s, { type: 'buildFences', edges, fence: 2 });
    expect(computeRegions(s).regions.every((r) => r.kind === 'public')).toBe(true);
  });

  it('fencing off the gate keeps the gate side public', () => {
    const s = flatWorld();
    applyCommand(s, { type: 'buildFences', edges: pathEdges(0, 8, 2, 10, true), fence: 1 });
    const { regions, tileRegion } = computeRegions(s);
    expect(regions[tileRegion[9 * s.map.width + 0]].kind).toBe('public');
    expect(regions[tileRegion[0]].kind).toBe('paddock');
  });

  it('an enclosure that includes unowned land is wild, not a paddock', () => {
    const s = flatWorld();
    const { cols } = parcelGrid(s.map);
    s.parcelsOwned[1] = false; // parcel (1, 0): tiles x ≥ 8, y < 8
    // Full-height wall at x = 6 (on owned land); the east side runs into unowned land.
    applyCommand(s, { type: 'buildFences', edges: pathEdges(6, 0, 6, s.map.height, false), fence: 1 });
    const { regions, tileRegion } = computeRegions(s);
    expect(cols).toBe(2);
    expect(regions[tileRegion[2 * s.map.width + 7]].kind).toBe('wild');
    expect(regions[tileRegion[2 * s.map.width + 2]].kind).toBe('public');
  });
});

describe('land', () => {
  it('new parks start with some owned land including the gate', () => {
    for (const seed of [1, 2, 3, 42, 999, 123456]) {
      const s = newGame(seed);
      expect(isTileOwned(s, s.entrance.x, s.entrance.y)).toBe(true);
      expect(s.map.tiles[s.entrance.y * s.map.width + s.entrance.x]).toBe(Terrain.Sand);
      let ownedLand = 0;
      for (let y = 0; y < s.map.height; y++)
        for (let x = 0; x < s.map.width; x++)
          if (isTileOwned(s, x, y) && isLand(s.map.tiles[y * s.map.width + x])) ownedLand++;
      expect(ownedLand).toBeGreaterThan(100);
    }
  });

  it('parcels must border owned land and cost per land tile', () => {
    const s = flatWorld();
    s.map = { width: 24, height: 8, tiles: new Array(24 * 8).fill(Terrain.Grass), heights: new Array(24 * 8).fill(5), shape: "classic" };
    s.parcelsOwned = [true, false, false];
    expect(parcelBuyBlocker(s, 2, 0)).toMatch(/border/);
    expect(parcelBuyBlocker(s, 1, 0)).toBeNull();
    const price = parcelPrice(s.map, 1, 0);
    expect(price).toBe(parcelLandTiles(s.map, 1, 0) * 40);
    const r = applyCommand(s, { type: 'buyParcel', px: 1, py: 0 });
    expect(r.ok).toBe(true);
    expect(s.money).toBe(STARTING_MONEY - price);
    expect(parcelBuyBlocker(s, 2, 0)).toBeNull();
  });

  it('state survives a JSON round trip', () => {
    const s = newGame(5);
    applyCommand(s, { type: 'buildFences', edges: pathEdges(s.entrance.x - 2, s.entrance.y - 3, s.entrance.x + 2, s.entrance.y - 3, true), fence: 2 });
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(copy).toEqual(s);
    expect(computeRegions(copy).regions.length).toBe(computeRegions(s).regions.length);
  });
});

describe('tileLine', () => {
  it('covers both legs of the L without repeating the corner', async () => {
    const { tileLine } = await import('../src/sim/grid');
    expect(tileLine(0, 0, 2, 1, true)).toEqual([[0, 0], [1, 0], [2, 0], [2, 1]]);
    expect(tileLine(0, 0, 2, 1, false)).toEqual([[0, 0], [0, 1], [1, 1], [2, 1]]);
    expect(tileLine(3, 3, 3, 3, true)).toEqual([[3, 3]]);
    expect(tileLine(2, 2, 0, 2, true)).toEqual([[2, 2], [1, 2], [0, 2]]);
  });
});
