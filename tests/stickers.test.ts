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





import { earnedStickers, STICKERS } from '../src/sim/stickers';
import { SPECIES_IDS } from '../src/sim/data/species';

describe('sticker book', () => {
  it('has a sticker for every species and baby, every medal, and the park moments', () => {
    const ids = STICKERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of SPECIES_IDS) {
      expect(ids).toContain(`dino:${id}`);
      expect(ids).toContain(`baby:${id}`);
    }
    expect(STICKERS.filter((s) => s.group === 'medals')).toHaveLength(4 * 3);
    for (const s of STICKERS) expect(s.hint.length).toBeGreaterThan(10);
  });

  it('a park earns stickers for what it has done', () => {
    const s = openPark();
    const got = earnedStickers(s);
    expect(got).toEqual(expect.arrayContaining(['dino:protoceratops', 'dino:triceratops', 'moment:first-dino']));
    expect(got).not.toContain('moment:photo');
    expect(got).not.toContain('baby:protoceratops');
    applyCommand(s, { type: 'photoDino', id: s.dinos[0].id });
    applyCommand(s, { type: 'treatDino', id: s.dinos[0].id });
    s.dinos.push({ ...s.dinos[0], id: 9999, baby: true });
    const more = earnedStickers(s);
    expect(more).toEqual(expect.arrayContaining(['moment:photo', 'moment:treat', 'baby:protoceratops']));
  });

  it('medals follow the milestones reached', () => {
    const s = openPark();
    s.scenario = { id: 'first-steps', status: 'playing', round: 2, roundStart: 1, earned: [[], []] };
    const got = earnedStickers(s);
    expect(got).toEqual(expect.arrayContaining(['medal:first-steps:0', 'medal:first-steps:1']));
    expect(got).not.toContain('medal:first-steps:2');
  });

  it('the hand-dug fossil sticker is only given by the dig mini-game', () => {
    const s = openPark();
    s.fossils = { ankylosaurus: 2 };
    expect(earnedStickers(s)).not.toContain('moment:fossil');
  });
});
