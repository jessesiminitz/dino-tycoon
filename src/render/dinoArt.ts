import { hash2 } from '../sim/rng';
import type { BodyTemplate, Species } from '../sim/data/species';

/**
 * Placeholder dinosaur pixel art. Each template is drawn facing right:
 *   B body · D belly/shade · A accent (plates, frill, crest) · E eye · W horn/teeth/claw
 * A dark outline is added automatically around every painted pixel.
 * No Phaser dependency, so the DOM catalog can reuse the same canvases.
 */
const TEMPLATES: Record<BodyTemplate, string[]> = {
  raptor: [
    '................',
    '...........BAB..',
    '..........BBEBB.',
    '..........BBBWW.',
    '.........BBB....',
    'BB......BBBB....',
    '.BBBBBBBBBBA....',
    '...BBBBBBBB.A...',
    '.....DDDDD......',
    '......B..B......',
    '.....BB..BB.....',
    '................',
  ],
  theropod: [
    '........................',
    '...............BBBBBB...',
    '..............BBBBBEBB..',
    '..............BBBBBBBBB.',
    '..............BBBBWWWW..',
    '..............BBBBBB....',
    '.............BBBB.......',
    'BB..........BBBBB.......',
    '.BBB......BBBBBBBA......',
    '..BBBBBBBBBBBBBBB.A.....',
    '....BBBBBBBBBBBBB.......',
    '......DDDDDDDDDD........',
    '........BBBB.BBB........',
    '........BBB...BB........',
    '........BB....BB........',
    '.......BBB...BBB........',
    '........................',
  ],
  ceratops: [
    '..................',
    '..............AA..',
    '.............AABB.',
    '............AABBBW',
    '..BB.......AABBEBW',
    '...BBBBBBBBBABBBB.',
    '...BBBBBBBBBBBBB..',
    '....BBBBBBBBBBB...',
    '....DDDDDDDDDD....',
    '....BB.BB..BB.BB..',
    '....B...B..B...B..',
    '..................',
  ],
  stego: [
    '....................',
    '........A.A.A.......',
    '.......AAAAAAA......',
    '......BBBBBBBBB.....',
    '.....BBBBBBBBBBB....',
    '.W..BBBBBBBBBBBBB...',
    '..WBBBBBBBBBBBBBBBB.',
    '...BBBBBBBBBBBBBBEB.',
    '.....DDDDDDDDDD.BBB.',
    '.....BB.BB..BB.BB...',
    '.....BB.BB..BB.BB...',
    '....................',
  ],
  ankylo: [
    '..................',
    '......AAAAAAA.....',
    '....AABABABABAA...',
    '.WW.BBBBBBBBBBBBB.',
    '.WWBBBBBBBBBBBBBEB',
    '....DDDDDDDDDDBBB.',
    '....BB.BB.BB.BB...',
    '....B..B..B..B....',
    '..................',
  ],
  hadro: [
    '................',
    '.........AAA....',
    '..........AABB..',
    '...........BBEB.',
    '...........BBBBW',
    '..........BBB...',
    '.........BBB....',
    'BB......BBBB....',
    '.BBBBBBBBBBBB...',
    '...BBBBBBBBBA...',
    '.....DDDDDD.....',
    '.....BB..BB.....',
    '.....B...B......',
    '....BB..BB......',
    '................',
  ],
  trike: [
    '....................',
    '..............AA....',
    '.............AAAA.W.',
    '............AAABBWW.',
    '............AABBEBB.',
    '..BB.......AABBBBBBW',
    '...BBBBBBBBBBBBBBBB.',
    '...BBBBBBBBBBBBBBB..',
    '....BBBBBBBBBBBBB...',
    '....DDDDDDDDDDDD....',
    '....BBB.BB..BB.BBB..',
    '....BB..BB..BB..BB..',
    '....................',
  ],
  dome: [
    '................',
    '..........AAA...',
    '.........AAAAA..',
    '.........BBBEBB.',
    '..........BBBBW.',
    '.........BBB....',
    '........BBB.....',
    'BB.....BBBB.....',
    '.BBBBBBBBBBB....',
    '...BBBBBBBBA....',
    '.....DDDDDD.....',
    '.....BB..BB.....',
    '.....B...B......',
    '....BB..BB......',
    '................',
  ],
  sauropod: [
    '............................',
    '....................BBBB....',
    '...................BBBEBB...',
    '...................BBB......',
    '..................BBB.......',
    '..................BBB.......',
    '.................BBB........',
    '.................BBB........',
    '................BBBB........',
    '................BBB.........',
    '...............BBBB.........',
    '..............BBBBB.........',
    '.......BBBBBBBBBBBB.........',
    '.....BBBBBBBBBBBBBBB........',
    'BB..BBBBBBBBBBBBBBBB........',
    '.BBBBBBBBBBBBBBBBBBB........',
    '...BBBBBBBBBBBBBBBB.........',
    '......DDDDDDDDDDDD..........',
    '......BBB..BBB..BBB.........',
    '......BBB..BBB..BBB.........',
    '......BBB..BBB..BBB.........',
    '............................',
  ],
};

const OUTLINE = '#1b1b14';

export function templateSize(t: BodyTemplate): { width: number; height: number } {
  const rows = TEMPLATES[t];
  return { width: Math.max(...rows.map((r) => r.length)), height: rows.length };
}

/** Mixes a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - a) + target * a);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Walk frame: the leg rows (below the belly) with alternate legs stepped one
 * pixel forward and back, so animals appear to stride.
 */
function strideRows(rows: string[]): string[] {
  const belly = rows.reduce((last, r, i) => (r.includes('D') ? i : last), -1);
  if (belly < 0) return rows;
  return rows.map((row, y) => {
    if (y <= belly) return row;
    const out = row.split('').map(() => '.');
    let run = 0;
    for (let x = 0; x < row.length; ) {
      if (row[x] === '.') {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] !== '.') end++;
      const shift = run % 2 === 0 ? -1 : 1;
      for (let i = x; i < end; i++) {
        const to = Math.min(row.length - 1, Math.max(0, i + shift));
        out[to] = row[i];
      }
      run++;
      x = end;
    }
    return out.join('');
  });
}

/**
 * Scale2x (EPX): doubles a pixel-art grid while rounding off diagonal steps,
 * so the upscaled sprite has smooth outlines instead of chunky staircases.
 */
function scale2x(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? rows[y][x] : '.');
  const out: string[][] = Array.from({ length: h * 2 }, () => new Array(w * 2).fill('.'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p;
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p;
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  return out.map((r) => r.join(''));
}

/**
 * Paints a species sprite (facing right) at double resolution: the template is
 * smoothed with Scale2x, then shaded with light from the upper left (a bright
 * rim along the top, shadow along the bottom and right), given the species'
 * stripes or spots, an eye glint and a dark outline. Frame 1 is mid-stride.
 */
export function paintDino(species: Species, frame: 0 | 1 = 0): HTMLCanvasElement {
  const base = TEMPLATES[species.art.template];
  const rows = scale2x(frame === 1 ? strideRows(base) : base);
  const height = rows.length;
  const width = rows[0].length;
  const { body, dark, accent, pattern } = species.art;
  const colors: Record<string, string> = { B: body, D: dark, A: accent, E: '#101010', W: '#f4ecd2' };
  const light: Record<string, string> = { B: tint(body, 0.28), A: tint(accent, 0.25), D: tint(dark, 0.12) };
  const soft: Record<string, string> = { B: tint(body, 0.12), A: tint(accent, 0.1) };
  const shade: Record<string, string> = { B: tint(body, -0.22), A: tint(accent, -0.2), D: tint(dark, -0.15) };
  const at = (x: number, y: number) => (y >= 0 && y < height ? (rows[y][x] ?? '.') : '.');
  const patternAt = (x: number, y: number) => {
    if (pattern === 'stripes') return Math.floor((x + y * 0.4) / 3) % 2 === 0 && y < height * 0.6;
    if (pattern === 'spots') return hash2(Math.floor(x / 3), Math.floor(y / 3), 71) < 0.18;
    return false;
  };

  // One pixel of margin all round for the outline.
  const canvas = document.createElement('canvas');
  canvas.width = width + 2;
  canvas.height = height + 2;
  const ctx = canvas.getContext('2d')!;
  for (let y = -1; y <= height; y++) {
    for (let x = -1; x <= width; x++) {
      const c = at(x, y);
      if (c !== '.') {
        let color = colors[c] ?? body;
        if (c === 'B' && patternAt(x, y)) color = shade.B;
        if (at(x, y - 1) === '.' && light[c]) color = light[c];
        else if (at(x, y - 2) === '.' && soft[c]) color = soft[c];
        else if ((at(x, y + 1) === '.' || at(x + 1, y) === '.') && shade[c]) color = shade[c];
        // Glint in the eye.
        if (c === 'E' && at(x - 1, y) !== 'E' && at(x, y - 1) !== 'E') color = '#f4ecd2';
        ctx.fillStyle = color;
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  return canvas;
}

export { TEMPLATES as DINO_TEMPLATES };
