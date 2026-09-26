/** Per-device preferences (sound, music). Kept in localStorage; not part of any park save. */
export interface Settings {
  sfx: boolean;
  sfxVolume: number;
  music: boolean;
  musicVolume: number;
}

const KEY = 'dino-tycoon:settings';
const DEFAULTS: Settings = { sfx: true, sfxVolume: 0.7, music: true, musicVolume: 0.35 };

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();

let current: Settings = (() => {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
})();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Still applies for this session.
  }
  for (const fn of listeners) fn(current);
}

export function onSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Renders the settings controls into `root` (used by the title menu and the pause menu). */
export function renderSettings(root: HTMLElement): void {
  const s = getSettings();
  root.innerHTML = `
    <label class="setting">
      <input type="checkbox" data-key="sfx" ${s.sfx ? 'checked' : ''}> Sound effects
      <input type="range" min="0" max="1" step="0.05" value="${s.sfxVolume}" data-key="sfxVolume" aria-label="Sound effects volume">
    </label>
    <label class="setting">
      <input type="checkbox" data-key="music" ${s.music ? 'checked' : ''}> Music
      <input type="range" min="0" max="1" step="0.05" value="${s.musicVolume}" data-key="musicVolume" aria-label="Music volume">
    </label>`;
  root.oninput = (e) => {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.key as keyof Settings | undefined;
    if (!key) return;
    updateSettings({ [key]: el.type === 'checkbox' ? el.checked : Number(el.value) } as Partial<Settings>);
  };
}
