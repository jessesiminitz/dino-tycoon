import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { applyCommand } from '../src/sim/commands';
import { SCENARIOS } from '../src/sim/data/scenarios';
import { onWalkway } from '../src/sim/paths';
import { onLand } from '../src/sim/pathfind';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { floodForecast, floodTiles, hourlyFlood, isFlooded, PUMP_RADIUS, scheduledLevel } from '../src/sim/systems/flood';
import type { GameEvent } from '../src/sim/systems/context';

const cfg = SCENARIOS['flood-season'].floods!;
const ctxFor = (s: ReturnType<typeof newPark>, events: GameEvent[] = []) => ({
  state: s,
  rng: new Rng(1),
  regions: computeRegions(s),
  emit: (e: GameEvent) => events.push(e),
  invalidateWorld() {},
});
const runTo = (s: ReturnType<typeof newPark>, hour: number, events: GameEvent[] = []) => {
  while (s.hours < hour) {
    s.hours++;
    hourlyFlood(ctxFor(s, events));
  }
};

describe('Flood Season floods', () => {
  it('the river rises and falls on schedule', () => {
    const s = newPark('flood-season', 1);
    s.hours = cfg.starts[0] - 1;
    expect(scheduledLevel(s).level).toBe(0);
    s.hours = cfg.starts[0] + cfg.rise;
    expect(scheduledLevel(s).level).toBe(cfg.peak);
    s.hours = cfg.starts[0] + cfg.rise + cfg.hold + cfg.drain;
    expect(scheduledLevel(s).level).toBe(0);
  });

  it('floods the riverside meadows but not the gate, with a forecast 12 hours ahead', () => {
    const s = newPark('flood-season', 1);
    const w = s.map.width;
    const wet = new Set(floodTiles(s, cfg.peak));
    expect(wet.size).toBeGreaterThan(100);
    expect(wet.has(s.entrance.y * w + s.entrance.x)).toBe(false);
    expect(s.dinos.filter((d) => wet.has(d.y * w + d.x)).length).toBeGreaterThanOrEqual(4);
    s.hours = cfg.starts[0] - 20;
    expect(floodForecast(s).size).toBe(0);
    s.hours = cfg.starts[0] - 10;
    expect(floodForecast(s).size).toBe(wet.size);
  });

  it('sandbags along the banks and a pump by the bridge keep it all dry', () => {
    const s = newPark('flood-season', 1);
    const { x, y } = s.entrance;
    const edges = [];
    for (let dx = -13; dx <= 13; dx++) if (dx !== 0) edges.push({ dir: 'h' as const, x: x + dx, y: y - 12 }, { dir: 'h' as const, x: x + dx, y: y - 10 });
    applyCommand(s, { type: 'buildFences', edges, fence: 6 });
    const withBags = floodTiles(s, cfg.peak).length;
    expect(withBags).toBeGreaterThan(0); // water still gets in round the bridge
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'pump', x: x + 1, y: y - 14 }).ok).toBe(true);
    expect(floodTiles(s, cfg.peak)).toHaveLength(0);
    expect(PUMP_RADIUS).toBe(4);
  });

  it('flood water blocks paths and ground, spoils feeders, closes buildings, and is cleaned up after', () => {
    const s = newPark('flood-season', 1);
    const w = s.map.width;
    const events: GameEvent[] = [];
    const money = s.money;
    runTo(s, cfg.starts[0] + cfg.rise, events);
    const wet = s.flood!.wet;
    expect(wet.length).toBeGreaterThan(100);
    const wetPath = wet.find((i) => s.paths[i] === 1)!;
    expect(isFlooded(s, wetPath)).toBe(true);
    expect(onWalkway(s, wetPath)).toBe(false);
    expect(onLand(s, wetPath)).toBe(false);
    expect(s.feeders.some((f) => wet.includes(f.y * w + f.x) && f.stock === 0)).toBe(true);
    expect(s.flood!.soaked.length).toBeGreaterThan(0);
    runTo(s, cfg.starts[0] + cfg.rise + cfg.hold + cfg.drain, events);
    expect(s.flood!.level).toBe(0);
    expect(s.flood!.wet).toHaveLength(0);
    expect(s.flood!.survived).toBe(1);
    expect(s.flood!.lastDry).toBe(false);
    expect(s.money).toBeLessThan(money); // clean-up
    expect(events.some((e) => /burst its banks/.test(e.text))).toBe(true);
    expect(events.some((e) => /drained away/.test(e.text))).toBe(true);
  });
});
