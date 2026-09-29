import { hash2 } from '../sim/rng';
import type { DecorKind } from '../sim/data/decor';
import type { BuildingKind } from '../sim/data/economy';
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

/** A clump of cattails for marshland. */
export function paintReeds(seed: number): HTMLCanvasElement {
  return paintSprite(12, 16, (px) => {
    for (let k = 0; k < 5; k++) {
      const x = 2 + k * 2 + (hash2(k, seed, 4) < 0.5 ? 0 : 1);
      const top = 2 + Math.floor(hash2(seed, k, 5) * 5);
      for (let y = top; y < 15; y++) px(x, y, y < top + 3 && k % 2 === 0 ? '#7a5a30' : k % 2 ? '#8aa84a' : '#6f8f3a');
    }
  }, false);
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

/** Path lamp: a slim dark post with a lantern on top. */
export function paintLamp(): HTMLCanvasElement {
  return paintSprite(10, 24, (px) => {
    for (let y = 8; y < 22; y++) px(5, y, '#3b3b3b');
    for (const x of [3, 4, 5, 6, 7]) px(x, 22, '#2b2b2b'); // foot
    for (let y = 3; y < 8; y++) for (let x = 3; x < 8; x++) px(x, y, x === 3 || x === 7 || y === 3 ? '#3b3b3b' : '#f7d77a'); // lantern
    for (const x of [4, 5, 6]) px(x, 2, '#3b3b3b');
    px(5, 1, '#3b3b3b');
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

// --- Park buildings, drawn in 3/4 view. ---

type Px = Plot;

/** Trash can: a hungry green dino head whose open mouth is the bin slot. */
export function paintTrashCan(): HTMLCanvasElement {
  return paintSprite(14, 19, (px) => {
    // Round head with the jaws wide open (top jaw up, bottom jaw is the can).
    for (let y = 2; y < 7; y++) for (let x = 2; x < 12; x++) if (!(y === 2 && (x === 2 || x === 11))) px(x, y, y === 2 || x === 2 ? '#7fcf6a' : '#5fb84a');
    for (let y = 7; y < 10; y++) for (let x = 3; x < 11; x++) px(x, y, y === 9 ? '#8a2a3a' : '#5a1a26'); // mouth
    for (const x of [4, 6, 8]) px(x, 7, '#ffffff'); // top teeth
    for (const x of [5, 7, 9]) px(x, 9, '#ffffff'); // bottom teeth
    for (const x of [4, 9]) {
      px(x, 3, '#ffffff');
      px(x + 1, 3, '#1b1b14');
    }
    px(6, 5, '#2f6b2a');
    px(7, 5, '#2f6b2a'); // nostrils
    // The can body: the dino's chin and neck, with a cream belly stripe.
    for (let y = 10; y < 17; y++) for (let x = 3; x < 11; x++) px(x, y, x === 3 ? '#7fcf6a' : x === 10 ? '#3f8a3a' : y === 13 || y === 14 ? '#f4ecd2' : '#5fb84a');
  });
}

/** Safari station: a giant safari jeep you walk into, with a door in its side. */
export function paintStation(): HTMLCanvasElement {
  return paintSprite(30, 26, (px) => {
    // Roll bar and canvas roof.
    for (let x = 4; x < 19; x++) px(x, 4, x % 3 ? '#3f7a3a' : '#2f5a2a');
    for (let x = 4; x < 19; x++) px(x, 5, '#2f5a2a');
    for (const x of [4, 18]) for (let y = 5; y < 11; y++) px(x, y, '#3b3b3b');
    // Windscreen and bonnet.
    for (let y = 5; y < 11; y++) px(20, y, y === 5 ? '#e8f6fb' : '#8fb8d0');
    for (let y = 5; y < 11; y++) px(21, y, '#5a6470');
    // Khaki body with a green stripe.
    for (let y = 11; y < 20; y++)
      for (let x = 2; x < 28; x++) {
        if (x > 21 && y < 13) continue; // bonnet is lower than the cabin
        px(x, y, y === 15 || y === 16 ? '#3f7a3a' : y === 11 || (x > 21 && y === 13) ? '#e8d9a8' : x === 2 ? '#e0cf96' : '#cdb97a');
      }
    for (let x = 22; x < 28; x++) px(x, 12, '#cdb97a');
    // Door in the side, a window beside it, a headlight and a spare tyre.
    for (let y = 12; y < 20; y++) for (let x = 11; x < 15; x++) px(x, y, x === 11 ? '#4a3018' : '#6b4a2a');
    px(14, 16, '#f2c14e');
    for (let y = 7; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, y === 7 ? '#e8f6fb' : '#8fb8d0');
    px(27, 14, '#f2d24e');
    px(27, 15, '#f2d24e');
    for (let y = 12; y < 18; y++) px(1, y, '#2b2b2b');
    // Big tyres with hubs.
    for (const cx of [7, 22])
      for (let y = 18; y < 24; y++)
        for (let x = cx - 3; x <= cx + 2; x++) {
          if ((y === 18 || y === 23) && (x === cx - 3 || x === cx + 2)) continue;
          px(x, y, (x === cx - 1 || x === cx) && (y === 20 || y === 21) ? '#b0b0b0' : '#2b2b2b');
        }
  });
}

/** Viewing tower: a giant pair of binoculars on a tall stand, with a ladder up the post. */
export function paintTower(): HTMLCanvasElement {
  return paintSprite(24, 42, (px) => {
    // Tripod legs and the post with ladder rungs.
    for (let y = 18; y < 41; y++) {
      px(10, y, '#8f9aa3');
      px(13, y, '#6e7880');
      if (y % 3 === 0) for (let x = 11; x < 13; x++) px(x, y, '#c9d2d8');
    }
    for (let i = 0; i < 9; i++) {
      px(9 - i * 0.7, 32 + i, '#6e7880');
      px(14 + i * 0.7, 32 + i, '#6e7880');
    }
    // A little platform where visitors stand.
    for (let x = 6; x < 18; x++) {
      px(x, 17, x < 8 ? '#e8d9a8' : '#cdb97a');
      px(x, 18, '#8a6038');
    }
    // Two big barrels joined by a bridge, lenses facing us.
    for (const cx of [7, 16]) {
      for (let y = 3; y < 15; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        const d = (x - cx) ** 2 + ((y - 9) * 0.8) ** 2;
        if (d > 22) continue;
        px(x, y, d > 13 ? (x < cx ? '#4a4a52' : '#2b2b30') : d > 7 ? '#1b1b20' : x < cx && y < 9 ? '#bfe6f2' : '#5fa8d0');
      }
      px(cx - 1, 7, '#ffffff'); // glint
    }
    for (let y = 6; y < 12; y++) for (let x = 11; x < 13; x++) px(x, y, '#4a4a52');
    for (let x = 10; x < 14; x++) px(x, 4, '#6e7880'); // focus wheel
    for (let y = 14; y < 17; y++) px(11, y, '#6e7880'); // neck of the stand
    for (let y = 14; y < 17; y++) px(12, y, '#4a4a52');
  });
}

/** Petting pen: a giant cracked-open dino egg with two babies peeking over the shell. */
export function paintPettingPen(): HTMLCanvasElement {
  return paintSprite(26, 26, (px) => {
    const cx = 12.5;
    // Two little dinos poking out of the top.
    for (const [hx, c, dark] of [[8, '#86c25c', '#4e8a33'], [16, '#e0a86b', '#a86e3a']] as const) {
      for (let y = 4; y < 12; y++) for (let x = hx; x < hx + 3; x++) px(x, y, x === hx ? c : y === 11 ? dark : c);
      for (let y = 3; y < 7; y++) for (let x = hx; x < hx + 5; x++) if (!(y === 3 && x === hx + 4)) px(x, y, c);
      px(hx + 3, 4, '#101010');
      px(hx + 4, 6, dark);
      px(hx + 2, 8, '#ff9fb8'); // rosy cheek
    }
    // The bottom half of the shell, with a zigzag cracked rim and speckles.
    for (let y = 9; y < 25; y++)
      for (let x = 2; x < 24; x++) {
        const dy = (y - 15) / 10;
        const dx = (x - cx) / 10.5;
        if (dx * dx + dy * dy > 1) continue;
        const rim = 10 + ((x >> 1) % 2 ? 0 : 2);
        if (y < rim) continue;
        const spot = (x * 13 + y * 7) % 11 === 0;
        px(x, y, spot ? '#8fc0a8' : x < 7 ? '#fffbea' : x > 19 ? '#d9cfb0' : '#f4ecd2');
      }
    // A round door, and a heart above it.
    for (let y = 17; y < 24; y++) for (let x = 11; x < 15; x++) if (!(y === 17 && (x === 11 || x === 14))) px(x, y, x === 11 ? '#4a3018' : '#6b4a2a');
    px(14, 20, '#f2c14e');
    ['.R.R.', 'RRRRR', '.RRR.', '..R..'].forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === 'R') px(11 + i, 12 + j, '#e0455a');
    });
  });
}

/** Dig site: a giant fossil bone sticking out of a sand heap, with a shovel and a little flag. */
export function paintDigSite(): HTMLCanvasElement {
  return paintSprite(28, 26, (px) => {
    // Sand heap.
    for (let y = 12; y < 25; y++)
      for (let x = 1; x < 27; x++) if (((x - 13.5) / 12.5) ** 2 + ((y - 25) / 12) ** 2 < 1) px(x, y, (x * 5 + y * 3) % 7 === 0 ? '#c9a45a' : y < 18 ? '#e8c77a' : '#d9b262');
    // The bone, tilted, with knobbly ends.
    const bone = (x: number, y: number) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) px(x + i, y + j, i + j < 0 ? '#fffbea' : '#f4ecd2');
    };
    for (let i = 0; i < 13; i++) {
      const x = 7 + i;
      const y = 14 - i * 0.7;
      px(x, y, '#f4ecd2');
      px(x, y + 1, '#d9cfb0');
      px(x, y - 1, '#fffbea');
    }
    for (const [x, y] of [[6, 13], [7, 16], [20, 4], [21, 7]]) bone(x, y);
    // Shovel stuck in the sand.
    for (let y = 8; y < 17; y++) px(24, y, '#8a5a2b');
    for (let x = 23; x < 26; x++) px(x, 7, '#8a5a2b');
    for (let y = 17; y < 21; y++) for (let x = 23; x < 26; x++) px(x, y, y === 20 && x !== 24 ? '#8f8f96' : '#b0b0b8');
    // Marker flag.
    for (let y = 8; y < 18; y++) px(3, y, '#5a3b1f');
    for (let y = 8; y < 11; y++) for (let x = 4; x < 7; x++) px(x, y, '#e05a4f');
    // A few small bones in the sand.
    px(10, 20, '#f4ecd2');
    px(11, 20, '#f4ecd2');
    px(17, 21, '#f4ecd2');
    px(18, 22, '#f4ecd2');
  });
}

/** Safari jeep: khaki with a green stripe, roll bar and big tyres (facing right). */
export function paintJeep(): HTMLCanvasElement {
  return paintSprite(22, 14, (px) => {
    for (let y = 6; y < 11; y++) for (let x = 2; x < 20; x++) px(x, y, y === 8 ? '#3f7a3a' : y === 6 ? '#e8d9a8' : '#cdb97a');
    for (let x = 14; x < 19; x++) px(x, 5, '#cdb97a'); // bonnet
    for (let y = 2; y < 6; y++) px(13, y, '#8fb8d0'); // windscreen
    for (let x = 3; x < 12; x++) px(x, 2, '#3b3b3b'); // roll bar
    for (const x of [3, 11]) for (let y = 2; y < 6; y++) px(x, y, '#3b3b3b');
    px(19, 7, '#f2d24e'); // headlight
    for (const cx of [5, 16])
      for (let y = 10; y < 14; y++) for (let x = cx - 2; x <= cx + 1; x++) px(x, y, (x === cx - 1 || x === cx) && (y === 11 || y === 12) ? '#8a8a8a' : '#2b2b2b');
  });
}

/** Feeding trough seen in 3/4: a wooden box whose top shows greens or meat. */
export function paintTrough(kind: 'plants' | 'meat' | 'fish', full: boolean): HTMLCanvasElement {
  return paintSprite(20, 14, (px) => {
    for (let x = 2; x < 18; x++) {
      px(x, 5, '#b07a3f'); // back rim
      for (let y = 9; y < 12; y++) px(x, y, y === 9 ? '#9c6b3c' : '#7a5028'); // front face
    }
    for (let y = 6; y < 9; y++)
      for (let x = 2; x < 18; x++) {
        const edge = x === 2 || x === 17;
        const h = hash2(x, y, kind === 'plants' ? 3 : 4);
        const water = h > 0.5 ? '#3f86c0' : '#5ba3d6';
        const food = kind === 'plants' ? (h > 0.5 ? '#6fb34f' : '#4e8a33') : kind === 'fish' ? water : h > 0.7 ? '#f4ecd2' : h > 0.35 ? '#d9454d' : '#a8323a';
        px(x, y, edge ? '#8a5a2b' : !full ? (kind === 'fish' ? '#2f5a7a' : '#4a3018') : food);
      }
    if (full && kind === 'plants') for (const x of [5, 9, 13]) px(x, 4, '#86c25c');
    // Silver fish in the water, a tail flicking out of one.
    if (full && kind === 'fish') for (const x of [5, 10, 14]) {
      px(x, 7, '#dfe6ea');
      px(x + 1, 7, '#b8c4cc');
    }
    if (full && kind === 'fish') px(11, 5, '#dfe6ea');
    for (const x of [3, 16]) px(x, 12, '#4a3018');
  });
}

// --- Shop signs: a little board on a post above a building, with a picture of what it's for. ---

// --- Novelty buildings shaped like what they sell, roadside-attraction style. ---

/** Fills the rows y0..y1 between edges that slide from (l0, r0) at the top to (l1, r1) at the bottom. */
function taper(px: Px, y0: number, y1: number, l0: number, r0: number, l1: number, r1: number, color: (x: number, y: number, l: number, r: number) => string | null): void {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const l = Math.round(l0 + (l1 - l0) * t);
    const r = Math.round(r0 + (r1 - r0) * t);
    for (let x = l; x <= r; x++) {
      const c = color(x, y, l, r);
      if (c) px(x, y, c);
    }
  }
}

/** A serving hatch: dark inside, a striped awning above and a wooden counter below. */
function hatch(px: Px, x0: number, x1: number, y: number, stripe: [string, string]): void {
  for (let x = x0; x <= x1; x++) px(x, y, (x - x0) % 2 ? stripe[1] : stripe[0]);
  for (let j = 1; j <= 3; j++) for (let x = x0 + 1; x < x1; x++) px(x, y + j, j === 1 ? '#2a1c12' : '#3a2a1a');
  for (let x = x0; x <= x1; x++) px(x, y + 4, x === x0 ? '#d9b27a' : '#b88a4f');
}

/** Restaurant: a giant carton of fries with a serving hatch and a door. */
export function paintFriesStand(): HTMLCanvasElement {
  return paintSprite(24, 32, (px) => {
    // Fries poking out of the top, at jaunty heights.
    const tops = [6, 3, 5, 2, 4, 3, 5, 2, 4, 6];
    tops.forEach((top, i) => {
      const x = 3 + i * 2;
      for (let y = top; y < 13; y++) {
        px(x, y, y === top ? '#fbe79a' : '#f7d046');
        px(x + 1, y, y === top ? '#f7d046' : '#d9a92a');
      }
    });
    // The red carton, wider at the top, with a light rim and shading on the right.
    taper(px, 11, 29, 2, 21, 5, 18, (x, y, l, r) =>
      y === 11 ? '#f06a5c' : x <= l + 1 ? '#e8584b' : x >= r - 1 ? '#a8322a' : '#d9453b');
    // The hatch and the door.
    hatch(px, 5, 18, 16, ['#f4ecd2', '#d9453b']);
    for (let y = 23; y <= 29; y++) for (let x = 10; x < 14; x++) px(x, y, x === 10 ? '#4a3018' : '#6b4a2a');
    px(13, 26, '#f2c14e');
  });
}

/** Snack stall: a big striped popcorn bucket, heaped high, with a serving hatch. */
export function paintPopcornStand(): HTMLCanvasElement {
  return paintSprite(22, 30, (px) => {
    // Heaped popcorn: overlapping puffs, lit from the upper left.
    const puffs = [[5, 8], [8, 6], [11, 5], [14, 6], [17, 8], [7, 9], [11, 8], [15, 9], [10, 3], [13, 4]];
    for (const [cx, cy] of puffs)
      for (let dy = -2; dy <= 1; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 4) continue;
          px(cx + dx, cy + dy, dx + dy < -1 ? '#fffbea' : dx + dy > 1 ? '#e8c96a' : '#fbf1c8');
        }
    // Red-and-white striped bucket.
    taper(px, 10, 27, 2, 19, 4, 17, (x, y, _l, r) => {
      if (y === 10) return '#f4ecd2';
      const red = Math.floor((x - 1) / 3) % 2 === 0;
      const edge = x >= r - 1 ? 1 : 0;
      return red ? (edge ? '#a8322a' : '#d9453b') : edge ? '#cfc4a6' : '#f4ecd2';
    });
    hatch(px, 5, 16, 14, ['#f7d046', '#e0a020']);
    // A yellow band near the base.
    taper(px, 24, 25, 4, 17, 4, 17, (x) => (x > 15 ? '#c89a2a' : '#f7d046'));
  });
}

/** Restrooms: a pair of porta-potties, one blue and one pink, with moon vents on the doors. */
export function paintPortaPotties(): HTMLCanvasElement {
  return paintSprite(24, 30, (px) => {
    const potty = (x0: number, body: [string, string, string], vent: boolean, dress: boolean) => {
      const x1 = x0 + 9;
      // Rounded white roof.
      for (let x = x0 + 1; x < x1; x++) px(x, 6, '#f4f7f9');
      for (let x = x0; x <= x1; x++) px(x, 7, x > x1 - 2 ? '#c9d2d8' : '#e8eef2');
      if (vent) for (let y = 3; y < 6; y++) px(x1 - 2, y, '#8f9aa3');
      // Body with light left edge and dark right edge.
      for (let y = 8; y <= 27; y++) for (let x = x0; x <= x1; x++) px(x, y, x === x0 ? body[0] : x >= x1 - 1 ? body[2] : body[1]);
      // Door panel, crescent moon vent and handle.
      for (let y = 10; y <= 27; y++) for (let x = x0 + 2; x <= x1 - 2; x++) px(x, y, x === x0 + 2 || y === 10 ? body[2] : body[1]);
      px(x0 + 4, 12, '#f7d046');
      px(x0 + 5, 12, '#f7d046');
      px(x0 + 4, 13, '#f7d046');
      px(x0 + 4, 14, '#f7d046');
      px(x0 + 5, 14, '#f7d046');
      // A little white figure on the door.
      const fx = x0 + 5;
      px(fx, 16, '#ffffff');
      for (let y = 18; y <= 20; y++) for (let dx = dress && y >= 19 ? -1 : 0; dx <= (dress && y >= 19 ? 1 : 0); dx++) px(fx + dx, y, '#ffffff');
      px(fx - 1, 18, '#ffffff');
      px(fx + 1, 18, '#ffffff');
      px(fx - 1, 21, '#ffffff');
      px(fx + 1, 21, '#ffffff');
      px(x1 - 3, 24, '#e8eef2');
      // Base skid.
      for (let x = x0 - 1; x <= x1 + 1; x++) px(x, 28, '#5a6470');
    };
    potty(2, ['#6fa8e8', '#3f7fd0', '#2a5a9a'], true, false);
    potty(12, ['#f59ac0', '#e05a8f', '#a83a66'], false, true);
  });
}

/** Souvenir shop: a giant shopping basket with a dino plush, a balloon and a present peeking out. */
export function paintBasketShop(): HTMLCanvasElement {
  return paintSprite(28, 32, (px) => {
    // Balloon on a string, rising behind everything.
    for (let y = 2; y < 6; y++) for (let x = 18; x < 22; x++) if (!((y === 2 || y === 5) && (x === 18 || x === 21))) px(x, y, x === 18 || y === 2 ? '#f06a8f' : '#d9456f');
    px(19, 3, '#ffd0de');
    for (let y = 6; y < 12; y++) px(19, y, '#6b6b6b');
    // Metal carrying handle arching over the top.
    for (let y = 5; y <= 13; y++) {
      px(4, y, '#c9d2d8');
      px(23, y, '#8f9aa3');
    }
    for (let x = 5; x <= 22; x++) px(x, 4, x < 8 ? '#e8eef2' : '#c9d2d8');
    // Plush dino: a neck rising out of the basket to a round head with a big eye and a smile.
    for (let y = 8; y < 13; y++) for (let x = 6; x < 9; x++) px(x, y, x === 6 ? '#7fcf6a' : '#5fb84a');
    for (let y = 4; y < 8; y++) for (let x = 6; x < 12; x++) if (!(y === 4 && (x === 6 || x === 11))) px(x, y, y === 4 || x === 6 ? '#7fcf6a' : '#5fb84a');
    px(9, 5, '#ffffff');
    px(10, 5, '#1b1b14');
    px(10, 7, '#2f6b2a');
    px(11, 6, '#2f6b2a');
    px(7, 3, '#e8b53a'); // back spikes
    px(7, 8, '#e8b53a');
    px(7, 10, '#e8b53a');
    for (let y = 9; y < 13; y++) for (let x = 12; x < 17; x++) px(x, y, x === 14 || y === 10 ? '#f7d046' : '#3f8fd0');
    px(13, 8, '#f7d046');
    px(15, 8, '#f7d046');
    // Red plastic basket with rows of slots, wider at the top.
    taper(px, 13, 29, 2, 25, 4, 23, (x, y, l, r) => {
      if (y <= 14) return y === 13 ? '#f06a5c' : '#b8352c';
      const slot = y % 3 !== 0 && (x - l) % 3 !== 0 && x > l && x < r;
      if (slot) return '#7a1f1a';
      return x <= l + 1 ? '#e8584b' : x >= r - 1 ? '#a8322a' : '#d9453b';
    });
    // A welcoming door in the middle.
    for (let y = 21; y <= 29; y++) for (let x = 12; x < 16; x++) px(x, y, y === 21 ? '#f4ecd2' : x === 12 ? '#4a3018' : '#6b4a2a');
    px(15, 25, '#f2c14e');
  });
}

/** Pump house: a little brick house with a big pipe spouting water back into the river. */
export function paintPumpHouse(): HTMLCanvasElement {
  return paintSprite(26, 26, (px) => {
    // Brick walls and a slate roof.
    for (let y = 10; y < 23; y++) for (let x = 3; x < 17; x++) px(x, y, (y % 3 === 0 || (x + (y % 6 < 3 ? 0 : 2)) % 4 === 0) ? '#8a3a2a' : x < 5 ? '#c8604a' : '#b24a36');
    for (let y = 4; y < 10; y++) {
      const half = 2 + (y - 4) * 1.4;
      for (let x = Math.round(10 - half); x <= Math.round(10 + half); x++) px(x, y, y === 9 ? '#3a4a5a' : '#5a6a7a');
    }
    for (let y = 16; y < 23; y++) for (let x = 8; x < 12; x++) px(x, y, x === 8 ? '#4a3018' : '#6b4a2a'); // door
    px(11, 19, '#f2c14e');
    // The big pipe out of the side, and its splash.
    for (let x = 17; x < 23; x++) for (let y = 13; y < 16; y++) px(x, y, y === 13 ? '#b0b8c0' : '#7a8a96');
    for (let y = 16; y < 23; y++) px(22, y, y % 2 ? '#8fd3ea' : '#e8f6fb');
    for (const x of [20, 21, 23, 24]) px(x, 23, '#bfe6f2');
    // A dial on the wall.
    px(5, 13, '#f4ecd2');
    px(6, 13, '#f4ecd2');
    px(5, 14, '#1b1b14');
  });
}

/** Each building is shaped like what it offers, so it's obvious at a glance. */
export function paintBuilding(kind: BuildingKind): HTMLCanvasElement {
  switch (kind) {
    case 'restaurant':
      return paintFriesStand();
    case 'snackstall':
      return paintPopcornStand();
    case 'giftshop':
      return paintBasketShop();
    case 'restroom':
      return paintPortaPotties();
    case 'trashcan':
      return paintTrashCan();
    case 'station':
      return paintStation();
    case 'tower':
      return paintTower();
    case 'petting':
      return paintPettingPen();
    case 'digsite':
      return paintDigSite();
    case 'pump':
      return paintPumpHouse();
  }
}

/** A dinosaur skeleton lying on the ground: skull, spine, ribs and a tail. */
export function paintSkeleton(): HTMLCanvasElement {
  return paintSprite(22, 12, (px) => {
    const bone = '#f4ecd2';
    const shade = '#cfc4a6';
    // Spine from tail (left) to neck (right), with a gentle curve.
    for (let x = 2; x < 16; x++) px(x, 7 - Math.round(Math.sin((x / 16) * Math.PI) * 2), x % 2 ? bone : shade);
    // Ribs hanging from the middle of the spine.
    for (const x of [7, 9, 11]) for (let y = 7; y < 10; y++) px(x, y, y === 9 ? shade : bone);
    // Skull with an eye socket and a jaw.
    for (let y = 4; y < 8; y++) for (let x = 16; x < 20; x++) if (!(y === 4 && x === 19)) px(x, y, y === 7 ? shade : bone);
    px(17, 5, '#5a4a38');
    px(20, 6, bone);
    // Leg bones.
    for (const x of [5, 12]) for (let y = 8; y < 11; y++) px(x, y, shade);
  });
}

/** Garden decorations, as placed in the park. */
export function paintDecor(kind: DecorKind): HTMLCanvasElement {
  switch (kind) {
    case 'tree':
      return paintBroadleaf(99);
    case 'palm':
      return paintPalm(1);
    case 'flowers':
      return paintFlowerBed(5);
    case 'fountain':
      return paintFountain();
    case 'bench':
      return paintBench();
    case 'lamp':
      return paintLamp();
    case 'skeleton':
      return paintSkeleton();
  }
}
