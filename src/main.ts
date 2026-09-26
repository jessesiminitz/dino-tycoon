import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { newGame } from './sim/GameState';
import { Simulation } from './sim/Simulation';
import { ParkScene } from './render/ParkScene';
import { loadGame, saveGame } from './save/storage';
import { mountHud } from './ui/hud';
import { UiState } from './ui/uiState';

const state = loadGame() ?? newGame((Math.random() * 2 ** 32) >>> 0);
const sim = new Simulation(state);
const ui = new UiState();
const hud = mountHud(sim, ui);

// iOS may kill a backgrounded web app without warning, so save whenever we lose focus.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(sim.state);
});
window.addEventListener('pagehide', () => saveGame(sim.state));
setInterval(() => saveGame(sim.state), 30_000);

// Offline support + updates. A home-screen app can stay open for days, so also
// check for a new version whenever it comes back to the foreground.
const UPDATE_CHECK_MS = 30 * 60 * 1000;
const UPDATE_RELOAD_FALLBACK_MS = 1500;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    hud.offerUpdate(() => {
      saveGame(sim.state);
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

// Dev-only handle for debugging and automated browser checks; stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __dino: { game, sim, ui } });
