import Phaser from 'phaser';
import { hash2 } from '../sim/rng';
import { isLand, isWater, Terrain, type TerrainMap } from '../sim/terrain';
import { TILE } from './tileset';

const SPARKLES = 40;
const SPARKLE_MS = 1600;

/**
 * Terrain dressing drawn over the tilemap: surf where water meets land (static)
 * and sparkles that twinkle on open water (animated).
 */
export class TerrainFx {
  private sparkle: Phaser.GameObjects.Graphics;
  private water: number[] = [];

  constructor(scene: Phaser.Scene, private map: TerrainMap) {
    const surf = scene.add.graphics().setDepth(0.3);
    this.sparkle = scene.add.graphics().setDepth(0.35);
    const { width, height, tiles } = map;
    const land = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && isLand(tiles[y * width + x]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isWater(tiles[y * width + x])) continue;
        if (tiles[y * width + x] !== Terrain.Pond) this.water.push(y * width + x);
        const ox = x * TILE;
        const oy = y * TILE;
        // A broken line of foam along each side that touches land.
        const sides: [boolean, (i: number) => [number, number]][] = [
          [land(x, y - 1), (i) => [ox + i, oy]],
          [land(x, y + 1), (i) => [ox + i, oy + TILE - 1]],
          [land(x - 1, y), (i) => [ox, oy + i]],
          [land(x + 1, y), (i) => [ox + TILE - 1, oy + i]],
        ];
        for (const [touches, at] of sides) {
          if (!touches) continue;
          for (let i = 0; i < TILE; i++) {
            const h = hash2(x * 31 + i, y * 17 - i, 7);
            if (h < 0.7) {
              const [px, py] = at(i);
              surf.fillStyle(h < 0.35 ? 0xe8f6fb : 0x9fd6ea, 0.9).fillRect(px, py, 1, 1);
            }
          }
        }
      }
    }
  }

  /** Twinkles: each sparkle fades in and out at a spot that moves every cycle. */
  update(time: number): void {
    const g = this.sparkle.clear();
    if (this.water.length === 0) return;
    const { width } = this.map;
    for (let i = 0; i < SPARKLES; i++) {
      const phase = (time / SPARKLE_MS + i / SPARKLES) % 1;
      const cycle = Math.floor(time / SPARKLE_MS + i / SPARKLES);
      const tile = this.water[Math.floor(hash2(i, cycle, 3) * this.water.length)];
      const x = (tile % width) * TILE + Math.floor(hash2(cycle, i, 5) * 14) + 1;
      const y = Math.floor(tile / width) * TILE + Math.floor(hash2(i * 7, cycle, 9) * 14) + 1;
      const a = Math.sin(phase * Math.PI);
      g.fillStyle(0xffffff, 0.8 * a).fillRect(x, y, 1, 1);
      if (a > 0.7) g.fillStyle(0xffffff, 0.4 * a).fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3);
    }
  }
}
