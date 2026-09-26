import Phaser from 'phaser';
import type { Dino, Feeder } from '../sim/GameState';
import type { Simulation } from '../sim/Simulation';
import { FEEDER_TYPES, type FeederKind } from '../sim/data/feeders';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../sim/data/species';
import { paintDino } from './dinoArt';
import { TILE } from './tileset';

const dinoKey = (id: SpeciesId) => `dino-${id}`;
const feederKey = (kind: FeederKind, full: boolean) => `feeder-${kind}-${full ? 'full' : 'empty'}`;
/** Sprites stand with their feet this far down the tile. */
const FOOT_Y = 13;

export type Selection = { kind: 'dino' | 'feeder'; id: number } | null;

/** Paints feeder troughs: a wooden box, plus greens or meat when stocked. */
function paintFeeder(kind: FeederKind, full: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px(1, 7, 14, 7, '#1b1b14');
  px(2, 8, 12, 5, '#8a5a2b');
  px(2, 8, 12, 1, '#b07a3f');
  px(3, 12, 2, 3, '#1b1b14');
  px(11, 12, 2, 3, '#1b1b14');
  if (full && kind === 'plants') {
    for (const [x, y, col] of [[3, 5, '#4e8a33'], [5, 4, '#73b44f'], [7, 5, '#86c25c'], [9, 4, '#4e8a33'], [11, 5, '#73b44f'], [4, 6, '#86c25c'], [8, 6, '#4e8a33'], [12, 6, '#86c25c']] as const) {
      px(x, y, 2, 3, col);
    }
  } else if (full) {
    px(3, 5, 4, 3, '#b8323a');
    px(8, 4, 5, 4, '#d9454d');
    px(9, 5, 2, 1, '#f4ecd2'); // bone
    px(4, 6, 2, 1, '#f4ecd2');
  }
  return c;
}

/** Dinosaur and feeder sprites, kept in sync with the simulation every frame. */
export class EntityLayer {
  private dinos = new Map<number, Phaser.GameObjects.Image>();
  private feeders = new Map<number, Phaser.GameObjects.Image>();
  private facingLeft = new Map<number, boolean>();
  private markers: Phaser.GameObjects.Graphics;
  selection: Selection = null;

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    for (const id of SPECIES_IDS) {
      if (!scene.textures.exists(dinoKey(id))) scene.textures.addCanvas(dinoKey(id), paintDino(SPECIES[id]));
    }
    for (const kind of Object.keys(FEEDER_TYPES) as FeederKind[]) {
      for (const full of [true, false]) scene.textures.addCanvas(feederKey(kind, full), paintFeeder(kind, full));
    }
    this.markers = scene.add.graphics().setDepth(9);
  }

  /** Where a dino is drawn right now (feet position, world pixels). */
  dinoPosition(d: Dino): { x: number; y: number } {
    const t = this.sim.stepProgress;
    return {
      x: (d.px + (d.x - d.px) * t) * TILE + TILE / 2,
      y: (d.py + (d.y - d.py) * t) * TILE + FOOT_Y,
    };
  }

  /** The dino drawn under a world point, preferring the one in front. */
  dinoAt(wx: number, wy: number): Dino | null {
    let best: Dino | null = null;
    let bestY = -Infinity;
    for (const d of this.sim.state.dinos) {
      const img = this.dinos.get(d.id);
      if (!img) continue;
      const b = img.getBounds();
      // Pad small sprites so they're still easy to hit with a finger.
      const pad = Math.max(0, (TILE * 1.25 - b.width) / 2);
      if (wx >= b.left - pad && wx <= b.right + pad && wy >= b.top - pad && wy <= b.bottom + pad / 2 && img.y > bestY) {
        best = d;
        bestY = img.y;
      }
    }
    return best;
  }

  feederAt(tx: number, ty: number): Feeder | undefined {
    return this.sim.state.feeders.find((f) => f.x === tx && f.y === ty);
  }

  update(time: number): void {
    const { state } = this.sim;
    const g = this.markers.clear();

    // Feeders
    const liveFeeders = new Set<number>();
    for (const f of state.feeders) {
      liveFeeders.add(f.id);
      let img = this.feeders.get(f.id);
      if (!img) {
        img = this.scene.add.image(f.x * TILE, f.y * TILE, feederKey(f.kind, true)).setOrigin(0).setDepth(3);
        this.feeders.set(f.id, img);
      }
      img.setTexture(feederKey(f.kind, f.stock > 0));
      // Stock bar under the trough.
      const cap = FEEDER_TYPES[f.kind].capacity;
      g.fillStyle(0x1b1b14, 0.9).fillRect(f.x * TILE + 2, f.y * TILE + 15, 12, 2);
      g.fillStyle(f.stock / cap > 0.25 ? 0x8fd16a : 0xff7a6b, 1).fillRect(f.x * TILE + 2, f.y * TILE + 15, Math.ceil((12 * f.stock) / cap), 2);
      if (this.selection?.kind === 'feeder' && this.selection.id === f.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeRect(f.x * TILE + 0.5, f.y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
    for (const [id, img] of this.feeders) {
      if (!liveFeeders.has(id)) {
        img.destroy();
        this.feeders.delete(id);
      }
    }

    // Dinosaurs
    const liveDinos = new Set<number>();
    for (const d of state.dinos) {
      liveDinos.add(d.id);
      let img = this.dinos.get(d.id);
      if (!img) {
        img = this.scene.add.image(0, 0, dinoKey(d.species)).setOrigin(0.5, 1);
        this.dinos.set(d.id, img);
      }
      const moving = d.x !== d.px || d.y !== d.py;
      if (d.x !== d.px) this.facingLeft.set(d.id, d.x < d.px);
      const { x, y } = this.dinoPosition(d);
      // A one-pixel bob while walking; idle animals breathe slowly.
      const bob = moving ? (this.sim.stepProgress < 0.5 ? -1 : 0) : Math.sin(time / 600 + d.id) > 0.9 ? -1 : 0;
      img.setPosition(Math.round(x), Math.round(y) + bob);
      img.setFlipX(this.facingLeft.get(d.id) ?? false);
      img.setDepth(4 + y / 10000);

      const top = Math.round(y) - img.height - 3;
      if (d.hunger >= 75 || d.health < 50) {
        // Red "!" above animals that need help.
        g.fillStyle(0x1b1b14, 1).fillRect(Math.round(x) - 2, top - 7, 4, 9);
        g.fillStyle(0xff5a4a, 1).fillRect(Math.round(x) - 1, top - 6, 2, 4).fillRect(Math.round(x) - 1, top - 1, 2, 2);
      }
      if (this.selection?.kind === 'dino' && this.selection.id === d.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(Math.round(x), Math.round(y), Math.max(12, img.width * 0.8), 5);
      }
    }
    for (const [id, img] of this.dinos) {
      if (!liveDinos.has(id)) {
        img.destroy();
        this.dinos.delete(id);
        this.facingLeft.delete(id);
        if (this.selection?.kind === 'dino' && this.selection.id === id) this.selection = null;
      }
    }
  }
}
