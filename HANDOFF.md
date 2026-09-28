# Dino Tycoon: handoff notes

Everything a fresh session needs to carry on. Last updated 2026-09-27, at commit `ba96d88` plus this file.

## What this is

A touch-first spiritual successor to *DinoPark Tycoon* (1993) for iPhone (and iPad), built as an installable web game (PWA).

- **Live:** https://jessesiminitz.github.io/dino-tycoon/ (GitHub Pages)
- **Repo:** https://github.com/jessesiminitz/dino-tycoon (public), local at `~/Projects/dino-tycoon`
- **Owner:** Jesse plays on an iPhone (Home Screen app); his daughter plays on an iPad. Keep it kid-friendly.
- **Stack:** TypeScript + Vite 6 + Phaser 3.90 + vite-plugin-pwa (prompt mode, "Update" banner) + Vitest. No art or audio files: pixel art is painted in code, sound is synthesised with Web Audio.
- **Machine:** Late-2015 iMac, macOS 12, no Xcode. Node 22 via nvm (`export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH`).

## Day-to-day

```sh
npm run dev            # dev server (usually already running on :5173); /?quickstart skips the menu
npm test               # all sim tests, then the perf benchmark separately (129 + 1 tests)
npm run build          # tsc --noEmit + vite build
npm run icons          # regenerate Home Screen icons (dev server must be running)
node scripts/checks/<name>.mjs   # browser checks (headless Chrome via puppeteer-core); see below
```

**Deploy:** push to `main` and GitHub Actions tests, builds and deploys to Pages in about 45 s. Plain `git push` has no credential helper here, so push with:

```sh
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q origin main
gh run list -R jessesiminitz/dino-tycoon --limit 1      # then gh run watch <id>
```

End commit messages with the Co-Authored-By / Claude-Session trailers the harness supplies. Commit and deploy after each round of changes: the owner tests on the live site.

**Dev hooks** (dev builds only): `window.__dino = { game, sim, ui, slot, audioDebug, playSfx }`; `/?quickstart` starts a fresh park.

## Architecture (see README for the overview)

- `src/sim/`: pure TS game rules, no Phaser. One serializable `GameState` (`GameState.ts`), a fixed-timestep `Simulation` (`Simulation.ts`), and commands via `sim.dispatch(cmd)` → `commands.ts` `applyCommand`. Seeded RNG (`rng.ts`; `hash2` gives stateless variation).
  - **Time:** `MS_PER_HOUR = 12_500` (a game day is 5 real minutes at 1×). `STEPS_PER_HOUR = 16` (in `systems/dinos.ts`). Speeds are `0 | 1 | 3 | 8`. Per-step odds that were tuned at 4 steps/hour go through `perStep()`; staff `WORK_STEPS` are in 16ths of an hour.
  - Step systems: dinos, escapes, visitors, staff. Hourly: dinos (hunger, happiness, **droppings**), health, fences, events, visitors (needs, thoughts, accidents, litter warnings), fossils, economy, scenario.
  - Regions come from a flood fill over fences (`regions.ts`: public, paddock or wild). `gaps.ts` finds missing or broken fence segments around a tapped tile.
  - `concerns.ts`: live dino and staff concerns, plus `whatVisitorsSay` (complaints with advice).
  - `goals.ts`: three rounds of milestones per scenario (Bronze, Silver, Gold) with rewards (species unlocks, or cash if already unlocked).
- `src/render/`: `ParkScene` (input, selection, gap-fix offer, camera focus), `EntityLayer` (dinos, visitors with carried items, staff, buildings, dirt), `WorldLayers` (fences, paths, ghost and gap markers), `SceneryLayer`, `TerrainFx`, `WeatherScene`. `dinoArt.ts` builds each of the 12 species from shapes (per-species anatomy). `iconArt.ts` paints the Home Screen icon.
- `src/ui/`: DOM overlays. `hud.ts` (top bar with a live **fit pass** so ☰ is never pushed off-screen; the info panel is placed by measuring the toolbar), `people.ts` (👥 Visitors, Reviews, Dinos and Staff with filters, rename and 📍 locate), `log.ts` (🔔 alert log), `parkPanel.ts` (Goals medal track, overview, staff, finances, bank), `overlays.ts` (pause, milestone and outcome popups, update banner), `menu.ts` (title, scenarios, save slots with ⤓ export and import), `tutorial.ts`, `guide.ts`, `catalog.ts`, `settings.ts`.
- `src/audio/`: `audio.ts` (sfx, rain, piano synth, shuffled playlist), `ragNotes.ts` (decoder and alphabet), `rags.ts` (generated, lazy-loaded chunk).
- `src/save/storage.ts`: 3 IndexedDB slots plus a localStorage mirror, and a boot directive (used to return to the park after an update reload).

### Save format: **v15**

Always bump `SAVE_VERSION` and add a step to `migrate()` when the state shape changes, then update the version assertions in the tests (`tests/{dinos,island,visitorlife,mess}.test.ts` check `toBe(15)`). Recent steps:
- v10 added the log.
- v11 added visitor names, thoughts and thirst, soda and snack fields, plus `messes` and `reviews`.
- v12 added scenario `round`, `roundStart` and `earned`. Saves that had already won carry on into Silver.
- v13 added `Dino.baby`, `eggs` and `stats.hatched`.
- v14 added `Dino.lastTreatHour`, `Dino.lastPatHour` and `stats.photos`, plus the `treats` expense category.
- v15 added `requests` and `stats.requestsDone`.

## Features in place (all deployed)

- **Core:** land parcels, drag-to-build fences (4 types, wear, repair), paddocks, 12 species (6 starters, the rest from fossil digs on visible fossil beds), feeders, hunger and hunting, escapes and guards, disease and vets, storms, volcano rumbles, inspections, school trips, loans and ledger, monthly reports.
- **Island:** procedural terrain with mountains, a volcano, ponds, beaches and trees, plus gardens (decor) that visitors enjoy.
- **Visitors:**
  - Needs: hunger, thirst, restroom.
  - Shopping: snack stall (popcorn, hot dog, ice cream, soda), restaurant, souvenir shop (plush, cap, balloon, poncho, umbrella). Items are visible in hand.
  - Kids, mascot, tour guides.
  - Park-specific thoughts; star reviews when they leave.
- **Mess:** visitor accidents (yellow pee puddle or small poop, picked by `accidentKind(id)`), litter without trash cans, janitors, trash cans, and a "filthy paths" inspection issue. Cleanliness was deliberately **toned down** at the owner's request, so keep it mild.
- **Dino droppings:** about 1 per dino every 1–2 days. They crumble after 72 h, workers shovel them when free, and they only upset dinos when piled past 2 per animal.
- **Baby dinosaurs** (`systems/breeding.ts`):
  - Happy, fed pairs of the same species in an uncrowded paddock lay eggs: about 1 in 48 per pair per hour, one egg per paddock at a time.
  - The park caps eggs plus babies at a quarter of the adults (minimum 4).
  - Eggs wobble before hatching at 48 h, and babies grow up in 7 days.
  - Babies eat half meals, don't push fences, can't be sold, count as smaller prey, add appeal, and get an "Aww!" from visitors.
  - Sprites are shrunk from each species' own art; eggs are speckled.
  - 👥 Dinos has a 🍼 Babies & eggs filter.
- **Tap a dino** (`systems/care.ts`, `ui/photo.ts`): the info bar shows 🍖 ✋ 📷 (plus Sell for grown-ups).
  - 🍖 Treat costs $25 and gives +10 happiness for 6 game-hours, once per hour.
  - ✋ Pat is free: +4 for 3 hours. Hungry grown-up carnivores snap "Nope!" instead.
  - Effects are hearts plus a happy hop, or a red "Nope!" sign, with chirp, snap and shutter sounds.
  - 📷 snapshots the canvas around the dino (without the selection ring), frames it as a polaroid with a caption, and offers `navigator.share` (Save Image on iOS), a download, or press-and-hold saving.
  - `hud.showInfo` accepts an array of actions (small icon buttons plus one main button).
- **Park requests** (`systems/requests.ts`, `ui/requests.ts`, the 📋 button with a badge):
  - Up to 3 at a time, arriving at 08:00, 12:00 and 16:00, each a different kind and only ever what the park can manage.
  - Kinds: see a species from a path, places to eat, visitors today (+25% stretch), a 4- or 5-star review, a photo (baby or species), N treats, the mayor (spotless paths when they arrive), the vet (feeders half full when they arrive).
  - They pay cash, and reputation only for active ones. Missed ones expire quietly.
  - Completion is checked hourly and after every successful command.
  - Requests use their own RNG (seeded from the seed and hour), so the rest of the sim is unaffected.
- **Placing dinos:** a fence gap is circled in red with a "Close gap · $x" button that fences or repairs it and releases the dino.
- **Panels:** 👥 People, 🔔 alert log (newest first, filters, unread badge), 🏆 Goals medal track, 📖 Dino Guide.
- **Scenarios:** First Steps (tutorial), Fossil Fever, Storm Coast, Rex Rising, each with 3 rounds of milestones; plus Sandbox. You can keep playing after winning or losing.
- **Music:** 21 public-domain ragtime pieces (Joplin, Joplin & Hayden, Turpin, Hunter; 1899–1914), about 69 minutes, from Mutopia Project public-domain MIDI editions. They're converted by `scripts/rags/gen.mjs` (download instructions are in the file) and played on a honky-tonk piano synth, reshuffled every loop, with a "🎹 Now playing" toast. **Only use pre-1929, public-domain compositions in public-domain editions.**
- **Home Screen icon:** a green Brachiosaurus on a sunset island (from `iconArt.ts`), plus a maskable variant.

## Owner preferences and feedback so far

- Pacing: a 5-minute game day at 1×, with 3× and 8× available.
- Keep the game kid-friendly. Mess and pee/poop jokes are wanted but mild; cleanliness should not dominate.
- Wants more depth: richer menus, milestones with unlock rewards, visible items, lively visitors.
- Art should evoke classic DinoPark Tycoon (VGA palette, beige bevel UI, 3/4 view), with good dino likeness.
- Recurring bug class: UI clashes on small or notched iPhones. Always check phone sizes (see `scripts/checks/hud-check.mjs`, `info-overlap.mjs`, `overflow-check.mjs`) after touching the HUD, toasts or panels.
- The rain volume was too loud before; it's now `RAIN_VOLUME = 0.045`.

## Browser checks (`scripts/checks/`)

Headless Chrome against the dev server (`http://localhost:5173`), using `puppeteer-core` (a dev dependency) and the installed Google Chrome. Screenshots land next to each script (git-ignored).

| Script | What it checks |
| --- | --- |
| `hud-check.mjs` | ☰ visible and nothing clipped on 7 iPhone sizes with notch insets |
| `info-overlap.mjs` | the info panel never covers the toolbar or pickers, and the text stays readable |
| `overflow-check.mjs` | the pause menu fits, and alerts don't clash with buttons |
| `people-check.mjs` | 👥 panel tabs, filters, rename and locate |
| `gap-check.mjs` | fence-gap detection and "Close gap" on dino placement |
| `milestone-check.mjs` | Bronze milestone popup and Goals tab |
| `ipad-check.mjs` | iPad layouts (portrait shows the "turn sideways" screen) |
| `dino-gallery.mjs` | all 12 species, both walk frames, at 4× |
| `icon-preview.mjs` | icon at full size, real size and maskable |
| `items-check.mjs` | carried items, pee and poop, litter, dung, janitor, trash can |
| `log-check.mjs`, `rag-check.mjs`, `repro-place.mjs` | alert log, music playback, place a dino and delete paths |

Scripts that step the sim by hand should use 16 steps per game-hour.

## Next up: `docs/ROADMAP.md`

The owner approved ten fun and engagement features, **to be built in order**: babies, tap-to-interact and photos, park requests, the fossil dig mini-game, lagoon and aviary, attractions, the sticker book, day and night, choice events, and more sound. Each has a design, sim, UI, test and check plan there. Work through the table from the top, one release per feature.

## Other ideas not done yet (ask before starting)

- Milestone M8 from the original plan: an App Store build (Capacitor plus a cloud macOS build). It needs an Apple Developer account.
- Scenario deadlines are counted in game days, so at 5-minute days they take long in real time (First Steps Bronze is 45 days, about 3¾ h at 1×). Offered to shorten them; no answer yet.
- iPad portrait play (currently shows a "turn sideways" screen; the top bar is too wide for a portrait iPad mini).
- Offered earlier: storms washing away litter; mess made purely cosmetic.
- Possible: a credits screen listing the music, and a day/night tint.
