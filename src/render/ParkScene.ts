import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { planFences, planPaths, planTracks, pondDigBlocker, POND_COST, refillCost, repairCost } from '../sim/commands';
import { stationStatus } from '../sim/systems/rides';
import { STAFF_TYPES } from '../sim/data/staff';
import { describeTask } from '../sim/systems/staff';
import { digChance, lockedSpecies } from '../sim/systems/fossils';
import { FENCE_REFUND, FENCE_TYPES, strongEnough } from '../sim/data/fences';
import { DINO_RESALE, FEEDER_TYPES } from '../sim/data/feeders';
import { habitatOf, SPECIES, type SpeciesId } from '../sim/data/species';
import { findFenceGaps, gapCost } from '../sim/gaps';
import { dinoLabel } from '../sim/systems/dinos';
import { hoursToGrow, hoursToHatch } from '../sim/systems/breeding';
import { SNACK_NAMES } from '../sim/systems/visitors';
import { fenceAt, fenceHp, fenceTypeAt } from '../sim/fences';
import { pathEdges, tileLine, type Edge } from '../sim/grid';
import { BUILDING_TYPES, PATH_COST, PATH_REFUND, SOUVENIRS, TRACK_COST } from '../sim/data/economy';
import { isTileOwned, parcelBuyBlocker, parcelLandTiles, parcelOf, parcelPrice, type Point } from '../sim/land';
import { isLand, Terrain, terrainAt, TERRAIN_NAMES } from '../sim/terrain';
import { bedAt, RICHNESS_LABEL } from '../sim/fossilBeds';
import { DECOR_TYPES } from '../sim/data/decor';
import { isOccupiedPaddock } from '../sim/regions';
import type { Hud, InfoAction } from '../ui/hud';
import { framePhoto, showPhoto } from '../ui/photo';
import { TREAT_COST } from '../sim/systems/care';
import { calendar } from '../sim/GameState';
import { formatMoney } from '../ui/hud';
import type { UiState } from '../ui/uiState';
import { createTextures, CURSOR_KEY, TILE, TILESET_KEY, tileIndex } from './tileset';
import { MAX_ZOOM, TouchController } from './input/TouchController';
import { WorldLayers, type GhostStyle } from './WorldLayers';
import { EntityLayer } from './EntityLayer';
import { TerrainFx } from './TerrainFx';
import { SceneryLayer } from './SceneryLayer';
import { playCall, playSfx, type Sfx } from '../audio/audio';

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
  private scenery!: SceneryLayer;
  private infoRefreshAt = 0;
  private boundsZoom = 0;
  private drawnHour = -1;
  /** Fence segment being inspected in Look mode. */
  private selectedFence: Edge | null = null;
  private touch!: TouchController;
  private drawnRevision = -1;
  private drag: Drag | null = null;
  /** The terrain tile layer, and the terrain it was last drawn with (ponds get dug and filled). */
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private drawnTerrain!: Uint8Array;
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
    this.ground = tilemap.createLayer(0, tileset, 0, 0)!;
    this.drawnTerrain = Uint8Array.from(map.tiles);
    this.terrainFx = new TerrainFx(this, map);
    this.scenery = new SceneryLayer(this, this.sim);

    this.layers = new WorldLayers(this, this.sim);
    this.entities = new EntityLayer(this, this.sim);
    this.cursor = this.add.image(0, 0, CURSOR_KEY).setOrigin(0).setVisible(false).setDepth(10);

    const worldW = map.width * TILE;
    const worldH = map.height * TILE;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1e5a96');
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

    // The ground shakes when the volcano rumbles.
    const offEvents = this.sim.onEvent((e) => {
      if (/^🌋/.test(e.text)) this.cameras.main.shake(600, 0.006);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offEvents);
    const unsubscribe = this.ui.onChange(() => this.onModeChange());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.onModeChange();
  }

  update(time: number, delta: number): void {
    this.animalSounds(time);
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
    this.scenery.update(time);
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
    this.syncTerrain();
    this.layers.drawFences();
    this.layers.drawPaths();
    this.scenery?.refresh();
    this.layers.drawOverlay(this.ui.mode === 'land', this.selectedParcel);
  }

  /** Now and then, a splash from a lagoon or a flap from an aviary that's on screen. */
  private nextAnimalSound = 0;
  private animalSounds(time: number): void {
    if (time < this.nextAnimalSound || this.sim.speed === 0) return;
    this.nextAnimalSound = time + 3000 + Math.random() * 4000;
    const view = this.cameras.main.worldView;
    const onScreen = this.sim.state.dinos.filter((d) => view.contains(d.x * TILE + TILE / 2, d.y * TILE + TILE / 2) && habitatOf(d.species) !== 'land');
    const d = onScreen[Math.floor(Math.random() * onScreen.length)];
    if (d) playSfx(habitatOf(d.species) === 'water' ? 'splash' : 'flap');
  }

  /** Updates any map tiles whose terrain changed (a pond dug or filled in). */
  private syncTerrain(): void {
    const { tiles, width } = this.sim.state.map;
    let changed = false;
    for (let i = 0; i < tiles.length; i++) {
      if (this.drawnTerrain[i] === tiles[i]) continue;
      this.drawnTerrain[i] = tiles[i];
      const x = i % width;
      const y = Math.floor(i / width);
      this.ground.putTileAt(tileIndex(tiles[i], x, y), x, y);
      changed = true;
    }
    if (changed) this.terrainFx.rebuild();
  }

  /** Garden tool with Pond picked: tap or drag to dig. */
  private get digging(): boolean {
    return this.ui.mode === 'decor' && this.ui.decorKind === 'pond';
  }

  private onModeChange(): void {
    const mode = this.ui.mode;
    this.touch.drawMode = mode === 'fence' || mode === 'demolish' || mode === 'path' || this.digging;
    this.cancelDrag();
    if (mode !== 'select') {
      this.cursor.setVisible(false);
      this.entities.selection = null;
      this.selectFence(null);
    }
    if (mode !== 'land') this.selectedParcel = null;
    this.redrawWorld();
    if (this.ui.focusTarget) {
      const target = this.ui.focusTarget;
      this.ui.focusTarget = null;
      this.focusOn(target);
    }
  }

  /** Glide the camera to someone and select them (from the People panel's 📍 button). */
  private focusOn(target: { kind: 'visitor' | 'dino' | 'staff' | 'egg'; id: number }): void {
    const { state } = this.sim;
    const find = <T extends { id: number }>(list: T[]) => list.find((e) => e.id === target.id);
    const v = target.kind === 'visitor' ? find(state.visitors) : undefined;
    const d = target.kind === 'dino' ? find(state.dinos) : undefined;
    const m = target.kind === 'staff' ? find(state.staff) : undefined;
    const egg = target.kind === 'egg' ? find(state.eggs) : undefined;
    const pos = v
      ? this.entities.visitorPosition(v)
      : d
        ? this.entities.dinoPosition(d)
        : m
          ? this.entities.staffPosition(m)
          : egg
            ? { x: egg.x * TILE + TILE / 2, y: egg.y * TILE + TILE - 3 }
            : null;
    if (!pos) return;
    const cam = this.cameras.main;
    if (cam.zoom < 2) cam.setZoom(2);
    cam.pan(pos.x, pos.y - 8, 450, 'Sine.easeInOut');
    this.selectFence(null);
    this.cursor.setVisible(false);
    this.entities.selection = { kind: target.kind, id: target.id };
    this.showSelection();
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
        if (feeder) return this.report(this.sim.dispatch({ type: 'removeFeeder', id: feeder.id }));
        const decor = this.sim.state.decor.find((d) => d.x === tx && d.y === ty);
        if (decor) return this.report(this.sim.dispatch({ type: 'removeDecor', id: decor.id }));
        const w = this.sim.state.map.width;
        if (this.sim.state.paths[ty * w + tx]) return this.report(this.sim.dispatch({ type: 'removePaths', tiles: [ty * w + tx] }));
        if (this.sim.state.tracks[ty * w + tx]) return this.report(this.sim.dispatch({ type: 'removeTracks', tiles: [ty * w + tx] }));
        if (this.sim.state.map.tiles[ty * w + tx] === Terrain.Pond) this.report(this.sim.dispatch({ type: 'fillPonds', tiles: [ty * w + tx] }));
        return;
      }
      case 'decor': {
        const x = Math.floor(wx / TILE);
        const y = Math.floor(wy / TILE);
        if (this.ui.decorKind === 'pond') return this.report(this.sim.dispatch({ type: 'digPonds', tiles: [y * this.sim.state.map.width + x] }));
        this.report(this.sim.dispatch({ type: 'placeDecor', kind: this.ui.decorKind, x, y }));
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

  /** Treat or pat a dino, and show how it took it. */
  private care(id: number, type: 'treatDino' | 'patDino'): void {
    const r = this.sim.dispatch({ type, id });
    if (!r.ok) return this.report(r);
    this.hud.toast(r.message, r.effect === 'snap' ? 'error' : 'ok');
    if (r.effect) {
      this.entities.careEffect(id, r.effect);
      playSfx(r.effect === 'snap' ? 'snap' : 'chirp');
    }
    this.showSelection();
  }

  /**
   * Snap the patch of park around a dino (without the selection ring), frame
   * it like an instant-camera print and offer to save it.
   */
  private takePhoto(id: number): void {
    const d = this.sim.state.dinos.find((x) => x.id === id);
    const img = this.entities.dinoSprite(id);
    if (!d || !img) return;
    const cam = this.cameras.main;
    const canvas = this.game.canvas;
    const ratio = canvas.width / canvas.clientWidth;
    // Frame the animal with some of its surroundings: 4:3, at least 200 screen px wide.
    const spriteW = img.width * cam.zoom;
    const spriteH = img.height * cam.zoom;
    const w = Math.min(canvas.clientWidth, Math.max(200, spriteW * 1.8, spriteH * 2.2));
    const h = Math.min(canvas.clientHeight, w * 0.75);
    const cx = (img.x - cam.worldView.x) * cam.zoom;
    const cy = (img.y - img.height / 2 - cam.worldView.y) * cam.zoom;
    const x = Math.max(0, Math.min(canvas.clientWidth - w, cx - w / 2));
    const y = Math.max(0, Math.min(canvas.clientHeight - h, cy - h / 2));
    const selection = this.entities.selection;
    this.entities.selection = null; // no yellow ring in the picture
    playSfx('shutter');
    this.game.renderer.snapshotArea(Math.round(x * ratio), Math.round(y * ratio), Math.round(w * ratio), Math.round(h * ratio), async (shot) => {
      this.entities.selection = selection;
      this.sim.dispatch({ type: 'photoDino', id });
      const { day } = calendar(this.sim.state);
      const photo = await framePhoto(shot as HTMLImageElement, dinoLabel(d), `Day ${day} · Dino Tycoon`);
      showPhoto(photo, `${d.name} the ${SPECIES[d.species].name}`);
    });
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
    if (!r.ok && this.offerGapFix(species, x, y)) return;
    this.report(r, 'build');
    if (!r.ok) return;
    this.afterRelease(species, x, y);
  }

  /**
   * The tap was in a fenced box that isn't closed: show the holes in red and
   * offer to fence (or repair) them and release the dinosaur in one go.
   */
  private offerGapFix(species: SpeciesId, x: number, y: number): boolean {
    const { state } = this.sim;
    const gaps = findFenceGaps(state, x, y);
    if (!gaps) return false;
    playSfx('error');
    const holes = [...gaps.missing, ...gaps.broken];
    this.layers.drawGaps(holes);
    // Bring the gap into view if it's off-screen (or hidden under the info panel).
    const cam = this.cameras.main;
    const view = cam.worldView;
    const gx = holes[0].x * TILE;
    const gy = holes[0].y * TILE;
    if (gx < view.x + view.width * 0.15 || gx > view.right - view.width * 0.15 || gy < view.y + view.height * 0.2 || gy > view.bottom - view.height * 0.35) {
      cam.pan(gx, gy + view.height * 0.1, 400, 'Sine.easeInOut');
    }
    const parts = [
      gaps.missing.length ? `${gaps.missing.length} missing` : '',
      gaps.broken.length ? `${gaps.broken.length} broken` : '',
    ].filter(Boolean);
    const segs = gaps.missing.length + gaps.broken.length === 1 ? 'segment' : 'segments';
    if (gaps.blocker) {
      this.hud.showInfo(`This paddock has a gap (${parts.join(' and ')} fence ${segs}, in red) that can't be fenced: ${gaps.blocker.toLowerCase()}`);
      return true;
    }
    const sp = SPECIES[species];
    const cost = gapCost(gaps, (e) => repairCost(state, e));
    this.hud.showInfo(`Gap in the fence (${parts.join(', ')}, circled in red). Close it to let your ${sp.name} in.`, {
      label: `Close gap · ${formatMoney(cost)}`,
      onClick: () => {
        if (gaps.missing.length) {
          const built = this.sim.dispatch({ type: 'buildFences', edges: gaps.missing, fence: gaps.fence });
          if (!built.ok) return this.report(built);
        }
        for (const edge of gaps.broken) this.sim.dispatch({ type: 'repairFence', edge });
        this.layers.clearGhost();
        const r = this.sim.dispatch({ type: 'buyDino', species, x, y });
        this.report(r, 'build');
        if (r.ok) this.afterRelease(species, x, y);
      },
    });
    return true;
  }

  private afterRelease(species: SpeciesId, x: number, y: number): void {
    playCall(species);
    const sp = SPECIES[species];
    const { regions, tileRegion } = this.sim.regions();
    const weakest = regions[tileRegion[y * this.sim.state.map.width + x]]?.weakestFence ?? 0;
    if (weakest !== 0 && !strongEnough(weakest, sp.fenceNeeded)) {
      this.hud.toast(`Careful: ${sp.name} needs ${FENCE_TYPES[sp.fenceNeeded].name.toLowerCase()} fences or stronger`, 'error');
    }
    if (!this.sim.state.feeders.some((f) => FEEDER_TYPES[f.kind].diet === sp.diet)) {
      this.hud.toast(`Tip: build a ${sp.diet === 'carnivore' ? 'meat' : sp.diet === 'piscivore' ? 'fish' : 'plant'} feeder so it can eat`);
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
    const egg = dino || staff || visitor ? undefined : this.sim.state.eggs.find((e) => e.x === tx && e.y === ty);
    const building = dino || staff || visitor || egg ? undefined : this.entities.buildingAt(tx, ty);
    const feeder = dino || staff || visitor || building ? undefined : this.entities.feederAt(tx, ty);
    const selection = dino
      ? ({ kind: 'dino', id: dino.id } as const)
      : staff
        ? ({ kind: 'staff', id: staff.id } as const)
        : egg
          ? ({ kind: 'egg', id: egg.id } as const)
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
      if (dino) playCall(dino.species, dino.baby);
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
      const stats = `Hunger ${Math.round(d.hunger)}% · Health ${Math.round(d.health)}% · Happy ${d.happiness}%`;
      const fed = state.hours - d.lastTreatHour < 1;
      const care: InfoAction[] = [
        {
          label: '🍖',
          title: fed ? `${d.name} just had a treat` : `Give ${d.name} a treat (${formatMoney(TREAT_COST)})`,
          small: true,
          disabled: d.escaped || fed || state.money < TREAT_COST,
          onClick: () => this.care(d.id, 'treatDino'),
        },
        { label: '✋', title: `Pat ${d.name}`, small: true, disabled: d.escaped, onClick: () => this.care(d.id, 'patDino') },
        { label: '📷', title: `Take a photo of ${d.name}`, small: true, onClick: () => this.takePhoto(d.id) },
      ];
      if (d.baby) {
        const days = Math.ceil(hoursToGrow(state, d) / 24);
        this.hud.showInfo(`${dinoLabel(d)}${status ? ` · ${status}` : ''} · grows up in ${days} day${days === 1 ? '' : 's'} · ${stats}`, care);
        return;
      }
      this.hud.showInfo(`${dinoLabel(d)}${status ? ` · ${status}` : ''} · ${stats}`, [
        ...care,
        { label: `Sell ${formatMoney(value)}`, onClick: () => this.report(this.sim.dispatch({ type: 'sellDino', id: d.id })) },
      ]);
    } else if (sel.kind === 'egg') {
      const egg = state.eggs.find((e) => e.id === sel.id);
      if (!egg) {
        this.entities.selection = null;
        this.hud.showInfo(null);
        return;
      }
      const h = hoursToHatch(state, egg.laidHour);
      const when = h <= 1 ? 'hatching any minute now!' : h < 24 ? `hatches in about ${h} hours` : `hatches in about ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`;
      this.hud.showInfo(`🥚 ${SPECIES[egg.species].name} egg · ${when}`);
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
      const carrying = [
        ...v.items.map((i) => SOUVENIRS[i].name),
        ...(v.snack ? [SNACK_NAMES[v.snack]] : []),
        ...(v.sodaUntil > 0 ? ['a soda'] : []),
      ];
      const needs = [v.bladder >= 70 ? 'needs a restroom' : '', v.hunger >= 60 ? 'hungry' : '', v.thirst >= 60 ? 'thirsty' : ''].filter(Boolean);
      const thought = v.thoughts[v.thoughts.length - 1];
      this.hud.showInfo(
        [
          `${v.name}${v.kid ? ' (kid)' : ''} · ${mood} (${Math.round(v.satisfaction)}%)`,
          thought ? `“${thought.text}”` : '',
          `seen ${v.seen.length} dino${v.seen.length === 1 ? '' : 's'}`,
          carrying.length ? `carrying ${carrying.join(', ')}` : '',
          needs.join(', '),
        ]
          .filter(Boolean)
          .join(' · '),
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
      if (b.kind === 'station') {
        this.hud.showInfo(`${t.name} · ${formatMoney(t.salePrice)} a ride · ${stationStatus(state, b)} · ride takings today ${formatMoney(state.finance.today.income.rides)} · upkeep ${formatMoney(t.upkeep)}/day`);
        return;
      }
      if (b.kind === 'tower' || b.kind === 'petting') {
        const closed = b.kind === 'petting' && !state.staff.some((m) => m.role === 'worker');
        const what = b.kind === 'tower' ? 'visitors climb up to spot dinosaurs up to 8 tiles away' : 'little dinos to pat (kids love it)';
        this.hud.showInfo(`${t.name} · ${formatMoney(t.salePrice)} a go · ${closed ? 'CLOSED: hire a worker to be its keeper' : what} · upkeep ${formatMoney(t.upkeep)}/day`);
        return;
      }
      if (b.kind === 'trashcan') {
        this.hud.showInfo(`${t.name} · visitors within 3 tiles bin their rubbish instead of dropping it · upkeep ${formatMoney(t.upkeep)}/day`);
        return;
      }
      if (b.kind === 'restroom') {
        const waiting = state.visitors.filter((v) => v.bladder >= 70).length;
        this.hud.showInfo(`${t.name} · free for visitors · ${waiting} visitor${waiting === 1 ? '' : 's'} looking for one right now · upkeep ${formatMoney(t.upkeep)}/day`);
        return;
      }
      const income = state.finance.today.income;
      const sold = b.kind === 'restaurant' ? income.food : b.kind === 'snackstall' ? income.snacks : income.souvenirs;
      const what = b.kind === 'giftshop' ? 'plushes, caps, balloons, ponchos and umbrellas' : `snacks and sodas at ${formatMoney(t.salePrice)}`;
      this.hud.showInfo(
        `${t.name} · ${b.kind === 'restaurant' ? `meals at ${formatMoney(t.salePrice)}` : what} · takings today ${formatMoney(sold)} · upkeep ${formatMoney(t.upkeep)}/day`,
      );
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
    const bed = bedAt(this.sim.state.fossilBeds, tx, ty);
    if (bed) parts.push(`fossil bed (${RICHNESS_LABEL[bed.richness]}${bed.richness === 3 ? ': rare species more likely' : ''})`);
    const decor = this.sim.state.decor.find((d) => d.x === tx && d.y === ty);
    if (decor) parts.push(`${DECOR_TYPES[decor.kind].name}: cheers up visitors nearby`);
    if (t === Terrain.Volcano) parts.push(this.sim.state.volcanoActivity > 0 ? 'rumbling!' : 'smoking quietly');
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
    if (this.ui.mode === 'path' || this.ui.mode === 'demolish' || this.digging) {
      const end = this.tileAt(wx, wy);
      const w = this.sim.state.map.width;
      d.tiles = tileLine(d.startTile.x, d.startTile.y, end.x, end.y, d.horizontalFirst ?? true).map(([x, y]) => y * w + x);
      if (this.ui.mode === 'path') {
        this.previewTiles(d.tiles);
        return;
      }
      if (this.digging) {
        const ok = d.tiles.filter((i) => !pondDigBlocker(this.sim.state, i % w, Math.floor(i / w)));
        this.layers.drawTileGhost(d.tiles.map((i) => ({ x: i % w, y: Math.floor(i / w), style: ok.includes(i) ? 'build' : 'blocked' })));
        this.hud.showInfo(`Dig ${ok.length} tile${ok.length === 1 ? '' : 's'} of pond · ${formatMoney(ok.length * POND_COST)}`);
        return;
      }
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
    } else if (this.digging) {
      if (tiles.length > 0) this.report(this.sim.dispatch({ type: 'digPonds', tiles }));
    } else if (this.ui.mode === 'demolish') {
      this.commitDemolish(edges, tiles);
    } else if (edges.length > 0) this.commitEdges(edges);
  }

  /** Remove tool drag: fences along the line and any path tiles under it. */
  private commitDemolish(edges: Edge[], tiles: number[]): void {
    const pathTiles = tiles.filter((i) => this.sim.state.paths[i]);
    const pondTiles = tiles.filter((i) => this.sim.state.map.tiles[i] === Terrain.Pond);
    const trackTiles = tiles.filter((i) => this.sim.state.tracks[i]);
    const hasFence = edges.some((e) => fenceTypeAt(this.sim.state, e));
    if (!hasFence && pathTiles.length === 0 && pondTiles.length === 0 && trackTiles.length === 0) return this.report({ ok: false, message: 'Nothing to remove there' });
    const results = [];
    if (hasFence) results.push(this.sim.dispatch({ type: 'removeFences', edges }));
    if (pathTiles.length) results.push(this.sim.dispatch({ type: 'removePaths', tiles: pathTiles }));
    if (pondTiles.length) results.push(this.sim.dispatch({ type: 'fillPonds', tiles: pondTiles }));
    if (trackTiles.length) results.push(this.sim.dispatch({ type: 'removeTracks', tiles: trackTiles }));
    const ok = results.filter((r) => r.ok);
    this.report(ok.length ? { ok: true, message: ok.map((r) => r.message).join(' · ') } : results[0]);
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
    const layer = this.ui.pathTrack ? state.tracks : state.paths;
    const noun = this.ui.pathTrack ? 'track' : 'path';
    const cost = this.ui.pathTrack ? TRACK_COST : PATH_COST;
    if (this.ui.pathErase) {
      const count = tiles.filter((i) => layer[i]).length;
      this.layers.drawTileGhost(tiles.map((i) => ({ ...at(i), style: layer[i] ? 'remove' : 'none' })));
      this.hud.showInfo(`Remove ${count} ${noun} tile${count === 1 ? '' : 's'} · +${formatMoney(Math.floor(count * cost * PATH_REFUND))}`);
      return;
    }
    const plan = this.ui.pathTrack ? planTracks(state, tiles) : planPaths(state, tiles);
    const building = new Set(plan.build);
    this.layers.drawTileGhost(tiles.map((i) => ({ ...at(i), style: building.has(i) ? 'build' : layer[i] ? 'none' : 'blocked' })));
    const short = plan.cost > state.money ? ' · not enough money!' : '';
    const why = plan.blocked ? ` · red: ${plan.blockReason.toLowerCase()}` : '';
    this.hud.showInfo(`${plan.build.length} ${noun} tile${plan.build.length === 1 ? '' : 's'} · ${formatMoney(plan.cost)}${short}${why}`);
  }

  private commitTiles(tiles: number[]): void {
    const track = this.ui.pathTrack;
    this.report(
      this.ui.pathErase
        ? this.sim.dispatch({ type: track ? 'removeTracks' : 'removePaths', tiles })
        : this.sim.dispatch({ type: track ? 'buildTracks' : 'buildPaths', tiles }),
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
      const ghost = edges.map((edge) => {
        const f = fenceTypeAt(state, edge);
        if (f) {
          refund += FENCE_TYPES[f].cost * FENCE_REFUND;
          count++;
        }
        return { edge, style: (f ? 'remove' : 'none') as GhostStyle };
      });
      const w = state.map.width;
      const pathTiles = (this.drag?.tiles ?? []).filter((i) => state.paths[i]);
      refund += pathTiles.length * PATH_COST * PATH_REFUND;
      this.layers.drawGhost(ghost, pathTiles.map((i) => ({ x: i % w, y: Math.floor(i / w), style: 'remove' as GhostStyle })));
      const parts = [
        count ? `${count} fence segment${count === 1 ? '' : 's'}` : '',
        pathTiles.length ? `${pathTiles.length} path tile${pathTiles.length === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      this.hud.showInfo(parts.length ? `Remove ${parts.join(' and ')} · +${formatMoney(Math.floor(refund))}` : 'Nothing to remove along this line');
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
