import Phaser from 'phaser';
import { hash2 } from '../sim/rng';
import { Terrain, TERRAIN_COUNT } from '../sim/terrain';

export const TILE = 16;
export const VARIANTS = 4;
export const TILESET_KEY = 'terrain-tiles';
export const CURSOR_KEY = 'tile-cursor';

type Painter = (px: (x: number, y: number, c: string) => void, r: (x: number, y: number) => number) => void;

function fill(px: (x: number, y: number, c: string) => void, c: string): void {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, c);
}

function speckle(
  px: (x: number, y: number, c: string) => void,
  r: (x: number, y: number) => number,
  colors: string[],
  density: number,
): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = r(x, y);
      if (v < density) px(x, y, colors[Math.floor((v / density) * colors.length)]);
    }
}

// Placeholder pixel art, painted in code so Milestone 1 needs no asset files.
// Swap for a hand-drawn tileset later by loading an image under TILESET_KEY.
const PAINTERS: Record<Terrain, Painter> = {
  [Terrain.DeepWater]: (px, r) => {
    fill(px, '#1e5a96');
    speckle(px, r, ['#2a6aa8', '#3b7fc0'], 0.06);
  },
  [Terrain.Shallows]: (px, r) => {
    fill(px, '#3e9ad0');
    speckle(px, r, ['#5bb8e0', '#9adcf0'], 0.08);
  },
  [Terrain.Sand]: (px, r) => {
    fill(px, '#ecd08a');
    speckle(px, r, ['#d9b86a', '#f7e4ac'], 0.2);
  },
  [Terrain.Grass]: (px, r) => {
    fill(px, '#66a642');
    speckle(px, r, ['#57963a', '#78b850', '#8cc75e'], 0.24);
    // Now and then a few wildflowers.
    if (r(77, 7) < 0.35) {
      const colors = ['#f4ecd2', '#f2d24e', '#ff9fb8'];
      for (let i = 0; i < 3; i++) px(Math.floor(r(i, 40) * 14) + 1, Math.floor(r(40, i) * 14) + 1, colors[Math.floor(r(i, i) * 3)]);
    }
  },
  [Terrain.Forest]: (px, r) => {
    // Forest floor under the tree sprites: darker grass, ferns and leaf litter.
    fill(px, '#3f7a2c');
    speckle(px, r, ['#356a25', '#4a8a33', '#5a3b1f'], 0.3);
    if (r(9, 9) < 0.5) {
      const fx = Math.floor(r(1, 9) * 10) + 3;
      const fy = Math.floor(r(9, 1) * 10) + 3;
      for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2]]) px(fx + dx, fy + dy, '#5b9a3f');
    }
  },
  [Terrain.Mountain]: (px, r) => {
    // Ground under the mountain sprites: dark scree.
    fill(px, '#6f695c');
    speckle(px, r, ['#5e584c', '#8a8373'], 0.35);
  },
  [Terrain.Volcano]: (px, r) => {
    fill(px, '#4a4038');
    speckle(px, r, ['#3a322c', '#5e524a'], 0.35);
  },
  [Terrain.Pond]: (px, r) => {
    fill(px, '#4f9a9a');
    speckle(px, r, ['#6fb8b0', '#3f8a8a'], 0.12);
    // A lily pad or two.
    if (r(3, 3) < 0.6) {
      const lx = Math.floor(r(1, 2) * 10) + 2;
      const ly = Math.floor(r(2, 1) * 10) + 2;
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, -1]]) px(lx + dx, ly + dy, '#4e8a33');
      if (r(4, 4) < 0.4) px(lx + 1, ly, '#ff9fb8');
    }
  },
  [Terrain.Rock]: (px, r) => {
    fill(px, '#8a8373');
    speckle(px, r, ['#6f695c', '#a39d8c', '#7a7466'], 0.3);
    // A boulder on some tiles only, of varying size and position, so rocky ground doesn't look tiled.
    if (r(20, 20) < 0.4) {
      const bx = 3 + Math.floor(r(21, 1) * 8);
      const by = 4 + Math.floor(r(1, 21) * 7);
      const rx = 2 + r(22, 2) * 2.5;
      const ry = 1.5 + r(2, 22) * 1.5;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const d = (x - bx) ** 2 / (rx * rx) + (y - by) ** 2 / (ry * ry);
          if (d < 1) px(x, y, y < by ? '#b5ae9c' : '#5e584c');
        }
    }
  },
};

/** Paints the terrain tileset (TERRAIN_COUNT × VARIANTS tiles in one row) and the selection cursor. */
export function createTextures(scene: Phaser.Scene): void {
  const cols = TERRAIN_COUNT * VARIANTS;
  const tex = scene.textures.createCanvas(TILESET_KEY, cols * TILE, TILE);
  if (!tex) throw new Error('Could not create tileset canvas');
  const ctx = tex.getContext();

  for (let t = 0; t < TERRAIN_COUNT; t++) {
    for (let v = 0; v < VARIANTS; v++) {
      const ox = (t * VARIANTS + v) * TILE;
      const px = (x: number, y: number, c: string) => {
        if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, y, 1, 1);
      };
      const r = (x: number, y: number) => hash2(x, y, t * 131 + v * 7919 + 17);
      PAINTERS[t as Terrain](px, r);
    }
  }
  tex.refresh();

  const cur = scene.textures.createCanvas(CURSOR_KEY, TILE, TILE);
  if (!cur) throw new Error('Could not create cursor canvas');
  const cctx = cur.getContext();
  cctx.fillStyle = '#f2c14e';
  for (let i = 0; i < 5; i++) {
    // Corner brackets
    cctx.fillRect(i, 0, 1, 1);
    cctx.fillRect(0, i, 1, 1);
    cctx.fillRect(TILE - 1 - i, 0, 1, 1);
    cctx.fillRect(TILE - 1, i, 1, 1);
    cctx.fillRect(i, TILE - 1, 1, 1);
    cctx.fillRect(0, TILE - 1 - i, 1, 1);
    cctx.fillRect(TILE - 1 - i, TILE - 1, 1, 1);
    cctx.fillRect(TILE - 1, TILE - 1 - i, 1, 1);
  }
  cur.refresh();
}

/** Tileset frame index for a terrain cell, with a stable per-cell variant. */
export function tileIndex(terrain: Terrain, x: number, y: number): number {
  return terrain * VARIANTS + Math.floor(hash2(x, y, 4242) * VARIANTS);
}
