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
    fill(px, '#1f4e79');
    speckle(px, r, ['#2a6496', '#3b7bb3'], 0.05);
  },
  [Terrain.Shallows]: (px, r) => {
    fill(px, '#3a8fb7');
    speckle(px, r, ['#5bb3d6', '#8fd3ea'], 0.07);
  },
  [Terrain.Sand]: (px, r) => {
    fill(px, '#e8d18b');
    speckle(px, r, ['#d4ba6c', '#f5e3a8'], 0.18);
  },
  [Terrain.Grass]: (px, r) => {
    fill(px, '#5f9e3f');
    speckle(px, r, ['#4e8a33', '#73b44f', '#86c25c'], 0.22);
  },
  [Terrain.Forest]: (px, r) => {
    fill(px, '#3f7a2c');
    speckle(px, r, ['#356a25'], 0.2);
    // A small conifer, nudged by the variant so forests don't tile visibly.
    const ox = Math.floor(r(99, 1) * 5) - 2;
    const trunkX = 7 + ox;
    for (let row = 0; row < 9; row++) {
      const half = Math.floor(row / 2) + 1;
      for (let dx = -half; dx < half; dx++) px(trunkX + dx + 1, 2 + row, row % 3 === 0 ? '#2f6b3a' : '#1f4d2a');
    }
    px(trunkX, 11, '#5a3b1f');
    px(trunkX + 1, 11, '#5a3b1f');
    px(trunkX, 12, '#4a2f18');
    px(trunkX + 1, 12, '#4a2f18');
  },
  [Terrain.Rock]: (px, r) => {
    fill(px, '#8a8373');
    speckle(px, r, ['#6f695c', '#a39d8c'], 0.25);
    for (let y = 5; y < 12; y++)
      for (let x = 4; x < 12; x++) {
        const d = (x - 7.5) ** 2 / 16 + (y - 8.5) ** 2 / 10;
        if (d < 1) px(x, y, y < 8 ? '#b5ae9c' : '#5e584c');
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
