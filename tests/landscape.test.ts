import { describe, expect, it } from 'vitest';
import { migrate, newGame, SAVE_VERSION } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { BRIDGE_COST, DRAIN_COST, PATH_COST } from '../src/sim/data/economy';
import { ISLAND_SHAPE_IDS } from '../src/sim/island';
import { isTileOwned } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { sceneryCharm } from '../src/sim/systems/visitors';
import { isLand, isSea, Terrain } from '../src/sim/terrain';

const SEEDS = [3, 42, 1905];
const count = (tiles: Terrain[], t: Terrain) => tiles.filter((x) => x === t).length;

describe('island shapes', () => {
  it('every shape is the same island every time from the same seed', () => {
    for (const shape of ISLAND_SHAPE_IDS) {
      const a = newGame(42, { shape });
      const b = newGame(42, { shape });
      expect(a.map.tiles).toEqual(b.map.tiles);
      expect(a.map.heights).toEqual(b.map.heights);
      expect(a.map.shape).toBe(shape);
    }
  });

  it('every shape has a gate that reaches its starting land, kept clear of rivers, cliffs and marsh', () => {
    for (const shape of ISLAND_SHAPE_IDS)
      for (const seed of SEEDS) {
        const s = newGame(seed, { shape });
        const w = s.map.width;
        const { regions, tileRegion } = computeRegions(s);
        const gateRegion = tileRegion[s.entrance.y * w + s.entrance.x];
        expect(regions[gateRegion].kind).toBe('public');
        let owned = 0;
        let reachable = 0;
        for (let i = 0; i < s.map.tiles.length; i++) {
          if (!isTileOwned(s, i % w, Math.floor(i / w))) continue;
          const t = s.map.tiles[i];
          expect([Terrain.River, Terrain.Cliff, Terrain.Waterfall, Terrain.Marsh]).not.toContain(t);
          if (!isLand(t)) continue;
          owned++;
          if (tileRegion[i] === gateRegion) reachable++;
        }
        expect(owned).toBeGreaterThan(150);
        expect(reachable / owned).toBeGreaterThan(0.85);
        expect(s.map.volcano).toBeDefined();
        expect(s.map.heights).toHaveLength(s.map.tiles.length);
        expect(Math.max(...s.map.heights)).toBeLessThanOrEqual(15);
      }
  });

  it('rivers flow into the sea, a lake or another river, and are more plentiful in River Valley', () => {
    let valley = 0;
    let classic = 0;
    for (const seed of SEEDS) {
      for (const shape of ['classic', 'river'] as const) {
        const s = newGame(seed, { shape });
        const { width, height, tiles } = s.map;
        const n = count(tiles, Terrain.River);
        if (shape === 'river') valley += n;
        else classic += n;
        // Every stretch of river touches the sea or a lake somewhere.
        const seen = new Set<number>();
        for (let start = 0; start < tiles.length; start++) {
          if (tiles[start] !== Terrain.River || seen.has(start)) continue;
          let outlet = false;
          const stack = [start];
          seen.add(start);
          while (stack.length) {
            const i = stack.pop()!;
            const x = i % width;
            const y = Math.floor(i / width);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const j = ny * width + nx;
              const t = tiles[j];
              if (isSea(t) || t === Terrain.Pond) outlet = true;
              if ((t === Terrain.River || t === Terrain.Waterfall) && !seen.has(j)) {
                seen.add(j);
                stack.push(j);
              }
            }
          }
          expect(outlet).toBe(true);
        }
      }
    }
    expect(valley).toBeGreaterThan(classic);
  });

  it('Fire Mountain has lava fields and hot springs; Twin Isles and Crescent Bay have islets', () => {
    for (const seed of SEEDS) {
      const fire = newGame(seed, { shape: 'fire' });
      expect(count(fire.map.tiles, Terrain.LavaRock)).toBeGreaterThan(60);
      expect(count(fire.map.tiles, Terrain.HotSpring)).toBeGreaterThanOrEqual(2);
      expect(count(fire.map.tiles, Terrain.LavaRock)).toBeGreaterThan(count(newGame(seed).map.tiles, Terrain.LavaRock));
    }
  });

  it('big islands are 96 × 72 and still keep the gate area clear', () => {
    const s = newGame(5, { shape: 'peninsula', big: true });
    expect([s.map.width, s.map.height]).toEqual([96, 72]);
    expect(s.map.tiles).toHaveLength(96 * 72);
    const { regions, tileRegion } = computeRegions(s);
    expect(regions[tileRegion[s.entrance.y * 96 + s.entrance.x]].kind).toBe('public');
  });
});

/** An island with a river tile that has land on both sides, on land we own. */
function riverCrossing() {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const s = newGame(seed, { shape: 'river' });
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    s.money = 1e6;
    const w = s.map.width;
    for (let i = w; i < s.map.tiles.length - w; i++) {
      if (s.map.tiles[i] !== Terrain.River) continue;
      const west = s.map.tiles[i - 1];
      const east = s.map.tiles[i + 1];
      if ([Terrain.Grass, Terrain.Forest, Terrain.Sand].includes(west) && [Terrain.Grass, Terrain.Forest, Terrain.Sand].includes(east))
        return { s, i, w };
    }
  }
  throw new Error('no river crossing found');
}

describe('bridges', () => {
  it('a path across a river is a bridge: it costs more and joins the land either side', () => {
    const { s, i } = riverCrossing();
    // Before: the river tile belongs to no region (it's water).
    expect(computeRegions(s).tileRegion[i]).toBe(-1);
    const r = applyCommand(s, { type: 'buildPaths', tiles: [i - 1, i, i + 1] });
    expect(r.ok).toBe(true);
    expect(r.ok && r.cost).toBe(2 * PATH_COST + BRIDGE_COST);
    const after = computeRegions(s);
    expect(after.tileRegion[i - 1]).toBe(after.tileRegion[i + 1]);
    expect(after.tileRegion[i]).toBe(after.tileRegion[i - 1]);
  });

  it('nothing else can be built on a river, and paths still refuse the sea', () => {
    const { s, i, w } = riverCrossing();
    expect(applyCommand(s, { type: 'placeDecor', kind: 'bench', x: i % w, y: Math.floor(i / w) }).ok).toBe(false);
    const sea = s.map.tiles.findIndex((t) => t === Terrain.Shallows);
    expect(applyCommand(s, { type: 'buildPaths', tiles: [sea] }).ok).toBe(false);
  });
});

describe('marsh', () => {
  it('is walkable but too soggy to build on until drained', () => {
    const s = newGame(1, { shape: 'river' });
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    s.money = 1e6;
    const w = s.map.width;
    const i = s.map.tiles.findIndex((t) => t === Terrain.Marsh);
    expect(i).toBeGreaterThanOrEqual(0);
    const at = { x: i % w, y: Math.floor(i / w) };
    const blocked = applyCommand(s, { type: 'placeDecor', kind: 'tree', ...at });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/drain/i);
    expect(applyCommand(s, { type: 'buildPaths', tiles: [i] }).ok).toBe(true);
    applyCommand(s, { type: 'removePaths', tiles: [i] });
    const money = s.money;
    const drained = applyCommand(s, { type: 'drainMarsh', tiles: [i] });
    expect(drained.ok).toBe(true);
    expect(s.money).toBe(money - DRAIN_COST);
    expect(s.map.tiles[i]).toBe(Terrain.Grass);
    expect(applyCommand(s, { type: 'placeDecor', kind: 'tree', ...at }).ok).toBe(true);
    expect(applyCommand(s, { type: 'drainMarsh', tiles: [i] }).ok).toBe(false);
  });
});

describe('scenery', () => {
  it('visitors are cheered by a waterfall or hot spring in view', () => {
    const s = newGame(1, { shape: 'fire' });
    const w = s.map.width;
    const i = s.map.tiles.findIndex((t) => t === Terrain.HotSpring);
    s.decor = [];
    expect(sceneryCharm(s, i % w, Math.floor(i / w) + 2)).toBeGreaterThanOrEqual(3);
  });
});

describe('saves', () => {
  it('maps from before heights were kept get estimated heights and the classic shape', () => {
    const s = newGame(42);
    const old = JSON.parse(JSON.stringify(s));
    old.version = 17;
    delete old.map.heights;
    delete old.map.shape;
    const m = migrate(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.map.shape).toBe('classic');
    expect(m.map.heights).toHaveLength(m.map.tiles.length);
    const peak = m.map.tiles.findIndex((t) => t === Terrain.Volcano);
    const sea = m.map.tiles.findIndex((t) => t === Terrain.DeepWater);
    expect(m.map.heights[peak]).toBeGreaterThan(m.map.heights[sea]);
  });
});
