import { migrate, type GameState } from '../sim/GameState';

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
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}
