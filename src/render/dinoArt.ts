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

/** Paints a species sprite (facing right) onto a new canvas, 1 canvas pixel per art pixel. */
export function paintDino(species: Species): HTMLCanvasElement {
  const rows = TEMPLATES[species.art.template];
  const { width, height } = templateSize(species.art.template);
  const colors: Record<string, string> = {
    B: species.art.body,
    D: species.art.dark,
    A: species.art.accent,
    E: '#101010',
    W: '#f4ecd2',
  };
  const at = (x: number, y: number) => (y >= 0 && y < height ? (rows[y][x] ?? '.') : '.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = at(x, y);
      if (c !== '.') {
        ctx.fillStyle = colors[c] ?? species.art.body;
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

export { TEMPLATES as DINO_TEMPLATES };
