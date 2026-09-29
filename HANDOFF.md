# Dino Tycoon: handoff notes

Everything a fresh session needs to carry on. Last updated 2026-09-28 (islands update) plus this file.

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
  - **Time:** `MS_PER_HOUR = 10_000` (a game day is 4 real minutes at 1×). `STEPS_PER_HOUR = 16` (in `systems/dinos.ts`). Speeds are `0 | 1 | 3 | 8`. Per-step odds that were tuned at 4 steps/hour go through `perStep()`; staff `WORK_STEPS` are in 16ths of an hour.
  - Step systems: dinos, escapes, visitors, staff. Hourly: dinos (hunger, happiness, **droppings**), health, fences, events, visitors (needs, thoughts, accidents, litter warnings), fossils, economy, scenario.
  - Regions come from a flood fill over fences (`regions.ts`: public, paddock or wild). `gaps.ts` finds missing or broken fence segments around a tapped tile.
  - `concerns.ts`: live dino and staff concerns, plus `whatVisitorsSay` (complaints with advice).
  - `goals.ts`: three rounds of milestones per scenario (Bronze, Silver, Gold) with rewards (species unlocks, or cash if already unlocked).
- `src/render/`: `ParkScene` (input, selection, gap-fix offer, camera focus), `EntityLayer` (dinos, visitors with carried items, staff, buildings, dirt), `WorldLayers` (fences, paths, ghost and gap markers), `SceneryLayer`, `TerrainFx`, `WeatherScene`. `dinoArt.ts` builds each of the 12 species from shapes (per-species anatomy). `iconArt.ts` paints the Home Screen icon.
- `src/ui/`: DOM overlays. `hud.ts` (top bar with a live **fit pass** so ☰ is never pushed off-screen; the info panel is placed by measuring the toolbar), `people.ts` (👥 Visitors, Reviews, Dinos and Staff with filters, rename and 📍 locate), `log.ts` (🔔 alert log), `parkPanel.ts` (Goals medal track, overview, staff, finances, bank), `overlays.ts` (pause, milestone and outcome popups, update banner), `menu.ts` (title, scenarios, save slots with ⤓ export and import), `tutorial.ts`, `guide.ts`, `catalog.ts`, `settings.ts`.
- `src/audio/`: `audio.ts` (sfx, rain, piano synth, shuffled playlist), `ragNotes.ts` (decoder and alphabet), `rags.ts` (generated, lazy-loaded chunk).
- `src/save/storage.ts`: 3 IndexedDB slots plus a localStorage mirror, and a boot directive (used to return to the park after an update reload).

### Save format: **v17**

Always bump `SAVE_VERSION` and add a step to `migrate()` when the state shape changes, then update the version assertions in the tests (`tests/{dinos,island,visitorlife,mess}.test.ts` check `toBe(17)`). Recent steps:
- v10 added the log.
- v11 added visitor names, thoughts and thirst, soda and snack fields, plus `messes` and `reviews`.
- v12 added scenario `round`, `roundStart` and `earned`. Saves that had already won carry on into Silver.
- v13 added `Dino.baby`, `eggs` and `stats.hatched`.
- v14 added `Dino.lastTreatHour`, `Dino.lastPatHour` and `stats.photos`, plus the `treats` expense category.
- v15 added `requests` and `stats.requestsDone`.
- v16 added `tracks`, `jeeps`, and `Visitor.rode` and `Visitor.riding`, plus the `rides` income category.
- v17 added `pendingChoice` and `stats.closedDay`.

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
- **Fossil dig mini-game** (`ui/dig.ts`):
  - Dig-site find events carry `fossil: { species, bone, have, needed, unlocked }`. They're credited at once as before; the mini-game is presentation only.
  - Finds queue behind a pulsing "🦴 Dig!" button (top right).
  - The pit is a 128×96 pixel canvas: the species' shape rendered as bone in dirt, under dithered sand. A finger brush clears the sand, and 70% uncovered triggers the reveal with sparkles and a caption.
  - The game pauses while digging, and there's a Skip button. The Settings switch "Fossil dig mini-game" (`digGame`) turns it off.
- **Lagoons and aviaries** (roadmap #6; no save change):
  - 16 species. Four have `habitat`: Plesiosaurus and Mosasaurus live in water; Pteranodon and Dimorphodon fly. All four eat fish (diet `piscivore`).
  - **Lagoon:** a Pond whose whole shore is one paddock joins that paddock's region (`regions.ts`). Garden → Pond digs grass or sand ($250 a tile, drag to dig). Remove fills ponds in.
  - **Aviary:** a paddock fenced all round with fence type 5, "Aviary net" (steel strength), with no open water at its edge: `Region.covered`.
  - Fence strength comparisons use `strongEnough()`, since ids no longer equal strength.
  - Fish feeders can float on pond water.
  - Movement per habitat uses `enterFor(d)`. Swimmers make no dung and have live young (no egg wait). A flyer escapes if its net is breached.
  - Rendering: swimmers are cropped at the waterline with ripples; flyers hover 14 px up, always flapping, with a ground shadow.
- **Attractions** (`systems/rides.ts`):
  - **Jeep track:** Path screen → Jeep track / Remove track ($15 a tile). It can't go on paths or inside occupied paddocks, and fences block it.
  - **Safari station** (next to a path, with track beside it): its jeep waits for up to 4 riders, or leaves after 6 steps with anyone aboard. It tours 32 steps, and riders see every dino within 5 tiles (×1.3 thrill). It then returns and drops riders where they boarded ($8).
  - **Viewing tower** ($3): reveals dinos within 8 tiles.
  - **Petting pen** ($4): +12 for kids, +5 for adults; needs a worker as keeper.
  - Each attraction is used once per visit. Riding visitors are skipped by the visitor system and hidden on the paths.
- **Sticker book** (`sim/stickers.ts` for the rules, `ui/stickers.ts` for the album; 📒 button with a NEW count):
  - 58 stickers: 16 species, 16 babies, a trophy room of 12 scenario medals, and 14 park moments.
  - The album lives in localStorage (`dino-tycoon:stickers`), per device and shared across saves. It isn't part of save exports.
  - `earnedStickers(state)` is checked every 2 s and after each event. Only the dig mini-game awards the hand-dug fossil sticker.
- **Day and night** (`render/daylight.ts`, night layer in `WeatherScene`):
  - Dusk from 17:00, full dark 20:30–05:00, dawn until 07:00, with a warm tint at sunset and sunrise.
  - The darkness is a RenderTexture with soft light stamps erased around path lamps (new decor `lamp`), lit buildings, the gate and jeeps. It's redrawn only when the view, the darkness or the lights change.
  - Setting: `nightDarkness`, where 0 turns it off.
  - `isAsleep` (21:00–05:00): animals stay put and show "Zz", unless they're nocturnal (Velociraptor, Compsognathus), escaped, or hungry. Sleeping flyers settle on the ground.
- **Decisions** (`systems/choices.ts`, `ui/choice.ts`):
  - About once a day while the park is open, one of 8 two-option events comes up: TV crew, birthday naming, scientist, storm warning, fossil collector, famous presenter, school fundraiser, lost child.
  - Each event's `setup` returns null when it doesn't fit the park.
  - The card pauses the game; "Decide later" leaves a ❓ button; after 4 game-hours the last (cautious) option is taken automatically. That option gives no reward for doing nothing.
  - Answers go through the `chooseOption` command, and results are written to the log.
  - Decisions use their own dice. Closing early sets `stats.closedDay`, which stops arrivals for the day.
- **Sound** (`audio/calls.ts` and `audio.ts`):
  - A synthesised call for each species (roar, honk, bellow, chirp, screech, song), played on tap or release. Babies are higher and softer.
  - A crowd `cheer` for hatchings, milestones and birthdays. `splash` and `flap` play every few seconds from visible lagoon and aviary animals.
  - Ambience (`setAmbience`, driven by `WeatherScene`): birdsong by day, crickets by night, quiet at dusk and in storms. Setting: "Birds & crickets" (`ambience`).
- **Orientation:** phones play sideways only (a rotate screen shows under 700 px wide). iPads play either way up. The manifest orientation is `any`, and the camera starts further inland when the screen is taller than it is wide. Check with `scripts/checks/ipad-portrait.mjs`.
- **Building shapes:** every building is shaped like what it offers (all in `sceneryArt.ts`; preview with `scripts/checks/shaped-buildings.mjs`): fries carton (restaurant), popcorn bucket (snack stall), shopping basket (souvenir shop), porta-potties (restrooms), hungry dino-head bin (trash can), giant jeep (safari station), giant binoculars on a stand (viewing tower), hatching egg (petting pen), giant fossil bone in a sand heap (dig site). There are no picture signs any more.
- **Placing dinos:** a fence gap is circled in red with a "Close gap · $x" button that fences or repairs it and releases the dino.
- **Panels:** 📊 Park (Goals medal track, Overview, Staff, Finances, Bank), 👥 People, 📋 Requests, 📖 Book (Dino Guide + Stickers tabs), 🔔 News (alert log: newest first, filters, unread badge). See "UI layout" below.
- **Scenarios:** First Steps (tutorial), Fossil Fever, Storm Coast, Rex Rising, each with 3 rounds of milestones; plus Sandbox. You can keep playing after winning or losing.
- **Music:** 21 public-domain ragtime pieces (Joplin, Joplin & Hayden, Turpin, Hunter; 1899–1914), about 69 minutes, from Mutopia Project public-domain MIDI editions. They're converted by `scripts/rags/gen.mjs` (download instructions are in the file) and played on a honky-tonk piano synth, reshuffled every loop, with a "🎹 Now playing" toast. **Only use pre-1929, public-domain compositions in public-domain editions.**
- **Home Screen icon:** a green Brachiosaurus on a sunset island (from `iconArt.ts`), plus a maskable variant.

## Owner preferences and feedback so far

- Pacing: a 4-minute game day at 1×, with 3× and 8× available.
- Keep the game kid-friendly. Mess and pee/poop jokes are wanted but mild; cleanliness should not dominate.
- Wants more depth: richer menus, milestones with unlock rewards, visible items, lively visitors.
- Art should evoke classic DinoPark Tycoon (VGA palette, bevelled UI, 3/4 view), with good dino likeness.
- UI theme is "Tropical lagoon" (chosen by the owner 2026-09-28): sea-green panels, deep teal title bars with yellow lettering, coral buttons, VT323 font. Colours are CSS variables at the top of `src/ui/style.css`; other candidate themes and `preview.mjs` are in `scripts/checks/themes/`.
- Owner feedback 2026-09-28: top buttons were too small and his daughter couldn't find things, which led to the labelled top bar and picture build screens. Keep menus simple, labelled and the same size.
- Recurring bug class: UI clashes on small or notched iPhones. Always check phone sizes (see `scripts/checks/hud-check.mjs`, `info-overlap.mjs`, `overflow-check.mjs`) after touching the HUD, toasts or panels.
- The rain volume was too loud before; it's now `RAIN_VOLUME = 0.045`.

## Browser checks (`scripts/checks/`)

Headless Chrome against the dev server (`http://localhost:5173`), using `puppeteer-core` (a dev dependency) and the installed Google Chrome. Screenshots land next to each script (git-ignored).

| Script | What it checks |
| --- | --- |
| `hud-check.mjs` | ☰ visible and nothing clipped on 7 iPhone sizes with notch insets |
| `info-overlap.mjs` | the info panel never covers the toolbar or the build chip, and the text stays readable |
| `overflow-check.mjs` | the pause menu fits, and alerts don't clash with buttons |
| `people-check.mjs` | 👥 panel tabs, filters, rename and locate |
| `gap-check.mjs` | fence-gap detection and "Close gap" on dino placement |
| `milestone-check.mjs` | Bronze milestone popup and Goals tab (via 📊 Park) |
| `ipad-check.mjs` | iPad layouts, landscape and portrait |
| `ipad-portrait.mjs` | iPads upright: HUD fits, panels open; iPhone upright shows the rotate screen |
| `ui-tour.mjs [WxH]` | opens every sheet (build screens, Dinos, Book, Park, People, News, Requests), reports size and sideways scrolling |
| `shaped-buildings.mjs` | all nine building sprites, enlarged |
| `dino-gallery.mjs` | all 12 species, both walk frames, at 4× |
| `icon-preview.mjs` | icon at full size, real size and maskable |
| `items-check.mjs` | carried items, pee and poop, litter, dung, janitor, trash can |
| `log-check.mjs`, `rag-check.mjs`, `repro-place.mjs` | alert log, music playback, place a dino and delete paths |

Scripts that step the sim by hand should use 16 steps per game-hour.

## Roadmap: `docs/ROADMAP.md` (all ten features done)

The ten fun and engagement features the owner approved are all built and deployed (2026-09-28). Ask the owner what's next; the ideas below are still open.

## Other ideas not done yet (ask before starting)

- Milestone M8 from the original plan: an App Store build (Capacitor plus a cloud macOS build). It needs an Apple Developer account.
- Scenario deadlines are counted in game days, so at 4-minute days they take a while in real time (First Steps Bronze is 45 days, 3 h at 1×). Offered to shorten them; no answer yet.
- Offered earlier: storms washing away litter; mess made purely cosmetic.
- Possible: a credits screen listing the music, and a day/night tint.

## UI layout (2026-09-28 reorganisation)
- **Top bar:** money above the clock, then five labelled buttons: 📊 Park (opens on Goals when the scenario has them; also Overview, Staff, Finances, Bank), 👥 People, 📋 Requests, 📖 Book (Dino Guide and Stickers as two tabs; opens at Stickers when there are new ones), 🔔 News (the park log). `fitHud` squeezes gaps first, then drops the labels; buttons never go below 44px.
- **Build tools:** Feeder, Build, Path, Garden and Fence each open a picture sheet like Buy Dinosaurs (`src/ui/tools.ts` builds the cards; `src/ui/shop.ts` is the generic sheet; small pictures for fences, paths and ponds are in `src/render/shopArt.ts`). Choosing a card starts placing it, and a chip above the toolbar shows the choice with a Change button. Remove and Land act straight away.
- **Sheets:** every big panel has `.modal-card.sheet`, a fixed size (`min(100%, 980px)` × `min(100%, 760px)`), so panels don't jump when switching tabs. Grids and bodies hide sideways overflow.
- Checks: `scripts/checks/ui-tour.mjs [WxH]` opens every sheet, reports its size and any sideways scrolling, and saves screenshots to `scripts/checks/tour/`.

## Islands (Phase 2 of `docs/PLAN-challenges.md`, done 2026-09-28)
- **Generator:** `src/sim/island.ts` (`generateIsland(width, height, seed, shape)`). Six shapes: classic, twin, crescent, river, fire, peninsula (`ISLAND_SHAPES`). Classic keeps its original elevation formula, so fixed scenario islands keep their outline.
- **Scenario islands:** First Steps classic, Fossil Fever River Valley, Storm Coast Crescent Bay, Rex Rising Fire Mountain. Sandbox has an island picker (shape, Normal/Big size, 🎲 reroll) with map previews (`src/render/minimap.ts`).
- **New terrain** (appended to `Terrain`, which is saved as numbers):

  | Terrain | Behaviour |
  | --- | --- |
  | River | Water. A path across it is a bridge at `BRIDGE_COST`; `isGround()` makes bridged tiles walkable and joins regions. A river is a natural paddock wall. |
  | Marsh | Walkable and fenceable, but `isBuildable()` is false. Drain it with Garden → Drain marsh (`drainMarsh`, `DRAIN_COST`). |
  | LavaRock | Plain land. |
  | HotSpring | Water, with steam. |
  | Cliff | Impassable. |
  | Waterfall | Water, with spray. |

- **Scenery:** hot springs and waterfalls give charm 3, rivers and ponds 1 (`NATURE_CHARM` in `visitors.ts`).
- **Generation rules:**
  - The starting plots near the gate (plus a 2-tile margin) are always kept clear of rivers, cliffs, marsh and lava.
  - The gate goes on the main island, never an islet (`mainland()` in `land.ts`).
  - Rivers start far from the sea (distance map), head for the far coast, carve downhill, and end in the sea, a lake or another river. Each river gets one waterfall with cliffs either side where it first flows south off high ground.
- **Height map:** `map.heights` (0–15) and `map.shape` are saved (SAVE_VERSION 18). Old saves get heights estimated from terrain (`DEFAULT_HEIGHT`). Floods and lava in Phase 3 will use them.
- **Big islands:** 96×72 (`newGame(seed, { big: true })`). Headless frame time and sim cost are about the same as normal size; still to be confirmed on a real iPhone and iPad.
- **Dev:** `/?quickstart&shape=river&seed=7&big` starts a specific island.
- **Checks:**
  - `island-gallery.mjs [n] [big]`: every shape × n seeds, with terrain counts
  - `islands-ui.mjs [WxH]`: menu previews, picker, bridge and marsh screenshots
  - `terrain-closeups.mjs`: waterfall, springs, lava, cliffs
  - `big-island-perf.mjs`: normal vs big frame times
  - Tests are in `tests/landscape.test.ts`.

## Fixes (2026-09-28, after the islands update)
- **Reviews:** `reviewStars()` in `visitors.ts`.
  - The score is satisfaction ± a per-visitor pickiness (8), minus 8 per different complaint topic, plus 2 per praise topic (up to 3).
  - Stars are capped by the number of different complaints: 0 → 5, 1 → 4, 2 → 3, 3+ → 2.
  - A 4-star review with a gripe reads "<praise> Only downside: <gripe>".
  - **Reputation now follows reviews** (`STAR_REPUTATION`: 5★ → 100, 4★ → 80, 3★ → 55, 2★ → 30, 1★ → 10), not raw satisfaction.
  - Measured on the visitor-life test park: basic park (no restroom or snacks) ≈ 60 reputation, mostly 3–4★; overpriced ≈ 67, mostly 4★; fair price and well equipped ≈ 88, 90% 5★.
- **Fences:** a Fence-tool drag builds the whole box from corner to corner (`boxEdges` in `grid.ts`), or a single line if the drag stays straight. The Remove tool still clears along an L.
- **Top bar:** buttons are plain, and light up only while their panel is open (MutationObserver in `hud.ts`).
- Check: `scripts/checks/fixes-check.mjs`.

## Challenges (Phase 1 of `docs/PLAN-challenges.md`, done 2026-09-29)
- **Menu:** New park → two folders. 🏗️ New builds (`BUILD_IDS`) and 🧩 Challenges (`CHALLENGE_IDS`, in unlock order). A challenge unlocks with any medal on the one before; best medals are kept per device in localStorage `dino-tycoon-challenges` (`src/ui/challengeRecords.ts`) and recorded on milestone/won events in `main.ts`. Cards show a preview of the prebuilt park (`paintParkMinimap`).
- **Prebuilt parks:** `src/sim/challenges.ts` has one setup per challenge, built with `ParkBuilder` (`src/sim/parkBuilder.ts`). Coordinates are relative to the gate. Construction goes through the normal commands, so a failure throws, and the tests build every challenge. `newPark(id, seed, island)` is how every park now starts, builds included.
- **Scenario additions** (`src/sim/data/scenarios.ts`): `category`, `big`, `briefing` (story card), `timeline` (story beats by hour, tracked in `scenario.timeline`), `loseIf` (`dinosLostAbove`, `reputationBelow`).
- **New goal kinds:** `profitStreak`, `debtFree`, `dinosHome`, `calmDays`, `fencesOk`. Progress text comes from `goalShown()`.
- **New stats:** `profitStreak` (midnight), `lastEscapeHour`, `dinosLost`.
- **Screens:**
  - story card on first start (`briefing.ts`; `scenario.briefed`)
  - goal tracker under the money (`tracker.ts`); alerts move down when it shows
  - Park → Overview "🚪 Close the park for today" (`closePark` command)
  - Park → Finances "Where the money goes" (`dailyCosts()` in `src/sim/moneyAdvice.ts`), with waste warnings
- **The Great Escape** (★, unlocked first; normal island seed 4242):
  - **Setup:** 14 dinos all loose, fences battered with 18 sections broken, 1 guard, no worker.
  - **Bronze:** everyone home in 2 days.
  - **Silver:** 90% of fences in repair and 5 calm days, within 15 days.
  - **Gold:** reputation 65 and 60 visitors in a day.
  - **Lost** if more than 3 dinos are lost.
- **The Money Pit** (★★; big island seed 8014):
  - **Setup:** 8 dinos left, 5 empty paddocks, 45 staff, unreachable restaurant and gift shop, safari stations with no track, $60 tickets (more than twice fair, so nobody comes), reputation 35, $150k of loans.
  - **Bronze:** profit 3 days running within 14 days.
  - **Silver:** debt-free and reputation 65 within 75 days.
  - **Gold:** $250k and 30 dinos within 90 days.
- **Balance test** (`tests/challengeBalance.test.ts`): plays each challenge doing nothing (must fail) and as a sensible player (must win).
- **Hunting:** a hungry carnivore that reaches prey gets one pounce (`POUNCE_SUCCESS` 0.2). A miss makes the prey bolt and the hunter rests `MISS_REST_HOURS` (5); a catch makes it rest `CATCH_REST_HOURS` (72) and leaves a `skeleton` decoration (natural, not in the Garden shop). Measured: an always-hungry raptor in a crowded paddock averages about 20 h to its first catch.
- **Save v19:** `Dino.huntRestUntil`, `scenario.briefed` and `timeline`, stats `profitStreak`, `lastEscapeHour`, `dinosLost`.
- **Checks:**
  - `challenges-ui.mjs [WxH]`: folders, story card, tracker, loose dinos, money report
  - `tracker-overlap.mjs`: tracker vs. tutorial vs. HUD on every size

## Fire Mountain (Phase 3, part 1; done 2026-09-29)
- **Challenge order** (`CHALLENGE_IDS`): Great Escape → Fire Mountain → Money Pit.
- **Fire Mountain** (★★; fire island seed 3303):
  - **Setup:** the park sits below the volcano. The script carves an old lava gully from the crater to the top of the park (`ParkBuilder.gully`) and a hollow over the upper paddocks (`setHeight`), so the lava heads there. The bottom-right paddock is empty and safe.
  - Erupts at hour 54 (day 3, 14:00), with 230 tiles of lava at 12 an hour.
  - **Bronze:** survive the eruption with no dinos lost, within 6 days.
  - **Silver:** 90% of fences in repair and 70 visitors in a day, within 20 days.
  - **Gold:** 20 dinos and reputation 75, within 40 days.
  - **Lost** if more than 2 dinos are lost.
- **Eruption** (`src/sim/systems/eruption.ts`, state `GameState.eruption`, save v20):
  - **Stages:** rumbling (warnings at 24 h and 6 h, rumbles every 12 h), erupting, cooling, over.
  - **`nextLava()` is the flow model.** Lava pours from the crater and always takes the lowest frontier tile (height plus a little hash noise). It passes unseen through Mountain, Volcano and Cliff tiles, stops at water, and is blocked by standing concrete fence edges (`LAVA_PROOF_FENCE`).
  - **`lavaPreview()`** gives the rest of the flow as the red-striped danger zone (drawn in `WorldLayers.drawOverlay`).
  - **What lava does to a tile:** it becomes `Terrain.Lava` and cools to LavaRock after `LAVA_COOL_HOURS` (30). Paths, tracks, buildings, feeders, decor and eggs there are lost. Fences round it are left broken (hp 0), so workers mend them after it cools.
  - **People:** visitors within 1 tile leave, and staff there go back to the gate.
  - **Dinos:** a dino bolts up to 8 steps to a safe tile, respecting fences. If it's trapped, a rescue helicopter lifts it out and it counts as lost (`stats.dinosLost`).
  - **Ash:** visitor arrivals ×0.25 until 48 h after the flow stops.
  - While erupting, `volcanoActivity` is kept up for the glow and smoke.
- **Move a dino:** 📦 in the dino's info panel → `UiState.startMoving` → mode `move-dino` → tap a paddock → `moveDino` command ($500 `MOVE_DINO_COST`). It uses the same placement rules as buying (`dinoSpotBlocker`).
- **Visuals:**
  - Lava tile art, plus a pulsing glow and sparks in `TerrainFx`.
  - Trees on lava are hidden (`SceneryLayer.refresh`).
  - The goal tracker shows "🌋 erupts in ~Nh", "ERUPTING!" or "lava cooling".
- **Tests:** `tests/eruption.test.ts`, plus a Fire Mountain case in `tests/challengeBalance.test.ts` (doing nothing loses dinos; moving everyone out of threatened paddocks, adding feeders and a vet wins Bronze with no losses).
- **Check:** `scripts/checks/fire-ui.mjs [WxH]`.

## Flood Season (Phase 3, part 2; done 2026-09-29)
- **Challenge order:** Great Escape (★) → Fire Mountain (★★) → Flood Season (★★) → Money Pit (now ★★★).
- **Flood Season** (classic island seed 6107):
  - **Setup:** `ParkBuilder.riverAcross(-12)` paints a 2-wide river east–west through the park, out to the sea both ways, crossed by the main path as a bridge. Low meadows either side are height 2; the rest of the park is 5.
  - **Paddocks:** three in the meadows (they flood); one empty high paddock (top right, safe); one on the terrace by the gate.
  - **Buildings:** the shops are on the dry terrace, with a gift shop and snack stall by the river that flood. The park has no vet.
  - **Floods:** starting at hours 30, 100, 170 … 660 (about every 3 days). Water rises to level 3 over 3 h, holds 6 h, drains over 3 h.
  - **Bronze:** 3 floods survived, no dinos lost, within 10 days.
  - **Silver:** a flood-proof flood and 60 visitors in a day, within 20 days.
  - **Gold:** 16 dinos and reputation 70, within 35 days.
  - **Lost** if more than 2 dinos are lost.
- **Floods** (`src/sim/systems/flood.ts`, state `GameState.flood`, save v21):
  - `scheduledLevel()` gives the water level each hour.
  - `floodTiles(state, level)`: water spreads from River, Pond and Waterfall tiles over connected land with `height <= level`. It is blocked by standing **sandbag** fence edges (`SANDBAGS`, fence type 6, $15) and by ground within `PUMP_RADIUS` (4) of a **pump house** (building `pump`, $2,500). Bridges (River + path) count as wet unless pumped.
  - `floodForecast()` gives the blue stripes 12 h before a flood. A storm starts 1 h before.
  - **While wet:**
    - `onLand` and `onWalkway` refuse wet tiles, and wet buildings are closed (`buildingNear` in visitors, `near` in rides).
    - Feeders spoil, and fences rot at 3/h ÷ strength (sandbags are immune).
    - Visitors in the water go home, and staff go back to the gate.
    - Dinos wade to dry ground (fences respected). If they can't, they lose happiness and have a 4%/h chance of catching a chill (sick).
  - **Afterwards:** `survived++`; `lastDry` is set if nothing that matters got wet (paths, buildings, dinos); soaked buildings cost $250 each to clean.
  - **Goals:** `floodsSurvived`, `floodProof`.
- **Solving it:** sandbags along both banks (skipping the bridge column) plus one pump beside the bridge at (+1, −14) keeps the whole park dry. That's what the balance test does, along with hiring a vet and a guard.
- **UI:**
  - Solid blue water with ripples while flooded; blue stripes for the forecast.
  - The goal tracker shows "🌧️ flood in ~Nh" and "🌊 FLOOD!".
  - The fence screen has Sandbags; the build screen has the Pump house (brick house with a spouting pipe).
- **Perf test:** p99 limit raised to 40 ms. It spiked to about 27 ms only when the whole suite ran in parallel; alone it's about 2.3 ms.
- **Checks:** `scripts/checks/flood-ui.mjs [WxH]`; tests in `tests/flood.test.ts` and `tests/challengeBalance.test.ts`.
