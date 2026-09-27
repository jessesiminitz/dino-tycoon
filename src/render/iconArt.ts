import { SPECIES } from '../sim/data/species';
import { paintDino } from './dinoArt';

/** The icon is painted on this pixel grid, then scaled up so the pixels stay crisp. */
const GRID = 128;
/** The square of the grid that's shown: a little in from the edges, so the dino fills more of the icon. */
const CROP = { x: 4, y: 12, size: 112 };

/**
 * The Home Screen icon: a Brachiosaurus on a palm-tree island, its long neck
 * against a big sunset sun, with the volcano smoking behind. Pixel art to
 * match the game. `inset` shrinks the scene toward the centre (for maskable
 * icons, which platforms crop to a circle) while the sky still fills the edges.
 */
export function paintIcon(size: number, inset = 0): HTMLCanvasElement {
  const art = document.createElement('canvas');
  art.width = GRID;
  art.height = GRID;
  const g = art.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const disc = (cx: number, cy: number, r: number, c: string) => {
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      px(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  };
  const horizon = 88;

  // Sunset sky in bands, with a checker dither between them (a classic pixel-art gradient).
  const sky = ['#2b2e5c', '#4a3a74', '#7a4a86', '#b8567a', '#e8745e', '#f59e5a', '#f9c46a'];
  const band = horizon / sky.length;
  for (let y = 0; y < horizon; y++) {
    const i = Math.min(sky.length - 1, Math.floor(y / band));
    const next = sky[Math.min(sky.length - 1, i + 1)];
    const edge = y % band >= band - 3;
    for (let x = 0; x < GRID; x++) px(x, y, 1, 1, edge && (x + y) % 2 === 0 ? next : sky[i]);
  }
  // A few stars up in the dark.
  for (const [x, y] of [[12, 8], [30, 16], [58, 6], [96, 12], [116, 22], [80, 20], [6, 26]]) px(x, y, 1, 1, '#f4ecd2');

  // Big sun sinking behind the island, with a warm halo.
  disc(84, 62, 27, '#fbd27a');
  disc(84, 62, 23, '#ffe39a');
  disc(84, 62, 18, '#fff1c4');

  // The volcano on the left, smoking gently.
  g.fillStyle = '#3d2c52';
  g.beginPath();
  g.moveTo(-6, horizon);
  g.lineTo(18, 54);
  g.lineTo(26, 52);
  g.lineTo(50, horizon);
  g.fill();
  px(18, 52, 9, 3, '#e8745e'); // glowing crater
  px(20, 51, 5, 1, '#f9c46a');
  for (const [x, y, r] of [[23, 46, 3], [19, 40, 4], [24, 33, 3]] as const) disc(x, y, r, 'rgba(180,160,190,0.55)');

  // Sea, with the sun's reflection broken into glints.
  const sea = ['#355b8c', '#2c4f7c', '#24426b', '#1d375a'];
  for (let y = horizon; y < GRID; y++) px(0, y, GRID, 1, sea[Math.min(sea.length - 1, Math.floor((y - horizon) / 10))]);
  for (let y = horizon + 2, w = 20; y < GRID; y += 3, w -= 2) {
    px(84 - w / 2 + ((y * 7) % 5), y, w, 1, '#f9c46a');
  }
  for (const [x, y] of [[10, 100], [30, 112], [112, 104], [120, 120], [6, 122]]) px(x, y, 5, 1, '#5b8fc0');

  // Island: sand edge, grass on top, a darker rim to lift it off the sea.
  g.fillStyle = '#1b1b14';
  g.beginPath();
  g.ellipse(58, 106, 50, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8d18b';
  g.beginPath();
  g.ellipse(58, 105, 48, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5fae4a';
  g.beginPath();
  g.ellipse(58, 102, 42, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7cc45a';
  g.beginPath();
  g.ellipse(54, 100, 32, 5, 0, 0, Math.PI * 2);
  g.fill();

  // Palm tree on the right of the island.
  for (let i = 0; i < 26; i++) px(100 + Math.round(Math.sin(i / 9) * 3), 100 - i, 3, 1, i % 4 === 0 ? '#6b4a2a' : '#8a6038');
  for (const [dx, dy] of [[-12, 4], [-9, -1], [9, -1], [12, 4], [0, -6], [-5, 7], [5, 7]]) {
    g.strokeStyle = '#2f7a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(102, 75);
    g.quadraticCurveTo(102 + dx * 0.6, 72 + dy * 0.3 - 3, 102 + dx, 75 + dy);
    g.stroke();
  }
  disc(102, 75, 3, '#3f9a4a');

  // The star of the show, from the game's own sprite, in a green that pops against the sunset.
  const sp = SPECIES.brachiosaurus;
  const dino = paintDino({ ...sp, art: { ...sp.art, body: '#6fb35a', dark: '#3f7a3a', accent: '#a8d67a' } }, 0);
  g.drawImage(dino, 14, 100 - dino.height + 1);

  // Scale up without smoothing, then (if asked) down smoothly to the final size.
  const big = document.createElement('canvas');
  big.width = CROP.size * 9;
  big.height = CROP.size * 9;
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  if (inset > 0) {
    // Maskable: stretch the sky's top row and the sea's bottom row out to the edges, scene in the middle.
    b.drawImage(art, 0, CROP.y, GRID, 1, 0, 0, big.width, big.height / 2);
    b.drawImage(art, 0, GRID - 1, GRID, 1, 0, big.height / 2, big.width, big.height / 2);
    const s = big.width * (1 - inset * 2);
    b.drawImage(art, CROP.x, CROP.y, CROP.size, CROP.size, (big.width - s) / 2, (big.height - s) / 2, s, s);
  } else {
    b.drawImage(art, CROP.x, CROP.y, CROP.size, CROP.size, 0, 0, big.width, big.height);
  }
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  o.drawImage(big, 0, 0, size, size);
  return out;
}
