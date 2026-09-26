import { calendar, migrate, type GameState } from '../sim/GameState';
import type { ScenarioId } from '../sim/data/scenarios';

/**
 * Three park slots. IndexedDB is the main store; every save also writes a
 * synchronous localStorage mirror, because iOS can kill a backgrounded web
 * app before an async IndexedDB write finishes. Loading takes whichever copy
 * is newer.
 */
export type SlotId = 1 | 2 | 3;
export const SLOT_IDS: SlotId[] = [1, 2, 3];

export interface SaveSummary {
  scenario: ScenarioId;
  status: GameState['scenario']['status'];
  day: number;
  money: number;
  dinos: number;
  reputation: number;
}

export interface SaveRecord {
  slot: SlotId;
  savedAt: number;
  summary: SaveSummary;
  state: GameState;
}

const DB_NAME = 'dino-tycoon';
const STORE = 'saves';
const MIRROR_KEY = (slot: SlotId) => `dino-tycoon:slot:${slot}`;
const LAST_SLOT_KEY = 'dino-tycoon:last-slot';
const BOOT_KEY = 'dino-tycoon:boot';
/** Pre-slots single autosave (Milestones 1–6). */
const LEGACY_KEY = 'dino-tycoon:autosave';

export function summarize(state: GameState): SaveSummary {
  return {
    scenario: state.scenario.id,
    status: state.scenario.status,
    day: calendar(state).day,
    money: Math.round(state.money),
    dinos: state.dinos.length,
    reputation: Math.round(state.reputation),
  };
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // IndexedDB unavailable: the localStorage mirror still works
    }
  });
  return dbPromise;
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = run(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

function readMirror(slot: SlotId): SaveRecord | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY(slot));
    return raw ? (JSON.parse(raw) as SaveRecord) : null;
  } catch {
    return null;
  }
}

/** Upgrades an old save record's state; null if it can't be read. */
function revive(rec: SaveRecord | null): SaveRecord | null {
  if (!rec?.state) return null;
  const state = migrate(rec.state as unknown as Record<string, unknown>);
  return state ? { ...rec, state } : null;
}

function newer(a: SaveRecord | null, b: SaveRecord | null): SaveRecord | null {
  if (!a) return b;
  if (!b) return a;
  return a.savedAt >= b.savedAt ? a : b;
}

/** Saves a park. The mirror write is synchronous, so it's safe to call when the page is hiding. */
export function saveSlot(slot: SlotId, state: GameState): void {
  const rec: SaveRecord = { slot, savedAt: Date.now(), summary: summarize(state), state };
  try {
    localStorage.setItem(MIRROR_KEY(slot), JSON.stringify(rec));
    localStorage.setItem(LAST_SLOT_KEY, String(slot));
  } catch {
    // Storage full or blocked: IndexedDB below may still work.
  }
  // Structured clone keeps IndexedDB's copy independent of the live state.
  void idb('readwrite', (s) => s.put(structuredClone(rec)));
}

export async function loadSlot(slot: SlotId): Promise<SaveRecord | null> {
  const fromDb = await idb<SaveRecord>('readonly', (s) => s.get(slot));
  return revive(newer(fromDb, readMirror(slot)));
}

/** Every slot, filled or not, with the newest copy of each save. */
export async function listSlots(): Promise<Record<SlotId, SaveRecord | null>> {
  await migrateLegacy();
  const out = {} as Record<SlotId, SaveRecord | null>;
  for (const slot of SLOT_IDS) out[slot] = await loadSlot(slot);
  return out;
}

export async function deleteSlot(slot: SlotId): Promise<void> {
  try {
    localStorage.removeItem(MIRROR_KEY(slot));
  } catch {
    // ignore
  }
  await idb('readwrite', (s) => s.delete(slot));
}

export function lastSlot(): SlotId | null {
  try {
    const n = Number(localStorage.getItem(LAST_SLOT_KEY));
    return SLOT_IDS.includes(n as SlotId) ? (n as SlotId) : null;
  } catch {
    return null;
  }
}

/** Moves a pre-slots autosave into slot 1 (once). */
async function migrateLegacy(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  const state = (() => {
    try {
      return migrate(JSON.parse(raw));
    } catch {
      return null;
    }
  })();
  if (state && !(await loadSlot(1))) saveSlot(1, state);
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

// --- Export / import ---

export function exportFileName(rec: SaveRecord): string {
  return `dino-tycoon-${rec.summary.scenario}-day${rec.summary.day}.json`;
}

/** Parses an exported save file into a playable state, or explains why not. */
export function parseImport(text: string): { state: GameState } | { error: string } {
  try {
    const data = JSON.parse(text) as Partial<SaveRecord> & Record<string, unknown>;
    // Accept either a full record or a bare state.
    const rawState = (data.state ?? data) as Record<string, unknown>;
    const state = migrate(rawState);
    return state ? { state } : { error: 'That file is from a version of the game this one can’t read.' };
  } catch {
    return { error: 'That isn’t a Dino Tycoon save file.' };
  }
}

// --- Boot directive: switching parks reloads the page into the chosen one ---

export type BootDirective = { kind: 'load'; slot: SlotId };

export function setBootDirective(d: BootDirective | null): void {
  try {
    if (d) sessionStorage.setItem(BOOT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(BOOT_KEY);
  } catch {
    // ignore
  }
}

export function takeBootDirective(): BootDirective | null {
  try {
    const raw = sessionStorage.getItem(BOOT_KEY);
    sessionStorage.removeItem(BOOT_KEY);
    return raw ? (JSON.parse(raw) as BootDirective) : null;
  } catch {
    return null;
  }
}
