import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { MUSEUM_PRICE } from '../src/sim/data/economy';
import { SPECIES, SPECIES_IDS, STARTER_SPECIES } from '../src/sim/data/species';
import { fenceHp, setFenceHp } from '../src/sim/fences';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { Simulation } from '../src/sim/Simulation';
import type { GameEvent, SimContext } from '../src/sim/systems/context';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import {
  FINE_PER_ISSUE,
  INSPECTION_AWARD,
  inspection,
  outbreak,
  safetyIssues,
  schoolTrip,
  startStorm,
  stormHour,
} from '../src/sim/systems/events';
import { digChance, hourlyFossils, lockedSpecies } from '../src/sim/systems/fossils';
import { expectedArrivals } from '../src/sim/systems/visitors';
import { Terrain } from '../src/sim/terrain';

const W = 20;
const H = 14;

/** Grass park, all owned, gate (0,13), paths along x=0 and y=9, fenced paddock [2,10)×[2,8). */
function park(fence: 1 | 2 | 3 | 4 = 4): GameState {
  const s = newGame(31);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass) };
  s.entrance = { x: 0, y: 13 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  const box: Edge[] = [...pathEdges(2, 2, 10, 8, true), ...pathEdges(2, 2, 10, 8, false)];
  applyCommand(s, { type: 'buildFences', edges: box, fence });
  const tiles = [];
  for (let y = 9; y <= 13; y++) tiles.push(y * W);
  for (let x = 1; x <= 14; x++) tiles.push(9 * W + x);
  applyCommand(s, { type: 'buildPaths', tiles });
  s.money = 1_000_000;
  return s;
}

function ctxFor(s: GameState, seed = 1): SimContext & { events: GameEvent[]; invalidated: number } {
  const c = {
    state: s,
    rng: new Rng(seed),
    regions: computeRegions(s),
    events: [] as GameEvent[],
    invalidated: 0,
    emit(e: GameEvent) {
      c.events.push(e);
    },
    invalidateWorld() {
      c.invalidated++;
      c.regions = computeRegions(s);
    },
  };
  return c;
}

/** Advance to the next midnight so nightly systems run. */
function atMidnight(s: GameState): void {
  s.hours = 16; // 08:00 + 16h = 00:00
}

describe('species data for the Dino Guide', () => {
  it('every species has facts, weight, discovery info and a sensible fossil setup', () => {
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      expect(sp.facts.length).toBeGreaterThanOrEqual(3);
      expect(sp.weight.length).toBeGreaterThan(0);
      expect(sp.discovered).toMatch(/\d{4}/);
      if (sp.starter) expect(sp.fossilsNeeded).toBe(0);
      else {
        expect(sp.fossilsNeeded).toBeGreaterThanOrEqual(3);
        expect(sp.fossilWeight).toBeGreaterThan(0);
      }
    }
    // Pricier species are rarer finds.
    const locked = SPECIES_IDS.filter((id) => !SPECIES[id].starter).sort((a, b) => SPECIES[a].price - SPECIES[b].price);
    for (let i = 1; i < locked.length; i++) {
      expect(SPECIES[locked[i]].fossilWeight).toBeLessThanOrEqual(SPECIES[locked[i - 1]].fossilWeight);
    }
  });
});

describe('fossil digs', () => {
  it('dig sites need no path, but must be on your land outside paddocks', () => {
    const s = park();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x: 16, y: 3 }).ok).toBe(true);
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x: 5, y: 5 }).message).toMatch(/paddock/);
  });

  it('rocky ground digs faster', () => {
    const s = park();
    s.map.tiles[3 * W + 16] = Terrain.Rock;
    expect(digChance(s, 16, 3)).toBeGreaterThan(digChance(s, 17, 3));
  });

  it('finds accumulate and unlock a species', () => {
    const s = park();
    applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x: 16, y: 3 });
    const c = ctxFor(s);
    atMidnight(s);
    for (let night = 0; night < 200 && lockedSpecies(s).length === 6; night++) hourlyFossils(c);
    const unlocked = s.unlockedSpecies.filter((id) => !STARTER_SPECIES.includes(id));
    expect(unlocked).toHaveLength(1);
    expect(s.fossils[unlocked[0]]).toBe(SPECIES[unlocked[0]].fossilsNeeded);
    expect(c.events.some((e) => /Fossil find/.test(e.text))).toBe(true);
    expect(c.events.some((e) => /\ba [AEIOU]/.test(e.text))).toBe(false); // "an Ankylosaurus", not "a Ankylosaurus"
    expect(c.events.some((e) => new RegExp(`${SPECIES[unlocked[0]].name} unlocked`).test(e.text))).toBe(true);
    // The new species can now be bought.
    expect(applyCommand(s, { type: 'buyDino', species: unlocked[0], x: 4, y: 4 }).ok).toBe(true);
  });

  it('common species turn up more often than rare ones', () => {
    const s = park();
    for (let x = 12; x < 18; x++) applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x, y: 3 });
    const c = ctxFor(s, 99);
    atMidnight(s);
    const counts: Record<string, number> = {};
    for (let night = 0; night < 400; night++) {
      const before = { ...s.fossils };
      hourlyFossils(c);
      for (const id of SPECIES_IDS) counts[id] = (counts[id] ?? 0) + ((s.fossils[id] ?? 0) - (before[id] ?? 0));
      s.unlockedSpecies = [...STARTER_SPECIES]; // keep everything locked to sample the odds
      s.fossils = {};
    }
    expect(counts.pachycephalosaurus).toBeGreaterThan(counts.tyrannosaurus * 2);
  });

  it('once everything is unlocked, finds are sold to museums', () => {
    const s = park();
    s.unlockedSpecies = [...SPECIES_IDS];
    applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x: 16, y: 3 });
    const c = ctxFor(s);
    atMidnight(s);
    for (let night = 0; night < 30; night++) hourlyFossils(c);
    expect(s.finance.month.income.sales).toBeGreaterThan(0);
    expect(s.finance.month.income.sales % MUSEUM_PRICE).toBe(0);
  });
});

describe('random events', () => {
  it('storms batter fences, keep visitors away, then pass', () => {
    const s = park(1);
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 4 });
    s.ticketPrice = 10;
    const c = ctxFor(s);
    const calm = expectedArrivals(s, c.regions);
    expect(calm).toBeGreaterThan(0);
    startStorm(c);
    expect(s.stormHours).toBeGreaterThanOrEqual(6);
    expect(expectedArrivals(s, c.regions)).toBeLessThan(calm);
    const e: Edge = { dir: 'h', x: 4, y: 2 };
    stormHour(c);
    expect(fenceHp(s, e)).toBeLessThan(100);
    const sim = new Simulation(s);
    const events: GameEvent[] = [];
    sim.onEvent((ev) => events.push(ev));
    for (let i = 0; i < 13 * STEPS_PER_HOUR; i++) sim.step();
    expect(s.stormHours).toBe(0);
    expect(events.some((ev) => /storm has passed/.test(ev.text))).toBe(true);
  });

  it('storms hurt weak fences far more than strong ones', () => {
    const worst = (fence: 1 | 4) => {
      const s = park(fence);
      const c = ctxFor(s, 7);
      for (let h = 0; h < 12; h++) stormHour(c); // a long storm
      const hps = [...s.hFenceHp.filter((_, i) => s.hFences[i]), ...s.vFenceHp.filter((_, i) => s.vFences[i])];
      return { min: Math.min(...hps), avg: hps.reduce((a, b) => a + b, 0) / hps.length };
    };
    const wood = worst(1);
    const concrete = worst(4);
    expect(concrete.min).toBeGreaterThan(40); // every concrete segment comes through a long storm standing
    expect(concrete.avg).toBeGreaterThan(wood.avg + 20);
  });

  it('outbreaks make several dinos sick', () => {
    const s = park();
    for (const x of [3, 5, 7]) applyCommand(s, { type: 'buyDino', species: 'protoceratops', x, y: 4 });
    const c = ctxFor(s);
    outbreak(c);
    expect(s.dinos.filter((d) => d.sick).length).toBeGreaterThanOrEqual(2);
    expect(c.events[0].text).toMatch(/Outbreak/);
  });

  it('school trips bring a crowd at half price', () => {
    const s = park();
    s.ticketPrice = 20;
    const c = ctxFor(s);
    schoolTrip(c);
    expect(s.visitors.length).toBeGreaterThanOrEqual(12);
    expect(s.finance.today.income.admissions).toBe(s.visitors.length * 10);
  });

  it('a safe park passes inspection and earns an award', () => {
    const s = park(4);
    applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 4, y: 4 });
    const c = ctxFor(s);
    const rep = s.reputation;
    inspection(c);
    expect(s.finance.today.income.awards).toBe(INSPECTION_AWARD);
    expect(s.reputation).toBeGreaterThan(rep);
  });

  it('inspectors fine weak fences, breaks, escapes and untreated illness', () => {
    const s = park(1); // wooden: too weak for Triceratops
    applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 4, y: 4 });
    s.dinos[0].sick = true;
    setFenceHp(s, { dir: 'h', x: 12, y: 12 }, 0); // not a real fence: ignored
    const c = ctxFor(s);
    const issues = safetyIssues(c);
    expect(issues.some((i) => /too weak for Triceratops/.test(i))).toBe(true);
    expect(issues.some((i) => /sick/.test(i))).toBe(true);
    inspection(c);
    expect(s.finance.today.expenses.fines).toBe(FINE_PER_ISSUE * issues.length);
    expect(c.events[0].text).toMatch(/Failed safety inspection/);
  });

  it('over a few months, events actually happen', () => {
    const s = park();
    for (const x of [3, 5]) applyCommand(s, { type: 'buyDino', species: 'protoceratops', x, y: 4 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 6, y: 6 });
    const sim = new Simulation(s);
    const seen = new Set<string>();
    sim.onEvent((e) => {
      for (const k of ['storm is rolling', 'school trip', 'inspection']) if (e.text.includes(k)) seen.add(k);
    });
    for (let i = 0; i < 24 * 120 * STEPS_PER_HOUR; i++) {
      sim.step();
      s.feeders[0].stock = 100;
    }
    expect([...seen].sort()).toEqual(['inspection', 'school trip', 'storm is rolling']);
  });
});
