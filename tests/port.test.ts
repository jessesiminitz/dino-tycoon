import { describe, expect, it } from 'vitest';
import { migrate, newGame, START_HOUR, type GameState } from '../src/sim/GameState';
import { applyCommand, ferryUpgradePrice } from '../src/sim/commands';
import { FERRY_TYPES, LEGACY_PORT, PORT_LEVELS } from '../src/sim/data/port';
import { dockStep, ferryCapacity, ferryPose, isPortTile, LANDING_STEPS, portSite, portUpkeep } from '../src/sim/port';
import { boardFerries, landFerries } from '../src/sim/systems/ferries';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { DAYS_PER_YEAR, seasonalDemand } from '../src/sim/seasons';
import { isSea, terrainAt } from '../src/sim/terrain';
import { Rng } from '../src/sim/rng';
import { computeRegions } from '../src/sim/regions';
import type { SimContext } from '../src/sim/systems/context';

const ctxFor = (s: GameState): SimContext => ({ state: s, rng: new Rng(1), regions: computeRegions(s), emit: () => {}, invalidateWorld: () => {} });
/** `state.hours` at a time of day on day 1. */
const at = (hour: number) => hour - START_HOUR;

describe('ferry port', () => {
  it('opens with a jetty and one ferry', () => {
    const s = newGame(7);
    expect(s.port.level).toBe(0);
    expect(s.port.ferries).toEqual(['medium']);
    expect(ferryCapacity(s.port)).toBe(FERRY_TYPES.medium.seats);
  });

  it('seats as many visitors as the ferries hold and counts the rest as turned away', () => {
    const s = newGame(7);
    s.port.level = 2;
    s.port.ferries = ['small', 'large', 'medium'];
    boardFerries(ctxFor(s), 100);
    expect(s.port.aboard).toEqual([6, 12, 9]);
    expect(s.port.turnedAway).toBe(100 - 27);
    boardFerries(ctxFor(s), 7);
    // Shared round the boats, so each one brings some of the crowd.
    expect(s.port.aboard).toEqual([3, 2, 2]);
    expect(s.port.loads).toEqual(s.port.aboard);
  });

  it('lands each ferry’s passengers at the gate a few minutes after it docks', () => {
    const s = newGame(7);
    s.port.level = 1;
    s.port.ferries = ['large', 'large'];
    s.hours = at(10);
    boardFerries(ctxFor(s), 20);
    const landedAt: number[] = [];
    for (let step = 0; step < STEPS_PER_HOUR; step++) {
      s.stepInHour = step;
      const before = s.visitors.length;
      landFerries(ctxFor(s));
      if (s.visitors.length > before) landedAt.push(step);
    }
    expect(landedAt).toEqual([dockStep(0, 2) + LANDING_STEPS, dockStep(1, 2) + LANDING_STEPS]);
    expect(s.visitors.length).toBe(20);
    expect(s.visitors.every((v) => v.x === s.entrance.x && v.y === s.entrance.y)).toBe(true);
  });

  it('brings no one when the park closed early', () => {
    const s = newGame(7);
    s.hours = at(12);
    boardFerries(ctxFor(s), 5);
    applyCommand(s, { type: 'closePark' });
    for (let step = 0; step < STEPS_PER_HOUR; step++) {
      s.stepInHour = step;
      landFerries(ctxFor(s));
    }
    expect(s.visitors.length).toBe(0);
  });

  it('upgrades the port, buys ferries and trades them up', () => {
    const s = newGame(7);
    s.money = 100_000;
    expect(applyCommand(s, { type: 'buyFerry', size: 'small' }).message).toMatch(/berth/);
    expect(applyCommand(s, { type: 'upgradeFerry', index: 0 }).message).toMatch(/bigger port/);
    expect(applyCommand(s, { type: 'sellFerry', index: 0 }).ok).toBe(false);
    expect(applyCommand(s, { type: 'upgradePort' }).ok).toBe(true);
    expect(s.money).toBe(100_000 - PORT_LEVELS[1].cost);
    expect(applyCommand(s, { type: 'buyFerry', size: 'large' }).ok).toBe(true);
    const before = s.money;
    expect(applyCommand(s, { type: 'upgradeFerry', index: 0 }).ok).toBe(true);
    expect(before - s.money).toBe(ferryUpgradePrice('medium', 'large'));
    expect(s.port.ferries).toEqual(['large', 'large']);
    expect(applyCommand(s, { type: 'upgradeFerry', index: 0 }).ok).toBe(false);
    expect(applyCommand(s, { type: 'upgradePort' }).ok).toBe(true);
    expect(applyCommand(s, { type: 'upgradePort' }).ok).toBe(false);
    expect(applyCommand(s, { type: 'buyFerry', size: 'small' }).ok).toBe(true);
    expect(ferryCapacity(s.port)).toBe(12 + 12 + 6);
    expect(applyCommand(s, { type: 'sellFerry', index: 2 }).ok).toBe(true);
    expect(s.port.ferries).toEqual(['large', 'large']);
  });

  it('charges the port’s running costs at midnight', () => {
    const s = newGame(7);
    s.port.level = 1;
    s.port.ferries = ['large', 'small'];
    s.hours = at(23);
    const sim = new Simulation(s);
    for (let i = 0; i < STEPS_PER_HOUR; i++) sim.step();
    expect(s.finance.month.expenses.ferries).toBe(portUpkeep(s.port));
    expect(portUpkeep(s.port)).toBe(PORT_LEVELS[1].upkeep + FERRY_TYPES.large.upkeep + FERRY_TYPES.small.upkeep);
  });

  it('gives saves from before the port a pier and two big ferries', () => {
    const raw = JSON.parse(JSON.stringify(newGame(7)));
    delete raw.port;
    raw.version = 21;
    for (const l of [raw.finance.today, raw.finance.month]) delete l.expenses.ferries;
    const m = migrate(raw)!;
    expect(m.version).toBe(22);
    expect(m.port.level).toBe(LEGACY_PORT.level);
    expect(m.port.ferries).toEqual(LEGACY_PORT.ferries);
    expect(m.finance.month.expenses.ferries).toBe(0);
    const broken = JSON.parse(JSON.stringify(m));
    broken.port.ferries = ['rowboat'];
    expect(migrate(broken)).toBeNull();
  });
});

describe('seasonal visitors', () => {
  it('peaks in summer, dips in winter and averages out over a year', () => {
    let sum = 0;
    const n = 2800;
    for (let i = 0; i < n; i++) sum += seasonalDemand((i / n) * DAYS_PER_YEAR);
    expect(sum / n).toBeCloseTo(1, 6);
    expect(seasonalDemand(10.5)).toBeCloseTo(1.25);
    expect(seasonalDemand(24.5)).toBeCloseTo(0.75);
    expect(seasonalDemand(3.5)).toBeCloseTo(1);
  });
});

describe('ferry timetable', () => {
  const park = (ferries: number) => {
    const s = newGame(7);
    s.port.level = 2;
    s.port.ferries = Array(ferries).fill('medium');
    return s;
  };

  it('sails in, docks and sails out every open hour, one ferry after another', () => {
    const s = park(2);
    const day = 0;
    const dock1 = at(12) + dockStep(1, 2) / STEPS_PER_HOUR;
    expect(ferryPose(s, 0, day + at(11.9)).mode).toBe('arriving');
    expect(ferryPose(s, 0, day + at(12.05)).mode).toBe('docked');
    expect(ferryPose(s, 0, day + at(12.4)).mode).toBe('leaving');
    expect(ferryPose(s, 1, dock1 - 0.1).mode).toBe('arriving');
    expect(ferryPose(s, 1, dock1 + 0.1).mode).toBe('docked');
    expect(ferryPose(s, 1, dock1 + 0.6).mode).toBe('away');
    expect(ferryPose(s, 1, dock1 + 0.85).mode).toBe('arriving'); // the next hour's run
  });

  it('keeps the first ferry tied up overnight; the others sail home', () => {
    const s = park(3);
    for (const hour of [21, 26, 31.5]) {
      expect(ferryPose(s, 0, at(hour))).toMatchObject({ mode: 'docked', t: 1 });
      expect(ferryPose(s, 1, at(hour)).mode).toBe('away');
      expect(ferryPose(s, 2, at(hour)).mode).toBe('away');
    }
  });

  it('shows the hour’s passengers walking ashore', () => {
    const s = park(1);
    s.hours = at(14);
    s.port.loads = [7];
    expect(ferryPose(s, 0, s.hours + 0.1)).toMatchObject({ mode: 'docked', passengers: 7 });
  });
});

describe('port layout', () => {
  it('runs out from the gate into open water, with every berth on the sea', () => {
    for (const seed of [7, 42, 1905, 20231]) {
      const s = newGame(seed);
      for (let level = 0; level < PORT_LEVELS.length; level++) {
        const site = portSite(s.map, s.entrance, level);
        expect(site.x).toBe(s.entrance.x);
        expect(site.y0).toBe(s.entrance.y + 1);
        expect(site.berths).toHaveLength(PORT_LEVELS[level].berths);
        for (const b of site.berths) {
          const t = terrainAt(s.map, Math.floor(b.x), Math.floor(b.y));
          expect(t === undefined || isSea(t)).toBe(true);
        }
        expect(isPortTile(site, site.x, site.y1)).toBe(true);
        expect(isPortTile(site, site.x, site.y0 - 1)).toBe(false);
      }
    }
  });
});
