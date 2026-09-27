import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { Terrain } from '../src/sim/terrain';

const W = 20;
const H = 14;
const idx = (x: number, y: number) => y * W + x;

/**
 * 20×14 grass park, gate at (0, 13). Paddock over [2,10) × [2,8) with a
 * Protoceratops pair, Triceratops and feeders. Path from the gate up x = 0
 * and along y = 9 to x = 12. Restaurant at (5, 10), gift shop at (7, 10).
 */
function openPark(): GameState {
  const s = newGame(11);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass) };
  s.entrance = { x: 0, y: 13 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 1_000_000;
  const box: Edge[] = [...pathEdges(2, 2, 10, 8, true), ...pathEdges(2, 2, 10, 8, false)];
  applyCommand(s, { type: 'buildFences', edges: box, fence: 4 });
  for (const [sp, x, y] of [['protoceratops', 3, 3], ['protoceratops', 4, 5], ['triceratops', 7, 4]] as const) {
    applyCommand(s, { type: 'buyDino', species: sp, x, y });
  }
  applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 5, y: 5 });
  const tiles = [];
  for (let y = 9; y <= 13; y++) tiles.push(idx(0, y));
  for (let x = 1; x <= 12; x++) tiles.push(idx(x, 9));
  expect(applyCommand(s, { type: 'buildPaths', tiles }).ok).toBe(true);
  expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 5, y: 10 }).ok).toBe(true);
  expect(applyCommand(s, { type: 'placeBuilding', kind: 'giftshop', x: 7, y: 10 }).ok).toBe(true);
  return s;
}


function run(sim: Simulation, hours: number, each?: () => void) {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) {
    sim.step();
    for (const f of sim.state.feeders) f.stock = 100;
    each?.();
  }
}



import { PAT_JOY, TREAT_COST, TREAT_HOURS, TREAT_JOY, careJoy } from '../src/sim/systems/care';

describe('treats, pats and photos', () => {
  it('a treat costs $25, cheers the animal up for hours, and can only be given once an hour', () => {
    const s = openPark();
    const d = s.dinos[0];
    d.happiness = 60;
    const money = s.money;
    const r = applyCommand(s, { type: 'treatDino', id: d.id });
    expect(r).toMatchObject({ ok: true, effect: 'hearts' });
    expect(s.money).toBe(money - TREAT_COST);
    expect(s.finance.today.expenses.treats).toBe(TREAT_COST);
    expect(d.happiness).toBe(60 + TREAT_JOY);
    expect(applyCommand(s, { type: 'treatDino', id: d.id }).ok).toBe(false); // too soon
    s.hours++;
    expect(applyCommand(s, { type: 'treatDino', id: d.id }).ok).toBe(true);
    expect(careJoy(s, d)).toBe(TREAT_JOY);
    s.hours += TREAT_HOURS;
    expect(careJoy(s, d)).toBe(0);
  });

  it('the cheer survives the hourly mood update', () => {
    const s = openPark();
    const sim = new Simulation(s);
    run(sim, 1);
    const d = s.dinos[0];
    const plain = d.happiness;
    applyCommand(s, { type: 'treatDino', id: d.id });
    applyCommand(s, { type: 'patDino', id: d.id });
    run(sim, 1);
    expect(d.happiness).toBe(Math.min(100, plain + TREAT_JOY + PAT_JOY));
  });

  it('pats are free and cute; hungry meat-eaters snap instead', () => {
    const s = openPark();
    const [proto] = s.dinos;
    expect(applyCommand(s, { type: 'patDino', id: proto.id })).toMatchObject({ ok: true, effect: 'hearts' });
    const raptor = { ...proto, id: 8000, species: 'dilophosaurus' as const, hunger: 70 };
    s.dinos.push(raptor);
    const before = raptor.happiness;
    const r = applyCommand(s, { type: 'patDino', id: raptor.id });
    expect(r).toMatchObject({ ok: true, effect: 'snap' });
    expect(r.message).toMatch(/^Nope!/);
    expect(raptor.happiness).toBe(before);
    raptor.hunger = 10;
    expect(applyCommand(s, { type: 'patDino', id: raptor.id })).toMatchObject({ effect: 'hearts' });
  });

  it('no treats or pats for an animal on the loose, or without the money', () => {
    const s = openPark();
    const d = s.dinos[0];
    d.escaped = true;
    expect(applyCommand(s, { type: 'patDino', id: d.id }).ok).toBe(false);
    d.escaped = false;
    s.money = 10;
    expect(applyCommand(s, { type: 'treatDino', id: d.id }).ok).toBe(false);
  });

  it('counts photos, and migrates v13 saves', () => {
    const s = openPark();
    applyCommand(s, { type: 'photoDino', id: s.dinos[0].id });
    expect(s.stats.photos).toBe(1);
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 13;
    delete raw.stats.photos;
    for (const d of raw.dinos) {
      delete d.lastTreatHour;
      delete d.lastPatHour;
    }
    const m = migrate(raw)!;
    expect(m.version).toBe(14);
    expect(m.stats.photos).toBe(0);
    expect(m.dinos.every((d) => careJoy(m, d) === 0)).toBe(true);
  });
});
