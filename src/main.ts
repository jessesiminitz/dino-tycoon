import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { newGame } from './sim/GameState';
import { Simulation } from './sim/Simulation';
import { ParkScene } from './render/ParkScene';
import { loadGame, saveGame } from './save/storage';
import { mountHud } from './ui/hud';
import { UiState } from './ui/uiState';

registerSW({ immediate: true });

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
