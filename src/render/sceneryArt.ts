import { hash2 } from '../sim/rng';
import { paintSprite, type Plot } from './pixels';

/**
 * Scenery sprites painted in code: trees, palms, mountains, the volcano and
 * garden decorations. Light comes from the upper left, so left/top pixels are
 * lighter and right/bottom ones darker.
 */

const LEAF = { light: '#86c25c', mid: '#4f9a3a', dark: '#2f6b2a', deep: '#1f4d2a' };
const TRUNK = { light: '#8a5a2b', dark: '#5a3b1f' };

function trunk(px: Plot, x: number, top: number, bottom: number, width = 2, colors = TRUNK): void {
  for (let y = top; y <= bottom; y++)
    for (let i = 0; i < width; i++) px(x + i, y, i === 0 ? colors.light : colors.dark);
}

/** Shade a canopy pixel by where it sits in the shape (0..1 across, 0..1 down). */
function leafShade(fx: number, fy: number, noise: number): string {
  const lit = 1 - (fx * 0.6 + fy * 0.8) + (noise - 0.5) * 0.4;
  return lit > 0.75 ? LEAF.light : lit > 0.35 ? LEAF.mid : lit > 0.05 ? LEAF.dark : LEAF.deep;
}

export function paintConifer(seed: number): HTMLCanvasElement {
  return paintSprite(18, 30, (px) => {
    trunk(px, 8, 22, 27);
    for (let tier = 0; tier < 4; tier++) {
      const top = 2 + tier * 5;
      const rows = 7;
      for (let r = 0; r < rows; r++) {
        const half = Math.floor((r + 1 + tier) * 0.9);
        for (let dx = -half; dx <= half; dx++) {
          const fx = (dx + half) / (2 * half + 1);
          px(9 + dx, top + r, leafShade(fx * 0.9, r / rows, hash2(dx + seed, r + tier * 9, 3)) === LEAF.light ? '#4f8f4a' : dx > half / 2 ? '#1f4d2a' : '#2f6b3a');
        }
      }
    }
  });
}

export function paintBroadleaf(seed: number): HTMLCanvasElement {
  return paintSprite(20, 26, (px) => {
    trunk(px, 9, 16, 23);
    px(8, 23, TRUNK.dark);
    px(11, 23, TRUNK.dark);
    const cx = 10;
    const cy = 9;
    for (let y = 1; y < 18; y++)
      for (let x = 1; x < 19; x++) {
        const d = ((x - cx) / 8.5) ** 2 + ((y - cy) / 7.5) ** 2;
        // A lumpy outline so it reads as foliage, not a circle.
        if (d < 1 - hash2(x + seed, y, 11) * 0.18) px(x, y, leafShade((x - 1) / 18, (y - 1) / 17, hash2(x, y + seed, 7)));
      }
  });
}

/** Cycads: prehistoric palm-like plants with a stout, scaly trunk. */
export function paintCycad(seed: number): HTMLCanvasElement {
  return paintSprite(20, 20, (px) => {
    for (let y = 11; y < 17; y++) for (let x = 8; x < 12; x++) px(x, y, (y + (x % 2)) % 2 ? '#8a6a3e' : '#6b5238');
    const fronds = 7;
    for (let f = 0; f < fronds; f++) {
      const a = Math.PI * (1.05 + (f / (fronds - 1)) * 0.9) + (hash2(f, seed, 2) - 0.5) * 0.2;
      for (let t = 1; t < 9; t++) {
        const x = 10 + Math.cos(a) * t;
        const y = 10 + Math.sin(a) * t * 0.7 + t * t * 0.04;
        px(x, y, t < 4 ? LEAF.mid : LEAF.dark);
        if (t % 2 === 0) px(x + Math.sin(a), y - Math.cos(a) * 0.7, LEAF.light);
      }
    }
  });
}

/** Tree ferns: a slim trunk with a crown of arching fronds. */
export function paintTreeFern(seed: number): HTMLCanvasElement {
  return paintSprite(22, 28, (px) => {
    trunk(px, 10, 8, 25, 2, { light: '#6b4a2a', dark: '#4a3018' });
    const fronds = 6;
    for (let f = 0; f < fronds; f++) {
      const dir = f % 2 === 0 ? -1 : 1;
      const len = 7 + (f % 3) + Math.round(hash2(f, seed, 4) * 2);
      for (let t = 0; t < len; t++) {
        const x = 11 + dir * t * (0.7 + (f >> 1) * 0.15);
        const y = 7 - (f >> 1) + t * t * 0.09;
        px(x, y, (f >> 1) === 0 ? LEAF.light : LEAF.mid);
        if (t > 2 && t % 2 === 1) px(x, y + 1, LEAF.dark);
      }
    }
  });
}

/** A towering conifer, a landmark in the forest. */
export function paintGiant(seed: number): HTMLCanvasElement {
  return paintSprite(20, 40, (px) => {
    trunk(px, 9, 20, 37, 3, { light: '#a0582e', dark: '#6b3a1e' });
    for (let y = 2; y < 26; y++) {
      const half = Math.min(8, 1 + Math.floor(y / 3)) - (y % 4 === 0 ? 1 : 0);
      for (let dx = -half; dx <= half; dx++) {
        const fx = (dx + half) / (2 * half + 1);
        px(10 + dx, y, leafShade(fx, y / 26, hash2(dx, y + seed, 5)) === LEAF.light ? '#3f7f3a' : fx > 0.6 ? '#1f4d2a' : '#2f6b3a');
      }
    }
  });
}

export function paintPalm(seed: number): HTMLCanvasElement {
  const lean = seed % 2 ? 1 : -1;
  return paintSprite(22, 30, (px) => {
    // Curved, ringed trunk.
    for (let y = 8; y < 27; y++) {
      const x = 11 + lean * Math.round(((27 - y) / 19) ** 2 * 4);
      px(x, y, y % 3 ? '#b08a5a' : '#8a6a3e');
      px(x + 1, y, '#8a6a3e');
    }
    const top = { x: 11 + lean * 4, y: 8 };
    for (let f = 0; f < 6; f++) {
      const a = Math.PI * (0.9 + f * 0.24) + (hash2(f, seed, 8) - 0.5) * 0.2;
      for (let t = 1; t < 9; t++) {
        const x = top.x + Math.cos(a) * t;
        const y = top.y + Math.sin(a) * t * 0.5 + t * t * 0.08;
        px(x, y, t < 4 ? LEAF.light : LEAF.mid);
        px(x, y + 1, LEAF.dark);
      }
    }
    px(top.x, top.y + 1, '#6b4a2a'); // coconuts
    px(top.x + 1, top.y + 1, '#6b4a2a');
  });
}

export function paintMountain(seed: number): HTMLCanvasElement {
  // A craggy peak: a jagged ridge line, lit west face, shadowed east face, rock strata.
  const w = 30;
  const h = 34;
  const apex = 13 + Math.round((hash2(seed, 1, 9) - 0.5) * 6);
  const peak = 22 + Math.round(hash2(seed, 2, 9) * 9);
  return paintSprite(w, h, (px) => {
    const base = h - 3;
    for (let x = 1; x < w - 1; x++) {
      const slope = x < apex ? 1.5 + hash2(seed, 3, 9) : 1.2 + hash2(seed, 4, 9);
      const top = base - peak + Math.abs(x - apex) * slope + Math.round((hash2(x, seed, 5) - 0.5) * 3);
      for (let y = Math.max(1, Math.round(top)); y <= base; y++) {
        const n = hash2(x + seed, y, 13);
        const lit = x < apex;
        let c = lit ? (n > 0.85 ? '#a39d8c' : '#8f887a') : n > 0.88 ? '#6f695c' : '#57514a';
        if (y === Math.round(top)) c = lit ? '#c9c2b0' : '#7a7466'; // ridge highlight
        if ((y + Math.round(x * 0.3) + seed) % 6 === 0 && n > 0.4) c = lit ? '#7a7466' : '#4a443e'; // strata
        if (y > base - 3 && n > 0.45) c = n > 0.8 ? '#6b9a3f' : '#4e8a33'; // grass at the foot
        px(x, y, c);
      }
    }
  });
}

export function paintVolcano(): HTMLCanvasElement {
  const w = 84;
  const h = 70;
  return paintSprite(w, h, (px) => {
    const base = h - 3;
    const top = 10;
    const cx = w / 2;
    for (let y = top; y <= base; y++) {
      const t = (y - top) / (base - top);
      // Concave slopes: steep near the top, spreading at the foot.
      const half = 10 + (t ** 1.6) * 30;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const n = hash2(x, y, 21);
        const lit = x < cx - half * 0.1;
        let c = lit ? (n > 0.8 ? '#6b5e52' : '#5a4e44') : n > 0.85 ? '#3e342c' : '#342a24';
        // Old lava channels, and one fresh flow down the front.
        if (Math.abs(x - (cx + 4 + Math.sin(y * 0.35) * 3)) < 1.2 && y < top + 34) c = y < top + 10 ? '#ffd24a' : y < top + 22 ? '#ff7a2a' : '#c84a2a';
        if (Math.abs(x - (cx - 12 + Math.sin(y * 0.25) * 2)) < 0.8 && y > top + 12 && n > 0.3) c = '#4a3028';
        if (y > base - 4 && n > 0.55) c = n > 0.85 ? '#6b9a3f' : '#4e6a33';
        px(x, y, c);
      }
    }
    // The crater: a dark rim around glowing lava.
    for (let x = cx - 10; x <= cx + 10; x++) {
      px(x, top, '#2a221c');
      px(x, top - 1, Math.abs(x - cx) < 9 ? '#4a3a30' : '#2a221c');
      if (Math.abs(x - cx) < 8) px(x, top + 1, Math.abs(x - cx) < 4 ? '#ffd24a' : '#ff7a2a');
    }
  });
}

/** Volcano crater height above the sprite's base (keep in sync with paintVolcano). */
export const VOLCANO_CRATER_ABOVE_BASE = 70 - 10;

/** A low rounded shrub for open grassland. */
export function paintBush(seed: number): HTMLCanvasElement {
  return paintSprite(14, 12, (px) => {
    for (let y = 2; y < 10; y++)
      for (let x = 1; x < 13; x++) {
        const d = ((x - 6.5) / 5.8) ** 2 + ((y - 6) / 4) ** 2;
        if (d < 1 - hash2(x + seed, y, 3) * 0.2) px(x, y, leafShade(x / 13, y / 10, hash2(x, y + seed, 2)));
      }
    if (seed % 3 === 0) {
      px(4, 4, '#f4ecd2');
      px(8, 3, '#ff9fb8');
    }
  });
}

export function paintFlowerBed(seed: number): HTMLCanvasElement {
  const colors = ['#f2d24e', '#ff9fb8', '#f4ecd2', '#e05a4f', '#b28dff'];
  return paintSprite(16, 12, (px) => {
    for (let y = 4; y < 10; y++)
      for (let x = 2; x < 14; x++) {
        if (((x - 8) / 6) ** 2 + ((y - 7) / 3.2) ** 2 > 1) continue;
        const n = hash2(x + seed, y, 17);
        px(x, y, n > 0.55 ? colors[Math.floor(n * 97) % colors.length] : n > 0.3 ? '#4e8a33' : '#6b4a2a');
      }
  }, false);
}

export function paintFountain(): HTMLCanvasElement {
  return paintSprite(18, 20, (px) => {
    for (let y = 10; y < 18; y++)
      for (let x = 1; x < 17; x++) {
        const d = ((x - 9) / 7.5) ** 2 + ((y - 14) / 3.5) ** 2;
        if (d > 1) continue;
        px(x, y, d > 0.6 ? (x < 9 ? '#c9c2b0' : '#9a9282') : y < 13 ? '#8fd3ea' : '#5bb3d6');
      }
    for (let y = 5; y < 13; y++) px(9, y, y < 7 ? '#e8f6fb' : '#b5ae9c'); // spout column
    px(8, 5, '#e8f6fb');
    px(10, 5, '#e8f6fb');
  });
}

export function paintBench(): HTMLCanvasElement {
  return paintSprite(16, 12, (px) => {
    for (let x = 2; x < 14; x++) {
      px(x, 3, '#9c6b3c');
      px(x, 5, '#b07a3f');
      px(x, 6, '#8a5a2b');
    }
    for (const x of [3, 12]) for (let y = 7; y < 10; y++) px(x, y, '#3b3b3b');
  });
}

/** Tree kinds used on forest tiles, picked per tile. */
export const FOREST_TREES = [paintConifer, paintBroadleaf, paintCycad, paintTreeFern, paintGiant] as const;

// --- Buildings, drawn in 3/4 view: a sloped roof you can see the top of, over a front wall. ---

type Px = Plot;

/** A pitched roof (top face visible) over a front wall with a door. */
function house(px: Px, w: number, roof: [string, string], wall: [string, string], roofRows = 8, wallRows = 13): { wallTop: number; bottom: number } {
  const roofTop = 2;
  for (let y = 0; y < roofRows; y++)
    for (let x = 1 + Math.max(0, 2 - y); x < w - 1 - Math.max(0, 2 - y); x++) {
      // Tiles: alternate shades by row, darker at the front edge.
      px(x, roofTop + y, y === roofRows - 1 ? roof[1] : (y + (x >> 1)) % 3 === 0 ? roof[1] : roof[0]);
    }
  const wallTop = roofTop + roofRows;
  const bottom = wallTop + wallRows - 1;
  for (let y = wallTop; y <= bottom; y++) for (let x = 2; x < w - 2; x++) px(x, y, x < 4 ? wall[0] : wall[x > w - 5 ? 1 : 0]);
  return { wallTop, bottom };
}

function windowAt(px: Px, x: number, y: number, w = 4, h = 4): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, j === 0 || i === 0 ? '#5a8fb0' : '#8fd3ea');
  px(x + w - 1, y, '#e8f6fb');
}

function doorAt(px: Px, x: number, y: number, bottom: number, color = '#6b4a2a'): void {
  for (let j = y; j <= bottom; j++) for (let i = 0; i < 4; i++) px(x + i, j, i === 0 ? '#4a3018' : color);
  px(x + 3, Math.round((y + bottom) / 2), '#f2c14e'); // handle
}

export function paintRestaurant(): HTMLCanvasElement {
  const w = 24;
  return paintSprite(w, 28, (px) => {
    const { wallTop, bottom } = house(px, w, ['#c8483a', '#8f2f24'], ['#f4ecd2', '#d9ccaa']);
    windowAt(px, 4, wallTop + 3);
    windowAt(px, w - 8, wallTop + 3);
    doorAt(px, 10, wallTop + 5, bottom);
    // Striped awning over the door and a sign with a fork and knife.
    for (let x = 8; x < 16; x++) px(x, wallTop + 3, x % 2 ? '#d9454d' : '#f4ecd2');
    for (let x = 8; x < 16; x++) px(x, wallTop + 4, x % 2 ? '#8f2f24' : '#d9ccaa');
    for (let x = 8; x < 16; x++) px(x, 1, '#f2c14e');
    px(10, 0, '#f2c14e');
    px(13, 0, '#f2c14e');
    px(10, 1, '#5a4028');
    px(13, 1, '#5a4028');
  });
}

export function paintSouvenirShop(): HTMLCanvasElement {
  const w = 24;
  return paintSprite(w, 28, (px) => {
    const { wallTop, bottom } = house(px, w, ['#3f7fb0', '#2a5a80'], ['#f4ecd2', '#d9ccaa']);
    // A big shop window with a plush dino and a balloon on display.
    for (let j = 0; j < 7; j++) for (let i = 0; i < 9; i++) px(4 + i, wallTop + 2 + j, j === 0 || i === 0 ? '#5a8fb0' : '#bfe6f2');
    for (const [dx, dy] of [[2, 4], [3, 4], [4, 4], [3, 3], [4, 3], [5, 3], [2, 5], [4, 5]]) px(4 + dx, wallTop + 2 + dy, '#5fb84a');
    px(10, wallTop + 3, '#e05a4f');
    px(10, wallTop + 4, '#e05a4f');
    doorAt(px, w - 9, wallTop + 4, bottom, '#2a5a80');
    for (let x = 5; x < w - 5; x++) px(x, 1, x % 3 ? '#6fb34f' : '#2f6b2a'); // sign
  });
}

export function paintRestroom(): HTMLCanvasElement {
  const w = 22;
  return paintSprite(w, 26, (px) => {
    const { wallTop, bottom } = house(px, w, ['#3f8f9a', '#2a646c'], ['#e8f0ec', '#c9d6d0'], 7, 12);
    doorAt(px, 4, wallTop + 4, bottom, '#5a6b7a');
    doorAt(px, w - 8, wallTop + 4, bottom, '#5a6b7a');
    // Figure signs above the doors.
    for (const [x, c] of [[5, '#3f7fb0'], [w - 7, '#e05a8f']] as const) {
      px(x + 1, wallTop + 1, c);
      px(x, wallTop + 2, c);
      px(x + 1, wallTop + 2, c);
      px(x + 2, wallTop + 2, c);
    }
  });
}

export function paintSnackStall(): HTMLCanvasElement {
  return paintSprite(22, 26, (px) => {
    // Striped umbrella dome.
    for (let y = 1; y < 9; y++) {
      const half = Math.min(10, 2 + y * 1.6);
      for (let x = Math.round(11 - half); x <= Math.round(11 + half); x++) px(x, y, Math.floor((x - 11) / 3 + 10) % 2 ? '#f28fb1' : '#f4ecd2');
    }
    for (let y = 9; y < 14; y++) px(11, y, '#8f8f96');
    // The cart: counter, front panel with an ice-cream cone, wheels.
    for (let x = 3; x < 19; x++) px(x, 14, '#f4ecd2');
    for (let y = 15; y < 21; y++) for (let x = 3; x < 19; x++) px(x, y, x < 5 ? '#f2b8cc' : '#e8a0b8');
    px(10, 16, '#f4ecd2');
    px(11, 16, '#ff9fb8');
    px(12, 16, '#f4ecd2');
    for (let y = 17; y < 20; y++) px(11, y, '#d9a45a');
    for (const x of [5, 16]) {
      px(x, 21, '#3b3b3b');
      px(x + 1, 21, '#3b3b3b');
      px(x, 22, '#3b3b3b');
      px(x + 1, 22, '#3b3b3b');
    }
  });
}

export function paintDigSite(): HTMLCanvasElement {
  return paintSprite(26, 24, (px) => {
    // Canvas tent.
    for (let y = 2; y < 16; y++) {
      const half = (y - 2) * 0.75;
      for (let x = Math.round(9 - half); x <= Math.round(9 + half); x++) px(x, y, x < 9 ? '#e8d9b5' : '#c9b48a');
    }
    for (let y = 9; y < 16; y++) px(9, y, '#5a4028'); // doorway
    // Spoil heap with bones, a pick and a shovel.
    for (let y = 13; y < 20; y++)
      for (let x = 13; x < 24; x++) if (((x - 18.5) / 5.5) ** 2 + ((y - 19) / 5) ** 2 < 1) px(x, y, y < 16 ? '#a07a4a' : '#8a6a3e');
    for (let x = 15; x < 19; x++) px(x, 17, '#f4ecd2');
    px(14, 16, '#f4ecd2');
    px(19, 18, '#f4ecd2');
    for (let i = 0; i < 7; i++) px(20 - i * 0.6, 8 + i, '#8a5a2b'); // pick handle
    px(19, 8, '#8f8f96');
    px(21, 8, '#8f8f96');
    px(20, 7, '#8f8f96');
  });
}

/** Feeding trough seen in 3/4: a wooden box whose top shows greens or meat. */
export function paintTrough(kind: 'plants' | 'meat', full: boolean): HTMLCanvasElement {
  return paintSprite(20, 14, (px) => {
    for (let x = 2; x < 18; x++) {
      px(x, 5, '#b07a3f'); // back rim
      for (let y = 9; y < 12; y++) px(x, y, y === 9 ? '#9c6b3c' : '#7a5028'); // front face
    }
    for (let y = 6; y < 9; y++)
      for (let x = 2; x < 18; x++) {
        const edge = x === 2 || x === 17;
        const h = hash2(x, y, kind === 'plants' ? 3 : 4);
        px(x, y, edge ? '#8a5a2b' : !full ? '#4a3018' : kind === 'plants' ? (h > 0.5 ? '#6fb34f' : '#4e8a33') : h > 0.7 ? '#f4ecd2' : h > 0.35 ? '#d9454d' : '#a8323a');
      }
    if (full && kind === 'plants') for (const x of [5, 9, 13]) px(x, 4, '#86c25c');
    for (const x of [3, 16]) px(x, 12, '#4a3018');
  });
}
