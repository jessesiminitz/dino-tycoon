import type { Simulation } from '../sim/Simulation';
import { holdPause, releasePause } from './pause';
import type { GameEvent } from '../sim/systems/context';
import { SPECIES } from '../sim/data/species';
import { hash2 } from '../sim/rng';
import { dinoShape } from '../render/dinoArt';
import { playSfx } from '../audio/audio';
import { getSettings } from './settings';
import { award } from './stickers';

type Find = NonNullable<GameEvent['fossil']>;

/** The sand pit is painted on this grid and shown scaled up, pixel-art style. */
const W = 128;
const H = 96;
const BRUSH = 5;
/** Share of the fossil to uncover before it's identified. */
const REVEAL = 0.7;

const DIRT = ['#6b4e2e', '#5e4428', '#76583a', '#634829'];
const SAND = ['#e3c98f', '#d9bd82', '#ecd7a3', '#cfb178', '#e8cf97'];
const BONE = { base: '#e9dfc4', light: '#fbf5e4', shade: '#c9b98f', crack: '#b3a27a', edge: '#3a2a18' };

/** Paints the buried find (the species' own outline, turned to bone) and returns which pixels are fossil. */
function paintFossil(ctx: CanvasRenderingContext2D, find: Find): boolean[] {
  const fossil = new Array<boolean>(W * H).fill(false);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const pebble = hash2(x, y, 41) < 0.015;
      ctx.fillStyle = pebble ? '#8a8378' : DIRT[Math.floor(hash2(x, y, 7) * DIRT.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  const shape = dinoShape(SPECIES[find.species]);
  const sh = shape.length;
  const sw = shape[0].length;
  const scale = Math.max(1, Math.floor(Math.min((W - 16) / sw, (H - 14) / sh)));
  const ox = Math.floor((W - sw * scale) / 2);
  const oy = Math.floor((H - sh * scale) / 2);
  const at = (x: number, y: number) => {
    const sx = Math.floor((x - ox) / scale);
    const sy = Math.floor((y - oy) / scale);
    return x >= ox && y >= oy && sx < sw && sy < sh ? shape[sy][sx] : null;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (k) {
        fossil[y * W + x] = true;
        let c = BONE.base;
        if (k === 'E' || k === 'M') c = BONE.edge; // eye socket, jaw line
        else if (!at(x, y - 1)) c = BONE.light;
        else if (!at(x, y + 1) || !at(x + 1, y)) c = BONE.shade;
        else if (hash2(x, y, 99) < 0.05) c = BONE.crack;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        ctx.fillStyle = BONE.edge;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  return fossil;
}

function paintSand(ctx: CanvasRenderingContext2D): void {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = hash2(x, y, 13) < 0.01 ? '#b09a6a' : SAND[Math.floor(hash2(x, y, 3) * SAND.length)];
      ctx.fillRect(x, y, 1, 1);
    }
}

/**
 * 🦴 Fossil finds (already credited by the dig site) wait behind a "Dig!"
 * button; tapping it opens a sand pit to brush away with a finger until the
 * bones show. Purely for fun: skipping, or turning it off in Settings, changes nothing.
 */
export function mountDig(sim: Simulation): void {
  const button = document.getElementById('dig-btn')!;
  const badge = button.querySelector<HTMLElement>('.badge')!;
  const modal = document.getElementById('dig')!;
  const fossilCanvas = modal.querySelector<HTMLCanvasElement>('.dig-fossil')!;
  const sandCanvas = modal.querySelector<HTMLCanvasElement>('.dig-sand')!;
  const sparkles = modal.querySelector<HTMLElement>('.dig-sparkles')!;
  const bar = modal.querySelector<HTMLElement>('.need-bar span')!;
  const caption = modal.querySelector<HTMLElement>('.dig-caption')!;
  const done = modal.querySelector<HTMLButtonElement>('.dig-done')!;
  const sand = sandCanvas.getContext('2d')!;
  const queue: Find[] = [];
  let current: Find | null = null;
  let fossil: boolean[] = [];
  let total = 1;
  let cleared = new Set<number>();
  let finished = false;
  let last: { x: number; y: number } | null = null;

  const refreshButton = () => {
    button.classList.toggle('hidden', queue.length === 0);
    badge.textContent = String(queue.length);
    badge.classList.toggle('hidden', queue.length < 2);
  };

  sim.onEvent((e) => {
    if (!e.fossil || !getSettings().digGame) return;
    queue.push(e.fossil);
    refreshButton();
  });

  const open = () => {
    current = queue.shift() ?? null;
    refreshButton();
    if (!current) return;
    fossil = paintFossil(fossilCanvas.getContext('2d')!, current);
    total = Math.max(1, fossil.filter(Boolean).length);
    cleared = new Set();
    finished = false;
    paintSand(sand);
    sandCanvas.style.opacity = '1';
    sparkles.classList.remove('go');
    bar.style.width = '0%';
    caption.textContent = 'Drag your finger over the sand to uncover the find.';
    done.classList.add('hidden');
    holdPause(sim, modal);
    modal.classList.remove('hidden');
  };

  const close = () => {
    modal.classList.add('hidden');
    current = null;
    last = null;
    releasePause(sim, modal);
  };

  const reveal = () => {
    if (!current || finished) return;
    finished = true;
    const sp = SPECIES[current.species];
    sandCanvas.style.opacity = '0'; // the last of the sand blows away
    bar.style.width = '100%';
    sparkles.classList.add('go');
    caption.textContent = current.unlocked
      ? `It's a ${sp.name} ${current.bone}, the last piece! ${sp.name} unlocked!`
      : `It's a ${sp.name} ${current.bone}! (${current.have} of ${current.needed} found)`;
    done.classList.remove('hidden');
    playSfx(current.unlocked ? 'fanfare' : 'chime');
    award('moment:fossil');
  };

  /** Brushes sand away along the finger's path, with a ragged (dithered) edge. */
  const brushAt = (x: number, y: number) => {
    for (let dy = -BRUSH; dy <= BRUSH; dy++)
      for (let dx = -BRUSH; dx <= BRUSH; dx++) {
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const d = Math.hypot(dx, dy);
        if (d > BRUSH || (d > BRUSH - 1.5 && hash2(px, py, cleared.size & 7) < 0.5)) continue;
        const i = py * W + px;
        if (cleared.has(i)) continue;
        cleared.add(i);
        sand.clearRect(px, py, 1, 1);
      }
  };

  const toGrid = (e: PointerEvent) => {
    const r = sandCanvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const stroke = (e: PointerEvent) => {
    if (!current || finished) return;
    const p = toGrid(e);
    const from = last ?? p;
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y)));
    for (let i = 1; i <= steps; i++) brushAt(from.x + ((p.x - from.x) * i) / steps, from.y + ((p.y - from.y) * i) / steps);
    last = p;
    playSfx('brush');
    let uncovered = 0;
    for (const i of cleared) if (fossil[i]) uncovered++;
    const share = uncovered / total;
    bar.style.width = `${Math.min(100, Math.round((share / REVEAL) * 100))}%`;
    if (share >= REVEAL) reveal();
  };

  sandCanvas.addEventListener('pointerdown', (e) => {
    sandCanvas.setPointerCapture(e.pointerId);
    last = null;
    stroke(e);
  });
  sandCanvas.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') stroke(e);
  });
  sandCanvas.addEventListener('pointerup', () => (last = null));
  sandCanvas.addEventListener('pointercancel', () => (last = null));

  button.addEventListener('click', open);
  done.addEventListener('click', () => {
    close();
    if (queue.length) open(); // straight on to the next find
  });
  modal.querySelector('.dig-skip')!.addEventListener('click', close);
}
