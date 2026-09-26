import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { isLand, terrainAt, TERRAIN_NAMES } from '../sim/terrain';
import { createTextures, CURSOR_KEY, TILE, TILESET_KEY, tileIndex } from './tileset';
import { MAX_ZOOM, MIN_ZOOM, TouchController } from './input/TouchController';

export interface TileInfo {
  x: number;
  y: number;
  label: string;
}

/** Scene events: 'tile-selected' (TileInfo | null). */
export class ParkScene extends Phaser.Scene {
  private sim!: Simulation;
  private cursor!: Phaser.GameObjects.Image;

  constructor() {
    super('park');
  }

  init(data: { sim: Simulation }): void {
    this.sim = data.sim;
  }

  create(): void {
    createTextures(this);
    const { map } = this.sim.state;

    const data: number[][] = [];
    for (let y = 0; y < map.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < map.width; x++) row.push(tileIndex(map.tiles[y * map.width + x], x, y));
      data.push(row);
    }
    const tilemap = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset failed to load');
    tilemap.createLayer(0, tileset, 0, 0);

    this.cursor = this.add.image(0, 0, CURSOR_KEY).setOrigin(0).setVisible(false).setDepth(10);

    const worldW = map.width * TILE;
    const worldH = map.height * TILE;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1f4e79');
    cam.setRoundPixels(true);
    cam.setBounds(-TILE * 4, -TILE * 4, worldW + TILE * 8, worldH + TILE * 8);
    // Start zoomed so the island roughly fills the short side of the screen.
    cam.setZoom(Phaser.Math.Clamp(Math.floor(Math.min(cam.width / worldW, cam.height / worldH) * 2), MIN_ZOOM, MAX_ZOOM));
    cam.centerOn(worldW / 2, worldH / 2);

    const touch = new TouchController(this);
    touch.on('tap', (wx: number, wy: number) => this.selectTile(wx, wy));
    touch.on('longpress', (wx: number, wy: number) => this.selectTile(wx, wy));
  }

  update(_time: number, delta: number): void {
    this.sim.advance(delta);
  }

  private selectTile(wx: number, wy: number): void {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const t = terrainAt(this.sim.state.map, tx, ty);
    if (t === undefined) {
      this.cursor.setVisible(false);
      this.events.emit('tile-selected', null);
      return;
    }
    this.cursor.setPosition(tx * TILE, ty * TILE).setVisible(true);
    const label = `${TERRAIN_NAMES[t]}${isLand(t) ? '' : ' (not buildable)'}`;
    this.events.emit('tile-selected', { x: tx, y: ty, label } satisfies TileInfo);
  }
}
