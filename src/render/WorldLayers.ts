import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { FENCE_TYPES, type FenceTypeId } from '../sim/data/fences';
import type { Edge } from '../sim/grid';
import { isParcelOwned, parcelBuyBlocker, parcelGrid, parcelPrice, PARCEL, type Point } from '../sim/land';
import { formatMoney } from '../ui/hud';
import { hash2 } from '../sim/rng';
import { TILE } from './tileset';

const PADDOCK_TINTS = [0xf2c14e, 0x6ec6ff, 0xff8fb1, 0xb28dff, 0x7ee0b5, 0xffa257];
const FOR_SALE = 0xff9f43;

/** Rail thickness in world pixels per fence type. */
const RAIL_WIDTH: Record<FenceTypeId, number> = { 1: 2, 2: 2, 3: 1, 4: 4 };

export type GhostStyle = 'build' | 'blocked' | 'remove' | 'none';
const GHOST_COLORS: Record<GhostStyle, number> = {
  build: 0x8fd16a,
  blocked: 0xff7a6b,
  remove: 0xff7a6b,
  none: 0x9aa39a,
};

/** Draws everything built on top of the terrain. All shapes are in world pixels. */
export class WorldLayers {
  private paths: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private fences: Phaser.GameObjects.Graphics;
  private gate: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    this.paths = scene.add.graphics().setDepth(0.5);
    this.overlay = scene.add.graphics().setDepth(1);
    this.fences = scene.add.graphics().setDepth(2);
    this.gate = scene.add.graphics().setDepth(3);
    this.ghost = scene.add.graphics().setDepth(5);
    this.drawGate();
  }

  /**
   * Ownership shading, paddock tints and the property line. In land mode, plots
   * for sale get orange hatching, a border and a price sign; your land stays clear.
   */
  drawOverlay(landMode: boolean, selectedParcel: Point | null): void {
    const g = this.overlay.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    const { state } = this.sim;
    const { width } = state.map;

    const { regions } = this.sim.regions();
    let paddockNo = 0;
    for (const r of regions) {
      if (r.kind !== 'paddock') continue;
      g.fillStyle(PADDOCK_TINTS[paddockNo++ % PADDOCK_TINTS.length], 0.16);
      for (const i of r.tiles) g.fillRect((i % width) * TILE, Math.floor(i / width) * TILE, TILE, TILE);
    }

    const { cols, rows } = parcelGrid(state.map);
    const size = PARCEL * TILE;
    for (let py = 0; py < rows; py++) {
      for (let px = 0; px < cols; px++) {
        if (isParcelOwned(state, px, py)) continue;
        const x0 = px * size;
        const y0 = py * size;
        const forSale = landMode && parcelBuyBlocker(state, px, py) === null;
        if (!forSale) {
          g.fillStyle(0x000000, landMode ? 0.45 : 0.32);
          g.fillRect(x0, y0, size, size);
          continue;
        }
        g.fillStyle(0x000000, 0.2);
        g.fillRect(x0, y0, size, size);
        // Diagonal hatching, clipped to the plot.
        g.lineStyle(2, FOR_SALE, 0.55);
        for (let c = -size + 8; c < size; c += 12) {
          g.lineBetween(x0 + Math.max(0, c), y0 + Math.max(0, -c), x0 + Math.min(size, size + c), y0 + Math.min(size, size - c));
        }
        g.lineStyle(2, FOR_SALE, 1);
        g.strokeRect(x0 + 2, y0 + 2, size - 4, size - 4);
        this.labels.push(
          this.scene.add
            .text(x0 + size / 2, y0 + size / 2, `FOR SALE\n${formatMoney(parcelPrice(state.map, px, py))}`, {
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              fontStyle: 'bold',
              color: '#ffe7c2',
              backgroundColor: '#5a2f0ecc',
              align: 'center',
              padding: { x: 3, y: 2 },
              resolution: 4,
            })
            .setOrigin(0.5)
            .setDepth(6),
        );
      }
    }

    // Property line wherever an owned plot meets one you don't own.
    g.lineStyle(landMode ? 2 : 1, landMode ? 0x8fd16a : 0xffffff, landMode ? 1 : 0.5);
    for (let py = 0; py < rows; py++) {
      for (let px = 0; px < cols; px++) {
        if (!isParcelOwned(state, px, py)) continue;
        const x0 = px * size;
        const y0 = py * size;
        if (!isParcelOwned(state, px, py - 1)) g.lineBetween(x0, y0, x0 + size, y0);
        if (!isParcelOwned(state, px, py + 1)) g.lineBetween(x0, y0 + size, x0 + size, y0 + size);
        if (!isParcelOwned(state, px - 1, py)) g.lineBetween(x0, y0, x0, y0 + size);
        if (!isParcelOwned(state, px + 1, py)) g.lineBetween(x0 + size, y0, x0 + size, y0 + size);
      }
    }

    if (landMode && selectedParcel) {
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRect(selectedParcel.x * size + 1, selectedParcel.y * size + 1, size - 2, size - 2);
    }
  }

  drawFences(): void {
    const g = this.fences.clear();
    const { state } = this.sim;
    const { width, height } = state.map;
    for (let y = 0; y <= height; y++)
      for (let x = 0; x < width; x++) {
        const f = state.hFences[y * width + x] as FenceTypeId | 0;
        if (f) this.drawSegment(g, { dir: 'h', x, y }, f);
      }
    for (let y = 0; y < height; y++)
      for (let x = 0; x <= width; x++) {
        const f = state.vFences[y * (width + 1) + x] as FenceTypeId | 0;
        if (f) this.drawSegment(g, { dir: 'v', x, y }, f);
      }
  }

  /** Gravel footpaths, with darker edges where a path meets grass. */
  drawPaths(): void {
    const g = this.paths.clear();
    const { state } = this.sim;
    const { width, height } = state.map;
    const gate = state.entrance.y * width + state.entrance.x;
    const walk = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < width && y < height && (state.paths[y * width + x] === 1 || y * width + x === gate);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!walk(x, y)) continue;
        const ox = x * TILE;
        const oy = y * TILE;
        g.fillStyle(0xcdb58a, 1).fillRect(ox, oy, TILE, TILE);
        g.fillStyle(0xb89f73, 1);
        for (let k = 0; k < 6; k++) {
          const h = hash2(x * 7 + k, y * 13 - k, 99);
          g.fillRect(ox + Math.floor(h * 14) + 1, oy + Math.floor(((h * 97) % 1) * 14) + 1, 1, 1);
        }
        g.fillStyle(0x8f7a55, 1);
        if (!walk(x, y - 1)) g.fillRect(ox, oy, TILE, 1);
        if (!walk(x, y + 1)) g.fillRect(ox, oy + TILE - 1, TILE, 1);
        if (!walk(x - 1, y)) g.fillRect(ox, oy, 1, TILE);
        if (!walk(x + 1, y)) g.fillRect(ox + TILE - 1, oy, 1, TILE);
      }
    }
  }

  /** Path-tool preview: tiles that will be built (or erased) and ones that can't be. */
  drawTileGhost(tiles: { x: number; y: number; style: GhostStyle }[]): void {
    const g = this.ghost.clear();
    for (const { x, y, style } of tiles) {
      g.fillStyle(GHOST_COLORS[style], 0.45).fillRect(x * TILE, y * TILE, TILE, TILE);
      g.lineStyle(1, GHOST_COLORS[style], 0.9).strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }

  drawGhost(edges: { edge: Edge; style: GhostStyle }[]): void {
    const g = this.ghost.clear();
    for (const { edge, style } of edges) {
      g.fillStyle(GHOST_COLORS[style], 0.9);
      const x = edge.x * TILE;
      const y = edge.y * TILE;
      if (edge.dir === 'h') g.fillRect(x, y - 1, TILE, 3);
      else g.fillRect(x - 1, y, 3, TILE);
    }
  }

  clearGhost(): void {
    this.ghost.clear();
  }

  private drawSegment(g: Phaser.GameObjects.Graphics, e: Edge, f: FenceTypeId): void {
    const t = FENCE_TYPES[f];
    const w = RAIL_WIDTH[f];
    const half = Math.floor(w / 2);
    const x = e.x * TILE;
    const y = e.y * TILE;

    if (f === 3) {
      // Electric: a faint glow behind a thin live wire.
      g.fillStyle(t.rail, 0.25);
      if (e.dir === 'h') g.fillRect(x, y - 2, TILE, 4);
      else g.fillRect(x - 2, y, 4, TILE);
    }
    g.fillStyle(t.rail, 1);
    if (e.dir === 'h') g.fillRect(x, y - half, TILE, w);
    else g.fillRect(x - half, y, w, TILE);

    // Posts at both ends (shared posts simply overdraw).
    g.fillStyle(t.post, 1);
    const [x2, y2] = e.dir === 'h' ? [x + TILE, y] : [x, y + TILE];
    const p = f === 4 ? 4 : 3;
    g.fillRect(x - Math.floor(p / 2), y - Math.floor(p / 2), p, p);
    g.fillRect(x2 - Math.floor(p / 2), y2 - Math.floor(p / 2), p, p);
    if (f === 1) {
      // Wooden fences get a mid post.
      const [mx, my] = e.dir === 'h' ? [x + TILE / 2, y] : [x, y + TILE / 2];
      g.fillRect(mx - 1, my - 1, 2, 2);
    }
  }

  private drawGate(): void {
    const g = this.gate.clear();
    const { x, y } = this.sim.state.entrance;
    const ox = x * TILE;
    const oy = y * TILE;
    // Two posts, a lintel and a little yellow sign.
    g.fillStyle(0x5a3b1f, 1);
    g.fillRect(ox + 2, oy + 3, 2, 12);
    g.fillRect(ox + 12, oy + 3, 2, 12);
    g.fillRect(ox + 1, oy + 2, 14, 2);
    g.fillStyle(0xf2c14e, 1);
    g.fillRect(ox + 4, oy - 2, 8, 5);
    g.fillStyle(0x1b1b1b, 1);
    g.fillRect(ox + 6, oy, 4, 1);
  }
}
