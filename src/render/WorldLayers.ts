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

/** How tall each fence type stands, in world pixels. */
const FENCE_H: Record<FenceTypeId, number> = { 1: 8, 2: 9, 3: 9, 4: 10, 5: 13 };

/** Mixes a 0xRRGGBB colour toward white (amount > 0) or black (< 0). */
function lighten(color: number, amount: number): number {
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (shift: number) => Math.round(((color >> shift) & 255) * (1 - a) + target * a);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

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
  /** One graphics layer per row of the map, depth-sorted with dinos and people. */
  private fenceRows: Phaser.GameObjects.Graphics[] = [];
  private gate: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    this.paths = scene.add.graphics().setDepth(0.5);
    this.overlay = scene.add.graphics().setDepth(1);
    for (let y = 0; y <= sim.state.map.height; y++) {
      // A fence along row edge y stands at world y*TILE: things further north are behind it.
      this.fenceRows.push(scene.add.graphics().setDepth(4 + (y * TILE) / 10000 - 0.00001));
    }
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
    for (const g of this.fenceRows) g.clear();
    const { state } = this.sim;
    const { width, height } = state.map;
    for (let y = 0; y <= height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const f = state.hFences[i] as FenceTypeId | 0;
        if (f) this.drawSegment(this.fenceRows[y], { dir: 'h', x, y }, f, state.hFenceHp[i]);
      }
    for (let y = 0; y < height; y++)
      for (let x = 0; x <= width; x++) {
        const i = y * (width + 1) + x;
        const f = state.vFences[i] as FenceTypeId | 0;
        // A north–south segment is sorted by its southern (front) end.
        if (f) this.drawSegment(this.fenceRows[y + 1], { dir: 'v', x, y }, f, state.vFenceHp[i]);
      }
  }

  /** Gravel footpaths, with darker edges where a path meets grass. */
  drawPaths(): void {
    const g = this.paths.clear();
    this.drawTracks(g);
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

  /** Jeep tracks: packed earth with two tyre ruts that join up with neighbouring track. */
  private drawTracks(g: Phaser.GameObjects.Graphics): void {
    const { state } = this.sim;
    const { width, height } = state.map;
    const track = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && state.tracks[y * width + x] === 1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (!track(x, y)) continue;
        const ox = x * TILE;
        const oy = y * TILE;
        g.fillStyle(0xa8875a, 1).fillRect(ox + 1, oy + 1, TILE - 2, TILE - 2);
        g.fillStyle(0x7a5e3a, 1);
        const ruts = [4, 11];
        // Ruts run toward each neighbour that's track (a lone tile gets an east–west pair).
        const east = track(x + 1, y);
        const west = track(x - 1, y);
        const north = track(x, y - 1);
        const south = track(x, y + 1);
        if (east || west || (!north && !south)) for (const r of ruts) g.fillRect(west ? ox : ox + 3, oy + r, (west ? 0 : -3) + (east ? TILE : TILE - 3), 1);
        if (north || south) for (const r of ruts) g.fillRect(ox + r, north ? oy : oy + 3, 1, (north ? 0 : -3) + (south ? TILE : TILE - 3));
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

  drawGhost(edges: { edge: Edge; style: GhostStyle }[], tiles: { x: number; y: number; style: GhostStyle }[] = []): void {
    const g = this.ghost.clear();
    for (const { x, y, style } of tiles) {
      g.fillStyle(GHOST_COLORS[style], 0.4).fillRect(x * TILE, y * TILE, TILE, TILE);
      g.lineStyle(1, GHOST_COLORS[style], 0.9).strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
    for (const { edge, style } of edges) {
      g.fillStyle(GHOST_COLORS[style], 0.9);
      const x = edge.x * TILE;
      const y = edge.y * TILE;
      if (edge.dir === 'h') g.fillRect(x, y - 1, TILE, 3);
      else g.fillRect(x - 1, y, 3, TILE);
    }
  }

  /** Fence gaps: thick red bars, each circled so they stand out at any zoom. */
  drawGaps(edges: Edge[]): void {
    const g = this.ghost.clear();
    for (const edge of edges) {
      const x = edge.x * TILE;
      const y = edge.y * TILE;
      g.fillStyle(0xff4a3a, 0.95);
      if (edge.dir === 'h') g.fillRect(x, y - 2, TILE, 4);
      else g.fillRect(x - 2, y, 4, TILE);
      const cx = edge.dir === 'h' ? x + TILE / 2 : x;
      const cy = edge.dir === 'h' ? y : y + TILE / 2;
      g.lineStyle(2, 0xff4a3a, 0.9).strokeCircle(cx, cy, TILE * 0.7);
    }
  }

  clearGhost(): void {
    this.ghost.clear();
  }

  /**
   * One fence segment, drawn standing up in 3/4 view: posts rise FENCE_H pixels
   * above the ground line. East–west runs show their face; north–south runs are
   * seen end-on as a narrow band. Worn fences (< 50%) have gaps; broken ones
   * are fallen posts and rubble.
   */
  private drawSegment(g: Phaser.GameObjects.Graphics, e: Edge, f: FenceTypeId, hp: number): void {
    const t = FENCE_TYPES[f];
    const H = FENCE_H[f];
    const x0 = e.x * TILE;
    const y0 = e.y * TILE;
    const horizontal = e.dir === 'h';
    const [x1, y1] = horizontal ? [x0 + TILE, y0] : [x0, y0 + TILE];
    const light = lighten(t.rail, 0.25);
    const dark = lighten(t.rail, -0.3);

    const post = (px: number, py: number, h = H) => {
      g.fillStyle(0x1b1b14, 1).fillRect(px - 2, py - h - 1, 4, h + 2);
      g.fillStyle(t.post, 1).fillRect(px - 1, py - h, 2, h);
      g.fillStyle(lighten(t.post, 0.3), 1).fillRect(px - 1, py - h, 1, h);
    };

    if (hp <= 0) {
      // Broken: stumps, fallen rails and a red warning dash.
      post(x0, y0, 3);
      post(x1, y1, 3);
      g.fillStyle(t.rail, 0.9);
      if (horizontal) g.fillRect(x0 + 3, y0 + 1, 8, 2);
      else g.fillRect(x0 + 2, y0 + 5, 2, 6);
      g.fillStyle(0xff5a4a, 0.9);
      if (horizontal) g.fillRect(x0 + 5, y0 - 1, 6, 1);
      else g.fillRect(x0 - 1, y0 + 5, 1, 6);
      return;
    }

    const gap = hp < 25 ? 6 : hp < 50 ? 3 : 0;
    /** Fill a horizontal band of the segment, leaving a worn gap in the middle. */
    const band = (top: number, h: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      if (horizontal) {
        if (!gap) g.fillRect(x0, y0 - top, TILE, h);
        else {
          const seg = (TILE - gap) / 2;
          g.fillRect(x0, y0 - top, seg, h);
          g.fillRect(x0 + seg + gap, y0 - top, seg, h);
        }
      } else {
        // End-on: the same band runs down the length of the edge, shifted up by its height.
        const len = gap ? (TILE - gap) / 2 : TILE;
        g.fillRect(x0 - 1, y0 - top, 2, len + h - 1);
        if (gap) g.fillRect(x0 - 1, y0 - top + len + gap, 2, len + h - 1);
      }
    };

    switch (f) {
      case 5: // Aviary net: a tall, pale diamond mesh
        if (horizontal) {
          for (let x = 0; x < TILE; x++)
            for (let y = 1; y < H; y++) {
              if (gap && x >= (TILE - gap) / 2 && x < (TILE + gap) / 2) continue;
              if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) g.fillStyle(t.rail, 0.7).fillRect(x0 + x, y0 - y, 1, 1);
            }
        } else band(H - 1, H - 1, t.rail, 0.35);
        band(H, 1, light);
        band(1, 1, dark);
        break;
      case 1: // Wooden: two plank rails
        band(H - 1, 2, t.rail);
        band(H - 2, 1, light);
        band(4, 2, t.rail);
        band(5, 1, light);
        break;
      case 2: // Steel: chain-link mesh between top and bottom rails
        if (horizontal) {
          for (let x = 0; x < TILE; x += 2)
            for (let y = 1; y < H; y += 2) if (!gap || x < (TILE - gap) / 2 || x >= (TILE + gap) / 2) g.fillStyle(t.rail, 0.55).fillRect(x0 + x + (y % 4 === 1 ? 0 : 1), y0 - y, 1, 1);
        } else band(H - 1, H - 1, t.rail, 0.45);
        band(H, 1, light);
        band(1, 1, dark);
        break;
      case 3: // Electric: three live wires with a faint glow
        band(H - 1, H - 1, t.rail, 0.12);
        for (const h of [H - 1, Math.round(H / 2), 2]) band(h, 1, t.rail);
        break;
      case 4: // Concrete: a solid block wall with a lit top edge
        band(H, H, t.rail);
        band(H, 1, light);
        band(1, 1, dark);
        if (horizontal && !gap) {
          g.fillStyle(dark, 0.6).fillRect(x0 + 7, y0 - H + 1, 1, H - 2); // block joint
          g.fillStyle(dark, 0.6).fillRect(x0, y0 - Math.round(H / 2), TILE, 1);
        }
        break;
    }
    if (f !== 4) {
      post(x0, y0);
      post(x1, y1);
      if (f === 1 && !gap) post(horizontal ? x0 + TILE / 2 : x0, horizontal ? y0 : y0 + TILE / 2, H - 1);
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
