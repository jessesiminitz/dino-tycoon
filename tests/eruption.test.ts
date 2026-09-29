import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { applyCommand, MOVE_DINO_COST } from '../src/sim/commands';
import { SCENARIOS } from '../src/sim/data/scenarios';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { hourlyEruption, lavaPreview, LAVA_COOL_HOURS, nextLava } from '../src/sim/systems/eruption';
import { expectedArrivals } from '../src/sim/systems/visitors';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { Terrain } from '../src/sim/terrain';
import type { GameEvent } from '../src/sim/systems/context';

const cfg = SCENARIOS['fire-mountain'].eruption!;
const ctxFor = (s: ReturnType<typeof newPark>, events: GameEvent[] = []) => ({
  state: s,
  rng: new Rng(1),
  regions: computeRegions(s),
  emit: (e: GameEvent) => events.push(e),
  invalidateWorld() {},
});

describe('Fire Mountain eruption', () => {
  it('shows a danger zone over the top paddocks before it erupts, and never the gate', () => {
    const s = newPark('fire-mountain', 1);
    const danger = lavaPreview(s);
    expect(danger.size).toBe(cfg.volume);
    const w = s.map.width;
    expect(danger.has(s.entrance.y * w + s.entrance.x)).toBe(false);
    expect(s.dinos.filter((d) => danger.has(d.y * w + d.x)).length).toBeGreaterThanOrEqual(3);
  });

  it('erupts on time, flows a few tiles an hour, burns what it covers, then cools into lava rock', () => {
    const s = newPark('fire-mountain', 1);
    const events: GameEvent[] = [];
    const buildingsBefore = s.buildings.length;
    for (let h = 1; h <= cfg.eruptAtHour + 40 + LAVA_COOL_HOURS; h++) {
      s.hours = h;
      hourlyEruption(ctxFor(s, events));
      if (h === cfg.eruptAtHour) expect(s.eruption!.stage).toBe('erupting');
      if (h === cfg.eruptAtHour + 1) expect(s.eruption!.lava.length).toBeLessThanOrEqual(cfg.perHour);
    }
    expect(s.eruption!.stage).toBe('over');
    expect(s.eruption!.lava).toHaveLength(cfg.volume);
    for (const l of s.eruption!.lava) {
      expect(s.map.tiles[l.tile]).toBe(Terrain.LavaRock);
      expect(s.paths[l.tile]).toBe(0);
    }
    expect(s.buildings.length).toBeLessThan(buildingsBefore); // the tower at the top of the path
    expect(events.some((e) => /ERUPTION/.test(e.text))).toBe(true);
  });

  it('a wall of concrete fence turns the lava aside', () => {
    const s = newPark('fire-mountain', 1);
    const w = s.map.width;
    const before = nextLava(s, cfg.volume);
    // Wall off the whole top of the park with concrete.
    const { x, y } = s.entrance;
    s.money = 1e6;
    const edges = [];
    for (let dx = -14; dx <= 14; dx++) edges.push({ dir: 'h' as const, x: x + dx, y: y - 17 });
    for (const e of edges) applyCommand(s, { type: 'buildFences', edges: [e], fence: 4 });
    const after = new Set(nextLava(s, cfg.volume));
    const parkTiles = (tiles: Iterable<number>) => [...tiles].filter((i) => Math.floor(i / w) > y - 17 && Math.abs((i % w) - x) <= 13).length;
    expect(parkTiles(before)).toBeGreaterThan(20);
    expect(parkTiles(after)).toBeLessThan(parkTiles(before));
  });

  it('a dinosaur trapped by lava and fences is lifted out by helicopter (and counts as lost)', () => {
    const s = newPark('fire-mountain', 1);
    const w = s.map.width;
    const danger = lavaPreview(s);
    const doomed = s.dinos.filter((d) => danger.has(d.y * w + d.x)).length;
    for (let h = 1; h <= cfg.eruptAtHour + 30; h++) {
      s.hours = h;
      hourlyEruption(ctxFor(s));
    }
    expect(s.stats.dinosLost).toBeGreaterThan(0);
    expect(s.stats.dinosLost).toBeLessThanOrEqual(doomed + 2);
  });

  it('ash keeps visitors away while it lasts', () => {
    const s = newPark('fire-mountain', 1);
    const regions = computeRegions(s);
    const clear = expectedArrivals(s, regions);
    s.eruption!.ashUntil = s.hours + 10;
    expect(expectedArrivals(s, regions)).toBeCloseTo(clear * 0.25, 5);
  });

  it('runs inside the normal simulation without trouble', () => {
    const s = newPark('fire-mountain', 1);
    const sim = new Simulation(s);
    for (let i = 0; i < (cfg.eruptAtHour + 12) * STEPS_PER_HOUR; i++) sim.step();
    expect(s.eruption!.stage).toBe('erupting');
    expect(s.eruption!.lava.length).toBeGreaterThan(0);
  });
});

describe('moving a dinosaur', () => {
  it('crates it into another paddock for a fee, but only somewhere it can live', () => {
    const s = newPark('fire-mountain', 1);
    const { x, y } = s.entrance;
    const d = s.dinos[0];
    const money = s.money;
    expect(applyCommand(s, { type: 'moveDino', id: d.id, x, y: y - 1 }).ok).toBe(false); // the path
    const r = applyCommand(s, { type: 'moveDino', id: d.id, x: x + 5, y: y - 3 });
    expect(r.ok).toBe(true);
    expect([d.x, d.y, d.homeX, d.homeY]).toEqual([x + 5, y - 3, x + 5, y - 3]);
    expect(s.money).toBe(money - MOVE_DINO_COST);
  });
});
