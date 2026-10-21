import { hash2 } from '../sim/rng';
import { Terrain } from '../sim/terrain';
import { leafStage, type GroundTone, type LeafStage } from '../sim/seasons';

/**
 * Seasonal repaints of scenery canvases. Every transform works on the
 * finished sprite, so it suits the Blender, cartoon and original painters
 * alike: leaf-green pixels are recoloured, thinned or replaced by twigs, and
 * snow settles on whatever faces the sky.
 */

/** How a plant looks this season; `~`-suffixed onto its texture key. */
export type PlantLook =
  | 'green'
  | `${LeafStage}-${AutumnHue}`
  | `${LeafStage}-${AutumnHue}-snow`
  | 'evergreen-snow'
  | 'reeds-golden'
  | 'reeds-golden-snow'
  | 'reeds-fresh';
export type AutumnHue = 'gold' | 'orange' | 'red';
export const AUTUMN_HUES: readonly AutumnHue[] = ['gold', 'orange', 'red'];

const SNOW = [244, 248, 251] as const;
const SNOW_SHADE = [207, 222, 233] as const;
const BLOSSOM = [[246, 190, 210], [255, 238, 244], [240, 160, 190]] as const;
const AUTUMN: Record<AutumnHue, { h: number; s: number; l: number }> = {
  gold: { h: 46, s: 0.78, l: 0.06 },
  orange: { h: 27, s: 0.8, l: 0.02 },
  red: { h: 7, s: 0.66, l: -0.03 },
};
const TWIG = [90, 59, 31] as const;
const OUTLINE_RGB = [0x1b, 0x1b, 0x14] as const;

type Rgb = readonly [number, number, number];
interface Trunk { top: number; sumX: number; n: number; darkest: number; color: Rgb; lightest: number; light: Rgb }

function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}

/** Leaf-coloured: green to blue-green, not too grey, not a pale highlight. */
function isLeaf(h: number, s: number, l: number, maxHue = 175): boolean {
  return h >= 60 && h <= maxHue && s >= 0.18 && l > 0.1 && l < 0.8;
}

function isOutline(data: Uint8ClampedArray, i: number): boolean {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  if (r === OUTLINE_RGB[0] && g === OUTLINE_RGB[1] && b === OUTLINE_RGB[2]) return true;
  // Cartoon strokes: very dark and nearly grey.
  const [, s, l] = toHsl(r, g, b);
  return l < 0.16 && s < 0.45;
}

const OPAQUE = 128;

/**
 * The plant `src` repainted for `look`. `res` is the canvas pixels per world
 * pixel, so speckles and twigs keep the same size at every resolution.
 */
export function paintSeasonalPlant(src: HTMLCanvasElement, look: PlantLook, res = 1, seed = 0): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  if (look === 'green') return out;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const parts = look.split('-');
  const snow = parts[parts.length - 1] === 'snow';
  const stage = parts[0];
  const hue = AUTUMN[(parts[1] as AutumnHue) ?? 'gold'] ?? AUTUMN.gold;
  const at = (x: number, y: number) => (y * w + x) * 4;
  const cell = (x: number, y: number, size = 1, salt = 0) => hash2(Math.floor(x / (res * size)), Math.floor(y / (res * size)), seed * 31 + salt);
  const leaf = new Uint8Array(w * h);
  const trunk: Trunk = { top: h, sumX: 0, n: 0, darkest: 1, color: TWIG, lightest: 0, light: TWIG };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    if (data[i + 3] < OPAQUE) continue;
    const [hh, ss, ll] = toHsl(data[i], data[i + 1], data[i + 2]);
    if (isLeaf(hh, ss, ll)) leaf[y * w + x] = 1;
    else if (hh >= 10 && hh <= 45 && ss >= 0.2 && ll < 0.6 && !isOutline(data, i)) {
      // Bark: remember where the trunk ends and its darkest shade, for twigs.
      trunk.top = Math.min(trunk.top, y); trunk.sumX += x; trunk.n++;
      if (ll < trunk.darkest) { trunk.darkest = ll; trunk.color = [data[i], data[i + 1], data[i + 2]]; }
      if (ll > trunk.lightest) { trunk.lightest = ll; trunk.light = [data[i], data[i + 1], data[i + 2]]; }
    }
  }

  const set = (x: number, y: number, c: Rgb, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = at(x, y);
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a;
  };
  const shift = (x: number, y: number, hNew: number, sNew: number, dl: number) => {
    const i = at(x, y);
    const [, , ll] = toHsl(data[i], data[i + 1], data[i + 2]);
    set(x, y, fromHsl(hNew, sNew, ll + dl));
  };

  const canopy = leaf.slice();
  // Which leaves stay on, and what colour they turn.
  const keep = stage === 'buds' ? 0.3 : stage === 'falling' ? 0.35 : stage === 'bare' ? 0 : 1;
  const leafless = keep < 1;
  let removed = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!leaf[y * w + x]) continue;
    if (look.startsWith('evergreen') || look.startsWith('reeds')) {
      if (look.startsWith('reeds-golden')) shift(x, y, 44, 0.48, 0.04);
      else if (look === 'reeds-fresh') shift(x, y, 92, 0.55, 0.05);
      else shift(x, y, 128, 0.25, -0.03); // a darker winter green
      continue;
    }
    if (keep < 1 && cell(x, y, 2, 5) >= keep) {
      set(x, y, [0, 0, 0], 0);
      leaf[y * w + x] = 0;
      removed = true;
      continue;
    }
    switch (stage) {
      case 'buds': shift(x, y, 95, 0.6, 0.12); break;
      case 'fresh': shift(x, y, 92, 0.58, 0.07); break;
      case 'blossom':
        if (cell(x, y, 1, 9) < 0.32) set(x, y, BLOSSOM[Math.floor(cell(x, y, 1, 10) * 3)]);
        else shift(x, y, 92, 0.58, 0.07);
        break;
      case 'turning':
        if (cell(x, y, 2, 11) < 0.55) shift(x, y, hue.h, hue.s, hue.l);
        else shift(x, y, 66, 0.5, 0.02);
        break;
      case 'autumn':
      case 'falling':
        shift(x, y, hue.h + (cell(x, y, 2, 12) - 0.5) * 14, hue.s, hue.l);
        break;
    }
  }

  if (leafless && removed) {
    dropStrayOutline(data, w, h, res);
    drawTwigs(data, w, h, res, seed, canopy, trunk);
    reOutline(data, w, h, res);
  }
  if (snow) settleSnow(data, w, h, res, seed, look.startsWith('evergreen') ? 0.55 : 0.75);
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Outline that no longer borders anything once the leaves have gone. */
function dropStrayOutline(data: Uint8ClampedArray, w: number, h: number, res: number): void {
  const r = Math.max(1, Math.round(res));
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= OPAQUE && !isOutline(data, i * 4)) solid[i] = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < OPAQUE || !isOutline(data, i)) continue;
    let near = false;
    for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[ny * w + nx]) { near = true; break; }
    }
    if (!near) data[i + 3] = 0;
  }
}

/** Bare branches: a stem up from the trunk top with forked side branches reaching where the canopy was. */
function drawTwigs(data: Uint8ClampedArray, w: number, h: number, res: number, seed: number, canopy: Uint8Array, trunk: Trunk): void {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  const trunkTop = trunk.top, trunkN = trunk.n, trunkSumX = trunk.sumX;
  // Pixel art uses the darkest bark; smooth high-resolution art a mid tone, so thin twigs don't read as a dark mass.
  const mix = res > 1 ? 0.45 : 0;
  const trunkDark: Rgb = [0, 1, 2].map((k) => Math.round(trunk.color[k] * (1 - mix) + trunk.light[k] * mix)) as unknown as Rgb;
  // The branches reach across where the leaves were.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!canopy[y * w + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) {
    // Nothing left to measure: use the upper part of the canvas.
    x0 = Math.round(w * 0.2); x1 = Math.round(w * 0.8); y0 = Math.round(h * 0.1); y1 = Math.round(h * 0.6);
  }
  const cx = trunkN > 0 ? Math.round(trunkSumX / trunkN) : Math.round((x0 + x1) / 2);
  const base = trunkN > 0 ? trunkTop : Math.min(h - 2, y1 + Math.round(3 * res));
  const top = Math.min(y0 + Math.round(2 * res), base - Math.round(3 * res));
  const crownW = Math.max(4 * res, x1 - x0);
  const thick = Math.max(1, Math.round(res * 0.5));
  const line = (ax: number, ay: number, bx: number, by: number, width: number) => {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let k = 0; k <= n; k++) {
      const px = Math.round(ax + ((bx - ax) * k) / n), py = Math.round(ay + ((by - ay) * k) / n);
      for (let dy = 0; dy < width; dy++) for (let dx = 0; dx < width; dx++) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        data[i] = trunkDark[0]; data[i + 1] = trunkDark[1]; data[i + 2] = trunkDark[2]; data[i + 3] = 255;
      }
    }
  };
  if (base - top < 2) return;
  line(cx, base, cx, top, thick);
  const branches = 5;
  for (let b = 0; b < branches; b++) {
    const along = 0.18 + (b / branches) * 0.7;
    const sy = Math.round(base - (base - top) * along);
    const side = b % 2 === 0 ? -1 : 1;
    const reach = (crownW / 2) * (0.75 + hash2(b, seed, 71) * 0.25) * (1 - along * 0.35);
    const ex = Math.round(cx + side * reach);
    const ey = Math.round(sy - (base - top) * (0.22 + hash2(seed, b, 72) * 0.15));
    line(cx, sy, ex, ey, thick);
    // A little upward fork two thirds of the way out.
    const fx = Math.round(cx + side * reach * 0.62), fy = Math.round(sy + (ey - sy) * 0.62);
    line(fx, fy, Math.round(fx + side * res * 1.5), Math.round(fy - res * 3), thick);
  }
}

/** A dark outline round everything solid, as the sprite painters draw. */
function reOutline(data: Uint8ClampedArray, w: number, h: number, res: number): void {
  const r = Math.max(1, Math.round(res * 0.35));
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= OPAQUE && !isOutline(data, i * 4)) solid[i] = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (solid[y * w + x] || (data[i + 3] >= OPAQUE && isOutline(data, i))) continue;
    let near = false;
    for (let d = 1; d <= r && !near; d++)
      for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[ny * w + nx]) { near = true; break; }
      }
    if (near) { data[i] = OUTLINE_RGB[0]; data[i + 1] = OUTLINE_RGB[1]; data[i + 2] = OUTLINE_RGB[2]; data[i + 3] = 255; }
  }
}

/** Snow on every surface open to the sky: the top pixels of leaves, branches and fronds. */
function settleSnow(data: Uint8ClampedArray, w: number, h: number, res: number, seed: number, amount: number): void {
  const depth = Math.max(1, Math.round(res * 0.5));
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] >= OPAQUE;
  // Leave the ground shadow and the bottom quarter (trunk base) bare.
  const lowest = Math.round(h * 0.82);
  const caps: number[] = [];
  for (let x = 0; x < w; x++) {
    for (let y = 1; y < lowest; y++) {
      if (!solid(x, y) || solid(x, y - 1)) continue;
      if (hash2(Math.floor(x / res), Math.floor(y / res), seed * 13 + 77) > amount) continue;
      caps.push(x, y);
    }
  }
  for (let k = 0; k < caps.length; k += 2) {
    const x = caps[k], y = caps[k + 1];
    for (let d = 0; d < depth * 2; d++) {
      const yy = y + d - depth; // one pixel sits on top; the next whitens the surface
      if (yy < 0 || yy >= h) continue;
      if (d < depth && solid(x, yy)) continue;
      const i = (yy * w + x) * 4;
      const c = d < depth ? SNOW : hash2(x, yy, seed + 5) < 0.5 ? SNOW : SNOW_SHADE;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
}

// --- Ground -----------------------------------------------------------------

/** Terrain whose grass changes colour with the seasons. */
const GRASSY = new Set([Terrain.Grass, Terrain.Forest, Terrain.Marsh, Terrain.Cliff, Terrain.Pond]);

/** A terrain tile repainted for the season's ground tone. Water, sand and rock stay as they are. */
export function paintSeasonalTile(src: HTMLCanvasElement, terrain: Terrain, tone: GroundTone): HTMLCanvasElement {
  if (tone === 'summer' || !GRASSY.has(terrain)) return src;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = toHsl(d[i], d[i + 1], d[i + 2]);
    if (!isLeaf(h, s, l, 160)) continue;
    let c: Rgb;
    if (tone === 'fresh') c = fromHsl(h - 6, Math.min(0.62, s + 0.1), l + 0.04);
    else if (tone === 'golden') c = fromHsl(h * 0.45 + 50 * 0.55, s * 0.9, l + 0.03);
    else c = fromHsl(h * 0.4 + 62 * 0.6, s * 0.45, l - 0.02);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// --- Snow cover ---------------------------------------------------------------

/** Coverage steps in the snow tileset (1…SNOW_LEVELS; 0 means no snow tile). */
export const SNOW_LEVELS = 10;
/** The snow pattern repeats every SNOW_PERIOD tiles, so neighbouring tiles join up seamlessly. */
export const SNOW_PERIOD = 4;

/**
 * Snow tiles in one row: for each coverage level, SNOW_PERIOD² tiles cut from
 * one seamless drift pattern. Every level thresholds the same pattern, so a
 * thinner tile beside a thicker one shows a melting edge, never a seam.
 */
export function paintSnowTiles(tile: number): HTMLCanvasElement {
  const span = tile * SNOW_PERIOD;
  const field = new Float32Array(span * span);
  const lattice = 8, cells = span / lattice;
  const node = (i: number, j: number) => hash2(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, 9091);
  for (let y = 0; y < span; y++) for (let x = 0; x < span; x++) {
    const gx = x / lattice, gy = y / lattice;
    const i = Math.floor(gx), j = Math.floor(gy);
    const fx = gx - i, fy = gy - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const top = node(i, j) * (1 - sx) + node(i + 1, j) * sx;
    const bottom = node(i, j + 1) * (1 - sx) + node(i + 1, j + 1) * sx;
    field[y * span + x] = (top * (1 - sy) + bottom * sy) * 0.78 + hash2(x, y, 9092) * 0.22;
  }
  const subtiles = SNOW_PERIOD * SNOW_PERIOD;
  const canvas = document.createElement('canvas');
  canvas.width = SNOW_LEVELS * subtiles * tile; canvas.height = tile;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, tile);
  for (let level = 1; level <= SNOW_LEVELS; level++) {
    // Even full cover lets a little ground show through.
    const cover = (level / SNOW_LEVELS) * 0.97;
    for (let sub = 0; sub < subtiles; sub++) {
      const ox = ((level - 1) * subtiles + sub) * tile;
      const fx0 = (sub % SNOW_PERIOD) * tile, fy0 = Math.floor(sub / SNOW_PERIOD) * tile;
      for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
        const v = field[(fy0 + y) * span + fx0 + x];
        if (v >= cover) continue;
        const i = (y * canvas.width + ox + x) * 4;
        const edge = v > cover - 0.07;
        const c = edge ? SNOW_SHADE : hash2(fx0 + x, fy0 + y, 9093) < 0.04 ? [255, 255, 255] : SNOW;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = edge ? 220 : 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Snow tileset frame for a map cell with `level` coverage (1…SNOW_LEVELS). */
export function snowTileIndex(level: number, x: number, y: number): number {
  return (level - 1) * SNOW_PERIOD * SNOW_PERIOD + (y % SNOW_PERIOD) * SNOW_PERIOD + (x % SNOW_PERIOD);
}

/** How much more (or less) snow a kind of ground holds than open grass; null for none at all. */
export function snowBias(terrain: Terrain): number | null {
  switch (terrain) {
    case Terrain.Grass: case Terrain.Marsh: return 0;
    case Terrain.Forest: return -0.08; // sheltered under the trees
    case Terrain.Sand: return -0.18; // salty beaches melt first
    case Terrain.Rock: case Terrain.Cliff: return 0.04;
    case Terrain.Mountain: return 0.18;
    case Terrain.LavaRock: return -0.35;
    default: return null; // water, springs, lava and the warm volcano
  }
}

// --- Which look each plant has today ----------------------------------------

export type PlantKind = 'deciduous' | 'evergreen' | 'reeds' | 'none';

/** Plant kind from a scenery texture key. Conifers, cycads, tree ferns, giants and palms keep their leaves. */
export function plantKind(textureKey: string): PlantKind {
  if (/^tree-1-/.test(textureKey) || textureKey.startsWith('bush-') || textureKey === 'decor-tree') return 'deciduous';
  if (/^tree-[02-4]-/.test(textureKey) || textureKey.startsWith('palm-') || textureKey === 'decor-palm') return 'evergreen';
  if (textureKey.startsWith('reeds-')) return 'reeds';
  return 'none';
}

/**
 * The look of one plant on year-day `t` with `snow` cover. `h` (0–1) is the
 * plant's own dice: it staggers when it turns, and picks its autumn colour.
 */
export function plantLook(kind: PlantKind, t: number, snow: number, h: number): PlantLook {
  const snowy = snow + (h - 0.5) * 0.12 > 0.3;
  if (kind === 'evergreen') return snowy ? 'evergreen-snow' : 'green';
  if (kind === 'reeds') {
    if (t >= 15 + h || t < 2.5 + h) return snowy ? 'reeds-golden-snow' : 'reeds-golden';
    return t < 7 ? 'reeds-fresh' : 'green';
  }
  if (kind !== 'deciduous') return 'green';
  const stage = leafStage(t, (h - 0.5) * 2);
  if (stage === 'green') return 'green';
  // Only some trees blossom; the rest just leaf out.
  const look = stage === 'blossom' && h > 0.45 ? 'fresh' : stage;
  const coloured = look === 'turning' || look === 'autumn' || look === 'falling';
  const hue = coloured ? AUTUMN_HUES[Math.floor(hash2(Math.floor(h * 997), 3, 41) * AUTUMN_HUES.length)] : 'gold';
  return snowy && (look === 'bare' || look === 'buds' || look === 'falling') ? `${look}-${hue}-snow` : `${look}-${hue}`;
}
