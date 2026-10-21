import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { hash2 } from '../sim/rng';
import { groundTone, snowCover, yearDay, type GroundTone } from '../sim/seasons';
import { valueNoise, type Terrain } from '../sim/terrain';
import { getSettings } from '../ui/settings';
import { paintSnowTiles, snowBias, snowTileIndex, SNOW_LEVELS } from './seasonArt';
import { repaintGround, TILE } from './tileset';

const SNOW_KEY = 'snow-tiles';
/** Snow cover is redrawn in steps this fine, so a thaw creeps rather than jumps. */
const SNOW_STEPS = 40;

/**
 * The season on the ground: grass that greens up, goes golden and dulls, and
 * a layer of snow tiles that settles first on high ground and melts last there.
 * Paths, buildings and fences draw over the snow, so walkways look cleared.
 */
export class SeasonLayer {
  private snow: Phaser.Tilemaps.TilemapLayer;
  private tone: GroundTone = 'summer';
  private drawnSnow = -1;
  /** Each cell's extra (or reduced) snow: bumpy drifts, more on high ground. */
  private bias: Float32Array = new Float32Array(0);

  constructor(private scene: Phaser.Scene, private sim: Simulation) {
    if (!scene.textures.exists(SNOW_KEY)) scene.textures.addCanvas(SNOW_KEY, paintSnowTiles(TILE));
    const { width, height } = sim.state.map;
    const data = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const tilemap = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = tilemap.addTilesetImage(SNOW_KEY, SNOW_KEY, TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Snow tileset failed to load');
    this.snow = tilemap.createLayer(0, tileset, 0, 0)!.setDepth(0.2).setVisible(false);
    this.rebuild();
  }

  /** After the terrain changes (a pond dug or filled in). */
  rebuild(): void {
    const { width, height, tiles, heights } = this.sim.state.map;
    this.bias = new Float32Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const b = snowBias(tiles[i] as Terrain);
        const drift = (valueNoise(x, y, 5, 4401) - 0.5) * 0.3 + (hash2(x, y, 4402) - 0.5) * 0.08;
        const high = ((heights[i] ?? 4) - 4) * 0.025;
        this.bias[i] = b === null ? Number.NaN : b + drift + high;
      }
    this.drawnSnow = -1;
  }

  update(): void {
    const enabled = getSettings().seasonScenery;
    const t = yearDay(this.sim.state, this.sim.stepProgressInHour);
    const tone = enabled ? groundTone(t) : 'summer';
    if (tone !== this.tone) {
      this.tone = tone;
      repaintGround(this.scene, tone);
    }
    const snow = enabled ? Math.round(snowCover(t) * SNOW_STEPS) / SNOW_STEPS : 0;
    if (snow === this.drawnSnow) return;
    this.drawnSnow = snow;
    this.snow.setVisible(snow > 0);
    const { width, height } = this.sim.state.map;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const b = this.bias[y * width + x];
        const level = Number.isNaN(b) || snow === 0 ? 0 : Math.round(Math.max(0, Math.min(1, snow + b)) * SNOW_LEVELS);
        const current = this.snow.getTileAt(x, y);
        const index = level > 0 ? snowTileIndex(level, x, y) : -1;
        if ((current?.index ?? -1) === index) continue;
        if (index < 0) this.snow.removeTileAt(x, y);
        else this.snow.putTileAt(index, x, y);
      }
  }
}
