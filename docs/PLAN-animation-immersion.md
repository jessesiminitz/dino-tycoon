# Animation and immersion prototype

Implemented 2026-10-04 on `art/blender-pixel`. This is a local review prototype;
the simulation and regular production game retain their existing artwork and saves.

## Review

Open http://localhost:5173/scripts/art/immersion.html, also linked from the artwork
review page. The enclosure contains Carnotaurus, Diplodocus and Yutyrannus. Each
has eight Blender poses for walk, idle, eat and rest: **12 clips / 96 frames**.
The scene uses actual Blender scenery and terrain, a forest backdrop, swaying
rooted vegetation, drifting leaves, pond ripples, ground-contact dust or wet
footfall ripples, evening fireflies, warm lamps, and daylight/dusk/rain controls.

Natural behavior walks to a feeder, looks around, eats, rests and walks back.
Behavior controls can isolate each action. Preview cards support babies, both
directions, pause and frame inspection. Reduced-motion preference starts paused;
hidden tabs do not advance time. This fixture does not represent the simulation's
feeding rules, predator/prey interactions, saved behavior or production gameplay.

## Authoring

`scripts/art/prototype_motion.py` reuses the canonical extruded anatomy with
connected neck/head rotation, tail movement, jaw motion, feather movement and
resting body/leg compression. All meshes have a Basis and eight shape keys on an
editable Blender timeline. Twelve compressed `.blend` files live in
`assets-source/blender/motion/` (1,408,312 bytes total). The pixel camera gets eight
pixels of side and top clearance; the original sources and 224 grids remain intact.
Diplodocus/Yutyrannus eyes are enlarged slightly to survive native rotated sampling.

Walk stance is linear for two thirds of the cycle, followed by a lifted return.
The prototype measures translation speed from exported planted-foot meshes; tests
verify world-space contact in both directions. This prototype gait is separate
from the four-pose production gait. Timing: walk 960 ms, idle 1,600 ms, eat 2,000 ms,
rest 2,400 ms per eight-frame loop.

Use **separate MCP calls** for preparation, saving/first render batch, and final
batch. Reload the script each time:

```python
import runpy
motion = runpy.run_path(
    '/Volumes/Apple HDD 2TB/dino-tycoon-blender-art/scripts/art/prototype_motion.py',
    run_name='dino_motion'
)
motion['prepare']('diplodocus', 'eat')
```

```python
# After reloading motion in the next call:
motion['save_source']('diplodocus', 'eat')
motion['render_clip']('diplodocus', 'eat', 0, 4)
```

```python
# After reloading motion in the next call:
motion['render_clip']('diplodocus', 'eat', 4, 8)
```

`prepare` replaces only this prototype's named working scenes; source files remain
available to reload. Preparation sometimes returned “No data received” after the
scene was fully authored. Inspect scene name, dimensions and clip metadata before
continuing. Smaller saving/render calls completed normally. Export errors such as
a missing eye must be fixed before conversion. Per-frame PNG/JSON intermediates
are ignored; regenerate all twelve clips before converting on a fresh checkout.
`motion['export'](asset, clip)` combines the steps for a sufficiently long-running
Blender process.

```sh
npm run art:motion:convert
npm run art:motion:check
npm run art:immersion
```

The converter checks dimensions, allowed roles, eyes, grounded pixels, mesh
contacts, hashes and distinct poses. Checked-in `blenderMotion.ts` feeds the shared
palette/outline/baby painter through `paintDinoRows`. Its 192 adult/baby canvases
are prepared once. Wind deformations, sky and lighting are cached; preview cards
redraw only when their pose changes. The world paints at up to 30 fps while time
and animal movement advance independently. The prototype entry is not imported
by the regular game build.

## Validation

- **295 tests** passed: 294 regular plus one performance test. Six new checks cover
  frame looping, face/contour validity, anchored feet and direction.
- Production build, `art:check` and `art:motion:check` passed. All original 224 grids
  still match their render hashes. Total gzipped production files: 604,450 bytes
  (+61 versus the preceding expansion build); prototype clips/scenes are excluded.
- `art:immersion` passed: all **384** clip/frame/baby/direction previews match the
  shared painter with binary alpha; full-world pause; actual movement/footfalls;
  particle switch; feeders/rest; all four natural behaviors for all three animals;
  fixed sprite cache; untouched local storage; reduced-motion startup; no errors.
- No horizontal overflow at 390×844, 844×390 or 820×1180. Desktop and device-size
  screenshots plus metrics are ignored local artifacts in `docs/art-review/`.
- `art:integration` passed for all 28 species, catalog/guide/game texture agreement,
  palettes, babies/fossil masks, both directions, pause, waterline/sleeping flight,
  four catalog viewports and the existing twelve-dinosaur review gallery.
- Blender MCP reloaded all twelve saved source files and confirmed every mesh had
  nine shape-key blocks and an animation action, with correct clip durations.
- Headless Chrome on the iMac measured p95 requestAnimationFrame interval 66.7 ms
  before scenery caching and **16.8 ms** afterward. This is a prototype measurement,
  not a production park benchmark or physical Safari result.

## Next review

Judge legibility and mood on physical iPhone/iPad. Refine transitions between
standing, eating and resting; the current clips switch directly. Then choose
which behaviors to connect to actual game state and animation clocks, profile a
busy park, and expand by anatomy group. Drinking, visitor reactions and full-roster
animation remain future work. No deployment or integration into `main` occurred.

## References

- [Rainy bookshop reference](https://www.reddit.com/r/mcp/comments/1wsg1zi/i_built_an_mcp_server_that_lets_agents_draw_and/): warm/cool contrast, separate ambient layers and small character actions.
- [Motion Twin](https://motiontwin.com/faq): 3D-authored artwork converted to 2D.
- [Rain World developer interview](https://unity.com/blog/exploring-procedural-design-rain-world): creature animation and environmental interactions.
- [Kingdom Two Crowns official trailer](https://www.youtube.com/watch?v=7neFkOEDP6w): atmospheric pixel-world reference.
- [Octopath Traveler HD-2D](https://www.jp.square-enix.com/octopathtraveler/about/): pixel artwork with dimensional visual effects.
