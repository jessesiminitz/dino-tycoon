# Dino Tycoon

A touch-first spiritual successor to *DinoPark Tycoon* (1993), built as an installable web game for iPhone.

**Play:** https://jessesiminitz.github.io/dino-tycoon/
On iPhone, open it in Safari, tap Share → **Add to Home Screen**, and launch it from the icon to play full-screen and offline. When a new version is published, the game offers an **Update** button.

## The game

Build paddocks, buy dinosaurs, feed them, lay paths and open the gates to visitors. Hire workers, guards, vets and tour guides; survive storms, outbreaks, escapes and safety inspections; dig up fossils to unlock rarer species; and read about every species in the Dino Guide.

Scenarios: **First Steps** (with a tutorial), **Fossil Fever**, **Storm Coast**, **Rex Rising**, and a **Sandbox**. Three save slots, with export/import.

## Development

Requires Node 22 (`nvm use`).

```sh
npm install
npm run dev      # dev server on your LAN; open the Network URL on your phone
npm test         # simulation tests, then the performance benchmark on its own
npm run build    # production build in dist/
npm run bench    # just the stress benchmark, with timings
```

In development, `/?quickstart` skips the title screen and starts a fresh park, and `window.__dino` exposes the running game for debugging. Neither exists in production builds.

Pushing to `main` runs the tests, builds and deploys to GitHub Pages.

## How it's built

- **TypeScript + Vite + Phaser 3.** No art or audio files: pixel art is painted in code and sound is synthesised with Web Audio.
- `src/sim/`: the game rules, as pure TypeScript with no Phaser. One serializable `GameState`; a fixed-timestep `Simulation` (16 steps per game-hour; a game day is 5 real minutes at 1×) runs systems in `src/sim/systems/`; player actions go through `Simulation.dispatch(command)`. Seeded randomness makes runs reproducible.
- `src/render/`: Phaser scenes that draw the state (terrain, fences, sprites, weather) and turn touches into commands.
- `src/ui/`: DOM overlays: HUD, toolbar, panels, title screen, tutorial.
- `src/save/`: save slots in IndexedDB with a synchronous localStorage mirror, and versioned migrations so old saves keep loading.
- `tests/`: Vitest tests for the simulation, including a worst-case performance benchmark.
