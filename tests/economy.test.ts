import { describe, expect, it } from 'vitest';
import { calendar, newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { BUILDING_TYPES, DAYS_PER_MONTH, MAX_DEBT, PATH_COST } from '../src/sim/data/economy';
import { operatingProfit, totalExpenses, totalIncome } from '../src/sim/finance';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { onWalkway } from '../src/sim/paths';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { expectedArrivals, fairPrice, parkAppeal } from '../src/sim/systems/visitors';
import { Terrain } from '../src/sim/terrain';
import type { GameEvent } from '../src/sim/systems/context';

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

function runHours(sim: Simulation, hours: number, each?: () => void): void {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) {
    sim.step();
    for (const f of sim.state.feeders) f.stock = 100; // keep dinos fed and alive
    each?.();
  }
}

describe('paths and buildings', () => {
  it('paths cost per tile, and not inside paddocks or on land you do not own', () => {
    const s = openPark();
    const before = s.money;
    const r = applyCommand(s, { type: 'buildPaths', tiles: [idx(4, 4), idx(14, 11), idx(15, 11)] });
    expect(r.ok).toBe(true);
    expect(s.paths[idx(4, 4)]).toBe(0);
    expect(s.money).toBe(before - 2 * PATH_COST);
    s.parcelsOwned = s.parcelsOwned.map(() => false);
    expect(applyCommand(s, { type: 'buildPaths', tiles: [idx(16, 12)] }).ok).toBe(false);
  });

  it('buildings must be beside a path and outside paddocks', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 16, y: 3 }).message).toMatch(/next to a path/);
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 6, y: 7 }).message).toMatch(/paddock/);
    expect(applyCommand(s, { type: 'placeBuilding', kind: 'restaurant', x: 3, y: 9 }).message).toMatch(/not on it/);
  });

  it('removing paths refunds a quarter', () => {
    const s = openPark();
    const before = s.money;
    applyCommand(s, { type: 'removePaths', tiles: [idx(12, 9), idx(11, 9)] });
    expect(s.paths[idx(12, 9)]).toBe(0);
    expect(s.money).toBe(before + Math.floor(2 * PATH_COST * 0.25));
  });
});

describe('visitors', () => {
  it('arrive during opening hours and pay admission', () => {
    const s = openPark();
    const sim = new Simulation(s);
    runHours(sim, 6); // 08:00 → 14:00
    expect(s.finance.today.visitors).toBeGreaterThan(5);
    expect(s.finance.today.income.admissions).toBe(s.finance.today.visitors * s.ticketPrice);
  });

  it('only ever stand on paths or the gate', () => {
    const s = openPark();
    const sim = new Simulation(s);
    runHours(sim, 24, () => {
      for (const v of s.visitors) expect(onWalkway(s, idx(v.x, v.y))).toBe(true);
    });
  });

  it('watch dinos, eat at the restaurant and shop', () => {
    const s = openPark();
    const sim = new Simulation(s);
    let maxSeen = 0;
    runHours(sim, 12, () => {
      for (const v of s.visitors) maxSeen = Math.max(maxSeen, v.seen.length);
    });
    expect(maxSeen).toBeGreaterThan(0);
    expect(s.finance.month.income.food).toBeGreaterThan(0);
    expect(s.finance.month.income.souvenirs).toBeGreaterThan(0);
  });

  it('everyone leaves after closing, and a good park gains reputation', () => {
    const s = openPark();
    const sim = new Simulation(s);
    runHours(sim, 17); // 08:00 → 01:00: the last stragglers walk home after the 20:00 close
    expect(s.visitors).toHaveLength(0);
    expect(s.reputation).toBeGreaterThan(50);
  });

  it('a park with nothing to see and pricey tickets loses reputation', () => {
    const s = openPark();
    s.dinos = [];
    applyCommand(s, { type: 'setTicketPrice', price: 12 }); // fair price with nothing to see is $8
    const sim = new Simulation(s);
    runHours(sim, 16);
    expect(s.reputation).toBeLessThan(50);
  });

  it('arrivals grow with appeal and vanish at twice the fair price', () => {
    const s = openPark();
    const regions = computeRegions(s);
    const appeal = parkAppeal(s, regions);
    const withDinos = expectedArrivals(s, regions);
    s.ticketPrice = fairPrice(appeal) * 2;
    expect(expectedArrivals(s, regions)).toBe(0);
    s.ticketPrice = 20;
    s.dinos = [];
    expect(expectedArrivals(s, computeRegions(s))).toBeLessThan(withDinos);
  });
});

describe('books', () => {
  it('money always equals starting cash plus income minus expenses', () => {
    const s = openPark();
    // Start fresh books from here.
    const start = s.money;
    s.finance.month = { ...s.finance.month, income: { ...s.finance.month.income }, expenses: { ...s.finance.month.expenses } };
    const sim = new Simulation(s);
    const monthsIncome: number[] = [];
    let income = -totalIncome(s.finance.month);
    let expenses = -totalExpenses(s.finance.month);
    sim.onEvent((e) => {
      if (e.text.startsWith('Month')) monthsIncome.push(1);
    });
    applyCommand(s, { type: 'takeLoan', amount: 25_000 });
    for (let h = 0; h < 24 * 35; h++) {
      const beforeHistory = s.finance.history.length;
      runHours(sim, 1);
      if (s.finance.history.length > beforeHistory) {
        const closed = s.finance.history[s.finance.history.length - 1].ledger;
        income += totalIncome(closed);
        expenses += totalExpenses(closed);
      }
    }
    income += totalIncome(s.finance.month);
    expenses += totalExpenses(s.finance.month);
    expect(s.money).toBeCloseTo(start + income - expenses, 6);
    expect(monthsIncome.length).toBe(1);
  });

  it('midnight charges upkeep and resets the day', () => {
    const s = openPark();
    const sim = new Simulation(s);
    const events: GameEvent[] = [];
    sim.onEvent((e) => events.push(e));
    runHours(sim, 16);
    expect(calendar(s).hour).toBe(0);
    expect(s.finance.today.visitors).toBe(0);
    const upkeep = BUILDING_TYPES.restaurant.upkeep + BUILDING_TYPES.giftshop.upkeep;
    expect(s.finance.month.expenses.upkeep).toBe(upkeep);
    expect(events.some((e) => /^Day 1: \d+ visitors/.test(e.text))).toBe(true);
  });

  it('month end archives a report and charges loan payments', () => {
    const s = openPark();
    applyCommand(s, { type: 'takeLoan', amount: 10_000 });
    const sim = new Simulation(s);
    runHours(sim, 24 * DAYS_PER_MONTH - 8); // until 00:00 on day 31
    expect(s.finance.history).toHaveLength(1);
    const report = s.finance.history[0].ledger;
    expect(report.expenses.interest).toBe(150);
    expect(report.expenses.repayments).toBe(Math.ceil(10_000 / 12));
    expect(s.finance.loans[0].balance).toBe(10_000 - Math.ceil(10_000 / 12));
    expect(operatingProfit(report)).toBe(totalIncome(report) - 10_000 - (totalExpenses(report) - report.expenses.repayments));
    expect(s.finance.month.visitors).toBe(0);
  });
});

describe('loans', () => {
  it('the bank caps total debt, and loans can be paid off early', () => {
    const s = openPark();
    expect(applyCommand(s, { type: 'takeLoan', amount: 50_000 }).ok).toBe(true);
    expect(applyCommand(s, { type: 'takeLoan', amount: 50_000 }).ok).toBe(true);
    expect(applyCommand(s, { type: 'takeLoan', amount: 10_000 }).message).toMatch(new RegExp(MAX_DEBT.toLocaleString('en-US')));
    expect(applyCommand(s, { type: 'takeLoan', amount: 12_345 }).ok).toBe(false);
    const before = s.money;
    applyCommand(s, { type: 'repayLoan', id: s.finance.loans[0].id });
    expect(s.finance.loans).toHaveLength(1);
    expect(s.money).toBe(before - 50_000);
  });
});
