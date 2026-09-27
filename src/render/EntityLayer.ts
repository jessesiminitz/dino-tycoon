import Phaser from 'phaser';
import type { Building, Dino, Feeder, Staff, Visitor } from '../sim/GameState';
import { STAFF_ROLES, type StaffRole } from '../sim/data/staff';
import { BUILDING_TYPES, type BuildingKind } from '../sim/data/economy';
import { hash2 } from '../sim/rng';
import type { Simulation } from '../sim/Simulation';
import { FEEDER_TYPES, type FeederKind } from '../sim/data/feeders';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../sim/data/species';
import { paintDino } from './dinoArt';
import { TILE } from './tileset';

const dinoKey = (id: SpeciesId, frame: 0 | 1 = 0) => `dino-${id}-${frame}`;
const feederKey = (kind: FeederKind, full: boolean) => `feeder-${kind}-${full ? 'full' : 'empty'}`;
/** Sprites stand with their feet this far down the tile. */
const FOOT_Y = 13;

export type Selection = { kind: 'dino' | 'feeder' | 'building' | 'visitor' | 'staff'; id: number } | null;

const staffKey = (role: StaffRole, frame: 0 | 1 = 0) => `staff-${role}-${frame}`;
/** Uniform, cap and trouser colours per role. */
const UNIFORMS: Record<StaffRole, { U: string; C: string; L: string }> = {
  worker: { U: '#e8892f', C: '#f2d24e', L: '#5a4a3a' },
  guard: { U: '#2f4a7a', C: '#1b2a45', L: '#1b2a45' },
  vet: { U: '#f4f4f0', C: '#d9454d', L: '#6b7a8a' },
  guide: { U: '#4fae5a', C: '#c9a36b', L: '#6b5238' },
  mascot: { U: '#5fb84a', C: '#5fb84a', L: '#5fb84a' }, // painted separately as a dino costume
};

const visitorKey = (look: number, frame: 0 | 1 = 0, kid = false, poncho = false) =>
  `visitor-${look}-${frame}-${kid ? 'k' : 'a'}-${poncho ? 'p' : 'n'}`;
const PONCHO = '#f2d24e';
const BALLOONS = [0xe05a4f, 0x4f8fe0, 0xf2c14e, 0x9b6be0];
const buildingKey = (kind: BuildingKind) => `building-${kind}`;
const VISITOR_LOOKS = 6;
const SHIRTS = ['#e05a4f', '#4f8fe0', '#f2c14e', '#9b6be0', '#4fc08d', '#f28fb1'];
const HAIR = ['#3a2a1a', '#7a4a2a', '#d9b060', '#1b1b1b'];
const SKIN = ['#f1c7a0', '#c98b5f', '#8a5a3a'];

/** Pixel canvas from rows of palette keys, with an automatic dark outline. */
function paintRows(rows: string[], colors: Record<string, string>): HTMLCanvasElement {
  const w = rows[0].length + 2;
  const h = rows.length + 2;
  const at = (x: number, y: number) => rows[y - 1]?.[x - 1] ?? '.';
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = at(x, y);
      if (k !== '.') ctx.fillStyle = colors[k];
      else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) ctx.fillStyle = '#1b1b14';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

/** Person legs: standing, and mid-stride. */
const LEGS: Record<0 | 1, string[]> = { 0: ['.L.L.', '.L.L.'], 1: ['.L.L.', 'L...L'] };

/** Adults, and shorter kids; a poncho turns the shirt (and hood) bright yellow. */
function paintVisitor(look: number, frame: 0 | 1, kid: boolean, poncho: boolean): HTMLCanvasElement {
  const rows = kid
    ? ['.HHH.', '.SSS.', 'TTTTT', 'STTTS', '.LLL.', LEGS[frame][1]]
    : ['.HHH.', '.SSS.', 'TTTTT', 'STTTS', '.TTT.', '.LLL.', ...LEGS[frame]];
  return paintRows(rows, {
    H: poncho ? PONCHO : HAIR[look % HAIR.length],
    S: SKIN[look % SKIN.length],
    T: poncho ? PONCHO : SHIRTS[look % SHIRTS.length],
    L: '#3b4a6b',
  });
}

function paintStaff(role: StaffRole, frame: 0 | 1): HTMLCanvasElement {
  if (role === 'mascot') {
    // A cheerful green dino costume, tail and all.
    const rows = [
        '..GGG..',
        '.GGGEG.',
        '.GGGGGW',
        '..GGG..',
        '.GGGGG.',
        'GGBBBGG',
        '.GBBBG.',
        '.GGGGG.',
        'TGG.GG.',
    ];
    rows.push(frame === 0 ? '.GG.GG.' : 'GG...GG');
    return paintRows(rows, { G: '#5fb84a', B: '#d9e8a0', E: '#101010', W: '#f4ecd2', T: '#4a9a3a' });
  }
  return paintRows(['CCCCC', '.SSS.', 'UUUUU', 'SUUUS', '.UUU.', '.LLL.', ...LEGS[frame]], {
    ...UNIFORMS[role],
    S: '#e0b48a',
  });
}

function paintBuilding(kind: BuildingKind): HTMLCanvasElement {
  if (kind === 'snackstall') {
    // A striped umbrella over an ice-cream cart.
    return paintRows(
      [
        '....RWRWRWRW....',
        '...RWRWRWRWRW...',
        '..RWRWRWRWRWRW..',
        '.......PP.......',
        '.......PP.......',
        '..CCCCCCCCCCCC..',
        '..cyyccppccyyc..',
        '..cccccccccccc..',
        '..K..........K..',
      ],
      { R: '#f28fb1', W: '#f4ecd2', P: '#8f8f96', C: '#f4ecd2', c: '#e8a0b8', y: '#f2d24e', p: '#b07a3f', K: '#3b3b3b' },
    );
  }
  if (kind === 'restroom') {
    return paintRows(
      [
        '..SSSSSSSSSSSS..',
        '.SSSSSSSSSSSSSS.',
        '..WWWWWWWWWWWW..',
        '..WbWWWWWWWWgW..',
        '..WbWWDDDDWWgW..',
        '..WWWWDDDDWWWW..',
        '..WWWWDDDDWWWW..',
        '..WWWWDDDDWWWW..',
      ],
      { S: '#3f8f9a', W: '#e8f0ec', D: '#5a6b7a', b: '#3f7fb0', g: '#e05a8f' },
    );
  }
  if (kind === 'digsite') {
    // Canvas tent, a spoil heap, a pickaxe and a partly dug-out bone.
    return paintRows(
      [
        '......T.........',
        '.....TTT........',
        '....TTtTT.......',
        '...TTTtTTT..H...',
        '..TTTTtTTTT.H...',
        '.TTTTTdTTTTTHHH.',
        '......dddd......',
        '..MMM.dBBBd.MM..',
        '.MMMMMdddddMMMM.',
      ],
      { T: '#d9c7a3', t: '#a88a6a', d: '#5a3b1f', B: '#f4ecd2', M: '#8a6a3e', H: '#8f8f96' },
    );
  }
  // Awning stripes alternate A/a; walls W; window G; door D; sign S/s.
  const rows = [
    '......SSSS......',
    '......SssS......',
    '..AaAaAaAaAaAa..',
    '.AaAaAaAaAaAaAa.',
    '.WWWWWWWWWWWWWW.',
    '.WGGGWWWWWWGGGW.',
    '.WGGGWWDDWWGGGW.',
    '.WGGGWWDDWWGGGW.',
    '.WWWWWWDDWWWWWW.',
    '.WWWWWWDDWWWWWW.',
  ];
  const restaurant = kind === 'restaurant';
  return paintRows(rows, {
    A: restaurant ? '#d9454d' : '#3f7fb0',
    a: '#f4ecd2',
    W: restaurant ? '#b07a3f' : '#a88a6a',
    G: '#8fd3ea',
    D: '#5a3b1f',
    S: restaurant ? '#f2c14e' : '#6fb34f',
    s: restaurant ? '#d9454d' : '#2f6b3a',
  });
}

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
  private visitors = new Map<number, Phaser.GameObjects.Image>();
  private buildings = new Map<number, Phaser.GameObjects.Image>();
  private staff = new Map<number, Phaser.GameObjects.Image>();
  private markers: Phaser.GameObjects.Graphics;
  selection: Selection = null;

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    for (const id of SPECIES_IDS) {
      for (const frame of [0, 1] as const) {
        if (!scene.textures.exists(dinoKey(id, frame))) scene.textures.addCanvas(dinoKey(id, frame), paintDino(SPECIES[id], frame));
      }
    }
    for (const kind of Object.keys(FEEDER_TYPES) as FeederKind[]) {
      for (const full of [true, false]) scene.textures.addCanvas(feederKey(kind, full), paintFeeder(kind, full));
    }
    for (const frame of [0, 1] as const) {
      for (let look = 0; look < VISITOR_LOOKS; look++)
        for (const kid of [false, true])
          for (const poncho of [false, true])
            scene.textures.addCanvas(visitorKey(look, frame, kid, poncho), paintVisitor(look, frame, kid, poncho));
      for (const role of STAFF_ROLES) scene.textures.addCanvas(staffKey(role, frame), paintStaff(role, frame));
    }
    for (const kind of Object.keys(BUILDING_TYPES) as BuildingKind[]) scene.textures.addCanvas(buildingKey(kind), paintBuilding(kind));
    this.markers = scene.add.graphics().setDepth(9);
  }

  /** Where a visitor is drawn (feet), nudged per person so crowds don't stack. */
  visitorPosition(v: Visitor): { x: number; y: number } {
    const t = this.sim.stepProgress;
    const jx = Math.round((hash2(v.id, 1, 5) - 0.5) * 8);
    const jy = Math.round((hash2(v.id, 2, 5) - 0.5) * 6);
    return {
      x: (v.px + (v.x - v.px) * t) * TILE + TILE / 2 + jx,
      y: (v.py + (v.y - v.py) * t) * TILE + FOOT_Y + jy,
    };
  }

  visitorAt(wx: number, wy: number): Visitor | null {
    let best: Visitor | null = null;
    let bestD = 7;
    for (const v of this.sim.state.visitors) {
      const p = this.visitorPosition(v);
      const d = Math.hypot(p.x - wx, p.y - 5 - wy);
      if (d < bestD) {
        best = v;
        bestD = d;
      }
    }
    return best;
  }

  staffPosition(m: Staff): { x: number; y: number } {
    const t = this.sim.stepProgress;
    return {
      x: (m.px + (m.x - m.px) * t) * TILE + TILE / 2,
      y: (m.py + (m.y - m.py) * t) * TILE + FOOT_Y,
    };
  }

  staffAt(wx: number, wy: number): Staff | null {
    let best: Staff | null = null;
    let bestD = 8;
    for (const m of this.sim.state.staff) {
      const p = this.staffPosition(m);
      const d = Math.hypot(p.x - wx, p.y - 5 - wy);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  buildingAt(tx: number, ty: number): Building | undefined {
    return this.sim.state.buildings.find((b) => b.x === tx && b.y === ty);
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

    // Buildings
    this.sync(this.buildings, state.buildings, (b) =>
      this.scene.add.image(b.x * TILE + TILE / 2, (b.y + 1) * TILE, buildingKey(b.kind)).setOrigin(0.5, 1).setDepth(4 + ((b.y + 1) * TILE) / 10000),
    );
    const selB = this.selection?.kind === 'building' ? state.buildings.find((b) => b.id === this.selection!.id) : undefined;
    if (selB) g.lineStyle(1, 0xf2c14e, 1).strokeRect(selB.x * TILE - 0.5, selB.y * TILE - 0.5, TILE + 1, TILE + 1);

    // Visitors
    this.sync(this.visitors, state.visitors, (v) => this.scene.add.image(0, 0, visitorKey(v.look)).setOrigin(0.5, 1));
    for (const v of state.visitors) {
      const img = this.visitors.get(v.id)!;
      const { x, y } = this.visitorPosition(v);
      const moving = v.x !== v.px || v.y !== v.py;
      const stride = moving && this.sim.stepProgress >= 0.5;
      img.setTexture(visitorKey(v.look, stride ? 1 : 0, v.kid, v.items.includes('poncho')));
      const vx = Math.round(x);
      const vy = Math.round(y) + (moving && !stride ? -1 : 0);
      img.setPosition(vx, vy);
      this.drawCarried(g, v, vx, vy, img.height);
      img.setDepth(4 + y / 10000);
      if (this.selection?.kind === 'visitor' && this.selection.id === v.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(Math.round(x), Math.round(y), 9, 4);
      }
    }
    if (this.selection?.kind === 'visitor' && !state.visitors.some((v) => v.id === this.selection!.id)) this.selection = null;

    // Staff
    this.sync(this.staff, state.staff, (m) => this.scene.add.image(0, 0, staffKey(m.role)).setOrigin(0.5, 1));
    for (const m of state.staff) {
      const img = this.staff.get(m.id)!;
      const { x, y } = this.staffPosition(m);
      const working = m.task !== null && m.progress > 0;
      const walking = Math.abs(m.x - m.px) + Math.abs(m.y - m.py) > 0.01;
      img.setTexture(staffKey(m.role, walking && Math.floor(time / 150) % 2 === 1 ? 1 : 0));
      img.setPosition(Math.round(x), Math.round(y) + (working && Math.floor(time / 180) % 2 === 0 ? -1 : 0));
      img.setDepth(4 + y / 10000);
      if (working) {
        // Busy sparks above the head.
        g.fillStyle(0xf2c14e, 1).fillRect(Math.round(x) + (Math.floor(time / 240) % 2 === 0 ? -3 : 2), Math.round(y) - 14, 1, 1);
      }
      if (this.selection?.kind === 'staff' && this.selection.id === m.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(Math.round(x), Math.round(y), 9, 4);
      }
    }
    if (this.selection?.kind === 'staff' && !state.staff.some((m) => m.id === this.selection!.id)) this.selection = null;

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
      img.setTexture(dinoKey(d.species, moving && this.sim.stepProgress >= 0.5 ? 1 : 0));
      img.setPosition(Math.round(x), Math.round(y) + bob);
      img.setFlipX(this.facingLeft.get(d.id) ?? false);
      img.setDepth(4 + y / 10000);

      const top = Math.round(y) - img.height - 3;
      const cx = Math.round(x);
      if (d.escaped) {
        // Escaped: pulsing orange ring and a double "!".
        const pulse = Math.floor(time / 300) % 2 === 0;
        g.lineStyle(1, 0xff9f43, pulse ? 1 : 0.5).strokeEllipse(cx, Math.round(y), Math.max(14, img.width), 6);
        g.fillStyle(0x1b1b14, 1).fillRect(cx - 4, top - 7, 8, 9);
        g.fillStyle(0xff9f43, 1).fillRect(cx - 3, top - 6, 2, 4).fillRect(cx - 3, top - 1, 2, 2);
        g.fillRect(cx + 1, top - 6, 2, 4).fillRect(cx + 1, top - 1, 2, 2);
      } else if (d.sick) {
        // Sick: green cross.
        g.fillStyle(0x1b1b14, 1).fillRect(cx - 3, top - 7, 7, 7);
        g.fillStyle(0x6fd36a, 1).fillRect(cx - 2, top - 5, 5, 1).fillRect(cx, top - 6, 1, 5);
      } else if (d.hunger >= 75 || d.health < 50) {
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

  /** What a visitor has bought: a cap on the head, a balloon on a string, a plush or ice cream in hand. */
  private drawCarried(g: Phaser.GameObjects.Graphics, v: Visitor, x: number, y: number, h: number): void {
    const top = y - h + 1;
    if (v.items.includes('hat')) {
      g.fillStyle(0x3f8f3a, 1).fillRect(x - 3, top, 6, 2);
      g.fillStyle(0x2f6b2a, 1).fillRect(x, top + 1, 4, 1); // brim
    }
    if (v.items.includes('balloon')) {
      g.lineStyle(1, 0xf4ecd2, 0.8).lineBetween(x + 3, top + 5, x + 4, top - 6);
      g.fillStyle(BALLOONS[v.id % BALLOONS.length], 1).fillEllipse(x + 4, top - 9, 5, 6);
      g.fillStyle(0xffffff, 0.6).fillRect(x + 3, top - 11, 1, 1);
    }
    if (v.items.includes('plush')) {
      g.fillStyle(0x5fb84a, 1).fillRect(x - 5, y - 6, 3, 3);
      g.fillStyle(0x101010, 1).fillRect(x - 4, y - 6, 1, 1);
    }
    if (this.sim.state.hours < v.snackUntil) {
      g.fillStyle(0xd9a45a, 1).fillRect(x + 3, y - 6, 2, 3); // cone
      g.fillStyle(v.id % 2 ? 0xf28fb1 : 0xf4ecd2, 1).fillRect(x + 2, y - 8, 4, 2); // scoop
    }
  }

  /** Creates sprites for new entities and destroys sprites of removed ones. */
  private sync<T extends { id: number }>(
    sprites: Map<number, Phaser.GameObjects.Image>,
    entities: T[],
    create: (e: T) => Phaser.GameObjects.Image,
  ): void {
    const live = new Set<number>();
    for (const e of entities) {
      live.add(e.id);
      if (!sprites.has(e.id)) sprites.set(e.id, create(e));
    }
    for (const [id, img] of sprites) {
      if (!live.has(id)) {
        img.destroy();
        sprites.delete(id);
      }
    }
  }
}
