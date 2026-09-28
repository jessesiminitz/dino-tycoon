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





import { isAsleep, isNight, STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { Simulation } from '../src/sim/Simulation';
import { lightAt } from '../src/render/daylight';

/** Set the clock to a given hour on day 1 (the game starts at 08:00). */
const at = (s: GameState, hour: number) => (s.hours = (hour - 8 + 24) % 24);

describe('day and night', () => {
  it('night runs from 21:00 to 05:00', () => {
    const s = openPark();
    for (const [h, night] of [[12, false], [20, false], [21, true], [2, true], [4, true], [5, false]] as const) {
      at(s, h);
      expect(isNight(s), `${h}:00`).toBe(night);
    }
  });

  it('most animals sleep at night and stay put; night-owls and hungry animals are up', () => {
    const s = openPark();
    at(s, 23);
    const [proto] = s.dinos;
    proto.hunger = 10;
    expect(isAsleep(s, proto)).toBe(true);
    const raptor = { ...proto, id: 9001, species: 'velociraptor' as const };
    expect(isAsleep(s, raptor)).toBe(false);
    expect(isAsleep(s, { ...proto, hunger: 70 })).toBe(false);
    at(s, 12);
    expect(isAsleep(s, proto)).toBe(false);
    // Over a night, a sleeping animal doesn't wander.
    at(s, 22);
    for (const d of s.dinos) d.hunger = 0;
    const sim = new Simulation(s);
    const before = s.dinos.map((d) => `${d.x},${d.y}`);
    for (let i = 0; i < STEPS_PER_HOUR * 3; i++) {
      sim.step();
      for (const d of s.dinos) d.hunger = 0;
    }
    expect(s.dinos.map((d) => `${d.x},${d.y}`)).toEqual(before);
  });

  it('the light fades at dusk, is darkest at night, and returns at dawn', () => {
    expect(lightAt(12).dark).toBe(0);
    expect(lightAt(18.5).dark).toBeGreaterThan(0);
    expect(lightAt(18.5).dark).toBeLessThan(1);
    expect(lightAt(23).dark).toBe(1);
    expect(lightAt(3).dark).toBe(1);
    expect(lightAt(6).dark).toBeGreaterThan(0);
    expect(lightAt(8).dark).toBe(0);
    expect(lightAt(18.5).warm).toBeGreaterThan(0.9);
    expect(lightAt(12).warm).toBe(0);
  });
});
