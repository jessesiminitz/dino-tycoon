import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { ALL_DECOR_KINDS, type DecorKind } from '../sim/data/decor';
import { hash2 } from '../sim/rng';
import { isLand, Terrain } from '../sim/terrain';
import {
  FOREST_TREES,
  paintDecor,
  paintMountain,
  paintPalm,
  paintBush,
  paintReeds,
  paintVolcano,
  VOLCANO_CRATER_ABOVE_BASE,
} from './sceneryArt';
import { TILE } from './tileset';

const TREE_VARIANTS = 3;
/** Beach tiles that get a palm (away from the gate). */
const PALM_CHANCE = 0.1;
/** Open grass tiles that get a lone tree or a bush. */
const LONE_TREE_CHANCE = 0.025;
const BUSH_CHANCE = 0.05;
/** Share of marsh tiles with a clump of reeds. */
const REED_CHANCE = 0.45;
/** Mountain tiles that carry a peak sprite (the rest show scree between peaks). */
const PEAK_CHANCE = 0.55;
/** Keep peaks this far from the volcano so its cone stands clear. */
const VOLCANO_CLEARANCE = 2;
const SMOKE_PUFFS = 14;

const treeKey = (kind: number, v: number) => `tree-${kind}-${v}`;
const decorKey = (kind: DecorKind) => `decor-${kind}`;

/** Depth for something standing with its base at world y (matches dinos and people). */
const depthAt = (y: number) => 4 + y / 10000;

/**
 * Everything tall that stands on the island: forest trees and beach palms
 * (hidden where you build), mountains, the volcano with its smoke, fossil
 * beds on the ground, and garden decorations.
 */
export class SceneryLayer {
  /** Natural trees and palms by tile index. */
  private trees = new Map<number, Phaser.GameObjects.Image>();
  private decor = new Map<number, Phaser.GameObjects.Image>();
  /** Trees currently see-through because an animal stands behind them. */
  private faded = new Set<number>();
  private fx: Phaser.GameObjects.Graphics;
  private volcanoGlow: Phaser.GameObjects.Graphics;
  private volcanoBase = 0;

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    const tex = (key: string, paint: () => HTMLCanvasElement) => {
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paint());
    };
    FOREST_TREES.forEach((paint, kind) => {
      for (let v = 0; v < TREE_VARIANTS; v++) tex(treeKey(kind, v), () => paint(kind * 31 + v * 7));
    });
    for (let v = 0; v < TREE_VARIANTS; v++) tex(`palm-${v}`, () => paintPalm(v));
    for (let v = 0; v < 6; v++) tex(`mountain-${v}`, () => paintMountain(v * 13 + 3));
    for (let v = 0; v < 3; v++) tex(`bush-${v}`, () => paintBush(v));
    for (let v = 0; v < 3; v++) tex(`reeds-${v}`, () => paintReeds(v * 7 + 1));
    tex('volcano', paintVolcano);
    for (const kind of ALL_DECOR_KINDS) tex(decorKey(kind), () => paintDecor(kind));

    const { map } = sim.state;
    const { width, height, tiles } = map;
    const beds = scene.add.graphics().setDepth(0.45);
    this.drawFossilBeds(beds);

    const gate = sim.state.entrance;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const t = tiles[i];
        const h = hash2(x, y, 1234);
        const base = (y + 1) * TILE;
        const jitter = Math.round((hash2(y, x, 77) - 0.5) * 6);
        if (t === Terrain.Forest) {
          // Mostly conifers and broadleaves, some cycads and ferns, the odd giant.
          const kind = h < 0.34 ? 0 : h < 0.66 ? 1 : h < 0.8 ? 2 : h < 0.94 ? 3 : 4;
          const img = scene.add
            .image(x * TILE + TILE / 2 + jitter, base, treeKey(kind, Math.floor(hash2(x, y, 5) * TREE_VARIANTS)))
            .setOrigin(0.5, 1)
            .setDepth(depthAt(base));
          this.trees.set(i, img);
        } else if (t === Terrain.Sand && h < PALM_CHANCE && Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y)) > 2) {
          const img = scene.add
            .image(x * TILE + TILE / 2 + jitter, base, `palm-${Math.floor(hash2(x, y, 6) * TREE_VARIANTS)}`)
            .setOrigin(0.5, 1)
            .setDepth(depthAt(base));
          this.trees.set(i, img);
        } else if (t === Terrain.Grass && h < LONE_TREE_CHANCE + BUSH_CHANCE) {
          // Open grassland gets the odd lone tree or bush.
          const key = h < LONE_TREE_CHANCE ? treeKey(1 + Math.floor(hash2(x, y, 8) * 2), Math.floor(hash2(x, y, 5) * TREE_VARIANTS)) : `bush-${Math.floor(hash2(x, y, 9) * 3)}`;
          const img = scene.add
            .image(x * TILE + TILE / 2 + jitter, base, key)
            .setOrigin(0.5, 1)
            .setDepth(depthAt(base));
          this.trees.set(i, img);
        } else if (t === Terrain.Marsh && h < REED_CHANCE) {
          const img = scene.add
            .image(x * TILE + TILE / 2 + jitter, base - 2, `reeds-${Math.floor(hash2(x, y, 10) * 3)}`)
            .setOrigin(0.5, 1)
            .setDepth(depthAt(base));
          this.trees.set(i, img);
        } else if (t === Terrain.Mountain) {
          const v = map.volcano;
          const nearVolcano = v && Math.max(Math.abs(x - v.x), Math.abs(y - v.y)) <= VOLCANO_CLEARANCE;
          if (!nearVolcano && hash2(x, y, 55) < PEAK_CHANCE) {
            scene.add
              .image(x * TILE + TILE / 2 + jitter, base + 6, `mountain-${Math.floor(h * 6)}`)
              .setOrigin(0.5, 1)
              .setDepth(depthAt(base));
          }
        }
      }

    this.volcanoGlow = scene.add.graphics();
    this.fx = scene.add.graphics().setDepth(8.5);
    const v = map.volcano;
    if (v) {
      this.volcanoBase = (v.y + 2) * TILE + 4;
      scene.add.image(v.x * TILE + TILE / 2, this.volcanoBase, 'volcano').setOrigin(0.5, 1).setDepth(depthAt(this.volcanoBase));
      this.volcanoGlow.setDepth(depthAt(this.volcanoBase) + 0.00001);
    }
    this.refresh();
  }

  /** After building: hide trees on built-over tiles; add or remove garden sprites. */
  refresh(): void {
    const { state } = this.sim;
    const w = state.map.width;
    const busy = new Set<number>();
    for (let i = 0; i < state.paths.length; i++) if (state.paths[i]) busy.add(i);
    for (const o of [...state.buildings, ...state.feeders, ...state.decor]) busy.add(o.y * w + o.x);
    busy.add(state.entrance.y * w + state.entrance.x);
    for (let i = 0; i < state.map.tiles.length; i++) if (state.map.tiles[i] === Terrain.Pond) busy.add(i); // dug ponds
    // Reeds go when their marsh is drained; trees burn when lava reaches them.
    const scorched = (i: number) => state.map.tiles[i] === Terrain.Lava || state.map.tiles[i] === Terrain.LavaRock;
    for (const [i, img] of this.trees)
      img.setVisible(!busy.has(i) && !scorched(i) && (img.texture.key.startsWith('reeds') ? state.map.tiles[i] === Terrain.Marsh : true));

    const live = new Set<number>();
    for (const d of state.decor) {
      live.add(d.id);
      if (this.decor.has(d.id)) continue;
      const base = (d.y + 1) * TILE;
      const img = this.scene.add
        .image(d.x * TILE + TILE / 2, base, decorKey(d.kind))
        .setOrigin(0.5, 1)
        .setDepth(depthAt(base));
      this.decor.set(d.id, img);
    }
    for (const [id, img] of this.decor) {
      if (!live.has(id)) {
        img.destroy();
        this.decor.delete(id);
      }
    }
  }

  /** Pale, bone-strewn ground; richer beds are warmer in colour. */
  private drawFossilBeds(g: Phaser.GameObjects.Graphics): void {
    const { map, fossilBeds } = this.sim.state;
    for (const bed of fossilBeds) {
      const tint = bed.richness === 3 ? 0xd9a060 : bed.richness === 2 ? 0xd9c090 : 0xd9ccaa;
      for (let y = bed.y - bed.radius; y <= bed.y + bed.radius; y++)
        for (let x = bed.x - bed.radius; x <= bed.x + bed.radius; x++) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height || !isLand(map.tiles[y * map.width + x])) continue;
          const edge = Math.max(Math.abs(x - bed.x), Math.abs(y - bed.y)) === bed.radius;
          for (let k = 0; k < 16; k++) {
            const h = hash2(x * 16 + k, y * 16 - k, 41);
            if (edge && h < 0.5) continue; // ragged outline
            g.fillStyle(tint, 0.55).fillRect(x * TILE + (k % 4) * 4, y * TILE + Math.floor(k / 4) * 4, 4, 4);
          }
          // A couple of bones.
          for (let b = 0; b < 2; b++) {
            const h = hash2(x + b * 7, y - b * 3, 43);
            if (h > 0.6) continue;
            const bx = x * TILE + 2 + Math.floor(h * 11);
            const by = y * TILE + 3 + Math.floor(hash2(y, x + b, 44) * 10);
            g.fillStyle(0xf4ecd2, 1).fillRect(bx, by, 4, 1).fillRect(bx - 1, by - 1, 1, 1).fillRect(bx + 4, by + 1, 1, 1);
          }
        }
    }
  }

  /**
   * Trees just in front of (south of) a dinosaur turn see-through, so animals
   * are never lost behind the forest.
   */
  private fadeTreesInFront(): void {
    const { state } = this.sim;
    const w = state.map.width;
    const now = new Set<number>();
    for (const d of state.dinos) {
      for (let dy = 0; dy <= 2; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = (d.y + dy) * w + d.x + dx;
          if (this.trees.has(i)) now.add(i);
        }
    }
    for (const i of this.faded) if (!now.has(i)) this.trees.get(i)?.setAlpha(1);
    for (const i of now) if (!this.faded.has(i)) this.trees.get(i)?.setAlpha(0.35);
    this.faded = now;
  }

  /** Volcano smoke and glow, fountain sparkle, see-through trees. */
  update(time: number): void {
    this.fadeTreesInFront();
    const g = this.fx.clear();
    const glow = this.volcanoGlow.clear();
    const { state } = this.sim;
    const v = state.map.volcano;
    if (v) {
      const active = state.volcanoActivity > 0;
      const cx = v.x * TILE + TILE / 2;
      const cy = this.volcanoBase - VOLCANO_CRATER_ABOVE_BASE;
      // Crater glow pulses; much brighter while the volcano is active.
      const pulse = 0.5 + 0.5 * Math.sin(time / (active ? 180 : 700));
      glow.fillStyle(0xff7a2a, (active ? 0.5 : 0.2) + pulse * 0.2).fillEllipse(cx, cy + 1, 18, 4);
      // Smoke puffs rise from the crater, drift and fade.
      const n = active ? SMOKE_PUFFS * 2 : SMOKE_PUFFS;
      for (let i = 0; i < n; i++) {
        const life = ((time / (active ? 2200 : 4000) + i / n) % 1 + 1) % 1;
        const drift = (hash2(i, Math.floor(time / 4000 + i / n), 3) - 0.3) * 30;
        const x = cx + drift * life + Math.sin(life * 6 + i) * 3;
        const y = cy - life * (active ? 90 : 60);
        const r = 3 + life * (active ? 10 : 7);
        g.fillStyle(active ? 0x4a4038 : 0xb5ae9c, (1 - life) * (active ? 0.6 : 0.35)).fillCircle(x, y, r);
      }
    }
    for (const d of state.decor) {
      if (d.kind !== 'fountain') continue;
      const x = d.x * TILE + TILE / 2;
      const y = (d.y + 1) * TILE - 14;
      for (let k = 0; k < 4; k++) {
        const t = ((time / 500 + k / 4) % 1 + 1) % 1;
        const dx = (k % 2 ? 1 : -1) * t * 5;
        g.fillStyle(0xe8f6fb, 1 - t).fillRect(x + dx, y - 3 + t * t * 8, 1, 1);
      }
    }
  }
}
