# Blender sprite authoring

The park and title parade apply `src/render/dinoSize.ts` to all 28 dinosaurs. It derives a compressed display scale from registered lengths and painted silhouette widths, ignoring transparent canvas room. `dinoArt.ts` resamples palette-role grids while preserving eyes; `parkMotion.ts` paints scaled adult/baby atlases and scales walking distance consistently. Canonical sources, exported grids, catalog/guide art and native comparison galleries retain their original dimensions. Changing park display sizes does not require regenerating Blender sources. Painted frames record tight opaque bounds for local fence transparency; dinosaurs retain their normal ground depth instead of drawing their feet above walls.

The canonical set contains **28 dinosaur species × four poses, 10 park buildings, 15 scenery types with 38 variants, and 16 terrain types with four tile variants each**. There are 224 canonical grids, plus 896 animation frames in the full-roster rollout below. Blender **4.5.14 LTS** renders extruded mesh profiles with CPU Cycles, flat emission region colors and an orthographic camera at native pixel resolution. Dinosaurs keep the game's species palettes, highlights, patterns, outlines and 60% baby painter; each building has its own palette. Blender artwork is the default in development and production.

## Review locally

```sh
npm run dev
```

- All 69 assets, poses, babies, backgrounds, directions and moving comparison: `http://localhost:5173/scripts/art/review.html`
- Park: `http://localhost:5173/?quickstart&seed=7`
- Original artwork comparison: `http://localhost:5173/?quickstart&seed=7&art=original`
- Busy fixture: `http://localhost:5173/?quickstart&stress`

The review page has a 28-card animated gallery, clip controls and a twelve-card new-dinosaur comparison gallery and supports `?asset=spinosaurus` links. New species have only Blender artwork, so their comparison displays one panel; they also use Blender in an otherwise original-style park. All twelve are available in new Sandbox parks and enter campaign catalogs through fossil digs. The six starters are unchanged. See [the roster and facts sources](../docs/PR-blender-dinosaur-expansion.md).

The art choice is made before textures and DOM artwork are created. Reload to change the set. Saves remain v21 and contain no art selection. Development and `npm run build:art` previews support `?art=original`; regular production always uses Blender artwork and strips development hooks. `build:art` remains available for a separate `dist-art/` preview.

## Sources and generated data

- `scripts/art/render_sprites.py`: isolated scenes, pilot models, renderer, camera and region conversion.
- `scripts/art/environment_models.py`: canonical tree, plant, rock, volcano and decoration meshes, plus 16 ground/water materials. Natural scenery uses stable seeded variants; opaque 16×16 terrain tiles replace speckled placeholders in the existing atlas.
- `scripts/art/expansion_models.py`: the twelve new land dinosaurs, including sails, scythe claws, paired neck spines, feathered limbs, distinctive heads and four different sauropod proportions. Each has four grounded walking poses and a compressed source scene.
- `scripts/art/models.py`: the other species and buildings; shared leg modeling and species-specific anatomy, crests, feathers, plates, horns, flippers and wings.
- `export-manifest.json`: dimensions, phases, versions, colors, rendering settings and per-building palettes. Camera `(width/2, -100, height/2)`, orthographic scale `max(width,height)`.
- `pixel-cleanup/patches.json`: repeatable eye, brow and lens pixel corrections. `all` edits apply to every pose; frame-number keys apply to one pose. `.` erases a pixel.
- `blender/dinos/*.blend`, `blender/buildings/*.blend`: compressed, inspectable scenes for every asset and pose. Only this exporter's named scenes are rebuilt. Update the authoring functions or cleanup data to retain changes during regeneration.
- `renders/`: ignored diagnostic PNGs and JSON grids with SHA-256 hashes, timings and foot-contact coordinates extracted from the actual foot meshes.
- `src/render/generated/blenderArt.ts`: checked-in dinosaur/building rows and building palettes.
- `src/render/generated/blenderEnvironment.ts`: checked-in scenery/terrain rows, palettes and shadow settings.
- `blender/environment/*.blend`, `blender/terrain/*.blend`: compressed source scenes for all environment and tile variants.
- `walk-contacts.json`: generated land-foot positions for gait regression tests. It is not shipped in the game.

Regions `B D F A G W E M` mean body, belly, far limbs, accent, far accent, horn/claw/teeth, eye and mouth. Dino alpha remains binary. Building rows feed the existing outline/shadow painter. No Blender or MCP connection is needed at runtime.

## Animation

A separate [animation and immersion prototype](../docs/PLAN-animation-immersion.md)
adds Carnotaurus, Diplodocus and Yutyrannus walk/idle/eat/rest clips: 96 additional
frames with editable shape-key timelines in `blender/motion/`. Review at
http://localhost:5173/scripts/art/immersion.html. Its generated data and sources
are separate from the original 224 grids and are excluded from the regular game
build. Use `art:motion:convert`, `art:motion:check` and `art:immersion`; the linked
document gives the small-batch Blender MCP recipe.

Right-facing land animals plant the near foot at the front, move it backward during stance, then lift it while swinging forward. Far legs alternate; quadrupeds alternate diagonal pairs. Mirroring the artwork handles left-facing movement without reversing the frame order. Regression tests check ground-contact pixels and mesh positions for all 24 land species in both directions. The park does not add a walk bob to these poses, which keeps planted feet on the ground. Swimming and flying select all four authored poses; the shared animal clock freezes when paused. Water cropping and sleeping flight retain their existing behavior.

## Regenerate through Blender MCP

Run small batches with `execute_blender_code`; reload the script for every call because MCP variables do not persist:

```python
import runpy
art = runpy.run_path(
    '/Volumes/Apple HDD 2TB/dino-tycoon-blender-art/scripts/art/render_sprites.py',
    run_name='dino_tycoon_art'
)
art['export']('tyrannosaurus')
```

Use any asset ID from `export-manifest.json`. Export one new dinosaur per MCP call: source saves can outlast the transport timeout in larger batches. If a call times out, check render/source timestamps and hashes before repeating it. `art['build'](asset, frame)` prepares an inspectable scene without rendering. `get_scene_info` / `get_object_info` inspect the parts; the comparison page displays the final painted pixels. The command-line equivalent exports one asset:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/render_sprites.py -- --asset tyrannosaurus
```

After exporting every asset:

```sh
npm run art:convert
npm run art:check
```

The dinosaur/building rollout reproduced all **74 frame hashes** and land-foot coordinates. The environment rollout reproduced all **102 additional variant hashes** through MCP. The dinosaur expansion reproduced **48 new pose hashes**, with the existing 176 grids unchanged. The converter rejects unknown interior colors, missing eyes, floating grounded sprites, malformed dimensions and duplicate poses. `art:check` compares checked-in data with local render JSONs; regenerate first on a fresh checkout because intermediate renders are ignored.

## Validate integration

```sh
npm test
npm run build
npm run art:integration
npm run art:environment
npm run art:ui
npm run art:review
npm run art:offline
```

Browser checks require the dev server and installed Google Chrome; each uses a temporary browser profile. Run expensive test and browser suites sequentially on this iMac. `BASE_URL` can select a different dev server. `art:environment` captures scenery and repeated-tile galleries plus river/coast/volcano views. It verifies every scenery/decor texture, all 64 atlas tiles, preserved footprints and terrain opacity, tree fading around animals, and hiding/restoring scenery under construction. `art:ui` runs 13 existing UI tours. `art:review` captures the full native/4× gallery and matched busy-park renderer measurements. `art:offline` serves the regular production `dist/` under `/dino-tycoon/`, checks all 28 menu sprites, creates a v21 park and resumes it offline. Set `ART_DIST=dist-art` to check the separate preview instead.

Generated captures and logs live under ignored `docs/art-review/`. Headless Chrome software rendering does not establish physical iPhone/iPad Safari performance. The graphics branch remains separate from main pending device/integration review.


## Environment integration

Scenery canvases retain their original footprints and outline padding. `environmentVariant()` maps the existing integer seeds to fixed authored variants, so forest types, palm placement and rocky terrain stay deterministic across loading and rendering. Tree fading, depth sorting, construction hiding, shoreline foam, water sparkles, fountain spray, lamp lighting and volcano effects continue to use their existing layers. The 84×70 volcano's opening remains at native row 10, matching the smoke/glow anchor.

`terrainArt.ts` shares one painter between atlas construction and the comparison page. Terrain enum values, 16-pixel tiles, four variants per terrain, per-cell variant hashing and all saved-map rules remain unchanged. The baked material clusters add depth while keeping ground contrast below that of animals and buildings. No Blender connection or new fetch is needed at runtime; generated grids ship in the precached application bundle.

## Full-roster animation

All 28 species now have four eight-frame Blender clips: walk/swim/fly, idle, eat
and rest. The 112 editable timelines live under `blender/motion/`; render
intermediates live under ignored `renders/motion/`. `scripts/art/full_motion.py`
is the single author, with the original prototype entry forwarding to it.
The bulk export uses local Blender CLI after MCP authoring/inspection. No cloud
assets or running Blender connection are required by the game.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/full_motion.py
npm run art:motion:convert
npm run art:motion:check
npm run art:park-motion
npm run art:immersion
```

The motion converter validates all 896 frames and stores shared palette-role rows
in `src/render/generated/blenderMotion.ts`. The park creates one 32-frame atlas
only when a species/adult-baby appearance is present. Saved state stays v21;
meal cues, gait phase, wind and particles are presentation state. See
[docs/PLAN-animation-immersion.md](../docs/PLAN-animation-immersion.md) for the
MCP recipe, grounded gait, review links, performance limits and full validation.

## Anatomy attachments

`scripts/art/anatomy.py` supplies surface intersections and accessory bindings to
the canonical model builders. Spike and feather roots overlap the actual body
or tail profile; hands root their claws in a shared palm. Tail accessories carry
an `attachment` and native `anchor_x` in the editable Blender meshes. Neck-bound
Amargasaurus spines rotate with the neck, while its back spines stay on the body.
Tail clubs and fans follow their root without being stretched across the tail.
The idle and resting deformation is shared by the body and its accessories;
hind feathers use the same gait as their leg.

Both converters check eight-neighbour connectivity of the native silhouette.
Detached components larger than two pixels, or farther than a one-pixel gap from
the main silhouette, fail conversion. Tiny raster gaps at thin tips are tolerated.
The check never deletes or moves exported pixels. Its regression fixtures run
with `node --test scripts/art/silhouette.test.mjs`.

After changing geometry, regenerate each affected canonical dinosaur with
`render_sprites.py -- --asset <species>` **and** its four motion clips with
`full_motion.py -- <species>`, then run both converters and both check commands.
Review eating/resting as well as walking, including babies and both directions.

Twenty-four dinosaurs have additional horizontal camera room for their longer
tails or necks. `modelOffsetX` in the export manifest shifts
their original model coordinates; the canvas expands by twice that amount.
`offset_geometry()` applies the same translation to meshes and accessory anchors
in both canonical and animated exports. Symmetric room preserves body scale and
the centre/ground anchor when mirrored. Foot contact coordinates increase by the
offset, while positions relative to the canvas centre stay the same.
The generated canonical art retains this offset so the game's ground shadows
exclude the extra transparent room, including for babies.

Tail regression checks cover all 144 canonical/animated poses for these four,
checking exposed length, ground clearance, unclipped edges and original foot
placement. These are stylized silhouettes, informed by the
[NHM Stegosaurus skeleton](https://www.nhm.ac.uk/discover/studying-stegosaurus-skeleton.html),
[Spinosaurus tail study](https://www.nature.com/articles/s41586-020-2190-3),
[NHM Brachiosaurus reference](https://www.nhm.ac.uk/discover/dino-directory/brachiosaurus.html)
and the [Museum für Naturkunde Kentrosaurus mount](https://artsandculture.google.com/asset/kentrosaurus-0107/MQFPIYDp4rIjbw).

## Full-roster reference review (2026-10-05)

[Picture references and model decisions](../docs/PR-dinosaur-reference-review.md)
cover all 28 animals. The pass revised 26 canonical silhouettes and corrected
the Pteranodon resting wing fold; Triceratops was retained after comparison.
It includes longer tapered tails, separated Stegosaurus plates, revised skulls,
armor, claws and feathers, and improved neck/sail/fin profiles. All four clips
use the canonical authoring geometry, with editable shape-key source timelines.

Cleanup patch coordinates remain in the original model space: the exporter adds
`modelOffsetX` once when applying them. Pterosaur resting wings fold at their
actual shoulder, including its offset. Preserve these rules when extending a
canvas; a shifted eye patch or shoulder can otherwise detach from the body.

`tests/dinoAnatomy.test.ts` protects original world-relative toes for all 24 land
animals and unclipped side edges across every canonical/animated frame of the
24 expanded canvases. Integration checks cover adult/baby ground shadows for
all land animals. Run the expensive suites sequentially as documented above.
