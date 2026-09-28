import { findEntrance, initialParcels, parcelGrid, PARCEL } from './land';
import { hash2, Rng } from './rng';
import { fractal, isLand, isSea, Terrain, valueNoise, type TerrainMap } from './terrain';

export type IslandShape = 'classic' | 'twin' | 'crescent' | 'river' | 'fire' | 'peninsula';

export const ISLAND_SHAPES: Record<IslandShape, { name: string; icon: string; blurb: string }> = {
  classic: { name: 'Classic', icon: '🏝️', blurb: 'A round island with a mountain range, a volcano, a river and a waterfall or two.' },
  twin: { name: 'Twin Isles', icon: '🌉', blurb: 'Two islands joined by a sandy causeway. Expand across it.' },
  crescent: { name: 'Crescent Bay', icon: '🌙', blurb: 'A curved island wrapped round a calm lagoon, with little islets offshore.' },
  river: { name: 'River Valley', icon: '🏞️', blurb: 'Big rivers wind down to the sea through lakes and marshes. Bridges needed!' },
  fire: { name: 'Fire Mountain', icon: '🌋', blurb: 'A huge volcano with fields of old lava and steaming hot springs.' },
  peninsula: { name: 'Peninsula', icon: '🗺️', blurb: 'A long arm of land reaching out to sea. The far end is prime land.' },
};

export const ISLAND_SHAPE_IDS = Object.keys(ISLAND_SHAPES) as IslandShape[];

/** Smoothstep-like falloff: 1 at the centre of a blob, 0 at its edge and beyond. */
const blob = (d: number, r: number) => 1 - Math.min(1, d / r) ** 2.2;

/** Distance from (x, y) to the segment a–b, and how far along it (0–1) the nearest point lies. */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return { d: Math.hypot(x - (ax + vx * t), y - (ay + vy * t)), t };
}

/** How much a spot (in -1…1 map coordinates) belongs to the island, by shape. */
function landMask(shape: IslandShape, nx: number, ny: number): number {
  const dist = Math.hypot(nx, ny);
  switch (shape) {
    case 'twin':
      return Math.max(blob(Math.hypot(nx + 0.42, ny - 0.05), 0.62), blob(Math.hypot(nx - 0.47, ny + 0.08), 0.55));
    case 'crescent': {
      // A big disc with a bay bitten out of its south side.
      const bay = 1 - Math.min(1, Math.hypot(nx - 0.05, ny - 0.72) / 0.62);
      return Math.max(0, blob(Math.hypot(nx, ny + 0.05), 0.98) - bay * 2.2);
    }
    case 'river':
      return blob(dist, 1.02);
    case 'peninsula': {
      const { d, t } = toSegment(nx, ny, -0.5, 0.15, 0.78, -0.3);
      return blob(d, 0.6 - 0.3 * t);
    }
    default:
      return blob(dist, 1);
  }
}

/** Island-wide knobs per shape. */
const SHAPE_SETTINGS: Record<IslandShape, { rivers: number; lavaRadius: number; springs: number; marsh: number; islets: number }> = {
  classic: { rivers: 1, lavaRadius: 3.5, springs: 1, marsh: 0.5, islets: 2 },
  twin: { rivers: 1, lavaRadius: 3, springs: 0, marsh: 0.5, islets: 2 },
  crescent: { rivers: 1, lavaRadius: 3, springs: 1, marsh: 0.5, islets: 4 },
  river: { rivers: 3, lavaRadius: 3, springs: 0, marsh: 0.38, islets: 1 },
  fire: { rivers: 1, lavaRadius: 8, springs: 3, marsh: 0.6, islets: 2 },
  peninsula: { rivers: 1, lavaRadius: 3.5, springs: 1, marsh: 0.5, islets: 3 },
};

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Generates an island. Noise-based elevation shaped by a per-shape land mask
 * (edges are always open sea), moisture noise for forests, mountains on the
 * high ground with a volcano on the highest peak, and inland lakes. Then the
 * landscape: rivers run downhill from the high ground to the sea (ending in a
 * lake if trapped), cliffs mark the edge of high plateaus (a waterfall where a
 * river goes over), marsh gathers in wet lowland by the water, cooled lava
 * rings the volcano with hot springs, and a few islets dot the sea. The
 * starting land by the gate is always kept clear of rivers, cliffs and marsh.
 */
export function generateIsland(width: number, height: number, seed: number, shape: IslandShape = 'classic'): TerrainMap {
  const settings = SHAPE_SETTINGS[shape];
  const rng = new Rng((seed ^ 0x5eed1e) >>> 0);
  const n = width * height;
  const tiles: Terrain[] = new Array(n);
  const elev: number[] = new Array(n);
  const moist: number[] = new Array(n);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  // Islets: small bumps out at sea, placed where the main island isn't.
  const islets: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; tries < 60 && islets.length < settings.islets; tries++) {
    const x = rng.int(4, width - 5);
    const y = rng.int(4, height - 5);
    const m = landMask(shape, (x - cx) / cx, (y - cy) / cy);
    if (m < 0.05 && islets.every((o) => Math.hypot(o.x - x, o.y - y) > 10)) islets.push({ x, y, r: 2 + rng.next() * 1.8 });
  }
  // Twin Isles: a sandy causeway between the two islands.
  const bar = { ax: cx - 0.42 * cx, ay: cy + 0.05 * cy, bx: cx + 0.47 * cx, by: cy - 0.08 * cy };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = (x - cx) / cx;
      const ny = (y - cy) / cy;
      const mask = landMask(shape, nx, ny);
      // Taper to zero near the border so the map edge is always open ocean.
      // (Classic keeps its original formula, so the fixed scenario islands keep their familiar outline.)
      const border = shape === 'classic' ? 1 : Math.min(1, (1 - Math.max(Math.abs(nx), Math.abs(ny))) * 5);
      let e = Math.max(0, fractal(x, y, seed) * 0.6 + mask * 0.7 - 0.35) * Math.min(1, mask * 4) * border;
      if (shape === 'fire') e += 0.32 * Math.max(0, 1 - Math.hypot(nx, ny) / 0.5) ** 1.5 * border;
      for (const o of islets) {
        const d = Math.hypot(x - o.x, y - o.y);
        if (d < o.r) e = Math.max(e, 0.16 + 0.2 * (1 - d / o.r) + fractal(x, y, seed + 3) * 0.05);
      }
      if (shape === 'twin' && toSegment(x, y, bar.ax, bar.ay, bar.bx, bar.by).d < 1.3) e = Math.max(e, 0.19);
      elev[i] = e;
      moist[i] = fractal(x + 1000, y + 1000, seed + 7);
      const pond = valueNoise(x + 500, y + 2000, 5, seed + 13);

      let t: Terrain;
      if (e < 0.08) t = Terrain.DeepWater;
      else if (e < 0.17) t = Terrain.Shallows;
      else if (e < 0.22) t = Terrain.Sand;
      else if (pond > 0.9 && e > 0.3 && e < 0.6) t = Terrain.Pond;
      else if (moist[i] > 0.64) t = Terrain.Forest;
      else t = Terrain.Grass;
      tiles[i] = t;
    }
  }

  // Relative heights, so every island gets a range: the highest few percent of
  // the land becomes mountains, ringed by rocky ground.
  const landElev = (filter: (t: Terrain) => boolean) =>
    elev.filter((_, i) => filter(tiles[i])).sort((a, b) => a - b);
  const land = landElev(isLand);
  const pct = (p: number) => land[Math.floor(land.length * p)] ?? Infinity;
  const mountainCut = pct(0.96);
  const rockCut = pct(0.9);
  for (let i = 0; i < n; i++) {
    if (!isLand(tiles[i]) || tiles[i] === Terrain.Sand) continue;
    if (elev[i] >= mountainCut) tiles[i] = Terrain.Mountain;
    else if (elev[i] >= rockCut) tiles[i] = Terrain.Rock;
  }

  // The highest peak becomes a volcano (a 3×3 cone).
  let peak = -1;
  for (let i = 0; i < n; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) continue;
    if (tiles[i] === Terrain.Mountain && (peak < 0 || elev[i] > elev[peak])) peak = i;
  }
  let volcano: TerrainMap['volcano'];
  if (peak >= 0) {
    volcano = { x: peak % width, y: Math.floor(peak / width) };
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) tiles[(volcano.y + dy) * width + volcano.x + dx] = Terrain.Volcano;
  }

  const map: TerrainMap = { width, height, tiles, volcano, heights: [], shape };

  // Keep the land around the gate (the starting plots, plus a margin) plain and buildable.
  const entrance = findEntrance(map);
  const owned = initialParcels(map, entrance);
  const { cols } = parcelGrid(map);
  const keepClear = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    for (let dy = -2; dy <= 2 && !keepClear[i]; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const px = Math.floor((x + dx) / PARCEL);
        const py = Math.floor((y + dy) / PARCEL);
        if (x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height && owned[py * cols + px]) {
          keepClear[i] = 1;
          break;
        }
      }
  }

  carveRivers(map, elev, keepClear, rng, settings.rivers, shape === 'river', pct(0.72), entrance);
  addCliffs(map, elev, keepClear, seed, pct(0.72));
  addMarsh(map, elev, moist, keepClear, seed, pct(0.35), settings.marsh);
  if (volcano) addLava(map, keepClear, seed, rng, settings.lavaRadius, settings.springs);

  // Heights from elevation, 0–15; water sits a step below its banks.
  map.heights = elev.map((e, i) => {
    const h = Math.max(0, Math.min(15, Math.round(e * 20)));
    return tiles[i] === Terrain.River || tiles[i] === Terrain.Pond ? Math.max(0, h - 1) : h;
  });
  return map;
}

/**
 * Rivers start on high ground (below the peaks) and step to the lowest
 * neighbour each time, carving through rises, until they reach the sea, a lake
 * or another river. A river that gets trapped pools into a small lake. They
 * never cross mountains, the volcano or the land kept clear by the gate.
 */
function carveRivers(
  map: TerrainMap,
  elev: number[],
  keepClear: Uint8Array,
  rng: Rng,
  count: number,
  wide: boolean,
  cliffLevel: number,
  gate: { x: number; y: number },
): void {
  const { width, height, tiles } = map;
  const n = width * height;
  // Distance from the sea for every tile, so rivers can start deep inland.
  const seaDist = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (isSea(tiles[i])) {
    seaDist[i] = 0;
    queue.push(i);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (seaDist[j] >= 0) continue;
      seaDist[j] = seaDist[i] + 1;
      queue.push(j);
    }
  }
  // Sources: firm ground far from the sea and high up, with a little randomness; kept well apart.
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = tiles[i];
    if ((t === Terrain.Grass || t === Terrain.Forest || t === Terrain.Rock) && !keepClear[i] && seaDist[i] >= 4) candidates.push(i);
  }
  const rank = (i: number) => seaDist[i] + elev[i] * 12 + rng.next() * 6;
  const ranked = candidates.map((i) => ({ i, score: rank(i) })).sort((a, b) => b.score - a.score);
  const sources: number[] = [];
  for (const { i: c } of ranked) {
    if (sources.length >= count) break;
    const cx = c % width;
    const cy = Math.floor(c / width);
    if (sources.every((s) => Math.hypot((s % width) - cx, Math.floor(s / width) - cy) > 10)) sources.push(c);
  }
  sources.forEach((source, r) => {
    // Each river heads for a stretch of coast away from the gate, so it winds right across the island.
    // Toward the far coast, and away from the gate side where possible.
    const sx = source % width;
    const goRight = sx < width / 2 || (sx < gate.x + 6 && r % 2 === 1);
    const target = { x: goRight ? width - 1 : 0, y: rng.int(Math.floor(height * 0.2), Math.floor(height * 0.6)) };
    const pull = wide ? 0.007 : 0.005;
    const route: number[] = [];
    const seen = new Set<number>();
    let cur = source;
    let ended: 'water' | 'stuck' = 'stuck';
    for (let step = 0; step < 220; step++) {
      route.push(cur);
      seen.add(cur);
      const x = cur % width;
      const y = Math.floor(cur / width);
      const nbrs = NEIGHBOURS.map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height)
        .map(([nx, ny]) => ny * width + nx);
      if (step > 2 && nbrs.some((j) => isSea(tiles[j]) || tiles[j] === Terrain.River || (step > 30 && tiles[j] === Terrain.Pond))) {
        ended = 'water';
        break;
      }
      let best = -1;
      let bestScore = Infinity;
      for (const j of nbrs) {
        const t = tiles[j];
        if (seen.has(j) || keepClear[j] || t === Terrain.Mountain || t === Terrain.Volcano || (!isLand(t) && t !== Terrain.Pond)) continue;
        const jx = j % width;
        const jy = Math.floor(j / width);
        const score = elev[j] + hash2(j, r, 71) * 0.03 + Math.hypot(jx - target.x, jy - target.y) * pull;
        if (score < bestScore) {
          bestScore = score;
          best = j;
        }
      }
      if (best < 0) break;
      // Carve: the river bed never runs uphill.
      elev[best] = Math.min(elev[best], elev[cur]);
      cur = best;
    }
    if (route.length < 10) return;
    for (const i of route) tiles[i] = Terrain.River;
    addWaterfall(map, elev, keepClear, route, cliffLevel);
    if (wide && r === 0) {
      // The valley's main river runs two tiles wide in the lowlands.
      for (const i of route) {
        const j = i + 1;
        if (elev[i] < 0.42 && (i % width) + 1 < width && isLand(tiles[j]) && tiles[j] !== Terrain.Sand && !keepClear[j]) {
          tiles[j] = Terrain.River;
          elev[j] = Math.min(elev[j], elev[i]);
        }
      }
    }
    if (ended === 'stuck') {
      // Trapped in a hollow: it pools into a lake.
      const end = route[route.length - 1];
      const ex = end % width;
      const ey = Math.floor(end / width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = (ey + dy) * width + ex + dx;
          if (ex + dx < 0 || ey + dy < 0 || ex + dx >= width || ey + dy >= height || keepClear[j]) continue;
          if (isLand(tiles[j]) || tiles[j] === Terrain.River) tiles[j] = Terrain.Pond;
        }
    }
  });
}

/**
 * Where a river flows south off the high ground, it drops over a waterfall
 * with a short cliff either side, like a little gorge.
 */
function addWaterfall(map: TerrainMap, elev: number[], keepClear: Uint8Array, route: number[], level: number): void {
  const { width, tiles } = map;
  for (let k = 1; k < route.length - 2; k++) {
    const i = route[k];
    const next = route[k + 1];
    if (next !== i + width || elev[route[k - 1]] < level * 0.92 || keepClear[i]) continue;
    tiles[i] = Terrain.Waterfall;
    for (const side of [-1, 1])
      for (let d = 1; d <= 3; d++) {
        const j = i + side * d;
        const t = tiles[j];
        if (keepClear[j] || (t !== Terrain.Grass && t !== Terrain.Forest && t !== Terrain.Rock)) break;
        tiles[j] = Terrain.Cliff;
      }
    return;
  }
}

/**
 * The edge of high ground facing the viewer (south) becomes a cliff face,
 * broken into stretches so the plateau above can still be reached. A river
 * crossing the edge becomes a waterfall.
 */
function addCliffs(map: TerrainMap, elev: number[], keepClear: Uint8Array, seed: number, level: number): void {
  const { width, height, tiles } = map;
  for (let y = 1; y < height - 2; y++) {
    let run = 0;
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const below = i + width;
      const t = tiles[i];
      const edge =
        elev[i] >= level &&
        elev[below] < level &&
        elev[i] - elev[below + width] > 0.05 &&
        (isLand(tiles[below]) || tiles[below] === Terrain.River) &&
        !keepClear[i] &&
        !keepClear[below] &&
        valueNoise(x, y, 5, seed + 31) > 0.38;
      if (!edge) {
        run = 0;
        continue;
      }
      if (t === Terrain.River) {
        tiles[i] = Terrain.Waterfall;
        run = 0;
        continue;
      }
      if (t !== Terrain.Grass && t !== Terrain.Forest && t !== Terrain.Rock) {
        run = 0;
        continue;
      }
      // A gap every so often so the high ground stays reachable.
      run++;
      if (run % 9 === 8 || run % 9 === 0) continue;
      tiles[i] = Terrain.Cliff;
    }
  }
}

/** Marsh gathers in wet lowland near rivers, lakes and lagoons. */
function addMarsh(map: TerrainMap, elev: number[], moist: number[], keepClear: Uint8Array, seed: number, low: number, threshold: number): void {
  const { width, height, tiles } = map;
  const wet = (t: Terrain) => t === Terrain.River || t === Terrain.Pond || t === Terrain.Shallows;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const t = tiles[i];
      if ((t !== Terrain.Grass && t !== Terrain.Forest) || keepClear[i] || elev[i] > low || moist[i] < 0.42) continue;
      let nearWater = false;
      for (let dy = -2; dy <= 2 && !nearWater; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && wet(tiles[ny * width + nx])) {
            nearWater = true;
            break;
          }
        }
      if (nearWater && valueNoise(x, y, 4, seed + 41) > threshold) tiles[i] = Terrain.Marsh;
    }
}

/** Old lava around the volcano, a few streaks running down from it, and hot springs among it. */
function addLava(map: TerrainMap, keepClear: Uint8Array, seed: number, rng: Rng, radius: number, springs: number): void {
  const { width, height, tiles } = map;
  const v = map.volcano!;
  const lavaOk = (i: number) => {
    const t = tiles[i];
    return (t === Terrain.Grass || t === Terrain.Forest || t === Terrain.Rock || t === Terrain.Sand) && !keepClear[i];
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const d = Math.hypot(x - v.x, y - v.y);
      if (lavaOk(i) && d < radius * (0.7 + 0.6 * valueNoise(x, y, 3, seed + 51))) tiles[i] = Terrain.LavaRock;
    }
  if (radius >= 6) {
    // Fire Mountain: old flows run downhill from the crater, two tiles wide.
    for (let k = 0; k < 3; k++) {
      const angle = rng.next() * Math.PI * 2;
      for (let s = 2; s < radius * 2; s++) {
        const x = Math.round(v.x + Math.cos(angle) * s + (valueNoise(s, k, 2, seed + 61) - 0.5) * 2);
        const y = Math.round(v.y + Math.sin(angle) * s);
        for (const [dx, dy] of [[0, 0], [1, 0]]) {
          const i = (y + dy) * width + x + dx;
          if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
          if (lavaOk(i)) tiles[i] = Terrain.LavaRock;
        }
      }
    }
  }
  // Hot springs: small steaming pools among the rocks near the volcano.
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < springs; tries++) {
    const x = v.x + rng.int(-Math.ceil(radius) - 3, Math.ceil(radius) + 3);
    const y = v.y + rng.int(-Math.ceil(radius) - 3, Math.ceil(radius) + 3);
    if (x < 1 || y < 1 || x >= width - 2 || y >= height - 1) continue;
    const i = y * width + x;
    const d = Math.hypot(x - v.x, y - v.y);
    if (d < 3 || keepClear[i] || keepClear[i + 1]) continue;
    if ((tiles[i] !== Terrain.LavaRock && tiles[i] !== Terrain.Rock) || (tiles[i + 1] !== Terrain.LavaRock && tiles[i + 1] !== Terrain.Rock)) continue;
    tiles[i] = Terrain.HotSpring;
    tiles[i + 1] = Terrain.HotSpring;
    placed++;
  }
}
