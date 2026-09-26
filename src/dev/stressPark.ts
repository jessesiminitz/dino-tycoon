import { newGame, type GameState } from '../sim/GameState';
import { applyCommand } from '../sim/commands';
import { SPECIES_IDS } from '../sim/data/species';
import type { Edge } from '../sim/grid';
import { parcelGrid } from '../sim/land';
import { spawnVisitor } from '../sim/systems/visitors';
import { Rng } from '../sim/rng';
import { computeRegions } from '../sim/regions';
import { Terrain } from '../sim/terrain';

// Shared by the performance test and the in-browser frame-time check. Not part of the game build.
/**
 * Worst-case park: the full 64×48 map owned, a grid of 12 paddocks, 30 dinos,
 * 150 visitors on a path network, 12 staff and plenty of feeders.
 */
export function stressPark(): GameState {
  const s = newGame(123);
  const W = 64;
  const H = 48;
  s.map = { width: W, height: H, tiles: new Array(W * H).fill(Terrain.Grass) };
  s.entrance = { x: 0, y: H - 1 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.hFences = new Array(W * (H + 1)).fill(0);
  s.vFences = new Array((W + 1) * H).fill(0);
  s.hFenceHp = new Array(W * (H + 1)).fill(0);
  s.vFenceHp = new Array((W + 1) * H).fill(0);
  s.paths = new Array(W * H).fill(0);
  s.money = 1e9;
  s.unlockedSpecies = [...SPECIES_IDS];
  // 4×3 paddocks of 12×10 tiles, separated by path corridors.
  const edges: Edge[] = [];
  for (let py = 0; py < 3; py++)
    for (let px = 0; px < 4; px++) {
      const x0 = 2 + px * 15;
      const y0 = 2 + py * 14;
      for (let x = x0; x < x0 + 12; x++) edges.push({ dir: 'h', x, y: y0 }, { dir: 'h', x, y: y0 + 10 });
      for (let y = y0; y < y0 + 10; y++) edges.push({ dir: 'v', x: x0, y }, { dir: 'v', x: x0 + 12, y });
      applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: x0 + 1, y: y0 + 1 });
      applyCommand(s, { type: 'placeFeeder', kind: 'meat', x: x0 + 10, y: y0 + 8 });
    }
  applyCommand(s, { type: 'buildFences', edges, fence: 4 });
  const tiles: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y % 14 === 13 || x % 15 === 0 || y === H - 1) tiles.push(y * W + x);
  applyCommand(s, { type: 'buildPaths', tiles });
  for (let i = 0; i < 30; i++) {
    const px = i % 4;
    const py = Math.floor(i / 4) % 3;
    const sp = (['protoceratops', 'triceratops', 'parasaurolophus', 'stegosaurus', 'compsognathus'] as const)[i % 5];
    applyCommand(s, { type: 'buyDino', species: sp, x: 4 + px * 15 + (i % 3) * 2, y: 4 + py * 14 + (i % 2) * 3 });
  }
  for (const role of ['worker', 'worker', 'worker', 'worker', 'guard', 'guard', 'vet', 'vet', 'guide', 'guide', 'guide', 'guide'] as const) {
    applyCommand(s, { type: 'hireStaff', role });
  }
  const ctx = { state: s, rng: new Rng(5), regions: computeRegions(s), emit() {}, invalidateWorld() {} };
  for (let i = 0; i < 150; i++) spawnVisitor(ctx, 60, 20);
  return s;
}

