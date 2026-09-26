import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { FENCE_TYPES, type FenceTypeId } from '../sim/data/fences';
import type { Edge } from '../sim/grid';
import { isParcelOwned, parcelBuyBlocker, parcelGrid, PARCEL, type Point } from '../sim/land';
import { TILE } from './tileset';

const PADDOCK_TINTS = [0xf2c14e, 0x6ec6ff, 0xff8fb1, 0xb28dff, 0x7ee0b5, 0xffa257];

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
  private overlay: Phaser.GameObjects.Graphics;
  private fences: Phaser.GameObjects.Graphics;
  private gate: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    this.overlay = scene.add.graphics().setDepth(1);
    this.fences = scene.add.graphics().setDepth(2);
    this.gate = scene.add.graphics().setDepth(3);
    this.ghost = scene.add.graphics().setDepth(5);
    this.drawGate();
  }

  /** Ownership shading, paddock tints and (in land mode) the plot grid. */
  drawOverlay(landMode: boolean, selectedParcel: Point | null): void {
    const g = this.overlay.clear();
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
        const buyable = landMode && parcelBuyBlocker(state, px, py) === null;
        g.fillStyle(buyable ? 0xf2c14e : 0x000000, buyable ? 0.18 : 0.32);
        g.fillRect(px * size, py * size, size, size);
      }
    }

    if (landMode) {
      g.lineStyle(1, 0xffffff, 0.35);
      for (let px = 0; px <= cols; px++) g.lineBetween(px * size, 0, px * size, rows * size);
      for (let py = 0; py <= rows; py++) g.lineBetween(0, py * size, cols * size, py * size);
      if (selectedParcel) {
        g.lineStyle(2, 0xf2c14e, 1);
        g.strokeRect(selectedParcel.x * size + 1, selectedParcel.y * size + 1, size - 2, size - 2);
      }
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
