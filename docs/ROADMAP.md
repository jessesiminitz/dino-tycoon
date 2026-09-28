# Roadmap: making Dino Tycoon more fun

Agreed with the owner on 2026-09-27: build these ten features **in this order**. They're numbered as in the original suggestion list; #4 (relaxed mode) and #12 (welcome-back summary) were left out on purpose.

Each feature ships as its own release:
1. Build it.
2. Add or update Vitest tests.
3. Run `npm test` and `npm run build`.
4. Run the phone and iPad checks in `scripts/checks/` (add a new check for any new UI).
5. Commit and push to `main` (auto-deploys).
6. Tick it off here.

State-shape changes bump `SAVE_VERSION` (currently 16) with a `migrate()` step. Keep everything kid-friendly and all art original: we paint our own animals in code and imitate no film or franchise designs.

| # | Feature | Size | Save bump | Status |
|---|---------|------|-----------|--------|
| 1 | Baby dinosaurs (eggs, hatching, growing up) | L | v13 | ✅ 2026-09-27 |
| 2 | Tap a dino: treats, pats and 📷 photos | M | v14 (tiny) | ✅ 2026-09-28 |
| 3 | Park requests: short daily goals | M | v15 | ✅ 2026-09-28 |
| 5 | Fossil dig mini-game | M | none | ✅ 2026-09-28 |
| 6 | New habitats: lagoon and aviary, with 4 new species | XL | none | ✅ 2026-09-28 |
| 7 | Attractions: jeep safari, viewing tower, petting area | L | v16 | ✅ 2026-09-28 |
| 8 | Sticker book and trophy room | M | v18 | ☐ |
| 9 | Day and night | M | none | ☐ |
| 10 | Events with choices | M | v19 | ☐ |
| 11 | More sound: species calls, cheers, splashes | S–M | none | ☐ |

Sizes: S is under half a session, M one session, L one to two, XL two to three. Stickers (#8) come after babies, habitats and attractions, so they have more to collect. Day and night (#9) and sound (#11) touch everything, so they go late.

---

## 1. Baby dinosaurs

**For players:** happy pairs of the same species lay an egg in their paddock. It hatches a few days later into a small, bouncy baby, which grows into an adult over about a week. Babies are big crowd-pleasers.

**Sim**
- Add `Dino.bornHour` (it already exists) and `Dino.stage: 'egg' | 'baby' | 'adult'`. Alternatively, store eggs in a separate `eggs: Egg[]` list; the separate list is simpler, since eggs don't move, eat or escape.
- **Laying (hourly):** in a paddock with at least one pair of the same species, both animals with happiness ≥ 75, hunger < 50, and not crowded (the space check from `hourlyDinos`). Chance about 1 in 48 per qualifying pair per hour, so roughly every other day.
- **Limits:** one egg per paddock at a time, and a park-wide cap: babies plus eggs ≤ 25% of adults, or 4, whichever is higher.
- **Hatching:** after 48 h the egg becomes a baby `Dino` with `stage: 'baby'`, a new name, full health and hunger 20. Emit "🥚 A baby Triceratops hatched! Say hello to Pip."
- **Babies:** eat half a meal, need no fence strength (predators still can), give extra visitor appeal (×1.5 for their species while any baby is present) and a visitor thought ("Aww, a baby Stegosaurus!"). They grow up after 7 game days.
- A carnivore that can eat the adult can also eat the baby. That's a real reason to keep species apart.
- **Selling:** babies can't be sold until grown. Eggs can be moved? No: keep it simple and leave them in place.

**Render**
- **Eggs:** speckled egg sprites in the species' accent colour, wobbling for the last 6 h.
- **Babies:** the adult sprite at about 60% size, with a bigger head and eyes. Add a `baby` variant to `dinoArt.ts` that paints the species with shortened proportions and a scale factor. They should hop between tiles.

**UI**
- The 👥 Dinos tab shows babies (with an "age" line) and eggs ("Hatches in 1 day").
- A 🥚 filter.
- The Dino Guide notes that the species can breed.

**Tests:** laying conditions and caps, hatching timing, growth, predators eating babies, migration.

**Checks:** a new `babies-check.mjs` screenshot of an egg, a hatching and a baby next to an adult.

## 2. Tap a dino: treats, pats and photos

**For players:** tapping a dino opens a small card with three actions:
- 🍖 **Give a treat** ($25; +10 happiness, hearts). Limited to once per dino per game-hour.
- ✋ **Pat** (free; hearts, a little happiness if it's calm). Carnivores that are hungry snap instead, with a comic "Nope!".
- 📷 **Photo**: a framed snapshot saved to Photos or shared.

**Sim:** add commands `treatDino` and `patDino` with a per-dino cooldown (`lastTreatHour`, which is the tiny save bump). Treats show up in the ledger under "Dino treats".

**Render and UI**
- Heart particles and a happy hop.
- The info bar for a selected dino gains the three buttons, next to Sell.
- **Photo:** render the camera's current view (cropped around the dino) to a canvas with a polaroid-style frame and caption ("Pip the Triceratops · Day 12"). Share it with `navigator.share({ files })` so iOS offers **Save Image**, and fall back to showing the image full-screen so it can be long-pressed and saved.
- The last few photos go into the sticker book later (#8).

**Sound:** a quick species-agnostic chirp for now; per-species calls come in #11.

**Tests:** cooldowns, cost, happiness caps, and the carnivore refusal.

**Checks:** the photo card on phone and iPad sizes. `navigator.share` is mocked in the check.

## 3. Park requests: short daily goals

**For players:** each in-game day brings up to 3 small requests, each with a timer and a reward. They give something to aim for in between the long milestones. Examples:
- "A school group wants to see a **Stegosaurus** before 15:00" (own one, near a path).
- "A food critic visits today: have **2 snack stalls** open".
- "Keep **every paddock's feeder** above half until dusk".
- "Welcome **60 visitors** today".
- "Get a **4-star review** today".
- "Take a **photo** of a baby dino" (ties into #1 and #2).

**Sim**
- Add `requests: Request[]` with `{ id, kind, target, species?, expiresHour, reward }`.
- A generator picks from templates, using only what's achievable in the current park (for example, only species already unlocked).
- Checked hourly. Fulfilled requests pay out (cash or reputation, sometimes a treat bundle) and log "✅ Request done".
- Missed requests just expire quietly, with no penalty.

**UI**
- A 📋 button in the top bar with a count badge. It must pass `hud-check.mjs`, and the fit pass may need a level 4.
- A panel with request cards: a progress bar, time left and the reward.
- A toast when a new request arrives.

**Tests:** the generator only offers feasible requests, progress and expiry, rewards, migration.

**Checks:** top-bar fit on all 7 iPhones, and the panel on phone and iPad.

## 5. Fossil dig mini-game

**For players:** when a dig site finds a fossil, instead of an instant toast you get a "🦴 Something's here!" card. Tap it to open a sand pit: drag your finger to brush sand away and reveal the bones. When enough is uncovered, it's identified ("Ankylosaurus skull fragment!").

**Sim:** no change to the odds.
- Finds already happen in `hourlyFossils`. Queue them in UI state (`pendingFinds`, not saved) and award them straight away as now, so nothing is lost if the player ignores them.
- The mini-game is presentation only.
- A setting skips it for anyone who wants instant finds.

**UI**
- A full-screen DOM canvas.
- A sand layer, erased with a soft brush under the finger.
- Underneath, a pixel-art bone silhouette generated from that species' sprite, drawn in bone colours as a "fossil" version.
- 70% uncovered completes it, with a sparkle and a chime.
- Works with touch and mouse, and has a Skip button.

**Tests:** the queue and award logic stay unchanged (existing fossil tests must still pass), and skipping awards the same.

**Checks:** the mini-game at phone and iPad sizes, with a simulated brush drag that completes it.

## 6. New habitats: lagoon and aviary

**For players:** two new kinds of enclosure and four new animals, unlocked by fossils and by milestone rewards:
- **Lagoon** (fenced water): **Plesiosaurus** (graceful, long neck) and **Mosasaurus** (big, needs strong fencing, eats fish). Visitors love watching from the shore.
- **Aviary** (a netted dome): **Pteranodon** (glides in circles) and **Dimorphodon** (small and noisy).

These are prehistoric reptiles, not dinosaurs; the Dino Guide explains the difference.

**Sim**
- Species gain `habitat: 'land' | 'water' | 'air'`.
- **Lagoon:** a paddock region that's mostly Pond or Shallows water. Build it by fencing water (fences on water edges are allowed for lagoons) or digging a pond with a new "Dig pond" tool.
- **Aviary:** a new building-like enclosure placed as a rectangle (for example 5×5), with net walls and "air" regions; flyers move freely inside.
- New feeders: a fish feeder for the lagoon, and the existing meat feeder in the aviary.
- **Escapes:** flyers get loose and swoop at visitors (mild); swimmers can't leave water, so their escapes are limited.
- Visitors see these animals across water from a distance, so the viewing radius on water is bigger.

**Render**
- Swimmers use a waterline sprite (body half-submerged, ripples).
- Flyers get their own flight-frame sprites and cast shadows on the ground.
- The aviary net is drawn as a lattice dome.

**UI:** a new "Habitats" tool section. The catalog shows each species' habitat, and gives a clear message if you try to put a swimmer on land.

**Tests:** region habitat detection, placement rules per habitat, flyer movement staying inside the aviary, balance of the new species.

**Checks:** a gallery of the new sprites, and lagoon and aviary screenshots.

**Open question for the owner:** confirm these 4 animals, or swap in others (for example Quetzalcoatlus, the giant flyer).

## 7. Attractions: jeep safari, viewing tower, petting area

**For players:** rides that visitors pay extra for.

- **Jeep safari:** lay a track with a new tool (like paths, but separate and allowed to run beside paddock fences). A station building sends jeeps round on a loop. Riders see every dino within range of the track, which gives a big satisfaction boost. Ticket about $8.
- **Viewing tower:** a tall building that raises the view radius to 8 tiles for visitors who climb it. Ticket $3.
- **Petting area:** a small paddock for gentle, small herbivores only (Protoceratops and babies). Kids get a big happiness boost; they need a keeper (a worker) nearby.

**Sim**
- The track is a new tile layer: `tracks: number[]`, pathfound like paths.
- Jeeps are entities that follow the track loop, carrying up to 4 visitors.
- Visitors choose a ride when they have money, interest and a queue that isn't too long.
- Tower and petting are simple radius or region effects.

**Render:** a jeep sprite with animated wheels and riders visible in it; the tower in 3/4 view with height; a petting-area fence style.

**Tests:** track loops (a broken loop means the station warns), riders board and leave, income appears in a new "rides" income category, petting-area species rules.

**Checks:** jeeps running, the tower and petting area placed on a phone screen.

## 8. Sticker book and trophy room

**For players:** a 📒 book of stickers to collect:
- one per species shown in the park
- one per species hatched as a baby
- every milestone medal
- request streaks
- the first photo, the first 5-star review, the first fossil dug by hand, the first jeep ride, and so on

Plus a trophy room showing medals from every scenario. The sticker book is **shared across all saves**, so collecting feels permanent.

**Storage**
- Stickers live outside `GameState`, in `localStorage` or IndexedDB under a `profile` key, with their own version and migration. They're exported alongside saves.
- The sim emits achievement events, and the UI records stickers in the profile.

**UI**
- Pages by category, with the sticker art painted from the sprites.
- A "NEW!" shine on fresh stickers, and a toast when one's earned.
- Locked stickers show as silhouettes with a hint.

**Tests:** achievement detection from sim events, and profile persistence and migration.

**Checks:** the book on phone and iPad sizes.

## 9. Day and night

**For players:** a gentle dusk-to-night-to-dawn cycle. Lamps glow on the paths, the sky tints, stars appear over the water, and dinos curl up and sleep at night (with Zzz). The park is open 08:00–20:00 already, so nights are quiet and good for tidying up.

**Render**
- A full-screen tint in `WeatherScene` from the clock: warm at dusk, deep blue at night.
- Light "holes" around lamps and buildings, drawn as additive soft circles, or a darkness overlay with the lit spots cut out.
- A new decor item, the **path lamp**.

**Sim:** a small change. Dinos move less at night (a lower wander chance) and show a sleeping state; nocturnal species (the raptors) stay active. There's no save change.

**Settings:** a "Night darkness" slider (0 turns night lighting off).

**Performance:** keep 60 fps on older iPhones; `perf-check` stays green.

**Checks:** screenshots at 06:00, 12:00, 19:00 and 23:00.

## 10. Events with choices

**For players:** now and then a card pops up with a decision. Examples:
- 📺 "A TV crew wants to film feeding time": Allow (+reputation; small chance the animal gets stressed) / Decline.
- 🎂 "A girl is visiting for her birthday: name a baby after her?": Yes (+happiness) / No.
- 🧪 "A scientist offers $5,000 to study your Allosaurus for a day": Accept (the dino is off display for a day) / Decline.
- 🌧️ "Storm warning: close the park early?": Close (lose today's tickets, but no storm unhappiness) / Stay open.
- 🦴 "A collector wants to buy your rarest fossil find": Sell (cash) / Keep (reputation).

**Sim**
- Add a `pendingChoice` to the state, holding the event id and its options.
- Choices resolve through a `chooseOption` command.
- Events are data-driven (`data/choices.ts`), each with conditions, odds and effects. Most effects reuse existing mechanics.
- The sim pauses at 1× while a choice is open? No: it keeps running, and the card waits (with a timeout and a default).

**UI:** the card uses the milestone popup styles and fits on the smallest phone. Each result is written to the alert log.

**Tests:** conditions, each option's effects, timeout defaults, migration.

**Checks:** the card at phone sizes.

## 11. More sound: species calls, cheers and splashes

**For players:** the park sounds alive:
- each species gets its own short call when tapped or when it roars (deep rumble, honk, chirp, bellow)
- cheering when a baby hatches or a medal is earned
- splashes and flaps from lagoon and aviary animals
- quiet ambient birdsong by day and crickets at night (if #9 is done)

**Audio:** everything is synthesised in `audio.ts`, with no files:
- per-species calls from a formant-style voice (oscillator plus band-pass sweeps) with parameters in the species data: pitch, length, roughness
- the crowd from filtered noise bursts
- volumes balanced against the ragtime and the (now quiet) rain
- an "Ambience" toggle in Settings

**Tests:** the parameters exist for every species. Browser `audio-check` confirms nodes are created and the volume stays under the music.

---

### Notes for whoever picks this up

- Read `HANDOFF.md` first, for conventions, deploy, preferences and checks.
- After each feature, update the table above and HANDOFF.md's feature list.
- If anything here turns out much bigger than planned, split it and check with the owner before cutting scope.
