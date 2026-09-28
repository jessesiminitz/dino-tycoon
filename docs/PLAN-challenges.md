# Plan: richer islands, prebuilt challenge parks, and a split New Game menu

Status: **approved** (2026-09-28). Phase 2 (islands) is done; Phase 1 (challenges) is next. Each phase ends with something playable and deployed.

## Where things stand

- **Islands** (`src/sim/terrain.ts`): one recipe. A round blob of noise with a beach ring, grass and forest, a mountain range, one volcano and a few ponds, always 64×48. No height is kept after generation, so floods or lava can't know which way is downhill.
- **Scenarios** (`src/sim/data/scenarios.ts`, `src/sim/goals.ts`): every scenario starts on an empty island. Each has three medal rounds, day deadlines, and 7 goal kinds (dinos, species, visitors a day, reputation, cash, unlocked, own a species). There's no scripted timeline, no way to start from a prebuilt park, and no losing conditions beyond bankruptcy and running out of time.
- **New Game** (`src/ui/menu.ts`): one flat list of 5 scenarios.
- **Already useful for challenges:** selling dinos, loans and interest, hiring and firing staff, fence damage and repair, escapes and guard recapture, storms, volcano rumbles, outbreaks, inspections, decision cards (`choices.ts`), and daily finance history.

## 1. New Game menu: two folders

"New park" opens a screen with two big tabs:

- **🏗️ New Builds:** start from an empty island. First Steps, Fossil Fever, Storm Coast, Rex Rising and Sandbox, as today. Sandbox gains an **island picker** (see section 2), with a map preview.
- **🧩 Challenges:** prebuilt parks in trouble. Each card has a map thumbnail, a crisis icon, difficulty stars, a one-line story, and your **best medal** (kept on the device, like the sticker album).
- Challenges unlock one after another, easiest first: any medal on one opens the next. Easy ones say so, for your daughter.

## 2. More interesting islands

**Keep a height map.** Store a height (0–15) per tile with the map. This makes rivers, cliffs, floods and lava all possible. Old saves get heights estimated from their terrain.

**Island shapes**, picked by seed (or chosen in Sandbox):

| Shape | What's special |
| --- | --- |
| Classic | today's island, improved with the features below |
| Twin Isles | two islands joined by a sandbar; expand across the causeway |
| Crescent Bay | a curved island around a sheltered lagoon, with offshore islets |
| River Valley | a big river from the mountains to the sea, with lakes and a delta |
| Fire Mountain | a large volcano with lava-rock fields, hot springs and black sand |
| Peninsula | a long arm of land; the far end is prime (pricey) land |

**New land features** (new terrain types, appended so saves stay safe):

- **Rivers** flowing downhill from the mountains to the sea, with an occasional **waterfall** where they drop off a cliff.
  - You can't walk on a river. A **bridge** (a path tile laid over water, costing more) crosses it.
  - Dinos can drink from a river inside their paddock (a small happiness boost).
- **Lakes** and **marsh**.
  - Marsh is cheap land that's slow to build on until drained (a one-off cost).
  - Frogs and reeds, for charm.
- **Cliffs and plateaus:** rocky ridges that fences and paths go around.
  - Great viewpoints: a viewing tower on high ground sees further.
- **Lava rock and hot springs** near the volcano.
  - Barren but buildable.
  - Hot springs are a visitor attraction.
- **Islets, coves and sea stacks** offshore, for scenery.
- **Scenery bonus:** visitors near a waterfall, lake or hot spring cheer up, like garden items. So the land itself becomes something to build around.

**Map size:** challenge parks and Sandbox can use a larger 96×72 island, if it runs smoothly on the iPad and iPhone (to be measured). New Builds keep 64×48.

**Checks:**
- Tests make sure every generated island has a reachable gate, enough buildable starting land, rivers that reach the sea, and the same island every time from the same seed.
- A gallery script renders 20 islands of each shape for review.

## 3. Challenge framework (the engine the levels share)

- **Prebuilt parks from a script.** Each challenge has a `setup()` that builds its park with the same commands the player uses, on a fixed island: "paddock here with steel fence", "path from gate to here", "restaurant there", "3 guards", "a $150k loan", "fences at 30%".
  - This stays correct when save formats change, unlike stored save files.
  - A test builds every challenge and fails if any step doesn't work.
- **New goal kinds:**
  - profit for N days in a row
  - debt paid off
  - all dinos back in paddocks
  - no escapes for N days
  - fences in good repair (%)
  - visitor happiness
  - staff morale
  - no dinos lost
  - park open with X visitors while a crisis is on
- **Short deadlines:** rounds can count in hours as well as days, for emergencies ("recapture everyone within 36 hours").
- **Scripted timeline:** events at set times (warning, rumble, eruption, rising water, a strike vote), plus story messages as it unfolds.
- **Losing conditions per challenge**, e.g. reputation falling below 20, or losing more than two dinos. Bankruptcy still applies.
- **Screens and HUD:**
  - A **briefing card** at the start: the story in kid-friendly words, what to do, and the deadline.
  - An **objective tracker** under the top bar: the current goal and a countdown, tap for details.
  - A **crisis meter** when relevant (volcano, water level, staff mood).
  - Medals as now: 🥉 solve the crisis, 🥈 and 🥇 stretch goals.

## 4. The challenges

### First wave (use mostly existing systems)

**💸 The Money Pit** (★★): a big, grand-looking park that's losing thousands a day.
- **The mess:**
  - 25 dinos, some in the wrong fences
  - far too many tour guides
  - two restaurants nobody can reach
  - a gift shop by the back fence
  - tickets priced too high for what's on show
  - $200k in loans at high interest
  - empty feeders
- **Goals:**
  - 🥉 make a profit 3 days running within 20 days
  - 🥈 pay off all loans within 60 days
  - 🥇 $150k cash and reputation 70 by day 120
- **New:**
  - a **Money tab "Where is the money going?"** report that highlights the worst buildings, staff and loans
  - sell a dino to another park at a fair price (selling already exists; add a clearer screen and price)

**🚨 The Great Escape** (★★): a storm knocked the power out overnight, and every paddock is open. Dinos are wandering the paths and visitors are hiding in the gift shop.
- **Goals:**
  - 🥉 every dino back in a paddock within 2 days
  - 🥈 all fences repaired and no escapes for 7 days
  - 🥇 reputation back to 65 within 30 days
- **New:**
  - **food lures** (put a feeder outside a paddock to draw dinos in)
  - a **"Close the park" button** to send visitors home during an emergency
  - a clear "loose dinos" counter
- Loose meat-eaters mostly chase and scare visitors. Rarely, one catches another dino, which becomes a fossil. A cooldown per hunter and a low catch chance mean it never works through the whole park.

### Second wave (needs the height map from section 2)

**🌋 Fire Mountain** (★★★): the volcano is waking up.
- **Story:** rumbles build over three days, with a warning meter. Then it erupts, and lava flows down set channels, cooling into lava rock. Ash keeps visitors away for a while.
- **Goals:**
  - 🥉 no dinos lost in the eruption (move them out of the lava's path)
  - 🥈 reopen and reach 80 visitors a day within 15 days
  - 🥇 build a lava-rock viewpoint attraction and reach reputation 75
- **New:**
  - lava flow over the height map, with glowing tiles and smoke
  - **move a dino** (a crate you carry to another paddock)
  - **lava walls** (concrete stops a flow for a while)
  - the lava danger zone shown before it happens

**🌊 Flood Season** (★★): a river valley park in the wet season.
- **Story:** heavy rain raises the river. Low ground floods for a few hours, closing paths and making buildings and fences soggy, then drains away.
- **Goals:**
  - 🥉 keep the park open through 3 floods
  - 🥈 no sick dinos and 60 visitors a day during the season
  - 🥇 flood-proof the park (no flooded paths in the last flood)
- **New:**
  - flood water spreading over the height map
  - **sandbag walls** (built on edges, like fences)
  - a **pump house** building
  - raised boardwalk paths (cost more, stay dry)
  - a water-level meter and a rain forecast

### Third wave (needs staff morale)

**✊ Staff Strike** (★★): wages haven't gone up in years and the staff are fed up.
- **Story:** on day 1, everyone downs tools, with picket signs at the gate. Feeders run low and fences wear out.
- **Goals:**
  - 🥉 end the strike within 3 days
  - 🥈 keep every dino fed and healthy in the meantime
  - 🥇 staff mood above 80 for 10 days
- **New:**
  - **staff mood**, driven by wages, workload and a staff room
  - a wage setting per role
  - a **staff room** building
  - **negotiation cards** (decision cards with offers and counter-offers)
  - **do it yourself:** tap a feeder or fence to refill or repair it yourself, at extra cost

### Later challenges (reusing the systems above)

- **🥚 Baby Boom:** too many hatchlings, with crowded paddocks and grumpy dinos. Build space, or rehome babies to other parks.
- **🤒 Dino Flu:** an outbreak across the park. Hire vets, and build a quarantine paddock.
- **🎉 Grand Opening:** a VIP inspector arrives in 5 days. Finish a half-built park to a checklist.
- **☀️ Heatwave:** visitors need drinks and shade, and dinos need water. Build ponds, trees and snack stalls.
- **🧹 Clean-Up Crew:** a filthy park must pass inspection within 4 days.
- **🏝️ Island Hop:** start on the small twin isle and expand across the causeway.

## 5. Save format and tests

- Bump `SAVE_VERSION` and add `migrate()` steps for:
  - the height map
  - new terrain
  - lava and flood state
  - staff mood
  - challenge progress and the timeline
- Challenge best medals live in device storage, next to the sticker album.
- **Unit tests:**
  - each goal kind
  - the timeline
  - lava and flood spreading (the same result from the same seed)
  - staff mood and the strike
  - every challenge's setup builds cleanly
- **Balance scripts** play each challenge headless with a simple "sensible player" to check it can be won and isn't won instantly.
- **Browser checks:** the menu folders, the briefing card, and the objective tracker on every iPhone and iPad size.

## Order of work

| Phase | What ships | Rough size |
| --- | --- | --- |
| 1 | Menu folders, challenge framework (setup scripts, new goals, timeline, briefing, tracker, best medals), **Money Pit**, **Great Escape** | large |
| 2 ✅ | Height map, island shapes, rivers and bridges, lakes, marsh, cliffs, lava rock, hot springs, scenery bonus, map previews, Sandbox island picker | large |
| 3 | **Fire Mountain** (lava, moving dinos) and **Flood Season** (floods, sandbags, pumps, boardwalks) | large |
| 4 | Staff mood, wages and staff room; **Staff Strike** | medium |
| 5 | Baby Boom, Dino Flu, Grand Opening, Heatwave, Clean-Up Crew, Island Hop | medium each |

## Owner's decisions (2026-09-28)

1. **Better islands first:** Phase 2 goes before Phase 1.
2. **Challenges unlock in order**, easiest to hardest. Finishing one (any medal) opens the next.
3. **Meat-eaters may catch other dinos**, and a caught dino becomes a fossil (no gore). It must be **rare**: a loose hunter mostly chases and scares visitors, and must never work its way through the whole park. Add a cooldown per hunter and a low catch chance.
4. **Bigger islands (96×72)** are fine for challenges (and Sandbox) that need them.
