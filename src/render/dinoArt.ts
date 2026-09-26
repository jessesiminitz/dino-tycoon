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
 * Paints a species sprite (facing right) onto a new canvas, 1 canvas pixel per
 * art pixel. Frame 1 is the mid-stride walk frame. Bodies get a highlight along
 * the top and a shadow along the bottom so they read as solid shapes.
 */
export function paintDino(species: Species, frame: 0 | 1 = 0): HTMLCanvasElement {
  const base = TEMPLATES[species.art.template];
  const rows = frame === 1 ? strideRows(base) : base;
  const { width, height } = templateSize(species.art.template);
  const { body, dark, accent } = species.art;
  const colors: Record<string, string> = { B: body, D: dark, A: accent, E: '#101010', W: '#f4ecd2' };
  const light: Record<string, string> = { B: tint(body, 0.22), A: tint(accent, 0.2), D: tint(dark, 0.1) };
  const shade: Record<string, string> = { B: tint(body, -0.18), A: tint(accent, -0.18) };
  const at = (x: number, y: number) => (y >= 0 && y < height ? (rows[y][x] ?? '.') : '.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = at(x, y);
      if (c !== '.') {
        if (at(x, y - 1) === '.' && light[c]) ctx.fillStyle = light[c];
        else if (at(x, y + 1) === '.' && shade[c]) ctx.fillStyle = shade[c];
        else ctx.fillStyle = colors[c] ?? body;
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

export { TEMPLATES as DINO_TEMPLATES };
