import { dinoReaction, type DinoReactionAction, type DinoReaction } from './dinoReaction';
import { addPaintedTexture, fitPaintedImage } from './paintedTexture';
import { paintCartoonPerson } from './cartoonArt';
import Phaser from 'phaser';
import { accidentKind, type Building, type Dino, type Feeder, type Staff, type Visitor } from '../sim/GameState';
import { STAFF_ROLES, type StaffRole } from '../sim/data/staff';
import { BUILDING_TYPES, type BuildingKind } from '../sim/data/economy';
import { hash2 } from '../sim/rng';
import type { Simulation } from '../sim/Simulation';
import { FEEDER_TYPES, type FeederKind } from '../sim/data/feeders';
import { habitatOf, SPECIES, SPECIES_IDS, type SpeciesId } from '../sim/data/species';
import { dinoFrameCount, paintDino, paintEgg, dinoCanvasBounds, type DinoPixelBounds } from './dinoArt';
import { hoursToHatch, WOBBLE_HOURS } from '../sim/systems/breeding';
import { isAsleep } from '../sim/systems/dinos';
import type { CareEffect } from '../sim/systems/care';
import { TILE } from './tileset';
import { paintRows } from './pixels';
import { paintBuilding, paintJeep, paintTrough } from './sceneryArt';
import { walkFrame } from './dinoAnimation';
import { ART_STYLE } from './artStyle';
import { BLENDER_MOTION } from './generated/blenderMotion';
import { BLENDER_ART } from './generated/blenderArt';
import { advanceMotion, hasFunClips, motionTexture, walkLanding, type AnimalMotion } from './parkMotion';
import { getSettings } from '../ui/settings';
import { isWater, Terrain } from '../sim/terrain';
import { depthAt, tileDepth, obscuringFenceKeys, FOOT_Y, DEPTH_EPSILON } from './worldDepth';
import { dinoWorldScale } from './dinoSize';

const dinoKey = (id: SpeciesId, frame = 0, baby = false) => `dino-${id}-${frame}${baby ? '-baby' : ''}`;
const eggKey = (id: SpeciesId) => `egg-${id}`;
const feederKey = (kind: FeederKind, full: boolean) => `feeder-${kind}-${full ? 'full' : 'empty'}`;
/** Share of a swimmer's sprite that shows above the water. */
const WATERLINE = 0.62;
/** How high flying reptiles hover, in world pixels. */
const FLY_HEIGHT = 14;
const JEEP_KEY = 'jeep';
const ZZZ = ['XXX', '..X', '.X.', 'XXX'];
/** How long hearts or a "Nope!" stay up, in ms. */
const EFFECT_MS = 1100;
const HEART = ['.X.X.', 'XXXXX', '.XXX.', '..X..'];
export type Selection = { kind: 'dino' | 'feeder' | 'building' | 'visitor' | 'staff' | 'egg'; id: number } | null;

const staffKey = (role: StaffRole, frame: 0 | 1 = 0) => `staff-${role}-${frame}`;
/** Uniform, cap and trouser colours per role. */
const UNIFORMS: Record<StaffRole, { U: string; C: string; L: string }> = {
  worker: { U: '#e8892f', C: '#f2d24e', L: '#5a4a3a' },
  guard: { U: '#2f4a7a', C: '#1b2a45', L: '#1b2a45' },
  vet: { U: '#f4f4f0', C: '#d9454d', L: '#6b7a8a' },
  janitor: { U: '#6fa8c8', C: '#3a6a8a', L: '#3a4a5a' },
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


/** Person legs: standing, and mid-stride. */
const LEGS: Record<0 | 1, string[]> = { 0: ['.L.L.', '.L.L.'], 1: ['.L.L.', 'L...L'] };

/** Adults, and shorter kids; a poncho turns the shirt (and hood) bright yellow. */
function paintVisitor(look: number, frame: 0 | 1, kid: boolean, poncho: boolean): HTMLCanvasElement {
  if (ART_STYLE === 'cartoon') return paintCartoonPerson(poncho ? PONCHO : SHIRTS[look % SHIRTS.length], SKIN[look % SKIN.length], poncho ? PONCHO : HAIR[look % HAIR.length], frame, kid);
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
  if (ART_STYLE === 'cartoon') return paintCartoonPerson(UNIFORMS[role].U, '#ffdb9b', UNIFORMS[role].C, frame, false, true);
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

/** Feeding troughs, full and empty. */
function paintFeeder(kind: FeederKind, full: boolean): HTMLCanvasElement {
  return paintTrough(kind, full);
}

/** Dinosaur and feeder sprites, kept in sync with the simulation every frame. */
export class EntityLayer {
  private dinos = new Map<number, Phaser.GameObjects.Image>();
  private feeders = new Map<number, Phaser.GameObjects.Image>();
  private facingLeft = new Map<number, boolean>();
  private visitors = new Map<number, Phaser.GameObjects.Image>();
  private buildings = new Map<number, Phaser.GameObjects.Image>();
  private staff = new Map<number, Phaser.GameObjects.Image>();
  private eggs = new Map<number, Phaser.GameObjects.Image>();
  private jeeps = new Map<number, Phaser.GameObjects.Image>();
  /** Hearts and "Nope!" bubbles over animals that were just treated or patted. */
  private effects: { dinoId: number; kind: CareEffect; action: DinoReactionAction; start: number; label?: Phaser.GameObjects.Text }[] = [];
  private markers: Phaser.GameObjects.Graphics;
  /** Litter and messes on the ground, under everyone's feet. */
  private dirt: Phaser.GameObjects.Graphics;
  /** Soft ground shadows, under everything that stands. */
  private shadows: Phaser.GameObjects.Graphics;
  /** Shared animation clock: freezes with the simulation, including flyers/idle motion. */
  private animalTime = 0;
  private reactionTime = 0;
  private lastUpdateTime?: number;
  private motions = new Map<number, AnimalMotion>();
  private meals = new Map<number, number>();
  private footfalls: {x:number;y:number;born:number;wet:boolean}[] = [];
  private tracks: Phaser.GameObjects.Graphics;
  /** Carried objects and tools sort with their owners, below any intervening wall. */
  private attachments = new Map<string, Phaser.GameObjects.Graphics>();
  readonly obscuringFences = new Set<string>();
  selection: Selection = null;

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    for (const id of SPECIES_IDS) {
      for (let frame = 0; frame < (ART_STYLE === 'cartoon' ? 1 : dinoFrameCount(id)); frame++)
        for (const baby of [false, true])
          if (!scene.textures.exists(dinoKey(id, frame, baby))) {
            const canvas = paintDino(SPECIES[id], frame, baby, undefined, dinoWorldScale(id));
            Object.assign(addPaintedTexture(scene, dinoKey(id, frame, baby), canvas)!.get().customData, { dinoBounds: dinoCanvasBounds(canvas) });
          }
      if (!scene.textures.exists(eggKey(id))) addPaintedTexture(scene, eggKey(id), paintEgg(SPECIES[id]));
    }
    for (const kind of Object.keys(FEEDER_TYPES) as FeederKind[]) {
      for (const full of [true, false]) addPaintedTexture(scene, feederKey(kind, full), paintFeeder(kind, full));
    }
    for (const frame of [0, 1] as const) {
      for (let look = 0; look < VISITOR_LOOKS; look++)
        for (const kid of [false, true])
          for (const poncho of [false, true])
            addPaintedTexture(scene, visitorKey(look, frame, kid, poncho), paintVisitor(look, frame, kid, poncho));
      for (const role of STAFF_ROLES) addPaintedTexture(scene, staffKey(role, frame), paintStaff(role, frame));
    }
    for (const kind of Object.keys(BUILDING_TYPES) as BuildingKind[]) addPaintedTexture(scene, buildingKey(kind), paintBuilding(kind));
    if (!scene.textures.exists(JEEP_KEY)) addPaintedTexture(scene, JEEP_KEY, paintJeep());
    this.markers = scene.add.graphics().setDepth(9);
    this.shadows = scene.add.graphics().setDepth(3.9);
    this.dirt = scene.add.graphics().setDepth(3.85);
    this.tracks = scene.add.graphics().setDepth(3.88);
    const offActions = sim.onDinoAction(action => this.meals.set(action.dinoId, Number.NaN));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, offActions);
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

  /** Show how an animal reacted to a treat or pat. */
  careEffect(dinoId: number, kind: CareEffect, action: DinoReactionAction = 'pat'): void {
    this.effects = this.effects.filter(e => { if (e.dinoId !== dinoId) return true; e.label?.destroy(); return false; });
    this.effects.push({ dinoId, kind, action, start: this.reactionTime });
  }

  /** The sprite drawn for a dino (for photos). */
  dinoSprite(id: number): Phaser.GameObjects.Image | undefined {
    return this.dinos.get(id);
  }

  /** Where a dino is drawn right now (feet position, world pixels). */
  dinoPosition(d: Dino): { x: number; y: number } {
    if (ART_STYLE !== 'original' && this.sim.speed === 0) {
      const motion = this.motions.get(d.id);
      if (motion) return { x: motion.x, y: motion.y };
    }
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
      const padX = Math.max(0, (TILE * 1.25 - b.width) / 2);
      const padY = Math.max(0, (TILE * 1.25 - b.height) / 2);
      if (wx >= b.left - padX && wx <= b.right + padX && wy >= b.top - padY && wy <= b.bottom + padY && img.y > bestY) {
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
    const elapsed = this.lastUpdateTime === undefined ? 0 : Math.max(0, Math.min(250, time - this.lastUpdateTime));
    this.lastUpdateTime = time;
    this.reactionTime += elapsed;
    if (this.sim.speed !== 0) this.animalTime += elapsed * this.sim.effectiveSpeed;
    const animalTime = this.animalTime;
    time = animalTime;
    for(const [id,started] of this.meals)if(Number.isNaN(started))this.meals.set(id,animalTime);
    const { state } = this.sim;
    this.obscuringFences.clear();
    const g = this.markers.clear();
    const liveAttachments = new Set<string>();
    const propsFor = (key: string, depth: number) => {
      liveAttachments.add(key);
      let props = this.attachments.get(key);
      if (!props) {
        props = this.scene.add.graphics();
        this.attachments.set(key, props);
      }
      return props.clear().setDepth(depth + DEPTH_EPSILON / 2);
    };
    const sh = this.shadows.clear();
    sh.fillStyle(0x000000, 0.22);
    this.drawDirt(time);
    this.drawEffects(g, this.reactionTime);

    this.drawFootfalls();
    // Feeders
    const liveFeeders = new Set<number>();
    for (const f of state.feeders) {
      liveFeeders.add(f.id);
      let img = this.feeders.get(f.id);
      if (!img) {
        const base = (f.y + 1) * TILE;
        img = this.scene.add.image(f.x * TILE + TILE / 2, base, feederKey(f.kind, true)).setOrigin(0.5, 1).setDepth(tileDepth(f.y));
        this.feeders.set(f.id, img);
      }
      img.setTexture(feederKey(f.kind, f.stock > 0));
      fitPaintedImage(img);
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
      this.scene.add.image(b.x * TILE + TILE / 2, (b.y + 1) * TILE, buildingKey(b.kind)).setOrigin(0.5, 1).setDepth(tileDepth(b.y)),
    );
    const selB = this.selection?.kind === 'building' ? state.buildings.find((b) => b.id === this.selection!.id) : undefined;
    if (selB) g.lineStyle(1, 0xf2c14e, 1).strokeRect(selB.x * TILE - 0.5, selB.y * TILE - 0.5, TILE + 1, TILE + 1);

    // Safari jeeps, with their riders' heads showing.
    this.sync(this.jeeps, state.jeeps, () => this.scene.add.image(0, 0, JEEP_KEY).setOrigin(0.5, 1));
    for (const j of state.jeeps) {
      const img = this.jeeps.get(j.id)!;
      const t = this.sim.stepProgress;
      const x = (j.px + (j.x - j.px) * t) * TILE + TILE / 2;
      const y = (j.py + (j.y - j.py) * t) * TILE + FOOT_Y + 1;
      if (j.x !== j.px) img.setFlipX(j.x < j.px);
      const bump = j.steps > 0 && Math.floor(time / 160 + j.id) % 2 === 0 ? -1 : 0;
      img.setPosition(Math.round(x), Math.round(y) + bump).setDepth(depthAt(y));
      sh.fillEllipse(Math.round(x), Math.round(y) - 1, 18, 4);
      const riders = j.riders.length ? propsFor(`jeep:${j.id}`, img.depth) : null;
      j.riders.forEach((r, i) => {
        const v = state.visitors.find((q) => q.id === r.id);
        const hx = Math.round(x) + Math.round((i - 1.5) * 3) - (img.flipX ? -2 : 2); // seats behind the windscreen
        const hy = Math.round(y) + bump - img.displayHeight + 1;
        riders!.fillStyle(0x1b1b14, 1).fillRect(hx - 2, hy - 1, 4, 5);
        riders!.fillStyle(parseInt(SKIN[(v?.look ?? i) % SKIN.length].slice(1), 16), 1).fillRect(hx - 1, hy, 2, 2);
        riders!.fillStyle(parseInt(SHIRTS[(v?.look ?? i) % SHIRTS.length].slice(1), 16), 1).fillRect(hx - 1, hy + 2, 2, 2);
      });
    }

    // Visitors (except those out on a jeep)
    this.sync(this.visitors, state.visitors, (v) => this.scene.add.image(0, 0, visitorKey(v.look)).setOrigin(0.5, 1));
    for (const v of state.visitors) {
      const img = this.visitors.get(v.id)!;
      img.setVisible(v.riding === null);
      if (v.riding !== null) continue;
      const { x, y } = this.visitorPosition(v);
      const moving = v.x !== v.px || v.y !== v.py;
      const stride = moving && this.sim.stepProgress >= 0.5;
      img.setTexture(visitorKey(v.look, stride ? 1 : 0, v.kid, v.items.includes('poncho')));
      fitPaintedImage(img);
      const vx = Math.round(x);
      const vy = Math.round(y) + (moving && !stride ? -1 : 0);
      img.setPosition(vx, vy);
      sh.fillEllipse(vx, Math.round(y) - 1, 7, 3);
      img.setDepth(depthAt(y));
      if (v.items.length || v.snack || v.sodaUntil > 0) this.drawCarried(propsFor(`visitor:${v.id}`, img.depth), v, vx, vy, img.displayHeight);
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
      fitPaintedImage(img);
      img.setPosition(Math.round(x), Math.round(y) + (working && Math.floor(time / 180) % 2 === 0 ? -1 : 0));
      img.setDepth(depthAt(y));
      sh.fillEllipse(Math.round(x), Math.round(y) - 1, 8, 3);
      const tools = m.role === 'janitor' || working ? propsFor(`staff:${m.id}`, img.depth) : null;
      if (m.role === 'janitor') {
        // Broom: handle up past the shoulder, bristles at the feet (they sweep while working).
        const bx = Math.round(x) + 4 + (working && Math.floor(time / 160) % 2 === 0 ? 1 : 0);
        const by = Math.round(y);
        tools!.lineStyle(1, 0x8a5a2a, 1).lineBetween(bx - 1, by - 10, bx, by - 2);
        tools!.fillStyle(0xd9b060, 1).fillRect(bx - 1, by - 2, 3, 2);
      }
      if (working) {
        // Busy sparks above the head.
        tools!.fillStyle(0xf2c14e, 1).fillRect(Math.round(x) + (Math.floor(time / 240) % 2 === 0 ? -3 : 2), Math.round(y) - 14, 1, 1);
      }
      if (this.selection?.kind === 'staff' && this.selection.id === m.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(Math.round(x), Math.round(y), 9, 4);
      }
    }
    if (this.selection?.kind === 'staff' && !state.staff.some((m) => m.id === this.selection!.id)) this.selection = null;

    // Eggs: nestled in the grass, wobbling as they get ready to hatch.
    this.sync(this.eggs, state.eggs, (e) => this.scene.add.image(0, 0, eggKey(e.species)).setOrigin(0.5, 1));
    for (const e of state.eggs) {
      const img = this.eggs.get(e.id)!;
      const x = e.x * TILE + TILE / 2;
      const y = e.y * TILE + FOOT_Y;
      const wobbling = hoursToHatch(state, e.laidHour) <= WOBBLE_HOURS && Math.floor(time / 400 + e.id) % 3 === 0;
      img.setPosition(x, y).setAngle(wobbling ? Math.sin(time / 60) * 12 : 0).setDepth(depthAt(y));
      sh.fillEllipse(x, y - 1, 9, 3);
      if (this.selection?.kind === 'egg' && this.selection.id === e.id) g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(x, y, 13, 5);
    }
    if (this.selection?.kind === 'egg' && !state.eggs.some((e) => e.id === this.selection!.id)) this.selection = null;

    const reactions = new Map<number, DinoReaction>();
    for (const e of this.effects) {
      const d = state.dinos.find(d => d.id === e.dinoId);
      if (d && e.kind === 'hearts') reactions.set(e.dinoId, dinoReaction(d.species,e.action,this.reactionTime-e.start,getSettings().animation,hasFunClips()));
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
      const reaction = reactions.get(d.id);
      const moving = d.x !== d.px || d.y !== d.py;
      if (this.sim.speed !== 0 && d.x !== d.px) this.facingLeft.set(d.id, d.x < d.px);
      let { x, y } = this.dinoPosition(d);
      // Authored walk poses lift the feet; keep planted legs on the ground.
      const hop = d.baby ? -2 : -1;
      const walking = moving && this.sim.speed !== 0;
      const bob = walking ? (dinoFrameCount(d.species) === 2 && this.sim.stepProgress < 0.5 ? hop : 0) : Math.sin(animalTime / 600 + d.id) > 0.9 ? -1 : 0;
      const habitat = habitatOf(d.species);
      const scale = dinoWorldScale(d.species) * (d.baby ? .6 : 1);
      const asleep = isAsleep(state, d);
      if (ART_STYLE !== 'original') {
        const model = BLENDER_ART[d.species];
        const modelPadding = 'modelOffsetX' in model ? model.modelOffsetX : 0;
        const previous = this.motions.get(d.id);
        const motion = advanceMotion(previous, {species:d.species,baby:d.baby,x,y,time:animalTime,offset:d.id*137,paused:this.sim.speed===0,moving,asleep,eatingSince:this.meals.get(d.id),ambient:getSettings().animation,style:ART_STYLE,happiness:d.happiness});
        this.motions.set(d.id,motion);
        x=motion.x; y=motion.y;
        const shownClip = reaction?.clip ?? motion.fun ?? motion.clip;
        img.setTexture(motionTexture(this.scene,d.species,d.baby),`${shownClip}-${reaction?.clip ? reaction.frame : motion.frame}`);
        fitPaintedImage(img);
        img.setCrop();
        if (habitat === 'water') {
          // Padding is above the animal; preserve the original submerged fraction.
          // A playful clip's taller canvas adds its room over the head, so count that too.
          const headroom=BLENDER_MOTION[d.species][shownClip].height-BLENDER_MOTION[d.species].walk.height;
          const shown=Math.round((BLENDER_MOTION[d.species].walk.height-8)*WATERLINE*scale)+Math.round((8+headroom)*scale)+1;
          img.setCrop(0,0,img.width,shown / img.scaleY);
          img.setPosition(Math.round(x),Math.round(y)-2+img.displayHeight-shown);
          sh.lineStyle(1,0xe8f6fb,.55).strokeEllipse(Math.round(x),Math.round(y)-2,(img.displayWidth-16*scale)*.8,4);
        } else {
          const lift=habitat==='air' && !asleep ? FLY_HEIGHT+Math.round(Math.sin(animalTime/520+d.id)*2) : 0;
          img.setPosition(Math.round(x),Math.round(y)-lift);
          // Transparent tail room does not increase the body's ground shadow.
          const groundWidth = img.displayWidth-(16+2*modelPadding)*scale;
          sh.fillStyle(0x000000,.22).fillEllipse(Math.round(x),Math.round(y)-1,Math.max(6,groundWidth*(habitat==='air'?.45:.7)),habitat==='air'?3:Math.max(4,(img.displayHeight-8*scale)*.14));
        }
        if (getSettings().animation && this.sim.speed!==0 && moving && previous && motion.frame!==previous.frame && this.scene.cameras.main.worldView.contains(x,y)) {
          const landed=walkLanding(d.species,d.baby,previous.frame,motion.frame);
          if (landed!==undefined || (habitat==='water' && motion.frame%2===0)) {
            const tile=state.map.tiles[d.y*state.map.width+d.x];
            const wet=habitat==='water'||isWater(tile)||tile===Terrain.Marsh||state.stormHours>0;
            const direction=this.facingLeft.get(d.id)?-1:1;
            this.footfalls.push({x:Math.round(x+(landed??0)*direction),y:Math.round(y)-1,born:animalTime,wet});
            if(this.footfalls.length>96)this.footfalls.shift();
          }
        }
      } else if (habitat === 'water') {
        // Swimming: flippers keep stroking; only the top of the animal shows above the water.
        img.setTexture(dinoKey(d.species, Math.floor(animalTime / (900 / dinoFrameCount(d.species)) + d.id) % dinoFrameCount(d.species), d.baby));
        fitPaintedImage(img);
        const shown = Math.round(img.displayHeight * WATERLINE);
        img.setCrop(0, 0, img.width, shown / img.scaleY);
        img.setPosition(Math.round(x), Math.round(y) - 2 + (img.displayHeight - shown) + (Math.sin(animalTime / 700 + d.id) > 0.6 ? 1 : 0));
        sh.lineStyle(1, 0xe8f6fb, 0.75).strokeEllipse(Math.round(x), Math.round(y) - 2, img.displayWidth * 0.8, 4);
      } else if (habitat === 'air') {
        // Flying: always flapping, bobbing about a tile up, with a shadow on the ground below (asleep: settled on the ground).
        const flapping = !asleep;
        img.setTexture(dinoKey(d.species, flapping ? Math.floor(animalTime / (480 / dinoFrameCount(d.species)) + d.id) % dinoFrameCount(d.species) : 0, d.baby));
        fitPaintedImage(img);
        const lift = flapping ? FLY_HEIGHT + Math.round(Math.sin(animalTime / 520 + d.id) * 2) : 0;
        img.setPosition(Math.round(x), Math.round(y) - lift);
        sh.fillEllipse(Math.round(x), Math.round(y) - 1, img.displayWidth * 0.45, 3);
      } else {
        img.setTexture(dinoKey(d.species, walkFrame(dinoFrameCount(d.species), moving, this.sim.stepProgress, this.sim.speed === 0, asleep), d.baby));
        fitPaintedImage(img);
        img.setPosition(Math.round(x), Math.round(y) + bob);
        sh.fillEllipse(Math.round(x), Math.round(y) - 1, img.displayWidth * 0.7, Math.max(4, img.displayHeight * 0.14));
      }
      if (reaction) img.y -= reaction.lift;
      img.setAngle(reaction?.angle ?? 0);
      img.setFlipX(this.facingLeft.get(d.id) ?? false);
      const bounds = img.getBounds();
      const opaque = (img.frame.customData as { dinoBounds?: DinoPixelBounds }).dinoBounds;
      if (opaque && img.angle !== 0) {
        // Keep fence masking aligned with the painted body during a head wiggle.
        const matrix = img.getWorldTransformMatrix();
        const left = img.flipX ? img.width - opaque.right : opaque.left;
        const right = img.flipX ? img.width - opaque.left : opaque.right;
        const corners = [[left,opaque.top],[right,opaque.top],[left,opaque.bottom],[right,opaque.bottom]]
          .map(([ox,oy]) => matrix.transformPoint(ox-img.displayOriginX,oy-img.displayOriginY));
        const xs = corners.map(p=>p.x), ys = corners.map(p=>p.y);
        bounds.setTo(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
      } else if (opaque) {
        const left = bounds.left, top = bounds.top;
        bounds.setTo(left + (img.flipX ? img.displayWidth - opaque.right * img.scaleX : opaque.left * img.scaleX), top + opaque.top * img.scaleY,
          (opaque.right - opaque.left) * img.scaleX, (opaque.bottom - opaque.top) * img.scaleY);
      }
      // Swimmers' cropped-away pixels cannot overlap a fence above the waterline.
      if (habitat === 'water') bounds.bottom = Math.min(bounds.bottom, y - 2);
      img.setDepth(depthAt(y));
      for (const key of obscuringFenceKeys(state, y, bounds)) this.obscuringFences.add(key);

      const top = ART_STYLE!=='original' ? Math.round(img.y)-img.displayHeight+Math.round(8*scale)-3 : Math.round(y)-img.displayHeight-3;
      const cx = Math.round(x);
      if (d.escaped) {
        // Escaped: pulsing orange ring and a double "!".
        const pulse = Math.floor(time / 300) % 2 === 0;
        g.lineStyle(1, 0xff9f43, pulse ? 1 : 0.5).strokeEllipse(cx, Math.round(y), Math.max(14, img.displayWidth), 6);
        g.fillStyle(0x1b1b14, 1).fillRect(cx - 4, top - 7, 8, 9);
        g.fillStyle(0xff9f43, 1).fillRect(cx - 3, top - 6, 2, 4).fillRect(cx - 3, top - 1, 2, 2);
        g.fillRect(cx + 1, top - 6, 2, 4).fillRect(cx + 1, top - 1, 2, 2);
      } else if (d.sick) {
        // Sick: green cross.
        g.fillStyle(0x1b1b14, 1).fillRect(cx - 3, top - 7, 7, 7);
        g.fillStyle(0x6fd36a, 1).fillRect(cx - 2, top - 5, 5, 1).fillRect(cx, top - 6, 1, 5);
      } else if (asleep) {
        // Zz: little letters drifting up from a sleeping animal.
        for (let i = 0; i < 2; i++) {
          const t = ((time / 1400 + i * 0.5 + d.id * 0.13) % 1 + 1) % 1;
          const zx = cx + 3 + i * 4 + Math.round(t * 3);
          const zy = top - Math.round(t * 8) + 2;
          g.fillStyle(0xf4ecd2, 1 - t);
          for (const [row, bits] of ZZZ.entries()) for (let c = 0; c < bits.length; c++) if (bits[c] === 'X') g.fillRect(zx + c, zy + row, 1, 1);
        }
      } else if (d.hunger >= 75 || d.health < 50) {
        // Red "!" above animals that need help.
        g.fillStyle(0x1b1b14, 1).fillRect(Math.round(x) - 2, top - 7, 4, 9);
        g.fillStyle(0xff5a4a, 1).fillRect(Math.round(x) - 1, top - 6, 2, 4).fillRect(Math.round(x) - 1, top - 1, 2, 2);
      }
      if (this.selection?.kind === 'dino' && this.selection.id === d.id) {
        g.lineStyle(1, 0xf2c14e, 1).strokeEllipse(Math.round(x), Math.round(y), Math.max(12, img.displayWidth * 0.8), 5);
      }
    }
    for (const [id, img] of this.dinos) {
      if (!liveDinos.has(id)) {
        img.destroy();
        this.dinos.delete(id);
        this.facingLeft.delete(id);
        this.motions.delete(id);
        this.meals.delete(id);
        if (this.selection?.kind === 'dino' && this.selection.id === id) this.selection = null;
      }
    }
    // A newly spawned animal can eat and disappear between rendered frames.
    for (const [id, started] of this.meals) {
      if (!liveDinos.has(id) || animalTime - started >= 600) this.meals.delete(id);
    }
    for (const [key, props] of this.attachments) {
      if (!liveAttachments.has(key)) {
        props.destroy();
        this.attachments.delete(key);
      }
    }
  }

  /** Bounded, native-pixel footfalls and wakes; the clock stops with the park. */
  private drawFootfalls(): void {
    const g=this.tracks.clear();
    this.footfalls=this.footfalls.filter(p=>this.animalTime-p.born<600);
    if(!getSettings().animation){this.footfalls=[];return;}
    for(const p of this.footfalls){
      const t=(this.animalTime-p.born)/600;
      if(p.wet)g.lineStyle(1,0xc8e8df,(1-t)*.55).strokeEllipse(p.x,p.y,3+t*9,2+t*3);
      else g.fillStyle(0xbda774,(1-t)*.4).fillRect(p.x-1-Math.round(t*2),p.y-Math.round(t*3),2,1).fillRect(p.x+Math.round(t*3),p.y-Math.round(t*2),1,1);
    }
  }

  /** Rising hearts, or a cross little "Nope!" sign, over animals that were just treated or patted. */
  private drawEffects(g: Phaser.GameObjects.Graphics, time: number): void {
    this.effects = this.effects.filter((e) => {
      const d = this.sim.state.dinos.find((x) => x.id === e.dinoId);
      const img = this.dinos.get(e.dinoId);
      const t = (time - e.start) / EFFECT_MS;
      if (!d || !img || t >= 1) {
        e.label?.destroy();
        return false;
      }
      const top = img.y - img.displayHeight - 2;
      if (e.kind === 'hearts') {
        for (let i = 0; i < 3; i++) {
          const ti = t - i * 0.15;
          if (ti < 0) continue;
          const hx = Math.round(img.x + (i - 1) * 6 + Math.sin(ti * 8 + i) * 2);
          const hy = Math.round(top - ti * 14);
          g.fillStyle(0xff5a7a, 1 - ti);
          if (ART_STYLE === 'cartoon') {
            g.fillCircle(hx-1,hy+1,1.5).fillCircle(hx+1,hy+1,1.5).fillTriangle(hx-2.3,hy+1,hx+2.3,hy+1,hx,hy+4);
          } else for (const [row, bits] of HEART.entries()) for (let c = 0; c < bits.length; c++) if (bits[c] === 'X') g.fillRect(hx - 2 + c, hy + row, 1, 1);
        }
      } else {
        if (!e.label) {
          e.label = this.scene.add
            .text(0, 0, 'Nope!', { fontFamily: ART_STYLE === 'cartoon' ? 'Trebuchet MS, sans-serif' : 'Silkscreen, monospace', fontSize: '8px', color: '#ffffff', backgroundColor: '#b3261e', padding: { x: 2, y: 1 } })
            .setResolution(4)
            .setOrigin(0.5, 1)
            .setDepth(9.5);
        }
        const shake = t < 0.3 ? Math.round(Math.sin(t * 60)) : 0;
        e.label.setPosition(Math.round(img.x) + shake, Math.round(top - 2)).setAlpha(t > 0.75 ? (1 - t) * 4 : 1);
      }
      return true;
    });
  }

  /** Litter (cups and wrappers scattered by hash) and accident puddles with buzzing flies. */
  private drawDirt(time: number): void {
    const g = this.dirt.clear();
    for (const m of this.sim.state.messes) {
      const ox = m.x * TILE + 3 + Math.floor(hash2(m.id, 1, 9) * 10);
      const oy = m.y * TILE + 4 + Math.floor(hash2(m.id, 2, 9) * 9);
      if (m.kind === 'dung') {
        // A little heap (two sizes, picked by id); fresh ones steam.
        const big = hash2(m.id, 3, 9) > 0.5;
        g.fillStyle(0x3f2a16, 1).fillEllipse(ox, oy, big ? 7 : 5, big ? 3 : 2);
        g.fillStyle(0x5a3d20, 1).fillEllipse(ox, oy - 1, big ? 5 : 3, 2);
        g.fillStyle(0x6e4c2a, 1).fillRect(ox - 1, oy - (big ? 3 : 2), 2, 1);
        if (this.sim.state.hours - m.hour < 6) {
          const t = Math.floor(time / 250 + m.id) % 3;
          g.fillStyle(0xf4ecd2, 0.5).fillRect(ox - 1 + (t === 1 ? 1 : 0), oy - 5 - t, 1, 1);
        }
      } else if (m.kind === 'mess' && accidentKind(m.id) === 'pee') {
        // A yellow puddle with a glint.
        g.fillStyle(0xc9a82a, 0.75).fillEllipse(ox, oy, 9, 4);
        g.fillStyle(0xf2d24e, 0.85).fillEllipse(ox - 1, oy, 6, 2);
        g.fillStyle(0xfff6c4, 0.9).fillRect(ox - 2, oy - 1, 2, 1);
      } else if (m.kind === 'mess') {
        // A little brown swirl, with flies buzzing round it.
        g.fillStyle(0x4a3018, 1).fillEllipse(ox, oy, 6, 3);
        g.fillStyle(0x6b4424, 1).fillEllipse(ox, oy - 1, 4, 2);
        g.fillStyle(0x7e5230, 1).fillRect(ox - 1, oy - 3, 2, 1);
        const f = Math.floor(time / 120 + m.id);
        g.fillStyle(0x101010, 1).fillRect(ox - 3 + (f % 3), oy - 5 - (f % 2), 1, 1).fillRect(ox + 2 - (f % 2), oy - 7 + (f % 3), 1, 1);
      } else {
        const kind = m.id % 3;
        if (kind === 0) {
          g.fillStyle(0xe05a4f, 1).fillRect(ox, oy, 2, 3); // soda cup on its side
          g.fillStyle(0xf4ecd2, 1).fillRect(ox + 2, oy, 1, 3);
        } else if (kind === 1) {
          g.fillStyle(0xf4ecd2, 1).fillRect(ox, oy, 3, 2); // wrapper
          g.fillStyle(0xf2c14e, 1).fillRect(ox + 1, oy, 1, 1);
        } else {
          g.fillStyle(0xd9a45a, 1).fillRect(ox, oy, 2, 2); // popcorn box
          g.fillStyle(0xe05a4f, 1).fillRect(ox, oy + 1, 2, 1);
        }
      }
    }
  }

  /** What a visitor is carrying: cap, balloon, plush, umbrella, and whatever they're eating and drinking. */
  private drawCarried(g: Phaser.GameObjects.Graphics, v: Visitor, x: number, y: number, h: number): void {
    const top = y - h + 1;
    const { state } = this.sim;
    if (v.items.includes('umbrella')) {
      if (state.stormHours > 0) {
        // Open over their head.
        const c = BALLOONS[(v.id + 1) % BALLOONS.length];
        g.lineStyle(1, 0x3b3b3b, 1).lineBetween(x + 1, top - 3, x + 1, y - 7);
        g.fillStyle(c, 1).fillRect(x - 4, top - 5, 11, 2).fillRect(x - 2, top - 6, 7, 1);
        g.fillStyle(0xffffff, 0.35).fillRect(x - 1, top - 6, 2, 1);
      } else {
        g.lineStyle(1, 0x3b3b3b, 1).lineBetween(x - 4, y - 7, x - 5, y - 1); // furled, hanging from the hand
      }
    }
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
    if (v.snack === 'icecream') {
      g.fillStyle(0xd9a45a, 1).fillRect(x + 3, y - 6, 2, 3); // cone
      g.fillStyle(v.id % 2 ? 0xf28fb1 : 0xf4ecd2, 1).fillRect(x + 2, y - 8, 4, 2); // scoop
    } else if (v.snack === 'popcorn') {
      g.fillStyle(0xf4ecd2, 1).fillRect(x + 2, y - 8, 4, 2); // popped kernels
      g.fillStyle(0xe05a4f, 1).fillRect(x + 2, y - 6, 4, 3); // striped box
      g.fillStyle(0xf4ecd2, 1).fillRect(x + 3, y - 6, 1, 3);
    } else if (v.snack === 'hotdog') {
      g.fillStyle(0xe0b070, 1).fillRect(x + 2, y - 6, 5, 2); // bun
      g.fillStyle(0xb8453a, 1).fillRect(x + 1, y - 7, 7, 1); // sausage
      g.fillStyle(0xf2d24e, 1).fillRect(x + 3, y - 7, 2, 1); // mustard
    }
    if (v.sodaUntil > 0) {
      const sx = v.items.includes('plush') ? x - 7 : x - 5;
      g.fillStyle(0xf4ecd2, 1).fillRect(sx + 1, y - 10, 1, 2); // straw
      g.fillStyle(0xe05a4f, 1).fillRect(sx, y - 8, 3, 4); // cup
      g.fillStyle(0xf4ecd2, 1).fillRect(sx, y - 6, 3, 1);
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
      if (!sprites.has(e.id)) {
        const image = create(e);
        fitPaintedImage(image);
        sprites.set(e.id, image);
      }
    }
    for (const [id, img] of sprites) {
      if (!live.has(id)) {
        img.destroy();
        sprites.delete(id);
      }
    }
  }
}
