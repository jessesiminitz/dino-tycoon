import type { ArtStyle } from './artStyle';
import type { FerrySize } from '../sim/data/port';

/** Logical (world-pixel) size of each ferry, seen side-on with its bow to the right. */
export const FERRY_SIZE: Record<FerrySize, { w: number; h: number }> = {
  small: { w: 24, h: 13 },
  medium: { w: 40, h: 21 },
  large: { w: 56, h: 29 },
};

const OUTLINE = '#1b1b14';

/**
 * A ferry, code-painted: a water taxi, a two-deck island ferry, or a big
 * ferry with a funnel. `lit` paints glowing windows for the night run.
 */
export function paintFerry(size: FerrySize, style: ArtStyle, lit = false): HTMLCanvasElement {
  const res = style === 'cartoon' ? 2 : 1;
  const { w, h } = FERRY_SIZE[size];
  const canvas = document.createElement('canvas');
  canvas.width = w * res;
  canvas.height = h * res;
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  const round = style === 'cartoon';
  const box = (x: number, y: number, bw: number, bh: number, fill: string, radius = 0) => {
    c.fillStyle = fill;
    if (round && radius) {
      c.beginPath();
      c.roundRect(x, y, bw, bh, radius);
      c.fill();
    } else c.fillRect(x, y, bw, bh);
  };
  /** A hull from deck line `top` to the keel at `bottom`, with a raked bow on the right. */
  const hull = (top: number, bottom: number, fill: string, stripe: string, band: string) => {
    const shape = (inset: number) => {
      c.beginPath();
      c.moveTo(1 + inset, top + inset);
      c.lineTo(w - 1 - inset, top + inset);
      c.lineTo(w - 6 - inset, bottom - inset);
      c.lineTo(4 + inset, bottom - inset);
      c.closePath();
    };
    c.fillStyle = OUTLINE;
    shape(0);
    c.fill();
    c.fillStyle = fill;
    shape(1);
    c.fill();
    c.save();
    shape(1);
    c.clip();
    c.fillStyle = stripe;
    c.fillRect(0, top + 2, w, 2);
    c.fillStyle = band;
    c.fillRect(0, bottom - 3, w, 3);
    c.restore();
  };
  const windows = (x0: number, y: number, n: number, gap: number, wh: number) => {
    for (let i = 0; i < n; i++) {
      box(x0 + i * gap, y, 3, wh, OUTLINE, 1);
      box(x0 + i * gap + 0.5, y + 0.5, 2, wh - 1, lit ? '#ffe08c' : '#7fb8d6', 1);
    }
  };
  const rail = (x0: number, x1: number, y: number) => {
    c.fillStyle = '#e8ece6';
    c.fillRect(x0, y, x1 - x0, 1);
    for (let x = x0; x <= x1; x += 3) c.fillRect(x, y, 1, 3);
  };

  if (size === 'small') {
    // Water taxi: a yellow launch with a little white cabin and a pennant.
    box(7, 2, 10, 6, OUTLINE, 2);
    box(8, 3, 8, 5, '#f4f1e6', 2);
    windows(9, 4, 2, 4, 3);
    box(16, 0, 1, 4, '#5a4632');
    box(17, 0, 4, 2, '#e05a47');
    hull(7, 13, '#f2c14e', '#ffffff', '#c3412f');
  } else if (size === 'medium') {
    // Island ferry: white with a red stripe, a cabin of windows and a sun deck with an awning.
    box(6, 7, 27, 7, OUTLINE, 2);
    box(7, 8, 25, 6, '#f4f1e6', 2);
    windows(9, 9, 6, 4, 3);
    box(9, 1, 18, 4, OUTLINE, 2);
    box(10, 2, 16, 2, '#3f86c6', 1);
    for (let x = 11; x < 26; x += 4) box(x, 2, 2, 2, '#f4f1e6');
    box(10, 4, 1, 3, '#5a4632');
    box(25, 4, 1, 3, '#5a4632');
    rail(7, 33, 5);
    hull(14, 21, '#f8f6ee', '#d04a3a', '#2f4a68');
  } else {
    // Big ferry: navy hull, two decks of windows, a red funnel and a flag astern.
    box(10, 4, 5, 9, OUTLINE, 1);
    box(11, 5, 3, 8, '#d04a3a', 1);
    box(11, 5, 3, 2, '#2b2b2b');
    box(5, 12, 42, 8, OUTLINE, 2);
    box(6, 13, 40, 7, '#f4f1e6', 2);
    windows(8, 14, 9, 4, 4);
    box(18, 6, 24, 7, OUTLINE, 2);
    box(19, 7, 22, 6, '#f4f1e6', 2);
    windows(21, 8, 5, 4, 3);
    box(40, 7, 3, 2, '#7fb8d6'); // bridge window
    rail(6, 46, 10);
    box(3, 6, 1, 8, '#5a4632');
    box(4, 6, 5, 3, '#3f86c6');
    box(28, 2, 1, 5, '#5a4632');
    box(29, 2, 3, 2, '#f2c14e');
    hull(20, 29, '#2c4a7a', '#f4f1e6', '#1b2f4d');
    // Lifebuoys on the rail.
    for (const x of [12, 34]) {
      box(x, 15, 3, 3, '#f4f1e6', 1.5);
      box(x + 1, 16, 1, 1, '#d04a3a');
    }
  }
  return canvas;
}

/** The harbor lighthouse: logical 12×34, red and white with a lamp room. */
export function paintLighthouse(style: ArtStyle): HTMLCanvasElement {
  const res = style === 'cartoon' ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = 12 * res;
  canvas.height = 34 * res;
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
  };
  box(1, 28, 10, 6, OUTLINE);
  box(2, 29, 8, 4, '#8d8f86');
  // A tapering tower in bands.
  for (let y = 9; y < 29; y++) {
    const inset = Math.round((29 - y) / 9);
    box(2 + inset, y, 8 - inset * 2, 1, OUTLINE);
    box(3 + inset, y, 6 - inset * 2, 1, Math.floor((y - 9) / 5) % 2 ? '#f4f1e6' : '#d04a3a');
  }
  box(3, 4, 6, 6, OUTLINE);
  box(4, 5, 4, 4, '#ffe08c');
  box(2, 9, 8, 1, OUTLINE);
  box(3, 1, 6, 3, OUTLINE);
  box(4, 2, 4, 2, '#d04a3a');
  box(5, 0, 2, 1, OUTLINE);
  return canvas;
}

/** A ticket hut for the pier: logical 14×16. */
export function paintTicketHut(style: ArtStyle): HTMLCanvasElement {
  const res = style === 'cartoon' ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = 14 * res;
  canvas.height = 16 * res;
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
  };
  box(1, 6, 12, 10, OUTLINE);
  box(2, 7, 10, 8, '#ba8750');
  box(4, 8, 6, 4, '#243d40');
  box(5, 9, 4, 1, '#a9d0ce');
  box(3, 12, 8, 1, '#f4d795');
  box(0, 3, 14, 4, OUTLINE);
  box(1, 4, 12, 2, '#3f86c6');
  for (let x = 1; x < 13; x += 4) box(x, 4, 2, 2, '#f4f1e6');
  box(6, 0, 2, 3, OUTLINE);
  box(6, 1, 2, 1, '#f2c14e');
  return canvas;
}
