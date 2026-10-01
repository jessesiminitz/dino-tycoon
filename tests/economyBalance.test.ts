import { describe, expect, it } from 'vitest';
import { calendar, newGame, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { boxEdges } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { fairPrice, parkAppeal } from '../src/sim/systems/visitors';
import { Terrain } from '../src/sim/terrain';
import type { SpeciesId } from '../src/sim/data/species';
import { emptyLedger } from '../src/sim/finance';

const W = 64, H = 40;
/** A tidy standard park: a path along y=20, `paddocks` 10×8 paddocks either side, 4 herbivores each, shops and staff. */
function standardPark(paddocks: number, mix: SpeciesId[]): { s: GameState; capital: number } {
  const s = newGame(5);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: 'classic' };
  s.entrance = { x: 32, y: 39 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0); s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0); s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0); s.tracks = new Array(W * H).fill(0);
  s.money = 10_000_000; s.reputation = 60;
  const start = s.money;
  const tiles: number[] = [];
  for (let y = 21; y < 40; y++) tiles.push(y * W + 32);
  for (let x = 1; x < 63; x++) tiles.push(20 * W + x);
  applyCommand(s, { type: 'buildPaths', tiles });
  let k = 0;
  for (let p = 0; p < paddocks; p++) {
    const col = Math.floor(p / 2); const above = p % 2 === 0;
    const x0 = 2 + col * 12 + (col >= 3 ? 1 : 0); const y0 = above ? 11 : 21;
    const fx = x0 + 10 > 32 && x0 <= 32 ? x0 + 1 : x0; // keep clear of the gate path
    applyCommand(s, { type: 'buildFences', edges: boxEdges(fx, y0, fx + 9, y0 + 8), fence: 2 });
    applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: fx + 1, y: y0 + 1 });
    for (let d = 0; d < 4; d++) applyCommand(s, { type: 'buyDino', species: mix[k++ % mix.length], x: fx + 2 + d * 2, y: y0 + 4 });
  }
  for (const [kind, x, y] of [['restaurant', 31, 32], ['snackstall', 33, 32], ['restroom', 31, 34], ['giftshop', 33, 34], ['trashcan', 31, 36], ['snackstall', 33, 30], ['restroom', 31, 30]] as const)
    if (!applyCommand(s, { type: 'placeBuilding', kind, x, y }).ok) throw new Error(`no room for ${kind}`);
  for (const role of ['worker', 'janitor', 'vet', ...Array(Math.floor(paddocks / 3)).fill('worker')] as const) applyCommand(s, { type: 'hireStaff', role });
  const capital = start - s.money;
  s.money = 50_000;
  s.finance.today = emptyLedger(); s.finance.month = emptyLedger();
  return { s, capital };
}


/** Net profit per day (from the bank balance, so wages and upkeep count) of a standard park, played at fair prices. */
function netPerDay(paddocks: number): { net: number; dinos: number } {
  const mix: SpeciesId[] = ['protoceratops', 'parasaurolophus', 'triceratops', 'stegosaurus'];
  const { s } = standardPark(paddocks, mix);
  const sim = new Simulation(s);
  let m0 = 0;
  for (let h = 0; h < 24 * 10; h++) {
    if (calendar(s).hour === 7) applyCommand(s, { type: 'setTicketPrice', price: Math.max(5, Math.round(fairPrice(parkAppeal(s, computeRegions(s))) / 5) * 5) });
    if (h === 24 * 4) m0 = s.money;
    for (let i = 0; i < STEPS_PER_HOUR; i++) sim.step();
  }
  return { net: (s.money - m0) / 6, dinos: s.dinos.length };
}

/**
 * The money curve (rebalanced 2026-10-01, "moderate"): a small park clears about $2k a day and a big
 * one about $10k at best, so money doesn't snowball, but every extra paddock still pays its way.
 */
describe('economy balance', () => {
  it('profit grows with the park, but gently', () => {
    const [small, medium, large] = [1, 4, 10].map(netPerDay);
    console.log(`net/day: ${small.dinos} dinos $${Math.round(small.net)}, ${medium.dinos} dinos $${Math.round(medium.net)}, ${large.dinos} dinos $${Math.round(large.net)}`);
    expect(small.net).toBeGreaterThan(1000);
    expect(small.net).toBeLessThan(3000);
    expect(medium.net).toBeGreaterThan(small.net);
    expect(medium.net).toBeLessThan(7000);
    expect(large.net).toBeGreaterThan(medium.net);
    expect(large.net).toBeLessThan(15000);
  }, 120000);
});
