import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { planFences, planPaths, refillCost, repairCost } from '../sim/commands';
import { STAFF_TYPES } from '../sim/data/staff';
import { describeTask } from '../sim/systems/staff';
import { digChance, lockedSpecies } from '../sim/systems/fossils';
import { FENCE_REFUND, FENCE_TYPES } from '../sim/data/fences';
import { DINO_RESALE, FEEDER_TYPES } from '../sim/data/feeders';
import { SPECIES } from '../sim/data/species';
import { dinoLabel } from '../sim/systems/dinos';
import { fenceAt, fenceHp, fenceTypeAt } from '../sim/fences';
import { pathEdges, tileLine, type Edge } from '../sim/grid';
import { BUILDING_TYPES, PATH_COST, PATH_REFUND } from '../sim/data/economy';
import { isTileOwned, parcelBuyBlocker, parcelLandTiles, parcelOf, parcelPrice, type Point } from '../sim/land';
import { isLand, terrainAt, TERRAIN_NAMES } from '../sim/terrain';
import { isOccupiedPaddock } from '../sim/regions';
import type { Hud } from '../ui/hud';
import { formatMoney } from '../ui/hud';
import type { UiState } from '../ui/uiState';
import { createTextures, CURSOR_KEY, TILE, TILESET_KEY, tileIndex } from './tileset';
import { MAX_ZOOM, TouchController } from './input/TouchController';
import { WorldLayers } from './WorldLayers';
import { EntityLayer } from './EntityLayer';
import { TerrainFx } from './TerrainFx';
import { playSfx, type Sfx } from '../audio/audio';

/** How often (ms) the info panel refreshes while a dino or feeder is selected. */
const INFO_REFRESH_MS = 250;

/**
 * Screen pixels the HUD and toolbars can cover on each side. The camera may
 * scroll this far past the map edge, so every tile can be brought into the
 * clear, including the gate on the south beach under the toolbar.
 */
const UI_MARGIN = { top: 110, bottom: 230, left: 80, right: 80 };

/** How close (in tiles) a tap must be to an edge to pick that fence segment. */
const EDGE_PICK = 0.3;

interface Drag {
  start: Point;
  startWorld: Point;
  horizontalFirst: boolean | null;
  edges: Edge[];
  /** Path tool: start tile and the tile indices under the drag. */
  startTile: Point;
  tiles: number[];
}

export class ParkScene extends Phaser.Scene {
  private sim!: Simulation;
  private ui!: UiState;
  private hud!: Hud;
  private cursor!: Phaser.GameObjects.Image;
  private layers!: WorldLayers;
  private entities!: EntityLayer;
  private terrainFx!: TerrainFx;
  private infoRefreshAt = 0;
  private boundsZoom = 0;
  private drawnHour = -1;
  /** Fence segment being inspected in Look mode. */
  private selectedFence: Edge | null = null;
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
    this.terrainFx = new TerrainFx(this, map);

    this.layers = new WorldLayers(this, this.sim);
    this.entities = new EntityLayer(this, this.sim);
    this.cursor = this.add.image(0, 0, CURSOR_KEY).setOrigin(0).setVisible(false).setDepth(10);

    const worldW = map.width * TILE;
    const worldH = map.height * TILE;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1f4e79');
    cam.setRoundPixels(true);
    // Start zoomed in on the gate, where the player's land is.
    cam.setZoom(Phaser.Math.Clamp(Math.floor(Math.min(cam.width / worldW, cam.height / worldH) * 3), 2, MAX_ZOOM));
    this.fitBounds();
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

  update(time: number, delta: number): void {
    const cam = this.cameras.main;
    if (cam.zoom !== this.boundsZoom) this.fitBounds();
    this.sim.advance(delta);
    if (this.drawnRevision !== this.sim.worldRevision) this.redrawWorld();
    else if (this.drawnHour !== this.sim.state.hours) {
      // Fences wear hour by hour; redraw so damage shows up.
      this.drawnHour = this.sim.state.hours;
      this.layers.drawFences();
    }
    this.entities.update(time);
    this.terrainFx.update(time);
    if ((this.entities.selection || this.selectedFence) && time >= this.infoRefreshAt) {
      this.infoRefreshAt = time + INFO_REFRESH_MS;
      this.showSelection();
    }
  }

  /** Camera bounds: the map plus room (in screen pixels) to scroll edges out from under the UI. */
  private fitBounds(): void {
    const cam = this.cameras.main;
    const { width, height } = this.sim.state.map;
    const z = cam.zoom;
    this.boundsZoom = z;
    const left = UI_MARGIN.left / z + TILE;
    const right = UI_MARGIN.right / z + TILE;
    const top = UI_MARGIN.top / z + TILE;
    const bottom = UI_MARGIN.bottom / z + TILE;
    cam.setBounds(-left, -top, width * TILE + left + right, height * TILE + top + bottom);
  }

  private redrawWorld(): void {
    this.drawnRevision = this.sim.worldRevision;
    this.layers.drawFences();
    this.layers.drawPaths();
    this.layers.drawOverlay(this.ui.mode === 'land', this.selectedParcel);
  }

  private onModeChange(): void {
    const mode = this.ui.mode;
    this.touch.drawMode = mode === 'fence' || mode === 'demolish' || mode === 'path';
    this.cancelDrag();
    if (mode !== 'select') {
      this.cursor.setVisible(false);
      this.entities.selection = null;
      this.selectFence(null);
    }
    if (mode !== 'land') this.selectedParcel = null;
    this.redrawWorld();
  }

  // --- taps ---

  private onTap(wx: number, wy: number): void {
    switch (this.ui.mode) {
      case 'select':
        return this.inspect(wx, wy);
      case 'land':
        return this.selectParcel(wx, wy);
      case 'fence': {
        const edge = this.edgeNear(wx, wy);
        if (edge) this.commitEdges([edge]);
        return;
      }
      case 'demolish': {
        const edge = this.edgeNear(wx, wy);
        if (edge) return this.commitEdges([edge]);
        const tx = Math.floor(wx / TILE);
        const ty = Math.floor(wy / TILE);
        const building = this.entities.buildingAt(tx, ty);
        if (building) return this.report(this.sim.dispatch({ type: 'removeBuilding', id: building.id }));
        const feeder = this.entities.feederAt(tx, ty);
        if (feeder) this.report(this.sim.dispatch({ type: 'removeFeeder', id: feeder.id }));
        return;
      }
      case 'path':
        return this.commitTiles([Math.floor(wy / TILE) * this.sim.state.map.width + Math.floor(wx / TILE)]);
      case 'building':
        this.report(
          this.sim.dispatch({ type: 'placeBuilding', kind: this.ui.buildingKind, x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) }),
        );
        return;
      case 'feeder':
        this.report(
          this.sim.dispatch({ type: 'placeFeeder', kind: this.ui.feederKind, x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) }),
        );
        return;
      case 'place-dino':
        return this.releaseDino(wx, wy);
    }
  }

  private report(r: { ok: boolean; message: string }, sound: Sfx = 'build'): void {
    this.hud.toast(r.message, r.ok ? 'ok' : 'error');
    playSfx(r.ok ? sound : 'error');
  }

  private releaseDino(wx: number, wy: number): void {
    const species = this.ui.placing;
    if (!species) return;
    const x = Math.floor(wx / TILE);
    const y = Math.floor(wy / TILE);
    const r = this.sim.dispatch({ type: 'buyDino', species, x, y });
    this.report(r, 'roar');
    if (!r.ok) return;
    const sp = SPECIES[species];
    const { regions, tileRegion } = this.sim.regions();
    const weakest = regions[tileRegion[y * this.sim.state.map.width + x]].weakestFence;
    if (weakest !== 0 && weakest < sp.fenceNeeded) {
      this.hud.toast(`Careful: ${sp.name} needs ${FENCE_TYPES[sp.fenceNeeded].name.toLowerCase()} fences or stronger`, 'error');
    }
    if (!this.sim.state.feeders.some((f) => FEEDER_TYPES[f.kind].diet === sp.diet)) {
      this.hud.toast(`Tip: build a ${sp.diet === 'carnivore' ? 'meat' : 'plant'} feeder so it can eat`);
    }
    this.ui.setMode('select');
    this.entities.selection = { kind: 'dino', id: this.sim.state.dinos[this.sim.state.dinos.length - 1].id };
    this.showSelection();
  }

  /** Look mode: a dino under the finger wins, then a visitor, building or feeder, then the tile itself. */
  private inspect(wx: number, wy: number): void {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    this.selectFence(null);
    const dino = this.entities.dinoAt(wx, wy);
    const staff = dino ? null : this.entities.staffAt(wx, wy);
    const visitor = dino || staff ? null : this.entities.visitorAt(wx, wy);
    const building = dino || staff || visitor ? undefined : this.entities.buildingAt(tx, ty);
    const feeder = dino || staff || visitor || building ? undefined : this.entities.feederAt(tx, ty);
    const selection = dino
      ? ({ kind: 'dino', id: dino.id } as const)
      : staff
        ? ({ kind: 'staff', id: staff.id } as const)
        : visitor
          ? ({ kind: 'visitor', id: visitor.id } as const)
          : building
            ? ({ kind: 'building', id: building.id } as const)
            : feeder
              ? ({ kind: 'feeder', id: feeder.id } as const)
              : null;
    if (!selection) {
      const edge = this.edgeNear(wx, wy);
      if (edge && fenceTypeAt(this.sim.state, edge)) {
        this.cursor.setVisible(false);
        this.entities.selection = null;
        this.selectFence(edge);
        return;
      }
    }
    if (selection) {
      this.cursor.setVisible(false);
      this.entities.selection = selection;
      this.showSelection();
      return;
    }
    this.entities.selection = null;
    this.inspectTile(wx, wy);
  }

  /** Highlights a fence segment for Look mode (or clears it). */
  private selectFence(edge: Edge | null): void {
    this.selectedFence = edge;
    if (edge) {
      this.layers.drawGhost([{ edge, style: 'none' }]);
      this.showSelection();
    } else if (!this.drag) this.layers.clearGhost();
  }

  private showFence(edge: Edge): void {
    const { state } = this.sim;
    const type = fenceTypeAt(state, edge);
    if (!type) {
      this.selectFence(null);
      this.hud.showInfo(null);
      return;
    }
    const hp = Math.round(fenceHp(state, edge));
    const cond = hp <= 0 ? 'BROKEN' : hp < 25 ? 'about to give way' : hp < 50 ? 'worn' : hp < 80 ? 'fair' : 'good';
    const cost = repairCost(state, edge);
    this.hud.showInfo(
      `${FENCE_TYPES[type].name} fence · condition ${hp}% (${cond})`,
      cost > 0
        ? { label: `Repair ${formatMoney(cost)}`, onClick: () => this.report(this.sim.dispatch({ type: 'repairFence', edge })) }
        : undefined,
    );
  }

  private showSelection(): void {
    if (this.selectedFence) return this.showFence(this.selectedFence);
    const sel = this.entities.selection;
    if (!sel) return;
    const { state } = this.sim;
    if (sel.kind === 'dino') {
      const d = state.dinos.find((d) => d.id === sel.id);
      if (!d) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const sp = SPECIES[d.species];
      const { regions, tileRegion } = this.sim.regions();
      const loose = regions[tileRegion[d.y * state.map.width + d.x]]?.kind !== 'paddock';
      const status = [loose ? 'ESCAPED!' : '', d.sick ? 'SICK' : ''].filter(Boolean).join(' · ');
      const value = Math.floor(sp.price * DINO_RESALE);
      this.hud.showInfo(
        `${dinoLabel(d)}${status ? ` · ${status}` : ''} · Hunger ${Math.round(d.hunger)}% · Health ${Math.round(d.health)}% · Happy ${d.happiness}%`,
        { label: `Sell ${formatMoney(value)}`, onClick: () => this.report(this.sim.dispatch({ type: 'sellDino', id: d.id })) },
      );
    } else if (sel.kind === 'staff') {
      const m = state.staff.find((m) => m.id === sel.id);
      if (!m) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const t = STAFF_TYPES[m.role];
      this.hud.showInfo(`${m.name} · ${t.name} · ${describeTask(state, m)} · ${formatMoney(t.wage)}/day`);
    } else if (sel.kind === 'visitor') {
      const v = state.visitors.find((v) => v.id === sel.id);
      if (!v) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const mood = v.satisfaction >= 70 ? 'Loving it' : v.satisfaction >= 50 ? 'Enjoying it' : v.satisfaction >= 30 ? 'Bored' : 'Unhappy';
      this.hud.showInfo(
        `Visitor · ${mood} (${Math.round(v.satisfaction)}%) · Hunger ${Math.round(v.hunger)}% · Seen ${v.seen.length} dino${v.seen.length === 1 ? '' : 's'}`,
      );
    } else if (sel.kind === 'building') {
      const b = state.buildings.find((b) => b.id === sel.id);
      if (!b) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const t = BUILDING_TYPES[b.kind];
      if (b.kind === 'digsite') {
        const chance = Math.round(digChance(state, b.x, b.y) * 100);
        const left = lockedSpecies(state).length;
        const note = left > 0 ? `${left} species still to unlock` : 'everything unlocked: finds go to museums';
        this.hud.showInfo(`${t.name} · ${chance}% chance of a find each night · ${note} · upkeep ${formatMoney(t.upkeep)}/day`);
        return;
      }
      const sold = b.kind === 'restaurant' ? state.finance.today.income.food : state.finance.today.income.souvenirs;
      this.hud.showInfo(`${t.name} · sells at ${formatMoney(t.salePrice)} · takings today ${formatMoney(sold)} · upkeep ${formatMoney(t.upkeep)}/day`);
    } else {
      const f = state.feeders.find((f) => f.id === sel.id);
      if (!f) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const type = FEEDER_TYPES[f.kind];
      const cost = refillCost(state, f.id);
      this.hud.showInfo(
        `${type.name} · ${f.stock}/${type.capacity} food`,
        cost > 0 ? { label: `Refill ${formatMoney(cost)}`, onClick: () => this.report(this.sim.dispatch({ type: 'refillFeeder', id: f.id })) } : undefined,
      );
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
      else if (region.kind === 'paddock' && !isOccupiedPaddock(this.sim.state, { regions, tileRegion }, ty * this.sim.state.map.width + tx)) {
        parts.push(`Enclosed area · ${region.tiles.length} tiles · no animals or feeders yet, so paths and buildings are fine`);
      } else if (region.kind === 'paddock') {
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

  private tileAt(wx: number, wy: number): Point {
    const { width, height } = this.sim.state.map;
    return {
      x: Phaser.Math.Clamp(Math.floor(wx / TILE), 0, width - 1),
      y: Phaser.Math.Clamp(Math.floor(wy / TILE), 0, height - 1),
    };
  }

  private onDrawStart(wx: number, wy: number): void {
    this.drag = {
      start: this.vertexAt(wx, wy),
      startWorld: { x: wx, y: wy },
      horizontalFirst: null,
      edges: [],
      startTile: this.tileAt(wx, wy),
      tiles: [],
    };
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
    if (this.ui.mode === 'path') {
      const end = this.tileAt(wx, wy);
      const w = this.sim.state.map.width;
      d.tiles = tileLine(d.startTile.x, d.startTile.y, end.x, end.y, d.horizontalFirst ?? true).map(([x, y]) => y * w + x);
      this.previewTiles(d.tiles);
      return;
    }
    const end = this.vertexAt(wx, wy);
    d.edges = pathEdges(d.start.x, d.start.y, end.x, end.y, d.horizontalFirst ?? true);
    this.previewEdges(d.edges);
  }

  private onDrawEnd(): void {
    const edges = this.drag?.edges ?? [];
    const tiles = this.drag?.tiles ?? [];
    this.cancelDrag();
    if (this.ui.mode === 'path') {
      if (tiles.length > 0) this.commitTiles(tiles);
    } else if (edges.length > 0) this.commitEdges(edges);
  }

  private cancelDrag(): void {
    this.drag = null;
    this.layers.clearGhost();
    if (this.ui.mode === 'fence' || this.ui.mode === 'demolish' || this.ui.mode === 'path') this.hud.showHint();
  }

  private previewTiles(tiles: number[]): void {
    const { state } = this.sim;
    const w = state.map.width;
    const at = (i: number) => ({ x: i % w, y: Math.floor(i / w) });
    if (this.ui.pathErase) {
      const count = tiles.filter((i) => state.paths[i]).length;
      this.layers.drawTileGhost(tiles.map((i) => ({ ...at(i), style: state.paths[i] ? 'remove' : 'none' })));
      this.hud.showInfo(`Remove ${count} path tile${count === 1 ? '' : 's'} · +${formatMoney(Math.floor(count * PATH_COST * PATH_REFUND))}`);
      return;
    }
    const plan = planPaths(state, tiles);
    const building = new Set(plan.build);
    this.layers.drawTileGhost(tiles.map((i) => ({ ...at(i), style: building.has(i) ? 'build' : state.paths[i] ? 'none' : 'blocked' })));
    const short = plan.cost > state.money ? ' · not enough money!' : '';
    const why = plan.blocked ? ` · red: ${plan.blockReason.toLowerCase()}` : '';
    this.hud.showInfo(`${plan.build.length} path tile${plan.build.length === 1 ? '' : 's'} · ${formatMoney(plan.cost)}${short}${why}`);
  }

  private commitTiles(tiles: number[]): void {
    this.report(
      this.ui.pathErase ? this.sim.dispatch({ type: 'removePaths', tiles }) : this.sim.dispatch({ type: 'buildPaths', tiles }),
    );
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
    this.report(r);
  }
}
