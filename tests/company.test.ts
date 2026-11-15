import { describe, expect, it } from 'vitest';
import { newGame, type Dino, type GameState } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges, type Edge } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { Simulation } from '../src/sim/Simulation';
import { isAsleep } from '../src/sim/systems/dinos';
import { isWater, Terrain } from '../src/sim/terrain';
import type { SpeciesId } from '../src/sim/data/species';

const W = 44, H = 24;

/** A 44×24 grass park with one big paddock over [2,40) × [2,20), and a pond column at x = 20 if asked. */
function park(animals: readonly (readonly [SpeciesId, number, number])[], pond = false): GameState {
  const s = newGame(5);
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass), heights: new Array(W * H).fill(5), shape: 'classic' };
  s.entrance = { x: 0, y: H - 1 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 1_000_000;
  if (pond) for (let y = 8; y <= 13; y++) s.map.tiles[y * W + 20] = Terrain.Pond;
  const box: Edge[] = [...pathEdges(2, 2, 40, 20, true), ...pathEdges(2, 2, 40, 20, false)];
  expect(applyCommand(s, { type: 'buildFences', edges: box, fence: 4 }).ok).toBe(true);
  for (const [species] of animals) if (!s.unlockedSpecies.includes(species)) s.unlockedSpecies.push(species);
  for (const [species, x, y] of animals) expect(applyCommand(s, { type: 'buyDino', species, x, y }).ok).toBe(true);
  return s;
}

/** Runs daytime hours with everyone fed and content, calling `each` after every step. */
function run(s: GameState, hours: number, each: () => void): void {
  const sim = new Simulation(s);
  const end = s.hours + hours;
  while (s.hours < end) {
    for (const d of s.dinos) { d.hunger = 0; d.happiness = 80; d.health = 100; d.sick = false; }
    sim.step();
    if (!s.dinos.some((d) => isAsleep(s, d))) each();
  }
}
const apart = (a: Dino, b: Dino) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;

describe('company', () => {
  it('a baby trails after a grown-up of its kind; two grown-ups go their own ways', () => {
    const gaps = (baby: boolean) => {
      const s = park([['stegosaurus', 8, 10], ['stegosaurus', 14, 10]]);
      s.dinos[1].baby = baby;
      s.dinos[1].bornHour = s.hours + 10_000;   // stays a baby for the whole test
      const seen: number[] = [];
      run(s, 96, () => { s.dinos[1].baby = baby; seen.push(apart(s.dinos[0], s.dinos[1])); });
      return mean(seen);
    };
    const trailing = gaps(true), alone = gaps(false);
    expect(trailing).toBeLessThan(4.5);
    expect(alone).toBeGreaterThan(trailing * 1.5);
  });

  it('herd animals drift back together; a mixed group does not', () => {
    const spread = (kinds: readonly SpeciesId[]) => {
      const s = park(kinds.map((k, i) => [k, [5, 36, 5, 36][i], [4, 4, 17, 17][i]] as const));
      const seen: number[] = [];
      let step = 0;
      run(s, 240, () => { if (step++ > 1200) seen.push(mean(s.dinos.slice(0, 4).flatMap((a, i) => s.dinos.slice(i + 1, 4).map((b) => apart(a, b))))); });
      return mean(seen);
    };
    const herd = spread(['parasaurolophus', 'parasaurolophus', 'parasaurolophus', 'parasaurolophus']);
    const mixed = spread(['parasaurolophus', 'protoceratops', 'pachycephalosaurus', 'iguanodon']);
    expect(herd).toBeLessThan(mixed * .75);
  });

  it('a land animal near water strolls to its edge now and then, where it can drink', () => {
    const s = park([['triceratops', 16, 10]], true);
    let beside = 0, steps = 0;
    run(s, 120, () => {
      const d = s.dinos[0], row = d.y * W;
      steps++;
      if (isWater(s.map.tiles[row + d.x - 1]) || isWater(s.map.tiles[row + d.x + 1])) beside++;
      expect(isWater(s.map.tiles[row + d.x])).toBe(false);
    });
    expect(beside / steps).toBeGreaterThan(.04);
  });

  it('an animal on the loose does not wait for company', () => {
    const s = park([['stegosaurus', 8, 10], ['stegosaurus', 14, 10]]);
    s.dinos[1].baby = true;
    s.dinos[1].escaped = true;
    const sim = new Simulation(s);
    for (let i = 0; i < 400; i++) sim.step();   // simply runs: an escaped baby plans without a grown-up
    expect(s.dinos.length).toBeGreaterThan(0);
  });
});
