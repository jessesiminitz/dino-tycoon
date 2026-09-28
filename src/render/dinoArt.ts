import { hash2 } from '../sim/rng';
import type { Species, SpeciesId } from '../sim/data/species';

/**
 * Dinosaur sprites, built per species from simple shapes (tapered limbs,
 * ellipses and polygons) rasterised into a grid of palette keys, then shaded
 * and outlined. Everything faces right with the feet on the bottom row.
 *
 *   B body · D belly · F far-side limbs (in shadow) · A accent (plates, frill,
 *   crest, feathers) · G far-side accent · W horn/claw/teeth · E eye · M mouth
 *
 * No Phaser dependency, so the DOM catalog and guide can reuse the canvases.
 */

type Key = 'B' | 'D' | 'F' | 'A' | 'G' | 'W' | 'E' | 'M';
type Pt = [number, number];
type Node3 = [number, number, number];

class Sprite {
  readonly grid: (Key | null)[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.grid = Array.from({ length: h }, () => new Array<Key | null>(w).fill(null));
  }
  /** Bottom row: where the feet stand. */
  get ground(): number {
    return this.h - 1;
  }
  get(x: number, y: number): Key | null {
    return this.grid[y]?.[x] ?? null;
  }
  /** Paints one pixel; with `only`, just over pixels already painted with those keys. */
  set(x: number, y: number, k: Key, only?: Key[]): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const cur = this.grid[y][x];
    if (only && (cur === null || !only.includes(cur))) return;
    this.grid[y][x] = k;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, k: Key, only?: Key[]): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, k, only);
      }
  }
  /** A tapered tube through points [x, y, radius]: tails, necks, legs. */
  limb(pts: Node3[], k: Key, only?: Key[]): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1, r1] = pts[i];
      const [x2, y2, r2] = pts[i + 1];
      const minX = Math.floor(Math.min(x1 - r1, x2 - r2)) - 1;
      const maxX = Math.ceil(Math.max(x1 + r1, x2 + r2)) + 1;
      const minY = Math.floor(Math.min(y1 - r1, y2 - r2)) - 1;
      const maxY = Math.ceil(Math.max(y1 + r1, y2 + r2)) + 1;
      const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len2));
          const d = Math.hypot(x - (x1 + (x2 - x1) * t), y - (y1 + (y2 - y1) * t));
          if (d <= r1 + (r2 - r1) * t) this.set(x, y, k, only);
        }
    }
  }
  poly(points: Pt[], k: Key, only?: Key[]): void {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      const yc = y + 0.5;
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.set(x, y, k, only);
    }
  }
  line(x1: number, y1: number, x2: number, y2: number, k: Key, only?: Key[]): void {
    const n = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1));
    for (let i = 0; i <= n; i++) this.set(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, k, only);
  }
}

/** Leg swing for the two walk frames: near and far legs move opposite ways. */
const swing = (frame: 0 | 1, near: boolean) => (frame === 0 ? (near ? 0.35 : -0.35) : near ? -0.45 : 0.45);

/**
 * Bird-like hind leg: a heavy thigh down and forward to the knee, the shin
 * back to a raised ankle, then the toes flat on the ground.
 */
function hindLeg(s: Sprite, hx: number, hy: number, len: number, thick: number, sw: number, k: Key, foot = 3): void {
  const g = s.ground;
  const kneeX = hx + len * 0.22 + sw * len * 0.25;
  const kneeY = hy + (g - hy) * 0.45;
  const ankleX = hx - len * 0.08 + sw * len * 0.35;
  const ankleY = g - Math.max(1.5, (g - hy) * 0.18);
  s.limb([[hx, hy, thick], [kneeX, kneeY, thick * 0.62], [ankleX, ankleY, Math.max(1, thick * 0.35)]], k);
  s.limb([[ankleX, ankleY, Math.max(1, thick * 0.35)], [ankleX + foot, g - 0.3, 0.8]], k);
}

/** Sturdy pillar leg for four-legged animals, slightly bent, with a broad foot. */
function pillarLeg(s: Sprite, x: number, y: number, thick: number, sw: number, k: Key, bendBack = false): void {
  const g = s.ground;
  const midX = x + (bendBack ? -1 : 1) * 0.8 + sw * 1.5;
  const footX = x + sw * 3;
  s.limb([[x, y, thick], [midX, (y + g) / 2, thick * 0.8], [footX, g - 1, thick * 0.75]], k);
  s.limb([[footX - thick * 0.5, g, 1], [footX + thick * 0.9, g, 1]], k);
}

interface TheropodSpec {
  hip: Pt;
  body: { len: number; depth: number; tilt?: number };
  tail: { len: number; rise?: number };
  neck: { len: number; thick: number; up: number };
  head: { len: number; depth: number };
  leg: { len: number; thick: number };
  arm?: { len: number; thick: number };
  teeth?: boolean;
  foot?: number;
}

interface Head {
  hx: number;
  hy: number;
  hl: number;
  hd: number;
  eye: Pt;
}

/** Two-legged dinosaur: body balanced over the hips, tail out behind. Returns the head's geometry for extras. */
function theropod(s: Sprite, p: TheropodSpec, frame: 0 | 1): Head {
  const [hipX, hipY] = p.hip;
  const chestX = hipX + p.body.len * 0.8;
  const chestY = hipY - (p.body.tilt ?? 0);
  hindLeg(s, hipX - 1, hipY + 1, p.leg.len, p.leg.thick, swing(frame, false), 'F', p.foot);
  // Tail: thick at the hips, whip-thin at the tip, held out level.
  const tl = p.tail.len;
  const rise = p.tail.rise ?? 1;
  s.limb(
    [
      [hipX, hipY - p.body.depth * 0.2, p.body.depth * 0.75],
      [hipX - tl * 0.45, hipY - rise * 0.5 - 0.5, p.body.depth * 0.4],
      [hipX - tl, hipY - rise, 0.6],
    ],
    'B',
  );
  // Body, rising from the hips to the chest.
  s.limb([[hipX, hipY - p.body.depth * 0.25, p.body.depth], [chestX, chestY, p.body.depth * 0.85]], 'B');
  // Neck curving up to the head.
  const hx = chestX + p.neck.len * 0.45;
  const hy = chestY - p.neck.up;
  s.limb(
    [
      [chestX, chestY - p.body.depth * 0.3, p.neck.thick],
      [chestX + p.neck.len * 0.35, chestY - p.neck.up * 0.7, p.neck.thick * 0.85],
      [hx, hy, p.neck.thick * 0.8],
    ],
    'B',
  );
  // Skull: deep at the back, tapering to the snout.
  const hl = p.head.len;
  const hd = p.head.depth;
  s.poly(
    [
      [hx - 1, hy - hd * 0.55],
      [hx + hl * 0.55, hy - hd * 0.45],
      [hx + hl, hy - hd * 0.15],
      [hx + hl, hy + hd * 0.3],
      [hx + hl * 0.3, hy + hd * 0.5],
      [hx - 1, hy + hd * 0.45],
    ],
    'B',
  );
  s.ellipse(hx, hy, hd * 0.45, hd * 0.55, 'B');
  // Paler underside of the body.
  s.limb([[hipX + 1, hipY + p.body.depth * 0.55, p.body.depth * 0.5], [chestX, chestY + p.body.depth * 0.5, p.body.depth * 0.45]], 'D', ['B']);
  // Mouth line, teeth and eye.
  const my = Math.round(hy + hd * 0.18);
  s.line(hx + hl * 0.25, my, hx + hl - 0.5, my - 0.5, 'M', ['B']);
  if (p.teeth) for (let x = hx + hl * 0.35; x < hx + hl - 1; x += 2) s.set(x, my + 1, 'W', ['B']);
  const eye: Pt = [Math.round(hx + hl * 0.2), Math.round(hy - hd * 0.2)];
  s.set(eye[0], eye[1], 'E');
  if (p.arm) {
    const ax = chestX + 0.5;
    const ay = chestY + p.body.depth * 0.35;
    const lift = frame === 0 ? 0 : 0.6;
    s.limb(
      [
        [ax, ay, p.arm.thick],
        [ax + p.arm.len * 0.5, ay + p.arm.len * 0.55 + lift, p.arm.thick * 0.7],
        [ax + p.arm.len, ay + p.arm.len * 0.35 + lift, 0.6],
      ],
      'B',
    );
    s.set(ax + p.arm.len + 1, ay + p.arm.len * 0.35 + lift + 1, 'W');
  }
  hindLeg(s, hipX, hipY + 1, p.leg.len, p.leg.thick, swing(frame, true), 'B', p.foot);
  return { hx, hy, hl, hd, eye };
}

interface QuadSpec {
  /** Body ellipse: centre x, centre y, half-length, half-depth. */
  body: [number, number, number, number];
  hip: Pt;
  shoulder: Pt;
  /** Front and back leg thickness. */
  legThick: [number, number];
  tail: Node3[];
  neck: Node3[];
}

/** Four-legged plant-eater: barrel body on pillar legs, far legs in shadow. */
function quadruped(s: Sprite, q: QuadSpec, frame: 0 | 1): void {
  const [hx, hy] = q.hip;
  const [sx, sy] = q.shoulder;
  pillarLeg(s, hx - 1.5, hy, q.legThick[1] * 0.9, swing(frame, false), 'F', true);
  pillarLeg(s, sx + 1.5, sy, q.legThick[0] * 0.9, swing(frame, true), 'F');
  s.limb(q.tail, 'B');
  const [cx, cy, rx, ry] = q.body;
  s.ellipse(cx, cy, rx, ry, 'B');
  s.limb(q.neck, 'B');
  s.ellipse(cx + 1, cy + ry * 0.55, rx * 0.8, ry * 0.45, 'D', ['B']);
  pillarLeg(s, hx + 1, hy + 1, q.legThick[1], swing(frame, true), 'B', true);
  pillarLeg(s, sx - 1, sy + 1, q.legThick[0], swing(frame, false), 'B');
}

type Painter = (frame: 0 | 1) => Sprite;

const ART: Record<SpeciesId, Painter> = {
  // Chicken-sized hunter: slender, with a very long tail.
  compsognathus: (f) => {
    const s = new Sprite(28, 16);
    theropod(
      s,
      {
        hip: [11, 8],
        body: { len: 5, depth: 2.2, tilt: 1 },
        tail: { len: 11, rise: 2 },
        neck: { len: 5, thick: 1.2, up: 4 },
        head: { len: 5, depth: 3 },
        leg: { len: 7, thick: 1.5 },
        arm: { len: 2.5, thick: 0.8 },
        teeth: true,
        foot: 2,
      },
      f,
    );
    return s;
  },

  // Turkey-sized and feathered, with a stiff tail and the raised sickle claw.
  velociraptor: (f) => {
    const s = new Sprite(36, 22);
    s.poly([[1, 4], [8, 6], [8, 10], [0, 8]], 'G'); // tail-feather fan
    const h = theropod(
      s,
      {
        hip: [15, 11],
        body: { len: 7, depth: 3.2, tilt: 1.5 },
        tail: { len: 14, rise: 3 },
        neck: { len: 6, thick: 1.8, up: 5 },
        head: { len: 8, depth: 3.4 },
        leg: { len: 10, thick: 2.2 },
        arm: { len: 4, thick: 1.1 },
        teeth: true,
        foot: 3,
      },
      f,
    );
    // Feathery crest down the back of the head, and wing feathers on the arm.
    s.line(h.hx - 3, h.hy - 2, h.hx, h.hy - 3, 'A');
    s.poly([[21, 11], [26, 13], [25, 17], [21, 14]], 'A');
    // Sickle claw on the near foot, held off the ground.
    const g = s.ground;
    const toe = 15 + swing(f, true) * 3.5 - 1;
    s.set(toe, g - 2, 'W');
    s.set(toe + 1, g - 3, 'W');
    return s;
  },

  // Slim early hunter with two thin crests on its head.
  dilophosaurus: (f) => {
    const s = new Sprite(44, 30);
    const h = theropod(
      s,
      {
        hip: [18, 15],
        body: { len: 9, depth: 4.2, tilt: 2 },
        tail: { len: 17, rise: 3 },
        neck: { len: 8, thick: 2.4, up: 7 },
        head: { len: 9, depth: 4.4 },
        leg: { len: 13, thick: 3 },
        arm: { len: 5, thick: 1.3 },
        teeth: true,
        foot: 4,
      },
      f,
    );
    for (const [dx, k] of [[-2, 'G'], [1, 'A']] as const) {
      const x0 = h.hx + dx;
      const y0 = h.hy - h.hd * 0.5;
      s.line(x0, y0, x0 + 2, y0 - 4, k);
      s.line(x0 + 1, y0, x0 + 3, y0 - 4, k);
      s.line(x0 + 2, y0 - 4, x0 + 6, y0 + 0.5, k);
    }
    s.set(h.eye[0], h.eye[1], 'E');
    return s;
  },

  // Big Jurassic hunter: long skull, little horns in front of the eyes.
  allosaurus: (f) => {
    const s = new Sprite(56, 36);
    const h = theropod(
      s,
      {
        hip: [23, 18],
        body: { len: 12, depth: 5.5, tilt: 2 },
        tail: { len: 22, rise: 3 },
        neck: { len: 9, thick: 3.2, up: 7 },
        head: { len: 13, depth: 6 },
        leg: { len: 16, thick: 4 },
        arm: { len: 6, thick: 1.7 },
        teeth: true,
        foot: 5,
      },
      f,
    );
    s.poly([[h.eye[0] - 1, h.eye[1] - 2], [h.eye[0] + 2, h.eye[1] - 2], [h.eye[0] + 1, h.eye[1] - 5]], 'A');
    s.line(h.hx + 5, h.hy - h.hd * 0.48, h.hx + h.hl - 2, h.hy - h.hd * 0.25, 'A', ['B']);
    return s;
  },

  // Massive deep skull, thick legs and famously tiny arms.
  tyrannosaurus: (f) => {
    const s = new Sprite(66, 44);
    const h = theropod(
      s,
      {
        hip: [27, 22],
        body: { len: 13, depth: 7.5, tilt: 3 },
        tail: { len: 26, rise: 4 },
        neck: { len: 8, thick: 5, up: 7 },
        head: { len: 17, depth: 9.5 },
        leg: { len: 20, thick: 5.5 },
        arm: { len: 4, thick: 1.4 },
        teeth: true,
        foot: 6,
      },
      f,
    );
    // Heavy brow ridge and a deep lower jaw.
    s.line(h.eye[0] - 2, h.eye[1] - 2, h.eye[0] + 2, h.eye[1] - 2, 'D', ['B']);
    s.limb([[h.hx + 1, h.hy + h.hd * 0.35, 2], [h.hx + h.hl * 0.8, h.hy + h.hd * 0.35, 1.2]], 'B');
    return s;
  },

  // Two-legged plant-eater with a thick bony dome ringed by knobs.
  pachycephalosaurus: (f) => {
    const s = new Sprite(36, 28);
    const h = theropod(
      s,
      {
        hip: [15, 15],
        body: { len: 8, depth: 4.5, tilt: 1 },
        tail: { len: 13, rise: 1 },
        neck: { len: 6, thick: 2.2, up: 6 },
        head: { len: 6, depth: 4.2 },
        leg: { len: 11, thick: 3 },
        arm: { len: 3.5, thick: 1.2 },
        foot: 3,
      },
      f,
    );
    s.ellipse(h.hx + 1.5, h.hy - h.hd * 0.55, 4.2, 3.6, 'A');
    for (const [dx, dy] of [[-3, 0], [-2, 2], [4, 1], [5, -1]]) s.set(h.hx + 1.5 + dx, h.hy - h.hd * 0.3 + dy, 'W');
    s.set(h.eye[0], h.eye[1] + 1, 'E');
    return s;
  },

  // Duck-billed, long hind legs, and the long tube crest sweeping back.
  parasaurolophus: (f) => {
    const s = new Sprite(50, 36);
    pillarLeg(s, 33, 20, 1.6, swing(f, false), 'F');
    hindLeg(s, 18, 18, 14, 3.8, swing(f, false), 'F', 5);
    s.limb([[18, 14, 5], [9, 13, 3], [1, 11, 0.8]], 'B');
    s.limb([[18, 15, 6], [31, 14, 5]], 'B');
    s.limb([[31, 13, 3.5], [35, 8, 2.8], [38, 5, 2.4]], 'B');
    s.poly([[35, 2], [40, 2], [46, 5], [46, 7], [40, 8], [36, 7]], 'B');
    s.limb([[37, 3, 1.4], [30, 0.8, 1.2], [25, 1.5, 1]], 'A');
    s.line(41, 6, 45, 6, 'M', ['B']);
    s.set(39, 4, 'E');
    s.limb([[20, 18, 3], [30, 17, 2.5]], 'D', ['B']);
    pillarLeg(s, 31, 20, 1.8, swing(f, true), 'B');
    hindLeg(s, 19, 18, 14, 4, swing(f, true), 'B', 5);
    return s;
  },

  // Sheep-sized: small neck frill, parrot beak, no big horns.
  protoceratops: (f) => {
    const s = new Sprite(34, 20);
    quadruped(
      s,
      {
        body: [14, 10, 9, 5],
        hip: [9, 12],
        shoulder: [20, 12],
        legThick: [1.8, 2.2],
        tail: [[7, 9, 3.5], [1, 11, 1]],
        neck: [[20, 9, 3.5], [24, 9, 3]],
      },
      f,
    );
    s.ellipse(23, 6, 3, 4.5, 'A');
    s.poly([[24, 6], [29, 7], [31, 10], [30, 12], [25, 12]], 'B');
    s.poly([[29, 8], [32, 10], [30, 12]], 'M');
    s.set(26, 8, 'E');
    return s;
  },

  // Great frill, two long brow horns and a short nose horn over a beak.
  triceratops: (f) => {
    const s = new Sprite(60, 34);
    quadruped(
      s,
      {
        body: [24, 16, 17, 9],
        hip: [15, 20],
        shoulder: [34, 21],
        legThick: [3.6, 4.2],
        tail: [[10, 14, 5.5], [0, 19, 1]],
        neck: [[38, 16, 6], [42, 17, 5.5]],
      },
      f,
    );
    s.ellipse(42, 12, 7, 10, 'A');
    s.ellipse(42, 12, 5, 8, 'G', ['A']);
    for (let a = -2.2; a <= 0.6; a += 0.45) s.set(42 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 10.5, 'A');
    s.poly([[42, 13], [50, 14], [56, 19], [56, 23], [51, 25], [44, 23]], 'B');
    s.poly([[53, 20], [58, 22], [56, 25], [53, 24]], 'M');
    s.limb([[48, 15, 1.6], [53, 10, 1], [57, 7, 0.4]], 'W');
    s.limb([[46, 15, 1.4], [50, 10, 0.9], [53, 8, 0.4]], 'W');
    s.limb([[54, 18, 1.2], [56, 15, 0.4]], 'W');
    s.set(49, 17, 'E');
    return s;
  },

  // Arched back with two rows of plates, a small low head, and tail spikes.
  stegosaurus: (f) => {
    const s = new Sprite(58, 36);
    const back = (x: number) => 18 - 10 * Math.exp(-(((x - 24) / 14) ** 2));
    const plate = (x: number, size: number, k: Key) => {
      const y = back(x) + 1;
      s.poly([[x - size * 0.55, y], [x - size * 0.15, y - size * 1.1], [x + size * 0.3, y - size * 1.25], [x + size * 0.6, y]], k);
    };
    for (let x = 12; x <= 38; x += 5) plate(x + 2.5, 3 + 3 * Math.exp(-(((x - 24) / 11) ** 2)), 'G');
    quadruped(
      s,
      {
        body: [25, 18, 16, 10],
        hip: [18, 22],
        shoulder: [35, 25],
        legThick: [2.8, 4.2],
        tail: [[12, 17, 6], [5, 19, 3], [0, 16, 1.2]],
        neck: [[38, 22, 4.5], [45, 25, 3], [48, 26, 2.6]],
      },
      f,
    );
    for (let x = 10; x <= 38; x += 5) plate(x, 3.5 + 4 * Math.exp(-(((x - 24) / 11) ** 2)), 'A');
    s.poly([[46, 23], [52, 23], [56, 26], [55, 29], [47, 29]], 'B');
    s.set(50, 25, 'E');
    s.line(52, 28, 55, 28, 'M', ['B']);
    // Thagomizer: two pairs of long spikes near the tail tip, pointing up and back.
    for (const [x, y, dx, dy, k] of [[6, 17, -1, -6, 'G'], [3, 16, -3, -5, 'G'], [7, 18, 1, -6, 'W'], [4, 17, -2, -6, 'W']] as const) s.limb([[x, y, 1], [x + dx, y + dy, 0.3]], k);
    return s;
  },

  // Low, wide and armoured, with side spikes and a bony club on the tail.
  ankylosaurus: (f) => {
    const s = new Sprite(54, 26);
    quadruped(
      s,
      {
        body: [25, 13, 17, 7.5],
        hip: [17, 16],
        shoulder: [33, 16],
        legThick: [3.2, 3.6],
        tail: [[10, 12, 4.5], [3, 13, 2], [0, 13, 1.5]],
        neck: [[40, 13, 4.5], [44, 14, 4]],
      },
      f,
    );
    s.ellipse(2.5, 13, 3, 2.6, 'A');
    for (let row = 0; row < 3; row++)
      for (let x = 12 + row * 2; x <= 38; x += 4) {
        const y = 13 - Math.sqrt(Math.max(0, 1 - ((x - 25) / 17) ** 2)) * 7.5 + 1 + row * 2.5;
        s.ellipse(x, y, 1.4, 1, 'A', ['B', 'D']);
      }
    for (let x = 14; x <= 36; x += 5) s.poly([[x - 1, 16], [x + 1, 16], [x, 19]], 'W');
    s.poly([[43, 10], [49, 11], [52, 14], [50, 17], [43, 17]], 'B');
    s.limb([[44, 11, 1], [42, 9, 0.4]], 'W');
    s.limb([[46, 16, 1], [45, 19, 0.4]], 'W');
    s.set(47, 13, 'E');
    s.line(48, 15, 51, 15, 'M', ['B']);
    return s;
  },

  // Sea reptile: broad body, long neck and small head, four paddle flippers that "fly" through the water.
  plesiosaurus: (f) => {
    const s = new Sprite(54, 22);
    const stroke = f === 0 ? 0 : 1;
    // Far-side flippers first, in shadow.
    s.limb([[31, 14, 1.8], [36 - stroke * 3, 18 + stroke, 1.1], [39 - stroke * 5, 19 + stroke * 2, 0.5]], 'F');
    s.limb([[15, 14, 1.6], [19 - stroke * 3, 18 + stroke, 1], [21 - stroke * 5, 19 + stroke, 0.5]], 'F');
    s.limb([[12, 14, 3], [5, 15, 1.6], [1, 16, 0.6]], 'B'); // short tail
    s.ellipse(22, 14, 12, 5, 'B');
    s.limb([[31, 12, 3.2], [38, 8, 2.3], [44, 5, 1.8]], 'B'); // long neck
    s.ellipse(46.5, 4, 3.2, 2.3, 'B');
    s.poly([[47, 3], [53, 4], [53, 5.5], [47, 6]], 'B'); // snout
    s.line(49, 5, 53, 5, 'M', ['B']);
    for (const x of [50, 52]) s.set(x, 6, 'W');
    s.set(47, 3, 'E');
    s.ellipse(23, 17, 10, 2.5, 'D', ['B']);
    // Near-side flippers.
    s.limb([[29, 16, 2.2], [34 + stroke * 3, 20 - stroke, 1.3], [38 + stroke * 4, 21 - stroke * 2, 0.5]], 'B');
    s.limb([[14, 16, 2], [18 + stroke * 3, 20 - stroke, 1.2], [21 + stroke * 4, 21 - stroke, 0.5]], 'B');
    return s;
  },

  // Giant sea lizard: long powerful body, big toothy jaws, paddle flippers and a shark-like tail fin.
  mosasaurus: (f) => {
    const s = new Sprite(64, 22);
    const sweep = f === 0 ? 0 : 1.5;
    s.limb([[40, 14, 2], [44, 18, 1.2], [46, 19, 0.5]], 'F');
    s.limb([[20, 14, 1.8], [23, 18, 1], [24, 19, 0.5]], 'F');
    // Tail and its fin, swinging between frames.
    s.limb([[16, 11, 4.5], [7, 12 + sweep * 0.5, 2.4], [3, 13 + sweep, 1.2]], 'B');
    s.poly([[0, 7 + sweep], [5, 12 + sweep], [1, 19 + sweep]], 'A');
    s.limb([[16, 11, 4.8], [34, 10, 6.5], [46, 10, 5]], 'B');
    // Head: long jaws.
    s.poly([[44, 5], [55, 6], [63, 9], [62, 11], [55, 13], [46, 14]], 'B');
    s.line(49, 10, 62, 10, 'M', ['B']);
    for (let x = 51; x <= 61; x += 2) {
      s.set(x, 9, 'W');
      s.set(x + 1, 11, 'W');
    }
    s.set(52, 7, 'E');
    s.limb([[20, 14, 3], [44, 13, 3]], 'D', ['B']);
    s.limb([[38, 15, 2.2], [43, 19, 1.3], [46, 21, 0.5]], 'B');
    s.limb([[19, 15, 2], [22, 19, 1.1], [24, 21, 0.5]], 'B');
    return s;
  },

  // Great glider: long toothless beak, swept-back crest, wings of skin that flap between frames.
  pteranodon: (f) => {
    const s = new Sprite(58, 28);
    const up = f === 0;
    // Far wing, behind the body.
    s.poly(up ? [[31, 14], [44, 2], [39, 8], [26, 16]] : [[31, 17], [42, 27], [37, 22], [26, 18]], 'F');
    s.ellipse(28, 17, 5.5, 3, 'B');
    s.limb([[24, 18, 1.2], [17, 19, 0.4]], 'B'); // stubby tail and legs
    s.limb([[26, 19, 0.9], [22, 22, 0.5]], 'F');
    // Head: long beak forward, crest sweeping back.
    s.limb([[32, 14, 2.4], [35, 12, 2]], 'B');
    s.poly([[34, 10.5], [50, 13], [57, 14], [50, 14.5], [34, 14]], 'B');
    s.line(38, 13.5, 55, 14, 'M', ['B']);
    s.limb([[33, 11, 1.6], [26, 7, 1], [20, 5, 0.4]], 'A');
    s.set(36, 11, 'E');
    s.ellipse(28, 18, 4, 1.5, 'D', ['B']);
    // Near wing: a leading edge of bone, a membrane of skin.
    // Near wing: skin stretched from a long finger bone (the leading edge) back to the body.
    const tip: Pt = up ? [6, 1] : [5, 27];
    const shoulder: Pt = up ? [31, 14] : [31, 17];
    s.poly([shoulder, tip, up ? [13, 9] : [13, 21], [22, up ? 17 : 18]], 'D');
    s.line(shoulder[0], shoulder[1], tip[0], tip[1], 'B');
    s.line(shoulder[0], shoulder[1] + 1, tip[0] + 1, tip[1] + (up ? 1 : -1), 'B');
    return s;
  },

  // Small, big-headed flyer with fangs up front and a long tail ending in a little vane.
  dimorphodon: (f) => {
    const s = new Sprite(38, 22);
    const up = f === 0;
    s.poly(up ? [[22, 10], [30, 1], [27, 6], [18, 12]] : [[22, 13], [29, 21], [25, 17], [18, 13]], 'F');
    s.limb([[16, 12, 1], [5, 13, 0.4]], 'B'); // long stiff tail
    s.poly([[0, 13], [3, 10.5], [6, 13], [3, 15.5]], 'A'); // tail vane
    s.ellipse(19, 12, 4, 2.5, 'B');
    s.limb([[20, 13, 0.8], [18, 17, 0.4]], 'F');
    // Big, deep head with a short beak.
    s.ellipse(27, 8, 4.5, 4, 'B');
    s.poly([[29, 6], [36, 8], [36, 10], [29, 11]], 'B');
    s.line(30, 9, 36, 9, 'M', ['B']);
    s.set(33, 10, 'W');
    s.set(35, 10, 'W');
    s.set(27, 6, 'E');
    s.ellipse(19, 13, 3, 1.2, 'D', ['B']);
    const tip: Pt = up ? [5, 1] : [4, 21];
    const shoulder: Pt = up ? [22, 10] : [22, 13];
    s.poly([shoulder, tip, up ? [9, 7] : [9, 16], [15, up ? 13 : 14]], 'D');
    s.line(shoulder[0], shoulder[1], tip[0], tip[1], 'B');
    return s;
  },

  // Front legs longer than the back, neck held high like a giraffe, bump over the nose.
  brachiosaurus: (f) => {
    const s = new Sprite(66, 66);
    pillarLeg(s, 22, 42, 3.8, swing(f, false), 'F', true);
    pillarLeg(s, 40, 36, 4, swing(f, true), 'F');
    s.limb([[17, 41, 8], [7, 47, 4], [1, 52, 1.2]], 'B');
    s.limb([[21, 40, 10], [37, 34, 11]], 'B');
    s.limb([[40, 32, 7], [46, 20, 5], [51, 8, 3.8], [53, 4, 3.2]], 'B');
    s.poly([[51, 1], [56, 1], [62, 4], [62, 7], [55, 8], [51, 7]], 'B');
    s.ellipse(55.5, 1.5, 2.5, 2, 'A');
    s.line(57, 6, 61, 6, 'M', ['B']);
    s.set(55, 3, 'E');
    s.limb([[22, 45, 5], [37, 40, 5]], 'D', ['B']);
    pillarLeg(s, 24, 43, 5, swing(f, true), 'B', true);
    pillarLeg(s, 38, 38, 4.4, swing(f, false), 'B');
    return s;
  },
};

const OUTLINE = '#1b1b14';

/** Mixes a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - a) + target * a);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** The painted key grid for a species (for tests and tools). */
export function dinoShape(species: Species, frame: 0 | 1 = 0, baby = false): (string | null)[][] {
  const s = ART[species.id](frame);
  return (baby ? babyGrid(s) : s).grid;
}

/**
 * Paints a species sprite (facing right), shaded with light from the upper
 * left: a bright rim along the top, shadow underneath and on the right,
 * the species' stripes or spots, and a dark outline. Frame 1 is mid-stride.
 */
/** How big a baby is next to a grown-up. */
const BABY_SCALE = 0.6;

/**
 * Shrinks a sprite's key grid for a baby: each small pixel takes the most
 * common key under it (if the area is mostly filled), and the eye always
 * survives so the little face stays readable.
 */
function babyGrid(s: Sprite): Sprite {
  const out = new Sprite(Math.ceil(s.w * BABY_SCALE), Math.ceil(s.h * BABY_SCALE));
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const x0 = Math.floor(x / BABY_SCALE);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) / BABY_SCALE));
      const y0 = Math.floor(y / BABY_SCALE);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) / BABY_SCALE));
      const counts = new Map<Key, number>();
      let filled = 0;
      let eye = false;
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const k = s.get(sx, sy);
          if (!k) continue;
          filled++;
          if (k === 'E') eye = true;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      if (eye) out.set(x, y, 'E');
      else if (filled >= (x1 - x0) * (y1 - y0) * 0.4) out.set(x, y, [...counts].sort((a, b) => b[1] - a[1])[0][0]);
    }
  return out;
}

/** A speckled egg in the species' colours (about the size of a baby's head). */
export function paintEgg(species: Species): HTMLCanvasElement {
  const w = 9;
  const h = 11;
  const canvas = document.createElement('canvas');
  canvas.width = w + 2;
  canvas.height = h + 2;
  const ctx = canvas.getContext('2d')!;
  const shell = tint(species.art.accent, 0.55);
  const inside = (x: number, y: number) => {
    // Egg shape: narrower at the top.
    const cy = h * 0.58;
    const ry = y < cy ? cy : h - cy;
    const rx = (w / 2) * (y < cy ? 0.85 : 1);
    return ((x + 0.5 - w / 2) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  };
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      if (inside(x, y)) {
        let c = shell;
        if (hash2(x, y, species.id.length * 13) < 0.16) c = tint(species.art.dark, 0.1); // speckles
        if (x < w / 2 - 1 && y < h * 0.45 && hash2(x, y, 5) < 0.5) c = tint(shell, 0.4); // shine
        if (x > w * 0.6 && y > h * 0.55) c = tint(shell, -0.15);
        ctx.fillStyle = c;
      } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  return canvas;
}

export function paintDino(species: Species, frame: 0 | 1 = 0, baby = false): HTMLCanvasElement {
  const grown = ART[species.id](frame);
  const s = baby ? babyGrid(grown) : grown;
  const { w, h } = s;
  // Babies are a touch paler and softer.
  const soften = (c: string) => (baby ? tint(c, 0.12) : c);
  const art = species.art;
  const { pattern } = art;
  const body = soften(art.body);
  const dark = soften(art.dark);
  const accent = soften(art.accent);
  const colors: Record<Key, string> = {
    B: body,
    D: dark,
    F: tint(body, -0.32),
    A: accent,
    G: tint(accent, -0.35),
    W: '#f4ecd2',
    E: '#101010',
    M: tint(dark, -0.45),
  };
  const light: Partial<Record<Key, string>> = { B: tint(body, 0.28), A: tint(accent, 0.25), D: tint(dark, 0.12), F: tint(body, -0.2) };
  const shade: Partial<Record<Key, string>> = { B: tint(body, -0.2), A: tint(accent, -0.2), D: tint(dark, -0.15), W: '#c9bfa0' };
  const at = (x: number, y: number) => s.get(x, y);
  const patternAt = (x: number, y: number) => {
    if (pattern === 'stripes') return Math.floor((x + y * 0.4) / 3) % 2 === 0 && y < h * 0.62;
    if (pattern === 'spots') return hash2(Math.floor(x / 3), Math.floor(y / 3), 71) < 0.18;
    return false;
  };

  const canvas = document.createElement('canvas');
  canvas.width = w + 2;
  canvas.height = h + 2;
  const ctx = canvas.getContext('2d')!;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const c = at(x, y);
      if (c) {
        let color = colors[c];
        if (c === 'B' && patternAt(x, y)) color = shade.B!;
        if (!at(x, y - 1) && light[c]) color = light[c]!;
        else if ((!at(x, y + 1) || !at(x + 1, y)) && shade[c]) color = shade[c]!;
        if (c === 'E') color = colors.E;
        ctx.fillStyle = color;
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n)) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  // A dark seam where far-side limbs meet the body, so the legs read as separate.
  ctx.fillStyle = tint(body, -0.55);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (at(x, y) === 'F' && [at(x - 1, y), at(x + 1, y), at(x, y - 1)].some((n) => n && n !== 'F')) ctx.fillRect(x + 1, y + 1, 1, 1);
  return canvas;
}
