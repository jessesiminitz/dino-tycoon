import Phaser from 'phaser';
import { hash2 } from '../sim/rng';
import { Terrain, TERRAIN_COUNT } from '../sim/terrain';

import { paintTerrainTile, TERRAIN_TILE_SIZE } from './terrainArt';

export const TILE = TERRAIN_TILE_SIZE;
export const VARIANTS = 4;
export const TILESET_KEY = 'terrain-tiles';
export const CURSOR_KEY = 'tile-cursor';

/** Paints the terrain tileset (TERRAIN_COUNT × VARIANTS tiles in one row) and the selection cursor. */
export function createTextures(scene: Phaser.Scene): void {
  const cols = TERRAIN_COUNT * VARIANTS;
  const tex = scene.textures.createCanvas(TILESET_KEY, cols * TILE, TILE);
  if (!tex) throw new Error('Could not create tileset canvas');
  const ctx = tex.getContext();

  for (let t = 0; t < TERRAIN_COUNT; t++) {
    for (let v = 0; v < VARIANTS; v++) {
      const ox = (t * VARIANTS + v) * TILE;
      ctx.drawImage(paintTerrainTile(t as Terrain, v), ox, 0, TILE, TILE);
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
