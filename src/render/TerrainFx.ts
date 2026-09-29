import Phaser from 'phaser';
import { hash2 } from '../sim/rng';
import { isLand, isWater, Terrain, type TerrainMap } from '../sim/terrain';
import { TILE } from './tileset';

const SPARKLES = 40;
const SPARKLE_MS = 1600;
const STEAM_MS = 2600;
const SPRAY_MS = 700;
/** Water whose banks get surf foam (rivers and springs have plain banks). */
const FOAMY = new Set([Terrain.DeepWater, Terrain.Shallows, Terrain.Pond]);

/**
 * Terrain dressing drawn over the tilemap: surf where water meets land (static)
 * and sparkles that twinkle on open water (animated).
 */
export class TerrainFx {
  private sparkle: Phaser.GameObjects.Graphics;
  private surf: Phaser.GameObjects.Graphics;
  private water: number[] = [];
  private springs: number[] = [];
  private falls: number[] = [];
  private lava: number[] = [];
  private fx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private map: TerrainMap) {
    this.surf = scene.add.graphics().setDepth(0.3);
    this.sparkle = scene.add.graphics().setDepth(0.35);
    // Steam and spray rise above sprites standing nearby.
    this.fx = scene.add.graphics().setDepth(8.4);
    this.rebuild();
  }

  /** Redraws the shoreline foam (after a pond is dug or filled in). */
  rebuild(): void {
    const surf = this.surf.clear();
    this.water = [];
    this.springs = [];
    this.falls = [];
    this.lava = [];
    const { width, height, tiles } = this.map;
    const land = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && isLand(tiles[y * width + x]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = tiles[y * width + x];
        if (t === Terrain.HotSpring) this.springs.push(y * width + x);
        if (t === Terrain.Waterfall) this.falls.push(y * width + x);
        if (t === Terrain.Lava) this.lava.push(y * width + x);
        if (!isWater(t)) continue;
        if (t !== Terrain.Pond && t !== Terrain.HotSpring && t !== Terrain.Waterfall) this.water.push(y * width + x);
        if (!FOAMY.has(t)) continue;
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
    this.updateSteamAndSpray(time);
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

  /** Wisps of steam drifting up from hot springs, and spray at the foot of waterfalls. */
  private updateSteamAndSpray(time: number): void {
    const g = this.fx.clear();
    const { width } = this.map;
    for (const tile of this.springs) {
      const bx = (tile % width) * TILE;
      const by = Math.floor(tile / width) * TILE + 10;
      for (let k = 0; k < 3; k++) {
        const phase = (time / STEAM_MS + k / 3 + hash2(tile, k, 4)) % 1;
        const x = bx + 4 + k * 4 + Math.sin(phase * 6 + k) * 2;
        const y = by - phase * 22;
        const size = 2 + Math.floor(phase * 3);
        g.fillStyle(0xffffff, 0.85 * (1 - phase)).fillRect(Math.round(x), Math.round(y), size + 1, size);
      }
    }
    // Hot lava pulses and spits sparks.
    for (const tile of this.lava) {
      const bx = (tile % width) * TILE;
      const by = Math.floor(tile / width) * TILE;
      const pulse = 0.5 + 0.5 * Math.sin(time / 400 + hash2(tile, 1, 8) * 6);
      g.fillStyle(0xffb040, 0.18 + 0.22 * pulse).fillRect(bx, by, TILE, TILE);
      const phase = (time / 900 + hash2(tile, 2, 9)) % 1;
      if (hash2(tile, Math.floor(time / 900), 5) < 0.25) {
        g.fillStyle(0xffe070, 1 - phase).fillRect(bx + 3 + Math.floor(hash2(tile, 3, 1) * 10), by + 8 - Math.round(phase * 10), 1, 2);
      }
    }
    for (const tile of this.falls) {
      const bx = (tile % width) * TILE;
      const by = (Math.floor(tile / width) + 1) * TILE;
      for (let k = 0; k < 5; k++) {
        const phase = (time / SPRAY_MS + k / 5) % 1;
        const x = bx + 1 + Math.floor(hash2(k, Math.floor(time / SPRAY_MS), tile) * 14);
        g.fillStyle(0xffffff, 0.8 * (1 - phase)).fillRect(x, by - 2 - Math.round(phase * 4), 2, 1);
      }
    }
  }
}
