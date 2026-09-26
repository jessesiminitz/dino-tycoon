import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { planFences } from '../sim/commands';
import { FENCE_REFUND, FENCE_TYPES } from '../sim/data/fences';
import { fenceAt } from '../sim/fences';
import { pathEdges, type Edge } from '../sim/grid';
import { isTileOwned, parcelBuyBlocker, parcelLandTiles, parcelOf, parcelPrice, type Point } from '../sim/land';
import { isLand, terrainAt, TERRAIN_NAMES } from '../sim/terrain';
import type { Hud } from '../ui/hud';
import { formatMoney } from '../ui/hud';
import type { UiState } from '../ui/uiState';
import { createTextures, CURSOR_KEY, TILE, TILESET_KEY, tileIndex } from './tileset';
import { MAX_ZOOM, TouchController } from './input/TouchController';
import { WorldLayers } from './WorldLayers';

/** How close (in tiles) a tap must be to an edge to pick that fence segment. */
const EDGE_PICK = 0.3;

interface Drag {
  start: Point;
  startWorld: Point;
  horizontalFirst: boolean | null;
  edges: Edge[];
}

export class ParkScene extends Phaser.Scene {
  private sim!: Simulation;
  private ui!: UiState;
  private hud!: Hud;
  private cursor!: Phaser.GameObjects.Image;
  private layers!: WorldLayers;
  private touch!: TouchController;
  private drawnRevision = -1;
  private drag: Drag | null = null;
  private selectedParcel: Point | null = null;

  constructor() {
    super('park');
  }

  init(data: { sim: Simulation; ui: UiState; hud: Hud }): void {
    this.sim = data.sim;
    this.ui = data.ui;
    this.hud = data.hud;
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

    this.layers = new WorldLayers(this, this.sim);
    this.cursor = this.add.image(0, 0, CURSOR_KEY).setOrigin(0).setVisible(false).setDepth(10);

    const worldW = map.width * TILE;
    const worldH = map.height * TILE;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1f4e79');
    cam.setRoundPixels(true);
    cam.setBounds(-TILE * 4, -TILE * 4, worldW + TILE * 8, worldH + TILE * 8);
    // Start zoomed in on the gate, where the player's land is.
    cam.setZoom(Phaser.Math.Clamp(Math.floor(Math.min(cam.width / worldW, cam.height / worldH) * 3), 2, MAX_ZOOM));
    cam.centerOn(this.sim.state.entrance.x * TILE, (this.sim.state.entrance.y - 6) * TILE);

    this.touch = new TouchController(this);
    this.touch.on('tap', (wx: number, wy: number) => this.onTap(wx, wy));
    this.touch.on('longpress', (wx: number, wy: number) => this.onTap(wx, wy));
    this.touch.on('drawstart', (wx: number, wy: number) => this.onDrawStart(wx, wy));
    this.touch.on('drawmove', (wx: number, wy: number) => this.onDrawMove(wx, wy));
    this.touch.on('drawend', () => this.onDrawEnd());
    this.touch.on('drawcancel', () => this.cancelDrag());

    const unsubscribe = this.ui.onChange(() => this.onModeChange());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.onModeChange();
  }

  update(_time: number, delta: number): void {
    this.sim.advance(delta);
    if (this.drawnRevision !== this.sim.worldRevision) this.redrawWorld();
  }

  private redrawWorld(): void {
    this.drawnRevision = this.sim.worldRevision;
    this.layers.drawFences();
    this.layers.drawOverlay(this.ui.mode === 'land', this.selectedParcel);
  }

  private onModeChange(): void {
    const mode = this.ui.mode;
    this.touch.drawMode = mode === 'fence' || mode === 'demolish';
    this.cancelDrag();
    if (mode !== 'select') this.cursor.setVisible(false);
    if (mode !== 'land') this.selectedParcel = null;
    this.redrawWorld();
  }

  // --- taps ---

  private onTap(wx: number, wy: number): void {
    switch (this.ui.mode) {
      case 'select':
        return this.inspectTile(wx, wy);
      case 'land':
        return this.selectParcel(wx, wy);
      case 'fence':
      case 'demolish': {
        const edge = this.edgeNear(wx, wy);
        if (edge) this.commitEdges([edge]);
        return;
      }
    }
  }

  private inspectTile(wx: number, wy: number): void {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const t = terrainAt(this.sim.state.map, tx, ty);
    if (t === undefined) {
      this.cursor.setVisible(false);
      this.hud.showInfo(null);
      return;
    }
    this.cursor.setPosition(tx * TILE, ty * TILE).setVisible(true);

    const parts = [TERRAIN_NAMES[t]];
    if (isLand(t)) {
      const { regions, tileRegion } = this.sim.regions();
      const region = regions[tileRegion[ty * this.sim.state.map.width + tx]];
      if (tx === this.sim.state.entrance.x && ty === this.sim.state.entrance.y) parts.push('Park gate');
      if (!isTileOwned(this.sim.state, tx, ty)) parts.push('not your land');
      else if (region.kind === 'public') parts.push('visitor area');
      else if (region.kind === 'paddock') {
        const n = regions.filter((r) => r.kind === 'paddock' && r.id <= region.id).length;
        const weakest = region.weakestFence ? FENCE_TYPES[region.weakestFence].name.toLowerCase() : 'none';
        parts.push(`Paddock ${n} · ${region.tiles.length} tiles · weakest fence: ${weakest}`);
      } else parts.push('not enclosed');
    }
    this.hud.showInfo(parts.join(' · '));
  }

  private selectParcel(wx: number, wy: number): void {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const { state } = this.sim;
    if (terrainAt(state.map, tx, ty) === undefined) return;
    const p = parcelOf(tx, ty);
    this.selectedParcel = p;
    this.layers.drawOverlay(true, p);

    const blocker = parcelBuyBlocker(state, p.x, p.y);
    if (blocker) {
      this.hud.showInfo(blocker);
      return;
    }
    const price = parcelPrice(state.map, p.x, p.y);
    this.hud.showInfo(`Plot · ${parcelLandTiles(state.map, p.x, p.y)} land tiles · ${formatMoney(price)}`, {
      label: 'Buy',
      onClick: () => {
        const r = this.sim.dispatch({ type: 'buyParcel', px: p.x, py: p.y });
        this.hud.toast(r.message, r.ok ? 'ok' : 'error');
        if (r.ok) {
          this.selectedParcel = null;
          this.hud.showHint();
        }
      },
    });
  }

  /** The fence edge nearest a world point, if the point is close enough to one. */
  private edgeNear(wx: number, wy: number): Edge | null {
    const fx = wx / TILE;
    const fy = wy / TILE;
    const dh = Math.abs(fy - Math.round(fy));
    const dv = Math.abs(fx - Math.round(fx));
    if (Math.min(dh, dv) > EDGE_PICK) return null;
    return dh <= dv ? { dir: 'h', x: Math.floor(fx), y: Math.round(fy) } : { dir: 'v', x: Math.round(fx), y: Math.floor(fy) };
  }

  // --- drag to build / remove ---

  private vertexAt(wx: number, wy: number): Point {
    const { width, height } = this.sim.state.map;
    return {
      x: Phaser.Math.Clamp(Math.round(wx / TILE), 0, width),
      y: Phaser.Math.Clamp(Math.round(wy / TILE), 0, height),
    };
  }

  private onDrawStart(wx: number, wy: number): void {
    this.drag = { start: this.vertexAt(wx, wy), startWorld: { x: wx, y: wy }, horizontalFirst: null, edges: [] };
  }

  private onDrawMove(wx: number, wy: number): void {
    const d = this.drag;
    if (!d) return;
    // The first clear direction of travel decides which leg of the L comes first.
    if (d.horizontalFirst === null) {
      const dx = wx - d.startWorld.x;
      const dy = wy - d.startWorld.y;
      if (Math.hypot(dx, dy) > TILE / 2) d.horizontalFirst = Math.abs(dx) >= Math.abs(dy);
    }
    const end = this.vertexAt(wx, wy);
    d.edges = pathEdges(d.start.x, d.start.y, end.x, end.y, d.horizontalFirst ?? true);
    this.previewEdges(d.edges);
  }

  private onDrawEnd(): void {
    const edges = this.drag?.edges ?? [];
    this.cancelDrag();
    if (edges.length > 0) this.commitEdges(edges);
  }

  private cancelDrag(): void {
    this.drag = null;
    this.layers.clearGhost();
    if (this.ui.mode === 'fence' || this.ui.mode === 'demolish') this.hud.showHint();
  }

  private previewEdges(edges: Edge[]): void {
    const { state } = this.sim;
    if (this.ui.mode === 'fence') {
      const fence = this.ui.fenceType;
      const plan = planFences(state, edges, fence);
      const building = new Set(plan.build);
      this.layers.drawGhost(
        edges.map((edge) => ({
          edge,
          style: building.has(edge) ? 'build' : fenceAt(state, edge) === fence ? 'none' : 'blocked',
        })),
      );
      const short = plan.cost > state.money ? ' · not enough money!' : '';
      this.hud.showInfo(`${plan.build.length} × ${FENCE_TYPES[fence].name} · ${formatMoney(plan.cost)}${short}`);
    } else {
      let refund = 0;
      let count = 0;
      this.layers.drawGhost(
        edges.map((edge) => {
          const f = fenceAt(state, edge);
          if (f) {
            refund += FENCE_TYPES[f].cost * FENCE_REFUND;
            count++;
          }
          return { edge, style: f ? 'remove' : 'none' };
        }),
      );
      this.hud.showInfo(`Remove ${count} segment${count === 1 ? '' : 's'} · +${formatMoney(Math.floor(refund))}`);
    }
  }

  private commitEdges(edges: Edge[]): void {
    const r =
      this.ui.mode === 'fence'
        ? this.sim.dispatch({ type: 'buildFences', edges, fence: this.ui.fenceType })
        : this.sim.dispatch({ type: 'removeFences', edges });
    this.hud.toast(r.message, r.ok ? 'ok' : 'error');
  }
}
