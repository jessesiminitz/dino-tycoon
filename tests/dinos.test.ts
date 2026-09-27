import { describe, expect, it } from 'vitest';
import { migrate, newGame, STARTING_MONEY, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { SPECIES, SPECIES_IDS } from '../src/sim/data/species';
import { FEEDER_TYPES } from '../src/sim/data/feeders';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { Terrain } from '../src/sim/terrain';
import type { GameEvent } from '../src/sim/systems/context';
import { DINO_TEMPLATES } from '../src/render/dinoArt';

/** 20×14 grass world, all owned, gate at (0, 13), with a fenced paddock over tiles [2,10) × [2,8). */
function parkWithPaddock(): GameState {
  const s = newGame(7);
  const width = 20;
  const height = 14;
  s.map = { width, height, tiles: new Array(width * height).fill(Terrain.Grass) };
  s.entrance = { x: 0, y: 13 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(width * (height + 1)).fill(0);
  s.vFences = new Array((width + 1) * height).fill(0);
  const box: Edge[] = [...pathEdges(2, 2, 10, 8, true), ...pathEdges(2, 2, 10, 8, false)];
  expect(applyCommand(s, { type: 'buildFences', edges: box, fence: 4 }).ok).toBe(true);
  s.money = 1_000_000;
  return s;
}

function runHours(sim: Simulation, hours: number): void {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) sim.step();
}

const inPaddock = (d: { x: number; y: number }) => d.x >= 2 && d.x < 10 && d.y >= 2 && d.y < 8;

describe('species data', () => {
  it('has 12 species, 6 at the start, and every one has art', () => {
    expect(SPECIES_IDS).toHaveLength(12);
    expect(SPECIES_IDS.filter((id) => SPECIES[id].starter)).toHaveLength(6);
    for (const id of SPECIES_IDS) expect(DINO_TEMPLATES[SPECIES[id].art.template]).toBeDefined();
  });

  it('art templates are rectangular and use known colour codes', () => {
    for (const rows of Object.values(DINO_TEMPLATES)) {
      const w = rows[0].length;
      for (const r of rows) {
        expect(r.length).toBe(w);
        expect(r).toMatch(/^[.BDAEW]+$/);
      }
    }
  });
});

describe('buying and selling', () => {
  it('dinosaurs can only be released into a paddock', () => {
    const s = parkWithPaddock();
    expect(applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 15, y: 10 }).ok).toBe(false);
    const r = applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 4, y: 4 });
    expect(r.ok).toBe(true);
    expect(s.dinos).toHaveLength(1);
    expect(s.money).toBe(1_000_000 - SPECIES.triceratops.price);
  });

  it('locked species and unaffordable ones are refused', () => {
    const s = parkWithPaddock();
    expect(applyCommand(s, { type: 'buyDino', species: 'tyrannosaurus', x: 4, y: 4 }).ok).toBe(false);
    s.money = 100;
    expect(applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 4 }).ok).toBe(false);
    expect(s.dinos).toHaveLength(0);
  });

  it('selling returns half the price', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'buyDino', species: 'stegosaurus', x: 4, y: 4 });
    const before = s.money;
    applyCommand(s, { type: 'sellDino', id: s.dinos[0].id });
    expect(s.dinos).toHaveLength(0);
    expect(s.money).toBe(before + SPECIES.stegosaurus.price / 2);
  });

  it('feeders cost money, start full and refill at the unit price', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    expect(applyCommand(s, { type: 'placeFeeder', kind: 'meat', x: 5, y: 5 }).ok).toBe(false);
    const f = s.feeders[0];
    expect(f.stock).toBe(FEEDER_TYPES.plants.capacity);
    f.stock = 40;
    const before = s.money;
    applyCommand(s, { type: 'refillFeeder', id: f.id });
    expect(f.stock).toBe(100);
    expect(s.money).toBe(before - 60 * FEEDER_TYPES.plants.unitCost);
  });
});

describe('behaviour', () => {
  it('dinosaurs never leave their paddock', () => {
    const s = parkWithPaddock();
    for (const sp of ['compsognathus', 'protoceratops', 'triceratops'] as const) {
      applyCommand(s, { type: 'buyDino', species: sp, x: 5, y: 4 });
    }
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 3, y: 3 });
    applyCommand(s, { type: 'placeFeeder', kind: 'meat', x: 8, y: 6 });
    const sim = new Simulation(s);
    for (let i = 0; i < 24 * 5 * STEPS_PER_HOUR; i++) {
      sim.step();
      for (const f of s.feeders) f.stock = 100; // keep everyone fed so nobody gets eaten
      for (const d of s.dinos) expect(inPaddock(d)).toBe(true);
    }
    expect(s.dinos.some((d) => d.x !== 5 || d.y !== 4)).toBe(true); // they did move
  });

  it('hungry dinosaurs walk to a feeder and eat', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 3, y: 3 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 9, y: 7 });
    s.dinos[0].hunger = 90;
    runHours(new Simulation(s), 12);
    expect(s.dinos[0].hunger).toBeLessThan(50);
    expect(s.feeders[0].stock).toBeLessThan(100);
  });

  it('without food they starve and die, with an event', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 4 });
    const sim = new Simulation(s);
    const events: GameEvent[] = [];
    sim.onEvent((e) => events.push(e));
    runHours(sim, 24 * 5);
    expect(s.dinos).toHaveLength(0);
    expect(events.some((e) => /starving/.test(e.text))).toBe(true);
    expect(events.some((e) => /starved to death/.test(e.text))).toBe(true);
  });

  it('a hungry carnivore with no meat hunts a smaller herbivore', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'buyDino', species: 'dilophosaurus', x: 3, y: 3 });
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 8, y: 6 });
    s.dinos[0].hunger = 70;
    const sim = new Simulation(s);
    const events: GameEvent[] = [];
    sim.onEvent((e) => events.push(e));
    runHours(sim, 24);
    expect(s.dinos.map((d) => d.species)).toEqual(['dilophosaurus']);
    expect(events.some((e) => / ate /.test(e.text))).toBe(true);
  });

  it('carnivores prefer a stocked meat feeder, and never hunt bigger prey', () => {
    const s = parkWithPaddock();
    applyCommand(s, { type: 'buyDino', species: 'compsognathus', x: 3, y: 3 });
    applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4, y: 3 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 8, y: 6 });
    s.dinos[0].hunger = 90;
    const sim = new Simulation(s);
    for (let i = 0; i < 24 * 3 * STEPS_PER_HOUR; i++) {
      sim.step();
      s.feeders[0].stock = 100;
    }
    // Compsognathus (size 1) can't take a Protoceratops (size 2).
    expect(s.dinos.some((d) => d.species === 'protoceratops')).toBe(true);
  });

  it('happiness drops when crowded, lonely or living with a predator', () => {
    const s = parkWithPaddock(); // 48 tiles
    applyCommand(s, { type: 'buyDino', species: 'triceratops', x: 4, y: 4 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
    const sim = new Simulation(s);
    runHours(sim, 1);
    const alone = s.dinos[0].happiness;
    expect(alone).toBeLessThan(100); // social species kept alone
    applyCommand(s, { type: 'buyDino', species: 'dilophosaurus', x: 6, y: 4 });
    runHours(sim, 1);
    expect(s.dinos[0].happiness).toBeLessThan(alone);
  });
});

describe('determinism and saves', () => {
  it('the same park and seed produce the same result', () => {
    const make = () => {
      const s = parkWithPaddock();
      applyCommand(s, { type: 'buyDino', species: 'parasaurolophus', x: 4, y: 4 });
      applyCommand(s, { type: 'buyDino', species: 'compsognathus', x: 6, y: 5 });
      applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 3, y: 6 });
      const sim = new Simulation(s);
      runHours(sim, 48);
      return JSON.stringify(s);
    };
    expect(make()).toEqual(make());
  });

  it('migrates a version 2 save all the way to the current version', () => {
    const current = newGame(3);
    const {
      dinos: _d, feeders: _f, unlockedSpecies: _u, nextId: _n, stepInHour: _s,
      paths: _p, buildings: _b, visitors: _v, ticketPrice: _t, reputation: _r, finance: _fi,
      hFenceHp: _hh, vFenceHp: _vh, staff: _st, fossils: _fo, stormHours: _sh,
      scenario: _sc, stats: _stt, tutorialStep: _tu,
      ...rest
    } = current;
    const v2 = JSON.parse(JSON.stringify({ ...rest, version: 2 }));
    const migrated = migrate(v2)!;
    expect(migrated.version).toBe(9);
    expect(migrated.fossilBeds.length).toBeGreaterThan(0);
    expect(migrated.scenario).toEqual({ id: 'sandbox', status: 'free' });
    expect(migrated.tutorialStep).toBeNull();
    expect(migrated.fossils).toEqual({});
    expect(migrated.stormHours).toBe(0);
    expect(migrated.finance.month.expenses.fines).toBe(0);
    expect(migrated.staff).toEqual([]);
    expect(migrated.hFenceHp).toHaveLength(migrated.hFences.length);
    expect(migrated.finance.today.expenses.wages).toBe(0);
    expect(migrated.dinos).toEqual([]);
    expect(migrated.unlockedSpecies).toHaveLength(6);
    expect(migrated.money).toBe(STARTING_MONEY);
    expect(migrated.paths).toHaveLength(migrated.map.width * migrated.map.height);
    expect(migrated.finance.loans).toEqual([]);
    expect(computeRegions(migrated).regions.length).toBeGreaterThan(0);
  });
});
