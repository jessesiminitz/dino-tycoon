import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
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
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: "classic" };
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





import { answerChoice, CHOICE_EVENTS, CHOICE_HOURS, choiceEvent, hourlyChoices } from '../src/sim/systems/choices';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import type { SimContext } from '../src/sim/systems/context';
import { spawnVisitor } from '../src/sim/systems/visitors';

function ctxFor(s: GameState, events: string[] = []): SimContext {
  return { state: s, rng: new Rng(1), regions: computeRegions(s), emit: (e) => events.push(e.text), invalidateWorld: () => {} };
}

/** Put a specific decision in front of the player. */
function present(s: GameState, id: string) {
  const ev = choiceEvent(id)!;
  const about = ev.setup(s, new Rng(4));
  expect(about, `${id} should be possible here`).not.toBeNull();
  s.pendingChoice = { ...about!, eventId: id, createdHour: s.hours, expiresHour: s.hours + CHOICE_HOURS };
  return s.pendingChoice;
}

describe('decisions', () => {
  it('every event has two answers and a story', () => {
    for (const ev of CHOICE_EVENTS) {
      expect(ev.options).toHaveLength(2);
      expect(ev.title.length).toBeGreaterThan(3);
    }
  });

  it('events only come up when they make sense', () => {
    const s = openPark();
    expect(choiceEvent('birthday')!.setup(s, new Rng(1))).toBeNull(); // no baby to name
    expect(choiceEvent('collector')!.setup(s, new Rng(1))).toBeNull(); // no fossil pieces
    s.dinos.push({ ...s.dinos[0], id: 5000, baby: true, name: 'Pip' });
    spawnVisitor(ctxFor(s), 60, 0);
    expect(choiceEvent('birthday')!.setup(s, new Rng(1))).not.toBeNull();
  });

  it('naming a baby after the birthday visitor', () => {
    const s = openPark();
    const baby = { ...s.dinos[0], id: 5000, baby: true, name: 'Pip' };
    s.dinos.push(baby);
    spawnVisitor(ctxFor(s), 60, 0);
    const c = present(s, 'birthday');
    const rep = s.reputation;
    expect(answerChoice(s, 0)).toMatch(/Happy birthday/);
    expect(baby.name).toBe(c.name);
    expect(s.reputation).toBeGreaterThan(rep);
    expect(s.pendingChoice).toBeNull();
  });

  it('closing early for a storm sends everyone home happy and stops ticket sales for the day', () => {
    const s = openPark();
    s.hours = 4; // 12:00
    const sim = new Simulation(s);
    for (let i = 0; i < STEPS_PER_HOUR; i++) sim.step();
    expect(s.visitors.length).toBeGreaterThan(0);
    present(s, 'storm');
    const r = sim.dispatch({ type: 'chooseOption', option: 0 });
    expect(r.ok).toBe(true);
    expect(s.stormHours).toBeGreaterThan(0);
    expect(s.log.at(-1)!.text).toMatch(/closed early/);
    const sold = s.finance.today.visitors;
    for (let i = 0; i < STEPS_PER_HOUR * 3; i++) sim.step();
    expect(s.finance.today.visitors).toBe(sold);
  });

  it('selling fossils to the collector resets them', () => {
    const s = openPark();
    s.fossils = { allosaurus: 3 };
    const c = present(s, 'collector');
    const money = s.money;
    answerChoice(s, 0);
    expect(s.fossils.allosaurus).toBe(0);
    expect(s.money).toBe(money + (c.amount ?? 0));
  });

  it('left unanswered, the cautious choice is taken, and a new one may come later', () => {
    const s = openPark();
    s.fossils = { allosaurus: 3 };
    present(s, 'collector');
    const events: string[] = [];
    const ctx = ctxFor(s, events);
    s.hours += CHOICE_HOURS;
    hourlyChoices(ctx);
    expect(s.pendingChoice).toBeNull();
    expect(s.fossils.allosaurus).toBe(3); // kept, not sold
    expect(events.some((t) => t.startsWith('⌛ No answer in time'))).toBe(true);
  });

  it('about one decision a day comes up while the park is open', () => {
    const s = openPark();
    const events: string[] = [];
    const sim = new Simulation(s);
    sim.onEvent((e) => events.push(e.text));
    for (let i = 0; i < STEPS_PER_HOUR * 24 * 10; i++) sim.step();
    const asked = events.filter((t) => /a decision is waiting/.test(t)).length;
    expect(asked).toBeGreaterThan(2);
    expect(asked).toBeLessThan(20);
  });

  it('migrates v16 saves', async () => {
    const { migrate } = await import('../src/sim/GameState');
    const s = openPark();
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 16;
    delete raw.pendingChoice;
    delete raw.stats.closedDay;
    const m = migrate(raw)!;
    expect(m.version).toBe(19);
    expect(m.pendingChoice).toBeNull();
    expect(m.stats.closedDay).toBe(0);
  });
});
