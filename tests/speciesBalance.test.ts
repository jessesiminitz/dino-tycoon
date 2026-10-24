import { describe, expect, it } from 'vitest';
import { calendar, newGame } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { boxEdges } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { fairPrice, parkAppeal } from '../src/sim/systems/visitors';
import { Terrain } from '../src/sim/terrain';
import { habitatOf, SPECIES, SPECIES_IDS, type SpeciesId } from '../src/sim/data/species';
import { emptyLedger } from '../src/sim/finance';
import { newPort } from '../src/sim/port';

// 2026-10-24 audit: the headline dinosaurs took 5 to 7 months to pay for themselves.
// Every land species, added as one paddock to the same small park with a full harbor,
// should earn its cost back within about two months at the fair ticket price.

const W = 64;
const H = 40;
const DAYS = 14;
const MAX_PAYBACK_DAYS = 75;

function park(extra: SpeciesId | null) {
  const s = newGame(5);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: 'classic' };
  s.entrance = { x: 32, y: 39 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.tracks = new Array(W * H).fill(0);
  s.money = 10_000_000;
  s.reputation = 60;
  s.unlockedSpecies = [...SPECIES_IDS];
  s.port = newPort(2, ['large', 'large', 'large']);
  const tiles: number[] = [];
  for (let y = 21; y < 40; y++) tiles.push(y * W + 32);
  for (let x = 1; x < 63; x++) tiles.push(20 * W + x);
  applyCommand(s, { type: 'buildPaths', tiles });
  applyCommand(s, { type: 'buildFences', edges: boxEdges(2, 11, 11, 19), fence: 2 });
  applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 3, y: 12 });
  for (let d = 0; d < 4; d++) applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 4 + d * 2, y: 15 });
  let cost = 0;
  if (extra) {
    const sp = SPECIES[extra];
    const before = s.money;
    applyCommand(s, { type: 'buildFences', edges: boxEdges(40, 21, 51, 30), fence: sp.fenceNeeded });
    applyCommand(s, { type: 'placeFeeder', kind: sp.diet === 'herbivore' ? 'plants' : sp.diet === 'carnivore' ? 'meat' : 'fish', x: 41, y: 22 });
    const n = Math.max(2, Math.min(4, Math.floor(120 / sp.space)));
    for (let d = 0; d < n; d++) expect(applyCommand(s, { type: 'buyDino', species: extra, x: 43 + d * 2, y: 26 }).ok).toBe(true);
    cost = before - s.money;
  }
  for (const [kind, x, y] of [['restaurant', 31, 32], ['snackstall', 33, 32], ['restroom', 31, 34], ['giftshop', 33, 34], ['trashcan', 31, 36]] as const) {
    applyCommand(s, { type: 'placeBuilding', kind, x, y });
  }
  for (const role of ['worker', 'janitor', 'vet', 'guard'] as const) applyCommand(s, { type: 'hireStaff', role });
  s.hours += 7 * 24;
  s.money = 50_000;
  s.finance.today = emptyLedger();
  s.finance.month = emptyLedger();
  return { s, cost };
}

/** Average profit per day after a three-day settling-in, and what the paddock cost. */
function run(extra: SpeciesId | null): { net: number; cost: number } {
  const { s, cost } = park(extra);
  const sim = new Simulation(s);
  let start = 0;
  for (let h = 0; h < 24 * DAYS; h++) {
    if (calendar(s).hour === 7) {
      const price = Math.max(5, Math.round(fairPrice(parkAppeal(s, computeRegions(s))) / 5) * 5);
      applyCommand(s, { type: 'setTicketPrice', price });
    }
    if (h === 24 * 3) start = s.money;
    for (let i = 0; i < STEPS_PER_HOUR; i++) sim.step();
  }
  return { net: (s.money - start) / (DAYS - 3), cost };
}

describe('species balance', () => {
  it(`every land species pays for its paddock within ${MAX_PAYBACK_DAYS} days`, () => {
    const base = run(null).net;
    const slow: string[] = [];
    for (const id of SPECIES_IDS.filter((id) => habitatOf(id) === 'land')) {
      const { net, cost } = run(id);
      const payback = net > base ? cost / (net - base) : Infinity;
      if (payback > MAX_PAYBACK_DAYS) slow.push(`${id}: ${Math.round(payback)} days`);
    }
    expect(slow).toEqual([]);
  }, 120_000);
});
