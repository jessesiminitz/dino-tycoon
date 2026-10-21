# Dino Tycoon: handoff notes

## Ferry port and seasonal crowds — October 21, 2026

Every visitor now arrives by ferry, and crowds follow the seasons (recommendations A and B from the DinoPark research). Saves are **v22**: the `port` field was added, and finance ledgers gain a `ferries` expense category.

- **Rules** (`sim/data/port.ts`, `sim/port.ts`, `sim/systems/ferries.ts`): each open hour (08:00–18:00), the hour's demand (`expectedArrivals`, now × `seasonalDemand`) boards the ferries. Seats are shared round the boats; anyone without a seat is counted in `port.turnedAway`, and the news reports it at 19:00 if it reaches 8 or more. Each ferry docks at its slot in the hour (`dockStep`). Its passengers reach the gate `LANDING_STEPS` (3) steps later, where `admitVisitors` charges admission. Ferries carry nobody on a day the park closes early.
- **Upgrades** (Park report → **Port** tab, or tap the pier → Port):
  - **Port:** Jetty (start: 1 berth, up to a Ferry), Pier ($5,000: 2 berths, Big ferries allowed), Harbor ($12,000: 3 berths).
  - **Ferries:** Water taxi (6 seats, $1,500), Ferry (9, $3,500), Big ferry (12, $7,000).
  - **Trade-ins:** trading up costs the new boat's price minus half the old one's. Selling returns half. A park must keep at least one ferry.
  - **Running costs:** charged at midnight under "Ferries & port".
  - **Capacity:** a new park seats 9 visitors an hour; a full harbor seats 36.
- **Visitor limit:** `MAX_VISITORS` rose from 150 to 300 as a phone-safety limit; the ferries are now the real limit. The perf test now fills the stress park to 300 and still passes.
- **Existing saves and challenge parks** get a Pier with two Big ferries (24 an hour), slightly more than the old 150-visitor limit allowed (`LEGACY_PORT`, also set in `ParkBuilder.finish`).
- **Seasons:** demand is ×1.25 at mid-summer and ×0.75 at mid-winter on a smooth cosine, averaging exactly 1 over the 28-day year. The season news lines now mention crowds.
- **Art** (`render/PortLayer.ts`, `render/portArt.ts`):
  - **Port:** the pier runs straight south from the gate (boardwalk over any beach) until its head and berths are open water. It is a jetty, a wooden pier with a T-head and ticket hut, or a stone harbor with a lighthouse.
  - **Ferries:** code-painted for both art editions. They sail in from the south-west with a wake, tie up, drop a gangway, and up to 10 passengers walk to the gate as the real visitors arrive. Then they sail off south-east. The first ferry stays moored overnight with lit windows. The lamp and lighthouse glow at night.
  - **Open sea past the map edge** (`OPEN_SEA_KEY` tile sprite): ferries near a gate close to the map edge no longer cross a seam. Unowned edge parcels carry their shade out over it, and the property line is no longer drawn along the map edge.
- **Balance:**
  - `economyBalance` gives its standard parks a matching port (jetty, pier and 2 big ferries, full harbor) and measures in fall, an average season. Net per day: $2.2k, $4.1k, $13.7k.
  - In `challengeBalance`, the sensible Money Pit run adds ferries when they turn 20+ people away (Gold on day 88, $301k). The sensible Flood Season run patches storm-damaged sandbags each morning: without that, a different storm pattern breached them.
  - Challenge targets are unchanged.

Validation: 521 tests (12 new in `tests/port.test.ts`) and the production build passed. `scripts/checks/port-check.mjs` screenshots all three port levels, arriving/docked/landing ferries and the night mooring. It also taps the pier into the Port tab and builds a pier and buys a ferry there. It passed in both editions. `hud-check`, `info-overlap`, `overflow-check`, `typography-review` and `seasons-check` passed. Physical iPhone/iPad review is still to do.

## Visible seasons — October 21, 2026

The island now has a 28-day year: four seasons of 7 days each (`src/sim/seasons.ts`). Seasons are derived from `state.hours`, so saves stay v21. Day 1 is spring day 4, so a new park opens green and in blossom. The HUD clock shows the season icon (🌸 ☀️ 🍂 ❄️); its tooltip names the season and the day within it. A news item announces each new season at 07:00.

- **Trees and plants** (`render/seasonArt.ts`, applied hourly in `SceneryLayer.dressForSeason`): broadleaf trees, bushes and garden trees go bare → buds → blossom (about half of them) or fresh green → summer green → turning → gold/orange/red → falling → bare twigs. Each plant is staggered by up to a day, so a forest changes gradually. Conifers, cycads, tree ferns, giants and palms stay green and get snow caps. Reeds go golden in fall and winter. Seasonal textures are generated lazily from the finished sprite (`<key>~<look>`), so this works for the Blender, cartoon and original painters. Wind sway uses the seasonal texture as its root.
- **Ground** (`render/SeasonLayer.ts`): grassy tiles are fresh in spring, golden in fall and dull in winter (the tileset canvas is repainted when the tone changes). Snow is a separate tile layer at depth 0.2, under paths, fences and buildings, so walkways look cleared. It settles late in fall, covers the island in winter and melts in early spring. Mountains and high ground keep it longest; beaches and forest floors hold less; it never lies on water, lava or hot springs. The snow tiles threshold one seamless 64-px drift pattern at 10 coverage levels, so a thaw creeps across the map without tile seams.
- **Snowfall:** `WeatherScene` draws drifting flakes in six-hour spells while snow is settling (late fall to early winter).
- **Setting:** "Season scenery" (`seasonScenery`, default on) sits beside World animation in Settings. Off shows summer all year. Flakes also need World animation.
- **Seasonal visitor numbers** were added later with the ferry port (see above).

Validation: all 509 tests (10 new in `tests/seasons.test.ts`) and the production build passed. `scripts/checks/seasons-check.mjs` screenshots opening day, thaw, blossom, summer, turning, fall colour, first snow and winter, checks the Season scenery switch, and writes an enlarged plant gallery (`tour/season-gallery.png`). It passed in both the pixel and cartoon editions. `hud-check`, `info-overlap`, `menu-pacing` and the pause/settings overflow check passed. In software-rendered Chrome, generating a season's new textures took up to about 0.3 s once per change of look; physical iPhone/iPad timing is unmeasured.

## Standardized in-park menu typography — October 18, 2026

`parkTypography.css`, imported after the theme/hatching styles, gives every in-park .modal and native .hatch-dialog the same system font and disables the inherited VT323 font-size adjustment. The main title and map HUD retain their existing typography. Reports, People, News, requests, shops, catalog, guide, pause/settings and hatch dialogs use 14px body/control text, 12px secondary text, 18px panel headings/numeric values and 15px section headings. Local --pixel-font points to the menu font so legacy/cartoon heading and control rules resolve consistently. Name/text inputs remain 16px to avoid Safari focus zoom; menu buttons keep at least 44px height, including short-screen pause buttons. No save or gameplay changes.

`typography-review.mjs` opens each report tab, People/News/requests/catalog/guide, fence shop and pause/settings at 667×375, 844×390 and 1180×820, in both editions. It checks actual computed family, size and font-size-adjust, heading hierarchy, button size/tap height, panel bounds and content overflow, plus a native hatch-dialog fixture. Screenshots and results are under docs/typography-review. All 500 tests, production build and both browser review runs passed. Phone overview/settings screenshots were visually inspected.

## Keep the bottom of the screen visible — October 17, 2026

The full-screen UI now uses the visual viewport height and vertical offset, rather than assuming the layout viewport is entirely visible. `fitVisibleViewport()` updates --app-height/--app-top at startup, window resize, and visualViewport resize/scroll (browser controls or keyboard movement). CSS uses a fixed, layout-containing body so the game canvas, title, bottom tools and every fixed dialog share those visible bounds, including shops/hatching dialogs appended directly to body. Dynamic viewport units provide the CSS fallback; photo/dig sizing and parade scale also use the visible height. Menu options still scroll behind the parade, and existing safe-area insets remain applied.

`viewport-review.mjs` simulates a 375px layout with only 305px visible, a 250px viewport offset 30px, and restoration to full height. It checks title/scrollable content/parade bounds, Settings reachability, game/canvas/camera resizing, bottom toolbar safety with a 22px inset, and a visible runtime shop. Standard phone landscape, portrait and desktop sizes are checked too. The visual viewport mismatch is simulated in Chrome; this is not a physical Safari device check. Screenshots/results are in docs/viewport-review for both editions. No save changes.

Validation: all 500 tests, production build, and viewport-review in both art editions passed.

## Full-screen title scrolling, playful calls and twelve parks — October 17, 2026

The title content scrolls at full screen height, passing behind the foreground dinosaur parade. Bottom padding lets lower options scroll above the dinosaurs. Transparent gaps pass pointer gestures through; dinosaur buttons remain interactive, and reduced-motion/manual parade browsing remains available. Parade sizes and game proportions are unchanged. Secondary screens continue hiding the parade.

Species calls now play at .85 gain instead of .28, with brighter harmonics, audible growl formants and expressive pitch contours. The bass-only emphasis is reduced so large voices carry on small speakers. These are playful animal-inspired interpretations; research notes remain background inspiration, not an accuracy claim. Babies stay higher, shorter and softer; the existing SFX switch/volume still applies. A new call fades the previous voice over 80 ms to prevent stacked loud calls. No new recordings or runtime audio downloads. The listening gallery/WAV previews are regenerated.

Save slots expand from three to twelve with unchanged IndexedDB keys/schema and existing slots preserved. Menu initialization and full-slot guidance derive from SLOT_IDS; occupied rows display their park number. Continue metadata is written separately from the synchronous mirror so mirror quota failures do not prevent remembering the current IndexedDB park. No GameState shape/version change. Storage tests exercise all twelve slots, preservation, import, delete, boot directives and mirror quota handling. A synthesis regression checks audible energy above 300 Hz for large voices.

`menu-saves-review.mjs` checks full-height title layout, scrolling Settings clear of the parade, twelve rows with the first three occupied, automatically starting in slot four, and loading a persisted park twelve through the menu. It covers two landscape phones and desktop in both editions; screenshots/results are under docs/menu-saves-review. Desktop naturally needs no scroll when the menu fits. Leaving a running park updates Continue to that park, so the higher-slot check explicitly uses Load park. Existing menu-fun checks cover proportional sizing, animation, taps/snacks, reduced motion and paused park care. Calls review checks gesture unlock, adult/baby buffers and mute.

Validation: 499 regular tests plus the performance test (500 total), production build, both menu-fun editions, both menu-saves-review editions at three sizes, and calls-review passed. Calls review verifies the actual .85 voice gain and running audio context after a gesture, as well as mute.

## Free play first and combined marsh lagoons — October 17, 2026

New park goes directly to the island picker and creates a sandbox/free-play park. Scenario and challenge launch cards are set aside; their simulation definitions, records and existing saved parks remain loadable. Island Back returns to the title. No save migration or deletion.

Fences now offers Marsh / Lagoon fence. `UiState.lagoonFence` is a transient tool preset using the existing concrete boundary type. A rectangular fence drag calls `planLagoon`/`buildLagoon`: the whole site is checked, concrete boundary sections are built/repaired, the centre becomes Pond, and a one-tile dry shore remains inside the fence so the existing region model recognizes a usable lagoon. Natural marsh on the shore is drained. The preview includes fence, water and shore preparation costs; blocked ground, internal partitions, paths/tracks, objects, animals, eggs, people in the water area, unowned land and insufficient funds cannot cause partial construction. Existing clear pond tiles can be reused, and completed lagoons do not charge again. Minimum outer size is 3×3; larger lagoons are needed for animal space.

Gardening lists decorations only. Pond creation is part of the fence preset; marsh drainage moves to Remove (tap/drag), with cost in the preview. The legacy `digPonds`/`drainMarsh` simulation commands remain available to saved-game support, builders and tests. Water-animal habitat guidance points to Fences. Existing v21 terrain/fence representations are reused.

Three new habitat tests cover immediate animal/feeder placement, exact cost, repeat prevention, reversed drags, natural marsh and atomic failures. `lagoon-review.mjs` checks the free-play menu, real fence-shop drags, pond area/price, immediate water-dinosaur and feeder eligibility, decoration-only Garden, and Remove draining at two phone sizes. Screenshots/results are in `docs/lagoon-review`. `habitats-check.mjs` now uses the combined fence gesture instead of the retired Garden/Pond picker. Validation: 496 regular tests plus the performance test, production build, both art editions on two phone sizes, and the existing lagoon/aviary regression check passed.

## Evidence-informed calls and a more visible title parade — October 14, 2026

`callSynthesis.ts` replaces the species call oscillator presets with original deterministic PCM synthesis: drifting harmonics, filtered breath, irregular pulses, soft envelopes and headroom normalization. Large voices use low booms/coos/grunts; only Parasaurolophus gets a crest-resonance voice. Small theropods use clucks; pterosaur and marine reptile voices remain explicitly speculative (no whale-song claim). Baby calls remain higher, shorter and softer. `audio.ts` plays three subtle variations through the existing SFX bus/toggle and retains the 350 ms debounce, with a bounded 32-buffer cache and source cleanup. Greetings, title snacks and positive park care now use the species voice instead of a generic chirp; the hungry-animal snap stays a short effect. No downloaded recordings, audio assets in the runtime precache, or save changes.

Research, inference limits and primary references are in `docs/dinosaur-audio.md`. Exact pitches/rhythms are design choices, not fossil measurements. Ten adult/baby WAV previews and a local listening gallery are under `docs/dinosaur-audio`. `calls-review.mjs` generates these and checks real playback plus the SFX toggle; it resolves the running Vite module URLs to avoid a second uninitialized audio module after HMR. `callSynthesis.test.ts` checks all 28 species and both ages at 22.05/48 kHz for finite, audible, bounded waveforms with silent edges, as well as baby levels and variants. Full suite: 493 regular tests plus the performance test.

Menu dinosaurs keep one common zoom and their fixed animation canvases. The shared height grows from 98px to a responsive clamp(132px, 18vh, 210px), and short landscape grows from 66px to 90px. World dinosaur sizes stay as before. The parade and main content reserve matching space; secondary menu screens hide the decorative parade. `menu-fun` checks actual visible animals for walking-frame changes instead of assuming the first duplicated sprite is on-screen after viewport resizing. `menu-pacing` also checks that the parade hides on Settings and returns to the title.

## Domed aviaries, larger flyers and entrance landmark — October 12, 2026

Completed net enclosures now render curved mesh roofs with arched support ribs and netted end panels. `aviaryRoof.ts` follows horizontal runs of the actual region tiles, including holes and indented sides, rather than a bounding rectangle; low-opacity roof netting keeps animals visible. Roofs redraw with world revisions and disappear when net fences break or are removed. Wall strength, containment and building costs retain their simulation rules. Pteranodon and Dimorphodon receive a shared 1.5× visibility multiplier in `dinoWorldScale` in both editions, including babies, authored motion and the menu parade. Other species retain their scales.

The original tiny gate is replaced by the code-painted 96×64 world-pixel entrance in `entranceArt.ts`: a broad wooden arch, native DINO PARK lettering, two decorative ticket booths, flags and lamps. The central passage and visitor spawning stay on the entrance tile; the landmark sorts at its ground depth. Cartoon painting uses 2× resolution and rounded details. Existing v21 parks receive these visual changes on load without migrating or changing their maps. Phone review also exposed an existing 300–450 ms dead zone in map taps: `TouchController` now delivers stationary presses once on release, uses long-press semantics for held touches whose timer was delayed, and tracks whether a map press actually began to ignore unrelated releases. Drag, pinch and mouse-pan exclusions remain in place.

`aviary-entrance-review.mjs` checks both flyers at 50% above the preceding scale, roof removal/restoration, real phone selection taps, and the entrance at desktop plus 844×390 and 667×375. Screenshots and results for both editions are in `docs/aviary-entrance-review`. `aviaryRoof.test.ts` covers dome rise, enclosure bounds, capped ends and irregular footprints. Full suite: 491 regular tests plus the performance test.

## Active breakout rescue — October 11, 2026

The Great Escape now starts with intact paddocks and fourteen loose dinosaurs, including two hungry carnivores. No missing fence sections to hunt. Select a loose animal, use its diet-specific food lure, then Bring home ($250) within one game hour. Loose-animal treats reduce hunger by 30; normal treats still reduce it by 5. `rescueDino` checks hunger, the recent lure, money and the original home before transporting; guards remain optional backup and Move offers an alternative paddock. Silver now rewards no losses and one calm day instead of fence repair and five days waiting. Existing v21 fields persist lure timing without a schema change. Old challenge saves retain their original damaged maps; start a fresh challenge to see the revised opening.

`tests/rescue.test.ts` covers lure expiration, reload, hungry animals, insufficient funds, unsafe homes and duplicate rescue. Challenge balance now plays the active rescue route. `scripts/checks/rescue-review.mjs` verifies real food/rescue taps and fitting controls at two landscape phone sizes; screenshots are in `docs/rescue-review`. Full suite: 489 regular tests plus the performance test.

## Restore game proportions in the menu — October 11, 2026

The user requested the game's relative species sizes again after the portrait enlargement. Menu sprites now use `dinoWorldScale` for the selected edition, including the existing 2× Compsognathus adjustment, and share one responsive parade zoom. Full motion canvases retain identical dimensions across all clips and frames; per-frame cropping/resizing was making animals such as Nigersaurus appear to stretch. Label/touch targets remain large independently of body size. Large land animals now give gentle nods; smaller hops and flutters scale with the animal's height, squash/stretch is removed, and treats animate only the authored chewing poses. Reaction clips start from the tap and reset correctly on return to walking. Park sizes, authored motion files, simulation and v21 saves retain their current behavior.

`npm run check:menu-scale` checks all 896 adult frames per art style, fixed dimensions, game silhouette sizes and the common zoom. Nigersaurus contact sheets and results are under `docs/menu-scale-review`. `check:menu-fun` now verifies shared scale across desktop/phone/tablet layouts and includes Nigersaurus nod/chew interactions.


## Bigger, playful dinosaurs — October 11, 2026

The title parade now uses native cropped portraits independently of world metre scales. Every species has a readable 192×98 fit box (160×66 in short landscape screens), labeled 44px+ tap targets and authored walking frames. T. rex, Compsognathus, Triceratops and Stegosaurus lead the same complete 28-species loop. Taps pause the scroll for hops/wiggles, aerial flutters or swimmer bobs; subsequent taps cycle through snacks/chewing and greetings. Only visible animals advance, frames are cached lazily, and animation stops after starting a park. Reduced motion and the animation setting provide a static, manually scrollable roster. Duplicate loop buttons are excluded from keyboard navigation; focusing an original animal brings it into view.

Park pats and treats now animate species-specific full-body reactions through `dinoReaction.ts`: happy bobs/head wiggles, wing flutters, swimmer dips and eight chewing poses. A separate real-time presentation clock lets deliberate care reactions and hearts finish while simulation time is paused, without moving the dinosaur's simulation position. Reactions return to normal poses cleanly and body motion respects the animation setting. Saves remain v21. `npm run check:menu-fun` checks menu sizes, taps and paused care; `menu-pacing.mjs` checks all loop sizes plus keyboard access, and `art:offline` compares stable native menu posters rather than transient walking frames.


## Interactive baby reveal — October 11, 2026

The live game opts into interactive hatching through `mountHatching`: ready land eggs stay in the existing v21 save until the third tap dispatches `hatchEgg`. Headless simulations retain automatic births. A native dialog pauses the park with the shared pause holder, traps focus, shows successive shell cracks with synthesized crack SFX, and reveals the matching species' baby artwork. The congratulations screen offers an optional name using the existing rename command, then saves and restores the preceding speed. Concurrent eggs are presented one at a time; unfinished eggs reopen after reload. Sea reptiles retain live birth and receive the species-specific celebration/name screen directly. No save schema change. `npm run check:hatching` checks every species, taps, naming/save, reload, queuing, audio activation and phone/tablet layouts; screenshots go under `docs/hatching-review`.


## Compsognathus visibility adjustment — October 11, 2026

The user requested twice the previous core-game size. Blender Compsognathus now has a 2× world-scale multiplier for adults and babies, including all animation clips; cartoon/original sizes and other species retain their scales. Motion stride and selection bounds use the shared scale.


## Local cartoon edition — October 11, 2026

**Pixel size update:** the Blender pixel comparison (`?art=blender`) now uses a common six world pixels per registered metre, with only a five-pixel floor for the very smallest silhouettes. Compsognathus paints at about 7×5 pixels including its outline, beside a roughly 10-pixel-tall visitor; T. rex is about 74 pixels long and Argentinosaurus about 212. Large species may scale above their source resolution (up to 2.5×). Cartoon and original-painter sizes retain their preceding rules. Walking cycles receive the selected art style so gait distances match the corresponding body scale. The minimum 20×20 world-pixel dinosaur touch target remains intact. `scripts/checks/pixel-size-review.mjs` checks all 1,792 adult/baby frames and produces the visitor/species lineup under `docs/pixel-size-review/`.

The artwork was developed on **`art/cartoon`** and is being promoted to `main` for GitHub Pages at the user’s request. The core/default style is Blender pixel art; `?art=cartoon` remains public. Validation: all 483 tests, TypeScript and production build passed. The moved worktree link has been repaired against `/Volumes/Apple HDD 2TB/dino-tycoon/.git`.

Blender pixel art is now the core/default rendering style, including the realistic size update. `?art=cartoon` selects the cartoon alternative in development and production; `?art=original` remains development-only. Public app icons match the pixel edition.

The first playable cartoon pass covers 28 dinosaurs, four eight-frame clips each, adult/baby sizes, buildings, scenery, procedural terrain, visitors/staff, eggs, feeders, jeeps, fences, shop samples, interface and app icons. Most animal shapes are smooth curves derived from the editable local Blender contours; `cartoonRex.ts` gives the T. rex a bespoke rounded character and articulated poses based on the approved concept. This is a playable art-direction prototype, not a claim that every species exactly reproduces the generated concept illustration.

`scripts/art/export_cartoon.py` reads existing `.blend` files without overwriting them. It exports shared high-precision contours to `src/render/generated/cartoonGeometry.json`; `cartoonArt.ts` paints those directly to supersampled canvases without palette-grid quantization. World textures use 2× resolution and scale back to logical world dimensions; gallery/source-sized assets use 4×. Animation atlases remain lazy. The complete 56 adult/baby atlas set is approximately 116 MB; typical parks load only the species they contain.

The generated art pack is ~3.5 MB uncompressed and ~0.9 MB gzipped. It has its own production chunk so every precached file stays below the existing 5 MB limit. Simulation and saves remain v21.

Run `npm run art:cartoon` with the local dev server for the exhaustive animation/size/transparency review and screenshots under `docs/cartoon-review/`. App icons are regenerated separately with `npm run icons` so reviewing the cartoon alternative does not overwrite the core pixel icons. Physical iPhone/iPad performance and further character-design polish remain review items.

Everything a fresh session needs to carry on. Last updated 2026-10-05, after restoring little dinosaurs and correcting fence grounding.

## Where things stand (read this first)

- **Graphics branch:** `art/blender-pixel` in `/Volumes/Apple HDD 2TB/dino-tycoon-blender-art`, now with the twelve-species expansion on top of environment commit `843f5d7`. The roster now has 28 species. Blender artwork covers all dinosaurs, park buildings, scenery and terrain; backward-looking walking is fixed. Validation passed. This work remains separate from `main` and has not been deployed; physical iPhone/iPad review and integration are still pending. See **Blender graphics work** below.

- **Full park animation:** all 28 species now have four eight-frame Blender clips (896 frames / 112 editable animated source files). The playable park follows actual movement, feeding and nighttime rest. Rooted wind, leaves/fireflies, dust/wet footfalls, swimming wakes and pond sparkle extend the prototype's ambience. World animation is a device setting and defaults off for reduced motion; saves remain v21. Review all species at http://localhost:5173/scripts/art/review.html, or keep using the three-animal enclosure demo at http://localhost:5173/scripts/art/immersion.html. See [docs/PLAN-animation-immersion.md](docs/PLAN-animation-immersion.md) and [docs/PR-blender-park-immersion.md](docs/PR-blender-park-immersion.md).

- **Anatomy corrections:** reduced and repositioned claws, horns, tail clubs, spikes and feathers in twelve canonical models. Stegosaurus/Ankylosaurus tails now sit above the ground. Neck spines follow grazing necks, tail accessories follow their roots, and the shared idle/rest deformation preserves accessory joins across the full roster. All 896 motion frames and 112 editable timelines were regenerated. Both converters now reject detached anatomy; see **Anatomy correction validation** below. The changes remain local to the graphics branch.

- **Longer tails:** Stegosaurus, Spinosaurus, Brachiosaurus and Kentrosaurus now have longer tails rooted at their hips. Their canonical canvases have symmetric extra room, preserving body scale and world-relative foot placement in both directions. Spike groups follow the lengthened shafts; Spinosaurus has a tapered fin and Brachiosaurus carries its tail above ground. Generated model offsets keep transparent room out of the ground-shadow size. Four canonical sources and sixteen animation sources were rebuilt, covering 16 poses and 128 clip frames. See **Tail correction validation** below.

- **Full-roster picture review:** reviewed all 28 animals against additional web skeleton photographs and museum/research reconstructions. Revised 26 canonical silhouettes, corrected Pteranodon's resting wing fold, and retained Triceratops after comparison. Longer tails, clearer plates/armor/feathers, improved skull/beak/claw shapes, neck proportions, sail and tail-fin profiles now feed all four clips. Twenty-four canvases have symmetric extra room; world-relative grounded feet remain within 0.001 pixel of the preceding version. All picture links and per-animal decisions are in [docs/PR-dinosaur-reference-review.md](docs/PR-dinosaur-reference-review.md). See **Reference review validation** below.

- **Parade and nighttime pacing:** the title-screen parade reserves each dinosaur's actual sprite width and leaves a 48 CSS-pixel gap, including at the loop seam. Two matching rows scroll together at 30 px/s; reduced motion stops the parade. Nighttime (21:00–05:00) automatically multiplies the selected speed by three, then restores daytime pacing at dawn. Pause still freezes time and animation. At selected 1×, the night now takes about 27 seconds and a full day about 3 minutes 7 seconds. No simulation steps or hourly care/economy/event processing are skipped, and saves remain v21. Animal, environment and weather animation clocks use the effective speed. The clock tooltip/accessibility label explains nighttime acceleration without expanding the mobile HUD. See **Pacing validation** below. These changes remain local to the graphics branch.

- **Fossils and fence visibility:** all 22 fossil-locked species now need **two bones**; the six starters remain available without digging. Loaded parks and `Simulation` honor previously earned counts of two or more without resetting bones, duplicating unlocks or changing save schema v21. Fossil brushing now auto-completes at **95%** of the fossil rather than 70%; large silhouettes are fitted into the pit instead of clipping. Objects and people share a logical ground anchor, end-on fences sort at their midpoint, and carried balloons/snacks, staff tools and jeep passengers sort with their owners. The following size/grounding pass replaces the whole-dinosaur fence priority. Source artwork is unchanged. See **Fossil and depth validation** below. These changes remain local pending physical device review and deployment.

- **Dinosaur size and grounding:** the daughter missed little Compsognathus. All 28 species now use a compressed size scale derived from their registered lengths and painted silhouette widths, excluding transparent canvas room. Small animals are small again, with faces preserved by resampling role grids rather than shrinking a GPU image. Babies remain smaller; both get a minimum 20×20 world-pixel touch target. The title parade uses a common scale instead of giving every animal the same height, retaining its 48px gaps. Dinosaurs stay at their normal ground depth; only nearby live fence sections overlapping their painted bounds soften to 30% opacity. Feet and shadows remain behind the wall, while faces stay readable. Walls restore opacity when animals move away, and only affected rows redraw. No save schema, physics positions, species balance, Blender models or generated grids changed. See **Size and grounding validation** below. These changes remain local pending physical iPhone/iPad review and deployment.

- **Live and working:**
  - four challenges (The Great Escape, Fire Mountain, Flood Season, The Money Pit), in the 🧩 Challenges folder, unlocking in that order
  - six island shapes, with the Sandbox island picker
  - the Tropical lagoon UI theme
  - picture build screens
  - honest reviews
  - one-drag fence boxes
- **Plan in progress:** `docs/PLAN-challenges.md`. Phases 1–3 are done.
- **Next:** **Phase 4, the Staff Strike.** It needs staff mood, wages per role, a staff room, negotiation cards (built on `choices.ts`), and doing a job yourself. Then Phase 5: Baby Boom, Dino Flu, Grand Opening, Heatwave, Clean-Up Crew and Island Hop. The owner said "start on that one" for each challenge in turn, so ask before starting Phase 4.
- **Every new challenge follows the same recipe:**
  1. A `SCENARIOS` entry with `category: 'challenge'`, a briefing, a timeline and `loseIf`.
  2. A `ParkBuilder` setup in `src/sim/challenges.ts`.
  3. An entry in `CHALLENGE_IDS`.
  4. A case in `tests/challengeBalance.test.ts` where doing nothing fails and sensible play wins.
  5. A `scripts/checks/<name>-ui.mjs` screenshot tour.
  6. Bump the sticker medal count in `tests/stickers.test.ts`.
- **Owner preference:** continue authorized repository work autonomously. If an approval review blocks an action, follow the current harness instructions, complete unaffected work, and report the specific blocked action and reason.

## What this is

A touch-first spiritual successor to *DinoPark Tycoon* (1993) for iPhone (and iPad), built as an installable web game (PWA).

- **Live:** https://jessesiminitz.github.io/dino-tycoon/ (GitHub Pages)
- **Repo:** https://github.com/jessesiminitz/dino-tycoon (public). Main checkout: `~/Projects/dino-tycoon`; active graphics worktree: `/Volumes/Apple HDD 2TB/dino-tycoon-blender-art`.
- **Owner:** Jesse plays on an iPhone (Home Screen app); his daughter plays on an iPad. Keep it kid-friendly.
- **Stack:** TypeScript + Vite 6 + Phaser 3.90 + vite-plugin-pwa (prompt mode, "Update" banner) + Vitest. Pixel art uses checked-in Blender role grids painted to canvases at runtime, alongside code-painted effects and UI. Blender source files stay outside the shipped build. Sound is synthesised with Web Audio.
- **Machine:** Late-2015 iMac, macOS 12, no Xcode. Node 22 via nvm (`export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH`).

## Blender graphics work (2026-10-04)

Work in the graphics worktree on `art/blender-pixel`; do not overwrite the main checkout. Implementation commits:

- `973dd75`: Blender pixel-art pilot and reproducible export workflow.
- `b2a11ba`: all 16 dinosaur species × four poses and 10 buildings; walking gait correction and Blender Home Screen icons.
- `843f5d7`: 15 scenery types with 38 variants, plus 16 terrain types with four variants each.

The canonical set contains **69 asset types and 224 grids**; the full runtime animation adds 896 frames. Blender is the default in dev and regular production builds. Dev `?art=original` selects the original painters for comparison; normal production builds strip dev hooks and use Blender. Save format remains **v21**, with no simulation or map schema changes.

Planted feet move backward relative to the body while lifted feet swing forward; left-facing animation mirrors the same frame order. Swimmers and flyers also have four poses, and pause freezes the animal animation clock. Baby scaling, palette patterns, fossil masks, water cropping and sleeping flyers retain their existing behavior. Environment variants keep seeded selection, scenery footprints, opaque 16×16 terrain tiles, tree fading/construction hiding and volcano/fountain/lamp effect anchors.

**Preview:** `http://localhost:5173/scripts/art/review.html` compares all 69 asset types at native, 2× and 4× sizes, with pose/variant, direction, baby and background controls. `http://localhost:5173/?quickstart` opens a Blender park; add `&art=original` to compare. The dev server was running from this worktree at handoff; start it with `npm run dev` if needed.

**Source and regeneration:** [assets-source/README.md](assets-source/README.md) is the canonical workflow. Blender 4.5.14 LTS models and compressed `.blend` files live under `assets-source/`; generators are in `scripts/art/`. Render through Blender MCP or the documented Blender CLI, then run `npm run art:convert` and `npm run art:check`. PNG/JSON intermediates are ignored and must be regenerated on a fresh checkout. Runtime grids are checked in under `src/render/generated/`; Blender and MCP are not runtime dependencies. Canonical source files total about 6.7 MB; the 112 animation sources add about 12.7 MB. All source scenes are excluded from the shipped build.

**Size and grounding validation (2026-10-05):**

- All **476 tests** passed (475 regular plus one performance test) at their default time limits; production build passed. Thirty new size cases protect the little Compsognathus, roster hierarchy and all 28 species' adult/baby faces and grounded poses. Depth regressions now protect local softening without lifting animals above walls. Walking distance uses the same species/baby scale as the painted frames, including tiny babies' shorter strides.
- `check:fossil-depth` passed **672** species/baby/direction/fence-type cases with normal dinosaur ground depth, local fence softening and restored opacity after animals leave. Adult and baby Compsognathus retain the expanded touch target. Carried objects, tools, riders and people retain consistent wall ordering. Fossil fitting, 95% brushing, pause and restored speed still pass across phone/tablet layouts.
- Native comparison art remains unchanged. Ignored captures are `docs/art-review/dinosaur-world-size-lineup.png` (all 28 beside visitors at a shared 2× scale), `little-compsognathus-phone.png` and `grounded-fence-before.png` / `grounded-fence-after.png` (the prior whole-sprite priority versus softened foreground walls).
- `check:pacing` passed the full parade loop and seam at five screen sizes, reduced motion, 3× nighttime clocks and pause/dawn behavior. The parade now has one common zoom, with the largest sprite 64px tall; tiny animals are intentionally tiny. Phone catalogs, expansion galleries, palette/fossil parity and scaled adult/baby shadows passed `art:integration`.
- Final `art:park-motion` passed all **1,792 resized adult/baby atlas frames**, **896** runtime walk/frame/baby/facing combinations and **3,584** native review combinations, plus real meals, nighttime rest, pause and rooted wind. Pixel-sized motion frames keep the canonical palette and readable faces; source/gallery art remains native. Cached textures stayed bounded at 379 / 388 with ambient animation off/on. Software-rendered desktop Chrome measured p95 frame times of **116.7 ms** for both and entity updates of **1.3 / 1.5 ms**; these are not physical Safari measurements.
- Final `art:integration`, `art:motion-controls`, `check:pacing` and production `art:offline` passed. Production precache is 14 entries / **3,889.08 KiB**, under the PWA limit; the existing Vite chunk advisory remains. Save schema stays v21. Physical iPhone/iPad review, main integration and deployment remain pending.

**Fossil and depth validation (2026-10-05, preceding pass):**

- All **446 tests** passed (445 regular plus one performance test). The initial default run hit five existing 5-second timing limits (scenario generation, challenge setup/balance, long event simulation and music decoding); the complete rerun with `--testTimeout=30000` passed all assertions without changing timeout configuration. All five initially timed-out cases then passed at their original default limit in a 2.41-second targeted run. The separate strict performance check measured **0.454 ms average / 2.59 ms p99** per movement step in the 30-dinosaur / 150-visitor park.
- The production build passed with 14 precache entries / **3,887.19 KiB**, under the PWA limit; the existing Vite chunk advisory remains. No Blender sources, generated grids or animation frames changed.
- New simulation cases verify a first bone keeps each of the 22 non-starter species locked and a second bone unlocks it exactly once. Older v21 saves retain bone counts, unlock completed species immediately, preserve one-bone progress and round-trip without duplicates. A pending collector offer in an old save keeps the completed unlock and displays accurate text.
- Seven depth regressions cover consistent people/object anchors, end-on fence ordering, local dinosaur preference, broken/distant fences, lifted flyers/babies, crossing side walls and off-map silhouettes.
- `check:fossil-depth` verifies all 28 fossil silhouettes fit the canvas and skipping preserves credited progress. At 667×375, 844×390 and 820×1180, about 80% uncovered still allows brushing and completion happens near 95%; pause and the selected speed are restored correctly. Runtime checks cover **672** species/baby/direction/fence-type combinations, owner/prop depth parity and graphics cleanup. Comparison captures are ignored at `docs/art-review/fence-depth-before.png`, `fence-depth-after.png` and `fossil-more-brushing.png`.
- Final `art:integration` passed catalog/guide/fossil/palette parity, all 28 species' eight walking phases in both directions, pause and adult/baby shadows, plus phone/tablet catalogs and the expansion gallery. `art:motion-controls` passed four mobile settings layouts, paused positions and meal-cue cleanup. `art:offline` passed production startup, service-worker control, all 28 parade images and populated v21 save/resume with continuing animation. Physical device review and deployment remain pending.

**Pacing validation (2026-10-05, preceding pass):**

- All **415 tests** passed (414 regular plus one performance test). Nine additional clock cases cover nighttime multipliers at all selected speeds, pause/resume, within-frame dusk/dawn transitions, background-tab clamping, midnight rollover, complete-day timing and state parity with direct movement/hourly steps.
- `npm run check:pacing` sweeps the full parade loop and seam at 390×844, 667×375, 844×390, 820×1180 and 7680×1080. All 28 unique species retain at least 48px between image bounds, a matching loop, rightward 30px/s motion and no page overflow. Reduced motion stops the parade. The playable park check verifies synchronized 3× night clocks, pause, dawn and the mobile HUD. The phone capture is ignored at `docs/art-review/parade-spaced-phone.png`.
- The final production build passed (14 precache entries / 3,885.35 KiB; existing Vite chunk advisory). `art:motion-controls` passed paused-position, meal-cue cleanup and animation settings across four mobile layouts. `art:offline` passed the new parade artwork, production dev-hook stripping, service-worker control and populated v21 save/resume with continuing offline animation. Physical iPhone/iPad review and deployment remain pending.

**Reference review validation (2026-10-05, preceding pass):**

- Regenerated all 28 canonical source sets and all 112 motion timelines; retained the original binaries for the two unchanged canonical models and seven unchanged clips. The final canonical set still has 224 grids; motion still has 896 frames. Both converters pass attachment, face, hashes and ground-contact validation.
- Blender MCP inspected all 28 final models at unit pixel scale. MCP rerenders reproduced the revised Stegosaurus and Tyrannosaurus canonical hashes, the saved Pteranodon resting frame and the final Iguanodon grazing frame. New cheek meshes follow the skull through neck rotations. A separate saved-source audit verified all 112 timelines have the correct orthographic camera/dimensions and nine animated shape keys per mesh.
- All **406 tests** passed (405 regular plus one performance test), and the production build passed. New tests protect all 24 land species' original world toe anchors and unclipped side edges across the 24 expanded canvases. Integration now checks adult/baby shadows for all 24 land species, alongside catalog/guide/fossil/palette parity and phone/tablet layouts.
- Final `art:park-motion` passed: 1,792 adult/baby atlas frames, 896 walking/baby/facing combinations and 3,584 review combinations, feeding/rest/pause behavior, reduced motion and mobile layouts. Texture caches stayed bounded. The final software-rendered Chrome sweep measured p95 frame times of about 133 / 167 ms with ambient animation off/on; an earlier sweep measured about 117 ms for both. These desktop software measurements do not establish physical Safari performance.
- Final build files total **691,033 bytes gzipped**; PWA precache is 14 files / **3,884.48 KiB**, under its 5 MiB limit. Motion sources total 12,657,257 bytes and remain excluded from the shipped build. The existing Vite chunk advisory remains. Save schema remains v21; this is local graphics-branch work pending physical device review and integration/deployment.
- Final `art:offline` passed: production art, service-worker control, populated v21 save/resume and continuing animation after offline restart. `art:immersion` also passed for the three-animal prototype, including phone/iPad layout, untouched storage and reduced motion.
- Same-scale before/after artwork: `docs/art-review/reference-before-after.png`. All 28 model/picture sheets, downloaded reference images and Blender inspection reports are ignored under `docs/art-review/`. Research pictures are not shipped game assets. Review at http://localhost:5173/scripts/art/review.html.

**Tail correction validation (2026-10-05, preceding pass):**

- Corrected the four requested models: canonical widths are now 94 / 128 / 110 / 88 pixels for Stegosaurus / Spinosaurus / Brachiosaurus / Kentrosaurus, with model offsets 18 / 26 / 22 / 18. Heights and geometry scale remain the same. Both authoring paths shift accessory roots along with meshes. Canvas-relative contact coordinates change, while world-relative contacts retain their previous positions (maximum 0.001 pixel rounding difference across 128 frame comparisons). Save schema remains v21.
- Eight new regression tests cover exposed tail length, ground clearance, unclipped edges across all **144 canonical/animated poses**, and original foot positions. Canonical footprint tests now account explicitly for the additional canvas room.
- Blender MCP inspected the four native models, confirmed unit pixel scale, and rerendered the saved Stegosaurus resting timeline; its longer tail and four bound spike meshes reproduced the export hash. Both converters validate all 224 canonical grids and 896 motion frames.
- All **358 tests** passed (357 regular plus one performance test), along with the production build. The first concurrent build/test run hit a simulation-test timeout; the standalone rerun and the final suite passed without changing simulation code. All other canonical art and the **768 motion frames** outside these four species retain their previous pixels and contact data.
- Full atlas/runtime/review checks passed: 1,792 adult/baby atlas frames, 896 runtime walking combinations and 3,584 animated gallery combinations. After adjusting shadow sizing, `art:integration` passed again, including the eight adult/baby shadow cases, catalog/guide/fossil/palette parity, all canonical expansion poses and phone/tablet layouts.
- Final build files total **686,123 bytes gzipped**, with 14 PWA precache files / 3,500.48 KiB. Sources remain outside the shipped game. The existing Vite chunk advisory remains.
- Final `art:offline` passed: production art, service-worker control, populated v21 save/resume and continuing animation after offline restart.
- Same-scale before/after captures are ignored at `docs/art-review/long-tails-before-after.png`; reference links and the offset workflow are in [assets-source/README.md](assets-source/README.md). Review at `http://localhost:5173/scripts/art/review.html?asset=stegosaurus`. This remains local graphics-branch work; physical device review and integration/deployment remain pending.

**Anatomy correction validation (2026-10-05, preceding pass):**

- Twelve canonical dinosaur models were corrected: Velociraptor, Stegosaurus, Ankylosaurus, Therizinosaurus, Iguanodon, Microraptor, Kentrosaurus, Styracosaurus, Amargasaurus, Diplodocus, Argentinosaurus and Yutyrannus. Spinosaurus also received a snout-detail animation binding correction. The shared rest/idle deformation and tail-root rules apply throughout the roster.
- Regenerated the affected canonical poses and sources, plus all **896 motion frames / 112 editable timelines**. Canonical dimensions, walking contact metadata and save schema v21 remain unchanged. All 224 canonical grids and 896 motion frames pass hash, face, ground-contact and the new native-silhouette attachment checks. Five regression fixtures cover detached claws, distant tiny spines, diagonal joins, thin raster tips and row boundaries.
- All **350 existing tests**, the five anatomy fixtures and the production build passed. Blender audited all 112 saved timelines for nine shape-key blocks per mesh, animation actions, orthographic cameras and accessory bindings. MCP loaded the saved Amargasaurus eating model, verified its 24 neck-bound spine meshes, and reproduced the corrected grazing frame's hash.
- `art:park-motion` and `art:integration` passed: **1,792 adult/baby atlas frames**, **896 runtime walk/baby/facing combinations**, **3,584 animated review combinations**, all canonical expansion poses, catalog/guide/fossil/palette parity, feeding/rest/pause and phone/tablet layouts. The 30-dinosaur / 150-visitor dusk check kept both texture caches bounded; p95 frame time was about 116.7 ms with ambient animation both off and on in software-rendered Chrome.
- `art:offline` passed with the rebuilt production art: service-worker control, v21 save/resume, the updated menu art and continuing animation in a populated park after offline restart.
- Build files total **683,897 bytes gzipped**; PWA precache is 14 files / 3,394.80 KiB. The existing Vite chunk-size advisory remains. Before/after sheets and the source audit are ignored under `docs/art-review/`.
- Review at `http://localhost:5173/scripts/art/review.html`; choose the eating and resting clips as well as walking. Physical iPhone/iPad review, main integration and deployment remain pending.

**Full park animation validation (2026-10-04):**

- All **350 tests** passed (349 regular plus one performance test); production build, canonical `art:check` and full-roster `art:motion:check` passed.
- `art:park-motion` passed: all **1,792 adult/baby atlas frames**, **896 runtime walk/frame/baby/facing combinations**, actual feeding, nighttime rest, pause, fixed wind roots, bounded texture caches, mobile layout, reduced-motion defaults and **3,584** review combinations. The review page adds 28 animated gallery cards while retaining the twelve-species canonical gallery.
- The enclosure demo (`art:immersion`), expanded art integration, environment review and all **13 UI tours** passed. `art:motion-controls` verifies paused position lookup, meal-cue cleanup for animals disappearing before their first frame, and settings at 390×844, 667×375, 844×390 and 820×1180. The existing portrait rotate hint remains.
- Final `art:offline` passed with a populated 30-dinosaur v21 park, offline resume and continuing animation. Production dev hooks remain stripped.
- Blender MCP audited all **112** saved source scenes: every mesh has nine shape-key blocks and an animation action, with an orthographic camera. MCP rerendered 24 frames from saved Nigersaurus eat / Pteranodon rest / Mosasaurus walk sources; all hashes matched the bulk export. The exporter reports zero failed clips.
- Matched headless Chrome, 844×390 daytime, 32 dinosaurs / 150 visitors: **50.1 ms p95 frame time** for both original and animated Blender; entity update 1.5 / 1.6 ms, startup 5,554 / 6,812 ms in one captured run. A separate 1000×650 dusk run with 30 dinosaurs / 150 visitors measured **116.8 ms p95** with ambient movement both off and on, entity update 1.3 / 1.4 ms. These are software-rendered iMac measurements, not physical Safari results; the larger dusk run is not comparable to the smaller daytime run.
- Final gzipped build files total **701,060 bytes** (+96,610 versus the prototype); the main chunk is about 3.24 MB and remains under the 5 MiB PWA precache limit. Vite's existing 2,000 kB chunk advisory remains. Animation rows are deduplicated and textures are lazy per species/appearance; caches and particles are bounded.
- Current sources and regeneration: [docs/PLAN-animation-immersion.md](docs/PLAN-animation-immersion.md). Current local PR draft: [docs/PR-blender-park-immersion.md](docs/PR-blender-park-immersion.md). Captures, metrics and source audits remain ignored under `docs/art-review/`. Physical iPhone/iPad review, main integration and deployment remain pending.

**Twelve-species expansion:** Spinosaurus, Therizinosaurus, Amargasaurus, Kentrosaurus, Styracosaurus, Carnotaurus, Yutyrannus, Iguanodon, Microraptor, Diplodocus, Argentinosaurus and Nigersaurus. `EXPANSION_SPECIES_IDS` groups them in the registry and review gallery; `scripts/art/expansion_models.py` authors their four walking poses. They have catalog/guide entries, sounds, baby/fossil art and campaign fossil unlocks. New Sandbox parks unlock all 28; existing saved unlock lists and the six starters are preserved. Spinosaurus uses a land paddock and fish feeder; Microraptor is shown walking with folded feathers. New species have only Blender art, including in original-style comparison parks, and show one review panel. Direct preview: `http://localhost:5173/scripts/art/review.html?asset=spinosaurus#new-dinosaurs`.

**Latest expansion validation:** 288 regular tests plus one performance test (289 total), regular production build, `art:check`, expanded `art:integration`, all 13 UI tours and production `art:offline` passed. The overlap tour was rerun after fixing its disposable Chrome shutdown; it now exits nonzero for layout issues and bounds cleanup to ten seconds. All 48 new frame hashes reproduced through MCP; the preceding 176 grids were unchanged. Gallery checks cover all twelve × four poses × baby/adult × both directions, selection links, animation and phone access to the largest sprite. Build files total 604,389 gzipped bytes (+9,202 versus the environment pass). Source models stay outside the precached build. Vite's 2,000 kB chunk advisory now appears; the main chunk is within the configured 5 MiB PWA limit and offline resume passed. The current local PR draft, roster and facts references are [docs/PR-blender-dinosaur-expansion.md](docs/PR-blender-dinosaur-expansion.md).

Blender export batches can finish writing after an MCP transport timeout. Use one new species per call, and check render/source timestamps and hashes before repeating an export. The final expansion rerender completed despite batch response timeouts; all twelve source files and all 48 renders were confirmed newer than the captured hash baseline and identical to it.

**Historical environment validation for `843f5d7`:**

- `npm test`: 272 tests plus the separate performance test, **273 total**, passed. `npm run build` passed.
- `art:check`: all 176 grids passed; all 102 new environment grid hashes reproduced through Blender MCP, and the preceding 74 grids were unchanged.
- `art:environment`, `art:integration`, all 13 `art:ui` tours and `art:offline` passed. These cover scenery/terrain textures, tree fading and construction restoration, dinosaur poses and facing, babies, catalogs, phone/iPad layout and production PWA offline save/resume.
- An isolated 32-dinosaur/150-visitor comparison measured p95 frame time **50.1 ms** and entity update time **1.3 ms** for both styles. Startup was 3,027 ms original / 3,223 ms Blender in one run. This used headless Chrome software rendering on the iMac; physical Safari performance remains unmeasured.
- Total gzipped build files: **595,187 bytes**, up 8,276 bytes from the dinosaur/building pass and 19,730 bytes from before the pilot. Review images, logs and metrics are local ignored artifacts under `docs/art-review/`.

Run browser tours and performance comparisons sequentially on this machine to avoid contention. `npm run build:art` is available for a comparison-capable preview build, but it was not rerun for the latest expansion; the regular production build was verified.

**Remaining:** physical iPhone/iPad visual and performance review, then integration with `main` and deployment. No remote PR or deployment has been published. [docs/PLAN-blender-pixel-art.md](docs/PLAN-blender-pixel-art.md) tracks the work; [docs/PR-blender-dinosaur-expansion.md](docs/PR-blender-dinosaur-expansion.md) is the current local PR draft. [docs/PR-blender-environment.md](docs/PR-blender-environment.md) records the preceding environment pass. The earlier [docs/PR-blender-pixel-art.md](docs/PR-blender-pixel-art.md) describes the dinosaur/building pass and has historical validation counts.

## Day-to-day

```sh
npm run dev            # dev server (usually already running on :5173); /?quickstart skips the menu
npm test               # 475 tests + 1 separate performance test (476 total)
npm run build          # tsc --noEmit + vite build
npm run icons          # regenerate Home Screen icons (dev server must be running)
node scripts/checks/<name>.mjs   # browser checks (headless Chrome via puppeteer-core); see below
```

**Deploy:** push to `main` and GitHub Actions tests, builds and deploys to Pages in about 45 s. Plain `git push` has no credential helper here, so push with:

```sh
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q origin main
gh run list -R jessesiminitz/dino-tycoon --limit 1      # then gh run watch <id>
```

End commit messages with the Co-Authored-By / Claude-Session trailers the harness supplies. Normally commit and deploy after each round of changes: the owner tests on the live site. The current graphics branch remains local pending the device review and integration described above; do not deploy a handoff-only update.

**Dev hooks** (dev builds only): `window.__dino = { game, sim, ui, slot, audioDebug, playSfx }`. `/?quickstart` starts a fresh park (`&shape=river&seed=7&big` picks the island). Challenge checks start parks through the menu and set `localStorage['dino-tycoon-challenges']` to unlock them.

## Architecture (see README for the overview)

- `src/sim/`: pure TS game rules, no Phaser. One serializable `GameState` (`GameState.ts`), a fixed-timestep `Simulation` (`Simulation.ts`), and commands via `sim.dispatch(cmd)` → `commands.ts` `applyCommand`. Seeded RNG (`rng.ts`; `hash2` gives stateless variation).
  - **Time:** `MS_PER_HOUR = 10_000` in daytime; `NIGHT_SPEED_MULTIPLIER = 3` during `isNight` (21:00–05:00). A full day is about 3m 7s at selected 1×. `STEPS_PER_HOUR = 16` (in `systems/dinos.ts`). Selected speeds are `0 | 1 | 3 | 8`; `sim.effectiveSpeed` includes nighttime acceleration and is zero when paused. `advance()` splits elapsed time at movement boundaries so rate changes do not skip steps or charge the whole frame at the wrong rate. Direct `step()` behavior remains unchanged. Per-step odds that were tuned at 4 steps/hour go through `perStep()`; staff `WORK_STEPS` are in 16ths of an hour.
  - Step systems: dinos, escapes, visitors, staff. Hourly: dinos (hunger, happiness, **droppings**), health, fences, events, visitors (needs, thoughts, accidents, litter warnings), fossils, economy, scenario.
  - Regions come from a flood fill over fences (`regions.ts`: public, paddock or wild). `gaps.ts` finds missing or broken fence segments around a tapped tile.
  - `concerns.ts`: live dino and staff concerns, plus `whatVisitorsSay` (complaints with advice).
  - `goals.ts`: three rounds of milestones per scenario (Bronze, Silver, Gold) with rewards (species unlocks, or cash if already unlocked).
- `src/render/`: `ParkScene` (input, selection, gap-fix offer, camera focus), `EntityLayer` (dinos, visitors with carried items, staff, buildings, dirt), `WorldLayers` (fences, paths, ghost and gap markers), `SceneryLayer`, `TerrainFx`, `WeatherScene`. `dinoArt.ts` paints all 28 species, with Blender grids as the default and original shapes retained for comparison. `sceneryArt.ts` paints buildings and scenery; `terrainArt.ts` supplies terrain tiles to `tileset.ts`. `generated/` holds the exported artwork, and `artStyle.ts` controls comparison mode. `iconArt.ts` paints the Home Screen icon.
- `src/ui/`: DOM overlays. `hud.ts` (top bar with a live **fit pass** so ☰ is never pushed off-screen; the info panel is placed by measuring the toolbar), `people.ts` (👥 Visitors, Reviews, Dinos and Staff with filters, rename and 📍 locate), `log.ts` (🔔 alert log), `parkPanel.ts` (Goals medal track, overview, staff, finances, bank), `overlays.ts` (pause, milestone and outcome popups, update banner), `menu.ts` (title, scenarios, save slots with ⤓ export and import), `tutorial.ts`, `guide.ts`, `catalog.ts`, `settings.ts`.
- `src/audio/`: `audio.ts` (sfx, rain, piano synth, shuffled playlist), `ragNotes.ts` (decoder and alphabet), `rags.ts` (generated, lazy-loaded chunk).
- `src/save/storage.ts`: 3 IndexedDB slots plus a localStorage mirror, and a boot directive (used to return to the park after an update reload).

### Save format: **v21**

Always bump `SAVE_VERSION` and add a step to `migrate()` when the state shape changes, then update the version assertions in the tests (`grep -rn "toBe(21)" tests`: babies, care, choices, dinos, island, mess, requests, rides, visitorlife). Recent steps:
- v10 added the log.
- v11 added visitor names, thoughts and thirst, soda and snack fields, plus `messes` and `reviews`.
- v12 added scenario `round`, `roundStart` and `earned`. Saves that had already won carry on into Silver.
- v13 added `Dino.baby`, `eggs` and `stats.hatched`.
- v14 added `Dino.lastTreatHour`, `Dino.lastPatHour` and `stats.photos`, plus the `treats` expense category.
- v15 added `requests` and `stats.requestsDone`.
- v16 added `tracks`, `jeeps`, and `Visitor.rode` and `Visitor.riding`, plus the `rides` income category.
- v17 added `pendingChoice` and `stats.closedDay`.
- v18 added `map.heights` (0–15) and `map.shape`. Old maps get heights from `DEFAULT_HEIGHT`.
- v19 added `Dino.huntRestUntil`, `scenario.briefed`, `scenario.timeline`, and `stats.profitStreak`, `lastEscapeHour` and `dinosLost`.
- v20 added `eruption` (Fire Mountain).
- v21 added `flood` (Flood Season).

## Features in place (all deployed)

- **Core:** land parcels, drag-to-build fences (6 types including aviary net and sandbags; wear, repair), paddocks, 16 species (land, lagoon and aviary) (6 starters, the rest from fossil digs on visible fossil beds), feeders, hunger and hunting, escapes and guards, disease and vets, storms, volcano rumbles, inspections, school trips, loans and ledger, monthly reports.
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
  - All fossil-locked species need two bones. Saves with existing counts of at least two honor the unlock immediately; partial progress stays intact.
  - The pit is a 128×96 pixel canvas: the species' full silhouette fitted into the pit as bone in dirt, under dithered sand. A finger brush clears the sand, and 95% of the fossil uncovered triggers the reveal with sparkles and a caption.
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

- Pacing: keep daytime at 10 real seconds per game hour at 1×, with 3× and 8× available. On 2026-10-05 the owner requested faster nights; 21:00–05:00 now receives an automatic additional 3× boost, for a full day of about 3m 7s at selected 1×.
- Fossils: the owner requested two bones per unlockable dinosaur and more time brushing. Use the shared two-bone target and 95% uncovering threshold; honor existing earned bones when loading parks.
- Dinosaur size: the daughter misses the little Compsognathus. Preserve the small/medium/giant hierarchy in both the park and parade, readable eyes and generous touch targets for tiny adults/babies.
- Fence visibility: people and their carried objects should agree about walls. Keep dinosaur feet at their normal ground depth and soften only the obscuring fence sections; whole-sprite priority made dinosaurs appear to stand on walls. Restore opaque fences when animals move away.
- Keep the game kid-friendly. Mess and pee/poop jokes are wanted but mild; cleanliness should not dominate.
- Wants more depth: richer menus, milestones with unlock rewards, visible items, lively visitors.
- Art should evoke classic DinoPark Tycoon (VGA palette, bevelled UI, 3/4 view), with good dino likeness.
- UI theme is "Tropical lagoon" (chosen by the owner 2026-09-28): sea-green panels, deep teal title bars with yellow lettering, coral buttons, VT323 font. Colours are CSS variables at the top of `src/ui/style.css`; other candidate themes and `preview.mjs` are in `scripts/checks/themes/`.
- Owner feedback 2026-09-28: top buttons were too small and his daughter couldn't find things, which led to the labelled top bar and picture build screens. Keep menus simple, labelled and the same size.
- Recurring bug class: UI clashes on small or notched iPhones. Always check phone sizes (see `scripts/checks/hud-check.mjs`, `info-overlap.mjs`, `overflow-check.mjs`) after touching the HUD, toasts or panels.
- The rain volume was too loud before; it's now `RAIN_VOLUME = 0.045`.

## Browser checks (`scripts/checks/`)

Headless Chrome against the dev server (`http://localhost:5173`), using `puppeteer-core` (a dev dependency) and the installed Google Chrome. Screenshots land next to each script (git-ignored).

Shared helpers are in `scripts/checks/lib.mjs`: `HERE` (the folder as a real path, safe with spaces), `ready(page)` (waits for a `?quickstart` park), `shopPick(page, mode, id)` (opens a tool's picture shop and picks an item), `toScreen(page, x, y)`, `check(label, ok, detail)` and `finish(errors)`. **Every check exits non-zero on a page error or a failed `check()`**, so a run's exit code means something. New checks should use these, and assert results with `check()` rather than only printing them. To tap something on the map, centre the camera on it first: the info panel covers the bottom of the screen.

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
| `shaped-buildings.mjs` | the building sprites, enlarged |
| `dino-gallery.mjs` | all species, both walk frames, at 4× |
| `island-gallery.mjs [n] [big]`, `islands-ui.mjs`, `terrain-closeups.mjs`, `big-island-perf.mjs` | island shapes, the picker, new terrain, big-island speed |
| `fixes-check.mjs` | top buttons light only while their panel is open; one-drag fence box |
| `challenges-ui.mjs`, `tracker-overlap.mjs` | challenge folders, story card, goal tracker (vs. tutorial and HUD), money report |
| `fire-ui.mjs [WxH]`, `flood-ui.mjs [WxH]` | Fire Mountain and Flood Season from the menu to the disaster and after |
| `icon-preview.mjs` | icon at full size, real size and maskable |
| `items-check.mjs` | carried items, pee and poop, litter, dung, janitor, trash can |
| `log-check.mjs`, `rag-check.mjs`, `repro-place.mjs` | alert log, music playback, build a paddock, feeder and dino by touch, and delete paths |
| `pause-check.mjs` | popups keep a paused park paused; overlapping popups resume only when both close |
| `seasons-check.mjs` | the year in screenshots (thaw, blossom, summer, fall colour, first snow, winter), the Season scenery switch, and an enlarged plant gallery |
| `port-check.mjs` | jetty, pier and harbor with ferries arriving, docked and landing passengers, the night mooring, and tapping the pier into the Port tab to upgrade |
| `care-check.mjs`, `habitats-check.mjs`, `attractions-check.mjs` | treat, pat ("Nope!") and photo; lagoon, aviary and dragging a pond; safari and the Paths shop |

Scripts that step the sim by hand should use 16 steps per game-hour.

## Roadmaps

- `docs/ROADMAP.md`: the ten fun and engagement features, all done (2026-09-28).
- `docs/PLAN-challenges.md`: islands, challenges and disasters. Phases 1–3 are done; Phase 4 (Staff Strike) is next. It also records the owner's decisions: challenges unlock in order, meat-eaters may rarely catch prey (leaving a fossil), and big islands are fine for challenges.

## Other ideas not done yet (ask before starting)

- Milestone M8 from the original plan: an App Store build (Capacitor plus a cloud macOS build). It needs an Apple Developer account.
- Scenario deadlines are counted in game days and can take a while in real time (First Steps Bronze is 45 days, about 2h 20m at selected 1× with the new nighttime boost). Offered to shorten the deadlines themselves; no answer yet.
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
  - **Silver:** every fence in good repair and 14 dinos, within 20 days. That means rebuilding the burned upper paddocks and restocking.
  - **Gold:** 22 dinos and an allosaurus (Silver's reward), within 40 days. That needs an electric-fenced meat paddock, and more land: the park only owns a thin strip round its four paddocks.
  - **Rebalanced 2026-10-01:** the old Silver and Gold goals were met before the player did anything. "Visitors in a day" counts the best day ever, the prebuilt park had 265 on day 2, and reputation sits at 85–100. Money is deliberately not the constraint: income is about $10k a day.
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
- **Tests:** `tests/eruption.test.ts`, plus a Fire Mountain case in `tests/challengeBalance.test.ts`, which plays three ways:
  - doing nothing loses dinos
  - evacuating only earns exactly Bronze
  - sensible play wins Gold by about day 11: rebuild, repair, allosaurus paddock, then buy land for new paddocks (`buyRoomy`, `newPaddock`, `buyLand`)
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

## Bug-audit fixes (2026-09-30)

An outside audit (`docs/BUG_AUDIT-2026-09-30.md`, evidence in `docs/bug-audit-2026-09-30/`) found B01–B12; all are fixed, with regression tests in `tests/auditFixes.test.ts`.
- **B01 save files:** `migrate()` now catches upgrade errors and runs `stateProblem()` (map size, required arrays and objects, known scenario and species, finite numbers). Damaged imports get "damaged or incomplete"; bad slots read as empty instead of crashing.
- **B02 tracks:** `tileOccupant()` counts a jeep track, so paths, buildings, feeders, decor and ponds can't go on one.
- **B03 moving dinos:** `moveDino` clears paths inside the new paddock like `buyDino` (shared `clearPaddockPaths`); dinosaurs can't be put on a building tile.
- **B04 fence repair %:** broken sections count as needing repair.
- **B05/B11 flood rot:** each wet fence edge rots once per hour; a fence that rots through calls `invalidateWorld()`; wet-tile changes are compared tile by tile, not just by count.
- **B06 safaris:** `onTrack` excludes flooded track; while any track is wet the safari is closed (`safariFlooded`): no boarding, parked riders get off, the station says why.
- **B07 medals vs losses:** `fatalLoss()` (bankruptcy, `loseIf`) blocks medals at any hour; the game still ends at midnight. The deadline is unchanged: meeting goals in the last hour still counts.
- **B08–B10 pausing:** every pausing popup (☰, decision, outcome, dig, briefing) uses `holdPause`/`releasePause` in `src/ui/pause.ts`: the park stays paused until the last popup closes, then returns to its earlier speed (still paused if the player paused). Also fixed: the ☰ button used to set the speed to NaN (it has `.speed-btn` but no `data-speed`). Check: `scripts/checks/pause-check.mjs` (exits non-zero on failure).
- **B12 (owner decision: selling is not rescuing):** escaped dinosaurs can't be sold ("bring it home first"), so the Great Escape rescue medal needs real recaptures.
- The audit's test-script problems are fixed too: shared `lib.mjs` (real paths, waits for the park, exit codes), shop-based selectors, current unlock and visitor fixtures, named shop sheets in `sheet-scroll`, and assertions in `care-check`, `repro-place`, `habitats-check`, `attractions-check`, `challenges-ui` and `sheet-scroll`. The balance tests now require a **Gold win** for Fire Mountain (sensible play rebuilds the paddocks the lava burned) and Flood Season.

## Economy rebalance (2026-10-01)

The owner found money too easy to pile up and chose a **"moderate"** squeeze. Measured on a tidy standard park at fair prices (`tests/economyBalance.test.ts`, which guards the curve):

| Park | Net profit per day, before | After |
| --- | --- | --- |
| 4 dinos | ~$3.4k | ~$2.2k |
| 16 dinos | ~$10.5k | ~$4.8k |
| 40 dinos | ~$28k | ~$11k (best case: reputation ~90, few staff) |

Earning back a whole park's cost now takes 20–40 days, against 9–13 before.
- **Why it snowballed:** the fair ticket price was `8 + 0.6 × appeal` with no ceiling, while visitors are capped at 150 in the park at once (about 330 a day). Running costs were only 5–10% of income.
- **Fair price** is now `5 + 2.2 × √appeal`: about $16 at 4 dinos, $24 at 16, $32 at 40. The square root, rather than a log, keeps each extra dinosaur earning slightly more than it eats once the visitor cap is reached. With a log curve, big parks lost money on every new dino.
- **Running costs:**
  - wages ×2.5: worker $150, guard $200, vet $250, janitor $100, guide $125, mascot $110
  - building upkeep ×2 (dig site unchanged)
  - feed per unit: plants $5, meat $10, fish $9 (was $3 / $6 / $5)
- **Prizes halved:** request rewards and the inspection award ($1,000). Fines are unchanged.
- **Default ticket** is now $15, so new parks don't start overpriced.
- **Cash goals are unchanged.** The deadlines (90–200 days) still leave room at the new profit rates. Money Pit's balance run clears its debt by about day 70 and reaches $250k around day 105.
- **Tests made robust along the way:**
  - the babies month now has a vet, so a chance illness can't leave a lone parent
  - the school-trip balloon test counts kids' first picks over 12 trips
