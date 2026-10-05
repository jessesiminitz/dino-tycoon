# Blender animation and park immersion

Implemented on `art/blender-pixel`, 2026-10-04. The three-animal enclosure prototype
now drives a full-roster rollout in the playable game. Saves remain **v21**.
The branch remains local pending physical iPhone/iPad review and integration.

## Review

- Play the park: http://localhost:5173/?quickstart
- Inspect all 28 species: http://localhost:5173/scripts/art/review.html
  Choose Walk / swim / fly, Idle, Eat or Rest, then inspect eight frames,
  babies and both directions. The original four-pose comparison remains available.
- Enclosure demo: http://localhost:5173/scripts/art/immersion.html
  Carnotaurus, Diplodocus and Yutyrannus retain the day/dusk/rain prototype fixture.
  Its staged sequence demonstrates the art; the actual park follows simulation rules.

## Full rollout

**28 species × four clips × eight frames = 896 Blender frames**, backed by
**112 editable animated .blend sources** (12,299,079 bytes, outside the build).
Each mesh has a Basis and eight shape keys on an editable looping timeline.
Canonical dinosaur, building, scenery and terrain sources and their 224 grids remain intact.

The anatomy author groups bipeds, quadrupeds, swimmers and flyers. Neck, skull,
crests, horns and jaw move together; tails and feathers add secondary movement.
Grazing starts and finishes upright and clamps the muzzle above the soil. Resting
land animals compress their legs while toes stay planted. Resting flyers fold
wings and sit with their feet on the ground. Swimmers retain fin and tail motion.
Eyes stay readable at native resolution, including after rotation.

Walk stance moves backward linearly for two thirds of the cycle, then lifts and
returns forward. The runtime advances land gait by actual distance, with mirrored
facing and baby scale. The phase continues across tile boundaries. Teleports don't
produce giant strides. Stationary idle, eating and rest clips use a clock that
follows game speed and freezes on pause. Feeding emits a transient presentation
cue only after stock is consumed; cues never enter saves, logs or simulation RNG.
A meal plays its eight frames within the existing 625 ms stationary movement step.
Movement and sleep take priority. No new hunger, thirst or pathfinding rules were added.

One 32-frame GPU atlas is created lazily per species and adult/baby appearance.
Shared role rows reduce the generated download; the shared pixel painter preserves
palette patterns, hard alpha, outlines and baby scaling. Catalogs, fossils and
menus keep their existing static artwork. Blender/MCP is an authoring dependency only.

Trees, palms, bushes, reeds and living garden decorations use seven cached native
pixel bends. Roots stay fixed, variants keep their seeded placement, and tree
fading/construction hiding still work. Visible foliage updates at 120 ms intervals.
Small drifting leaves and dusk/night fireflies are bounded to nearby plants;
storms strengthen wind and suppress fireflies. Ground-contact dust, wet footfall
rings and swimming wakes have a 96-particle cap. Pond sparkles, volcano smoke,
fountain spray and wind follow the paused simulation clock. Existing daylight,
warm light pools and weather remain coordinated with the calendar; rain freezes
on pause. World animation can be disabled in device settings and defaults off
when the system requests reduced motion. Essential movement and feeding remain visible.

## Regeneration

`scripts/art/full_motion.py` is the single animation author. The old
`prototype_motion.py` entry forwards to it. Original scene files remain untouched.
Blender 4.5.14 LTS uses the canonical CPU Cycles palette and orthographic camera.
MCP prepared and rendered the first full-roster clip; local Blender CLI performs
the bulk render to avoid transport timeouts. MCP also inspects saved sources.

For a small MCP batch, reload the script on every call:

```python
import runpy
motion = runpy.run_path('/Volumes/Apple HDD 2TB/dino-tycoon-blender-art/scripts/art/full_motion.py')
motion['prepare']('nigersaurus', 'eat')
# Next call, after reloading:
motion['save_source']('nigersaurus', 'eat')
motion['render_clip']('nigersaurus', 'eat', 0, 4)
# Next call, after reloading:
motion['render_clip']('nigersaurus', 'eat', 4, 8)
```

For all 112 clips, or selected species:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/full_motion.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/full_motion.py -- tyrannosaurus pteranodon
npm run art:motion:convert
npm run art:motion:check
```

PNG/per-frame JSON/aggregate JSON intermediates and the batch status file live
under ignored `assets-source/renders/motion/`. Regenerate all species before
conversion on a fresh checkout. The converter checks dimensions, palette roles,
eyes, hashes, distinct poses and planted mesh contacts for every land frame.
Air and water clips are not incorrectly required to have land foot contacts.
Canonical cleanup patches do not apply to animated, padded anatomy.

## Validation

Current validation and measured performance are recorded in HANDOFF.md.

```sh
npm test
npm run build
npm run art:check
npm run art:motion:check
npm run art:park-motion
npm run art:motion-controls
npm run art:immersion
npm run art:integration
npm run art:environment
npm run art:ui
npm run art:offline
```

`art:park-motion` checks all 1,792 adult/baby atlas frames, 896 runtime
walk/frame/baby/direction combinations, real feeding, nighttime rest, pause,
rooted wind, stable caches, phone/iPad layout, reduced-motion defaults and all
3,584 clip/frame/baby/direction gallery combinations. It measures a busy park
with ambient movement off/on in sequential isolated runs. Generated captures,
logs and metrics stay under ignored `docs/art-review/`. Software-rendered Chrome
on this iMac does not establish physical Safari performance.

Future additions such as drinking, predator pounces and visitor reactions require
separate simulation/action designs. The current scope implements the prototype's
four behaviors across the roster and its ambient effects in the playable park.

## References

- [Rainy bookshop reference](https://www.reddit.com/r/mcp/comments/1wsg1zi/i_built_an_mcp_server_that_lets_agents_draw_and/): warm/cool contrast, ambient layers and small character actions.
- [Motion Twin](https://motiontwin.com/faq): 3D-authored artwork converted to 2D.
- [Rain World developer interview](https://unity.com/blog/exploring-procedural-design-rain-world): creature animation and environmental interactions.
- [Kingdom Two Crowns official trailer](https://www.youtube.com/watch?v=7neFkOEDP6w): atmospheric pixel-world reference.
- [Octopath Traveler HD-2D](https://www.jp.square-enix.com/octopathtraveler/about/): pixel artwork with dimensional visual effects.
