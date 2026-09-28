import type { Simulation } from '../sim/Simulation';
import { earnedStickers, STICKER_GROUPS, STICKERS, type Sticker } from '../sim/stickers';
import { SPECIES } from '../sim/data/species';
import { paintDino } from '../render/dinoArt';
import { playSfx } from '../audio/audio';

/**
 * The sticker album lives on this device, outside any park save, so every
 * park adds to the same collection. Stickers are never taken away.
 */
const KEY = 'dino-tycoon:stickers';

interface Album {
  version: 1;
  /** Sticker id → when it was earned (ISO date). */
  earned: Record<string, string>;
  /** Earned but not looked at in the book yet. */
  fresh: string[];
}

function load(): Album {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Album | null;
    if (raw?.version === 1) return raw;
  } catch {
    // Start a fresh album.
  }
  return { version: 1, earned: {}, fresh: [] };
}

let album = load();
const listeners = new Set<() => void>();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(album));
  } catch {
    // Keeps working for this session.
  }
  for (const fn of listeners) fn();
}

/** Adds a sticker to the album; returns true if it's new. */
export function award(id: string): boolean {
  if (album.earned[id] || !STICKERS.some((s) => s.id === id)) return false;
  album.earned[id] = new Date().toISOString();
  album.fresh.push(id);
  save();
  return true;
}

export function albumCount(): { have: number; total: number } {
  return { have: STICKERS.filter((s) => album.earned[s.id]).length, total: STICKERS.length };
}

/** Sticker picture: the animal (or baby) for creature stickers, an emoji for the rest. */
const artCache = new Map<string, string>();
function art(s: Sticker): string {
  if (!s.species) return `<span class="sticker-emoji">${s.icon}</span>`;
  const key = s.id;
  if (!artCache.has(key)) artCache.set(key, paintDino(SPECIES[s.species], 0, s.group === 'babies').toDataURL());
  return `<img class="sticker-img" alt="" src="${artCache.get(key)}">`;
}

/** 📒 The sticker book, and awarding stickers as the park earns them. */
export function mountStickers(sim: Simulation, toast: (text: string) => void): void {
  const modal = document.getElementById('stickers')!;
  const body = modal.querySelector<HTMLElement>('.stickers-body')!;
  const title = modal.querySelector<HTMLElement>('.stickers-count')!;
  const badge = document.getElementById('stickers-badge')!;

  const refreshBadge = () => {
    badge.textContent = String(album.fresh.length);
    badge.classList.toggle('hidden', album.fresh.length === 0);
  };

  const check = () => {
    for (const id of earnedStickers(sim.state)) {
      if (!award(id)) continue;
      const s = STICKERS.find((x) => x.id === id)!;
      toast(`📒 New sticker: ${s.name}${/[!?.]$/.test(s.name) ? '' : '!'}`);
      playSfx('chime');
    }
  };

  const render = () => {
    const { have, total } = albumCount();
    title.textContent = `${have} / ${total}`;
    body.innerHTML = STICKER_GROUPS.map((g) => {
      const items = STICKERS.filter((s) => s.group === g.id);
      const got = items.filter((s) => album.earned[s.id]).length;
      const cards = items
        .map((s) => {
          const earned = !!album.earned[s.id];
          const fresh = album.fresh.includes(s.id);
          return `<figure class="sticker ${earned ? 'earned' : 'locked'} ${g.id}" title="${earned ? s.name : s.hint}">
            ${fresh ? '<span class="sticker-new">NEW!</span>' : ''}
            <div class="sticker-art">${art(s)}</div>
            <figcaption>${earned ? s.name : '?'}</figcaption>
            ${earned ? '' : `<small>${s.hint}</small>`}
          </figure>`;
        })
        .join('');
      return `<section class="sticker-page"><h3>${g.name} <small>${got} / ${items.length}</small></h3><div class="sticker-grid ${g.id}">${cards}</div></section>`;
    }).join('');
  };

  document.getElementById('btn-stickers')!.addEventListener('click', () => {
    render();
    modal.classList.remove('hidden');
    // Looked at: the NEW! shine stays for this visit to the book, then goes.
    album.fresh = [];
    save();
  });
  const close = () => modal.classList.add('hidden');
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  listeners.add(refreshBadge);
  refreshBadge();
  // Check now and then (cheap), and straight after things that often earn one.
  check();
  window.setInterval(check, 2000);
  sim.onEvent(() => check());
}
