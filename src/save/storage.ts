import { SAVE_VERSION, type GameState } from '../sim/GameState';

// Milestone 1 uses localStorage; Milestone 7 moves saves to IndexedDB slots.
const KEY = 'dino-tycoon:autosave';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing or storage full: the game keeps running, just unsaved.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Older saves predate land and fences; start a fresh park rather than migrate.
    return parsed.version === SAVE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}
