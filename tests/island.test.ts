import { describe, expect, it } from 'vitest';
import { migrate, newGame } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { DECOR_TYPES } from '../src/sim/data/decor';
import { fenceHp } from '../src/sim/fences';
import { bedAt } from '../src/sim/fossilBeds';
import type { Edge } from '../src/sim/grid';
import { isTileOwned } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { RUMBLE_RADIUS, volcanoRumble } from '../src/sim/systems/events';
import { sceneryCharm } from '../src/sim/systems/visitors';
import { isLand, Terrain } from '../src/sim/terrain';
import type { GameEvent } from '../src/sim/systems/context';

const SEEDS = [20231, 77113, 5150, 1905, 42, 7, 99];

describe('island generation', () => {
  it('every island has a mountain range, a volcano and ponds, and the gate reaches most of the starting land', () => {
    for (const seed of SEEDS) {
      const s = newGame(seed);
      const count = (t: Terrain) => s.map.tiles.filter((x) => x === t).length;
      expect(count(Terrain.Mountain)).toBeGreaterThan(20);
      expect(count(Terrain.Volcano)).toBe(9);
      expect(s.map.volcano).toBeDefined();
      expect(count(Terrain.Pond)).toBeGreaterThan(0);
      // Mountains and water don't cut the starting land off from the gate.
      const { regions, tileRegion } = computeRegions(s);
      const w = s.map.width;
      const gateRegion = tileRegion[s.entrance.y * w + s.entrance.x];
      let owned = 0;
      let reachable = 0;
      for (let i = 0; i < s.map.tiles.length; i++) {
        if (!isLand(s.map.tiles[i]) || !isTileOwned(s, i % w, Math.floor(i / w))) continue;
        owned++;
        if (tileRegion[i] === gateRegion) reachable++;
      }
      expect(reachable / owned).toBeGreaterThan(0.85);
      expect(regions[gateRegion].kind).toBe('public');
    }
  });

  it('mountains, the volcano and ponds block building', () => {
    const s = newGame(42);
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    s.money = 1e7;
    const w = s.map.width;
    const find = (t: Terrain) => s.map.tiles.findIndex((x) => x === t);
    for (const t of [Terrain.Mountain, Terrain.Volcano, Terrain.Pond]) {
      const i = find(t);
      expect(applyCommand(s, { type: 'buildPaths', tiles: [i] }).ok).toBe(false);
      expect(applyCommand(s, { type: 'placeDecor', kind: 'tree', x: i % w, y: Math.floor(i / w) }).ok).toBe(false);
    }
  });
});

describe('fossil beds', () => {
  it('five beds: one on the starting land, a rich one near the volcano, none by the gate', () => {
    for (const seed of SEEDS) {
      const s = newGame(seed);
      expect(s.fossilBeds.length).toBeGreaterThanOrEqual(4);
      expect(s.fossilBeds.some((b) => isTileOwned(s, b.x, b.y))).toBe(true);
      expect(s.fossilBeds.some((b) => b.richness === 3)).toBe(true);
      for (const b of s.fossilBeds) {
        expect(Math.max(Math.abs(b.x - s.entrance.x), Math.abs(b.y - s.entrance.y))).toBeGreaterThanOrEqual(6);
        expect(isLand(s.map.tiles[b.y * s.map.width + b.x])).toBe(true);
      }
      expect(JSON.stringify(newGame(seed).fossilBeds)).toBe(JSON.stringify(s.fossilBeds));
    }
  });

  it('old saves get beds, and an existing dig site off any bed keeps working', () => {
    const s = newGame(42);
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    const w = s.map.width;
    // A land tile away from every generated bed.
    const spot = s.map.tiles.findIndex((t, i) => t === Terrain.Grass && !bedAt(s.fossilBeds, i % w, Math.floor(i / w)));
    s.buildings.push({ id: 999, kind: 'digsite', x: spot % w, y: Math.floor(spot / w) });
    const old = JSON.parse(JSON.stringify(s));
    old.version = 8;
    delete old.fossilBeds;
    delete old.decor;
    delete old.volcanoActivity;
    const m = migrate(old)!;
    expect(m.version).toBe(11);
    expect(m.decor).toEqual([]);
    expect(bedAt(m.fossilBeds, spot % w, Math.floor(spot / w))).toBeDefined();
  });
});

describe('gardens', () => {
  it('can be placed on your land beside paths (not on them) and removed for a partial refund', () => {
    const s = newGame(42);
    const { x, y } = s.entrance;
    const w = s.map.width;
    applyCommand(s, { type: 'buildPaths', tiles: [(y - 1) * w + x] });
    expect(applyCommand(s, { type: 'placeDecor', kind: 'flowers', x, y: y - 1 }).message).toMatch(/not on them/);
    const spot = { x: x + 1, y: y - 1 };
    const r = applyCommand(s, { type: 'placeDecor', kind: 'fountain', ...spot });
    expect(r.ok).toBe(true);
    expect(applyCommand(s, { type: 'placeDecor', kind: 'bench', ...spot }).ok).toBe(false);
    const before = s.money;
    applyCommand(s, { type: 'removeDecor', id: s.decor[0].id });
    expect(s.decor).toHaveLength(0);
    expect(s.money).toBe(before + Math.floor(DECOR_TYPES.fountain.cost * 0.25));
  });

  it('cheer up visitors nearby (with a cap) and fountains cost upkeep', () => {
    const s = newGame(42);
    const { x, y } = s.entrance;
    s.decor = [
      { id: 1, kind: 'fountain', x: x + 1, y: y - 2 },
      { id: 2, kind: 'tree', x: x - 1, y: y - 2 },
      { id: 3, kind: 'flowers', x: x + 2, y: y - 1 },
    ];
    expect(sceneryCharm(s, x, y - 1)).toBe(4); // 3 + 1 + 1, capped at 4
    expect(sceneryCharm(s, x + 10, y - 10)).toBe(0);
    const sim = new Simulation(s);
    for (let i = 0; i < 16 * STEPS_PER_HOUR; i++) sim.step();
    expect(s.finance.month.expenses.upkeep).toBe(DECOR_TYPES.fountain.upkeep);
  });
});

describe('volcano', () => {
  it('a rumble shakes fences near the volcano but not far away', () => {
    const s = newGame(42);
    const v = s.map.volcano!;
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    s.money = 1e7;
    // One fence segment near the volcano, one far from it.
    const w = s.map.width;
    const landNear = s.map.tiles.findIndex(
      (t, i) => isLand(t) && Math.max(Math.abs((i % w) - v.x), Math.abs(Math.floor(i / w) - v.y)) <= 5,
    );
    const near: Edge = { dir: 'h', x: landNear % w, y: Math.floor(landNear / w) };
    const far: Edge = { dir: 'h', x: s.entrance.x, y: s.entrance.y };
    expect(Math.max(Math.abs(far.x - v.x), Math.abs(far.y - v.y))).toBeGreaterThan(RUMBLE_RADIUS);
    applyCommand(s, { type: 'buildFences', edges: [near, far], fence: 1 });
    const events: GameEvent[] = [];
    const ctx = { state: s, rng: new Rng(1), regions: computeRegions(s), emit: (e: GameEvent) => events.push(e), invalidateWorld() {} };
    volcanoRumble(ctx);
    expect(fenceHp(s, near)).toBeLessThan(100);
    expect(fenceHp(s, far)).toBe(100);
    expect(s.volcanoActivity).toBeGreaterThan(0);
    expect(events[0].text).toMatch(/volcano rumbles/);
  });
});
