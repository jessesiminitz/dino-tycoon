import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import type { IslandShape } from './sim/island';
import { newGame, type GameState } from './sim/GameState';
import { Simulation } from './sim/Simulation';
import { ParkScene } from './render/ParkScene';
import { WeatherScene } from './render/WeatherScene';
import { loadSlot, saveSlot, setBootDirective, takeBootDirective, type SlotId } from './save/storage';
import { mountHud } from './ui/hud';
import { showMenu } from './ui/menu';
import { mountPauseMenu, offerUpdate, showOutcome } from './ui/overlays';
import { UiState } from './ui/uiState';
import { mountTutorial } from './ui/tutorial';
import { mountBriefing } from './ui/briefing';
import { recordMedals } from './ui/challengeRecords';
import { audioDebug, initAudio, onSong, playSfx, type Sfx } from './audio/audio';
import { getSettings } from './ui/settings';

/** Saves the running park, if there is one. Set when a park starts. */
let saveCurrent: () => void = () => {};
let currentSlot: SlotId | null = null;

/** Back to the title screen: save, then reload so the next park starts clean. */
function toMainMenu(): void {
  saveCurrent();
  setBootDirective(null);
  window.location.reload();
}

function startGame(state: GameState, slot: SlotId): void {
  const sim = new Simulation(state);
  const ui = new UiState();
  const hud = mountHud(sim, ui);
  saveCurrent = () => saveSlot(slot, sim.state);
  currentSlot = slot;
  saveCurrent(); // claim the slot straight away

  // iOS may kill a backgrounded web app without warning, so save whenever we lose focus.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrent();
  });
  window.addEventListener('pagehide', () => saveCurrent());
  setInterval(() => saveCurrent(), 30_000);

  mountPauseMenu(sim, { save: saveCurrent, mainMenu: toMainMenu, toast: (t) => hud.toast(t) });
  mountTutorial(sim, (t) => hud.toast(t));
  onSong((title, composer, year) => {
    if (getSettings().music) hud.toast(`🎹 Now playing: ${title} (${composer}, ${year})`);
  });
  sim.onEvent((e) => {
    const sound = eventSound(e.text, e.kind, e.outcome);
    if (sound) playSfx(sound);
    // The crowd cheers for new babies, medals and birthdays.
    if (/^(🐣|🎂 Happy birthday)/.test(e.text) || e.outcome === 'milestone' || e.outcome === 'won') playSfx('cheer');
    if (e.outcome) showOutcome(sim, e.outcome, toMainMenu, e.text);
    // Challenge medals are remembered on this device (they unlock the next challenge).
    if (e.outcome === 'milestone' || e.outcome === 'won') recordMedals(sim.state.scenario.id, sim.state.scenario.round);
  });
  mountBriefing(sim);
  document.body.classList.add('in-park');

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1b3a4b',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: { activePointers: 2 },
    banner: false,
  });
  game.scene.add('park', ParkScene, true, { sim, ui, hud });
  game.scene.add('weather', WeatherScene, true, { sim });

  // Dev-only handle for debugging and automated browser checks; stripped from production builds.
  if (import.meta.env.DEV) Object.assign(window, { __dino: { game, sim, ui, slot, audioDebug, playSfx } });
}

// Offline support + updates. A home-screen app can stay open for days, so also
// check for a new version whenever it comes back to the foreground.
const UPDATE_CHECK_MS = 30 * 60 * 1000;
const UPDATE_RELOAD_FALLBACK_MS = 1500;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    offerUpdate(() => {
      saveCurrent();
      // Come straight back to this park after the reload.
      if (currentSlot) setBootDirective({ kind: 'load', slot: currentSlot });
      void updateSW(true);
      // updateSW reloads once the new worker takes control; that signal never
      // comes if this page wasn't controlled yet (first visit), so reload anyway.
      window.setTimeout(() => window.location.reload(), UPDATE_RELOAD_FALLBACK_MS);
    });
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => void registration.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});

/** Which sound (if any) a park event makes. */
function eventSound(text: string, kind: string, outcome?: 'won' | 'lost' | 'milestone'): Sfx | null {
  if (outcome) return outcome === 'lost' ? 'sad' : 'fanfare';
  if (/caught .* fossil skeleton/.test(text)) return 'sad';
  if (/^(🦴|🥚|🐣|📋 A new|📋 [0-9])/.test(text)) return 'chime';
  if (/^✅/.test(text)) return 'cash';
  if (/^(⛈️ A storm|🌋)/.test(text)) return 'thunder';
  if (/^(🚨|🚑|🦠|📋 Failed)|smashed through|knocked down|rotted/.test(text)) return 'alert';
  if (/^(📋 Safety inspection passed|🚌)/.test(text)) return 'cash';
  return kind === 'bad' && /died|starved/.test(text) ? 'sad' : null;
}

initAudio();
// Every button gives a little click.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) playSfx('click');
});

async function boot(): Promise<void> {
  // Dev-only: /?quickstart jumps straight into a fresh park (used by automated browser checks).
  // Optional: &shape=river&seed=123&big to pick the island.
  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV && params.has('quickstart')) {
    const seed = params.has('seed') ? Number(params.get('seed')) : (Math.random() * 2 ** 32) >>> 0;
    return startGame(newGame(seed, { shape: (params.get('shape') ?? 'classic') as IslandShape, big: params.has('big') }), 3);
  }
  const directive = takeBootDirective();
  if (directive?.kind === 'load') {
    const rec = await loadSlot(directive.slot);
    if (rec) return startGame(rec.state, rec.slot);
  }
  showMenu({ start: startGame });
}

void boot();
