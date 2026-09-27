/** Small helpers for painting pixel-art sprites in code. */

export const OUTLINE = '#1b1b14';

/** Pixel canvas from rows of palette keys, with an automatic dark outline. */
export function paintRows(rows: string[], colors: Record<string, string>): HTMLCanvasElement {
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
      else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) ctx.fillStyle = OUTLINE;
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

export type Plot = (x: number, y: number, color: string) => void;

/**
 * A blank canvas painted by `draw`, then given a dark outline around every
 * opaque pixel and a soft ground shadow under its base.
 */
export function paintSprite(w: number, h: number, draw: (px: Plot) => void, shadow = true): HTMLCanvasElement {
  const grid: (string | null)[][] = Array.from({ length: h }, () => new Array(w).fill(null));
  draw((x, y, color) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) grid[y][x] = color;
  });
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (shadow) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 3, w * 0.38, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const filled = (x: number, y: number) => grid[y]?.[x] != null;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        ctx.fillStyle = grid[y][x]!;
      } else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        ctx.fillStyle = OUTLINE;
      } else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}
