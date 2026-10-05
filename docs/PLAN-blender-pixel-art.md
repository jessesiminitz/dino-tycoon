# Blender pixel-art improvement track

**Current status (2026-10-04):** The owner accepted the pilot and requested the full set. All 16 species and 10 buildings are implemented as the default art, including the backward-walking fix. Full-set tests, builds, headless browser checks and production offline resume passed; physical-device/integration review remains pending. The original proposal and pilot measurements below document the earlier stages.
Prepared 2026-10-04 after reviewing the local Dino Tycoon repository at `b37134fc0224609e6ad7efd68b9bbea40cd1df9b` (`main`). The representative pilot and its export/integration workflow are now implemented on `art/blender-pixel`; broader rollout and release integration remain behind visual/device review.

Updated the existing draft on 2026-10-04 for the requested Blender MCP workflow. The local MCP connection successfully returned scene `Scene` with `Cube`, `Light`, and `Camera`; the installed app reports version 4.5.14. This verifies scene inspection, not Python execution, sprite export, or render performance.

## Recommendation

Use Blender 4.5.14 LTS as an offline tool for shaping and posing models, then export small pixel sprites into the existing Phaser game. Start with T. rex, then Triceratops, then the viewing tower. Compare each at actual game size before expanding the work.

The opportunity is better silhouettes, separation between limbs, and more convincing motion. Rendering a detailed 3D model at a tiny resolution will still need deliberate pixel cleanup. Preserve the colorful, friendly retro style and the distinctive buildings shaped like what they sell.

## Separate development track

- Branch: `art/blender-pixel`.
- Worktree: `/Volumes/Apple HDD 2TB/dino-tycoon-blender-art`.
- Start from the reviewed main commit above. Keep the original checkout on `main` so challenge and gameplay work can continue there.
- Use small commits for the export tools, first dinosaur, second dinosaur, building, and animation expansion. Rebase or merge current `main` into the art branch before integration and rerun relevant checks.
- Review the first prototypes locally. Do not push to `main` during this experiment: this repo automatically deploys main to GitHub Pages, and the owner requested a separate graphics track.
- Later integrate through a reviewed PR. A proposed development-only comparison switch should allow original and experimental art to be viewed with identical scene, seed, camera, and frame.

The existing `/Volumes/Apple HDD 2TB/dino-tycoon-gameplay-audit` directory is an older non-Git audit copy. It is not the base for this work.

## What the review found

| Area | Evidence in the current code | Improvement and priority |
| --- | --- | --- |
| Dinosaur anatomy | `src/render/dinoArt.ts` builds 16 species from ellipses, polygons, and tapered limbs. The existing dinosaur gallery shows recognizable species but some feet, shoulders, and hind limbs merge into heavy blocks. | First: improve body mass, skull proportions, leg separation, and tail balance through model silhouettes and pixel cleanup. |
| Animation | All species have two frames. `EntityLayer.ts` also adds a one-pixel bob; water animals stroke on a timer and flyers flap on a timer. | First preserve the two-frame contract for a safe prototype. Later expand approved land animals to four walk poses, then improve flapping and swimming. |
| Scale and placement | World tiles are 16 px; adult shape grids range from 28×16 to 66×66, before the painter adds a one-pixel border. Sprites use bottom-center origins and depth sorting based on their feet. | Keep existing dimensions and registration initially. Large artwork can obscure fences and adjacent animals even when it looks good in a gallery. |
| Color and outlines | Dinosaur pixels have eight semantic roles (`B D F A G W E M`), species palettes, dark outlines, patterns, and upper-left highlights. Babies are generated at 60% scale with eyes protected. | Keep palette roles and outline rules. Model geometry should improve form without introducing gradients, muddy colors, or soft edges. |
| Buildings | `sceneryArt.ts` paints ten building types, including a fries carton, popcorn bucket, giant binoculars, and a pump house. | Next: clearer thickness, structural supports, and consistent depth. Start with the binocular tower while preserving its identity and footprint. |
| Shared artwork | `paintDino()` supplies Phaser textures, catalog, guide, menu, stickers, and the app icon. `dinoShape()` supplies the fossil dig image and is exercised by tests. Building painters also supply shop cards. | One shared asset adapter must serve every consumer. Replacing only the park texture would leave inconsistent artwork elsewhere. |
| Terrain and people | Tiles and fences are procedural. Visitors have very small row-based sprites and carried-item overlays. | Later: a restrained palette/texture cleanup. Blender has lower value here than for animals and larger props; retain procedural variation and connectivity. |

Reviewed existing local captures in the original checkout at `/Users/jessesiminitz/Projects/dino-tycoon/scripts/checks/`: `dinos-new.png` and `shaped-buildings.png`. They are historical visual reference captures, not new acceptance runs, and are not tracked in the art worktree. The building gallery script omits the pump and has no error assertions; update that coverage when building artwork changes. Historical park captures also include old UI layouts, so record fresh game-size baselines before implementation.

## How to use Blender MCP

Use the connected `blender_local` MCP for iterative model creation and inspection. Save the resulting scene and Python scripts in this worktree so asset regeneration is repeatable without replaying a chat session. Blender is an authoring tool; the shipped game continues to render pixel sprites in Phaser.

| Tool available in this session | Role in the implementation |
| --- | --- |
| `get_scene_info` | Check the connection and inspect scene/object names before and after a modeling step. Successfully exercised for this plan. |
| `get_object_info` | Inspect named model parts, bounds, and materials during the prototype. |
| `execute_blender_code` | Run small Python steps to create the export scene, model parts, poses, diagnostic materials, and rendered files. Execution is configured to require approval; that flow applies when implementation reaches a code call. |

No render-preview or screenshot MCP tool is exposed in this session. Produce a saved PNG through Python execution and inspect that file locally. Do not make a viewport screenshot the asset export.

Implementation sequence:

1. Inspect the current scene and save the prototype to a dedicated `.blend` file under `assets-source/blender/`. Create a named `DinoTycoon_Art` scene or collection; avoid clearing unrelated objects in the user's session.
2. Create the orthographic camera and eight named region materials in one small Python step. Save the camera transform, orthographic scale, output size, color settings, engine, and sampling settings in an export manifest.
3. Build the T. rex in named parts: torso, skull/jaw, tail, near/far hind legs, small arms, and face details. Inspect object information after each group; prioritize the projected silhouette over detail invisible at native size.
4. Make two poses with the same camera and frame bounds. Render both diagnostic-color PNGs to a worktree-local output folder. Start with rigid part transforms; add an armature only if these poses need it.
5. Convert renders to role grids, apply checked-in pixel cleanup patches, and validate dimensions, registration, color classification, and required features. Rebuild the same frames and compare grid hashes before adding the runtime adapter.
6. Review the original and candidate through the game's shared painter at 1× and 4×, then in a matching park scene. Iterate camera, proportions, and cleanup through small MCP calls, saving the scripts and `.blend` after each useful revision.

Make creation scripts idempotent for their named scene/collection so rerunning a step does not duplicate meshes or materials. Record Blender version and converter version in the manifest. Runtime builds use checked-in generated grids; they never connect to MCP or launch Blender. The manifest and scripts, rather than tool-call history, are the reproducible source of the export.

## Art direction and export contract

Keep the current overhead square-grid world and right-facing dinosaur profile. Use an orthographic camera, adjusting its angle only enough to separate limbs and show the existing amount of depth. Do not introduce a different map projection in the art track. Blender's [orthographic camera](https://docs.blender.org/manual/en/4.5/render/cameras.html) keeps apparent size independent of distance.

For the first dinosaur, render a transparent region-color image from a simple low-poly model. Assign diagnostic colors to body, belly, far limbs, accent, far accent, horns/teeth, eyes, and mouth. Use flat emission materials for the region export, a pinned camera and pixel resolution, no motion blur or depth of field, and the [Standard view transform](https://docs.blender.org/manual/en/4.5/render/color_management.html). Standard avoids extra tone mapping; the exporter must still verify its diagnostic colors rather than assume RGB values remain exact. [Transparent Film](https://docs.blender.org/manual/en/4.5/render/cycles/render_settings/film.html) supplies the background alpha.

Convert the image to the existing role-key grid, thresholding alpha and resolving edge samples to a known role. Keep exact-color interiors; use nearest-color classification only for edge samples and reject unknown interior colors. Store small cleanup patches for eye pixels, toes, horn tips, and silhouette edges as editable source data. Regeneration must reapply those patches rather than overwrite them.

The first runtime artifact should be a generated TypeScript role-grid module. Feed its grids through the existing palette, pattern, outline, and baby painter. This preserves synchronous `paintDino()` / `dinoShape()` calls and supports the alternate species palette used by `iconArt.ts`. It also avoids adding async loading across every DOM consumer. Keep procedural shapes as the fallback for species outside the pilot.

This approach transfers Blender's shape and pose improvements, while the existing painter supplies pixel shading. If it cannot produce enough visual improvement, evaluate baked, palette-limited sprite images as a second prototype. That alternative needs an explicit loading design, a semantic fossil mask, support for recolored icons, and shared availability before menus and park creation; do not silently swap in an atlas and break those contracts.

For registration, preserve each species' existing grid size, the painter's border, and the same bottom-center anchor in every pose. Keep a common frame extent instead of auto-trimming each frame. Export no ground shadow for dinosaurs: `EntityLayer` already draws it. Building shadow ownership should be checked separately because `paintSprite()` includes a shadow.

The dinosaur grid itself must retain occupied pixels on the bottom row for grounded species, as required by `tests/dinos.test.ts`; do not insert a transparent margin inside that grid. The existing painter adds the outline space. Check binary alpha on the final canvas after cleanup rather than accepting softened render edges. Keep the eye role visible in both adult poses and in the generated baby. Preserve relative species size checks as well as canvas dimensions.

## Work packages

### 1. Record the baseline and build the export tool

- Capture all adult and baby species at 1× and enlarged nearest-neighbor scale; capture both directions in a fixed park at normal zoom, including a fence overlap.
- Record noon, dusk, night, catalog, guide, stickers, app icon, fossil dig, and building shop references. Use an isolated browser profile so personal saves stay untouched.
- Record production transfer size, startup time, and renderer frame times with fixed seed, population, viewport, and camera. Existing simulation benchmarks do not measure renderer cost.
- Create one reusable Blender scene with camera, diagnostic materials, ground reference, naming conventions, and an export script. Pin Blender 4.5.14 and exporter settings in the asset README.
- Begin by measuring a tiny CPU Cycles export on this iMac. The earlier draft reports a successful small render test, but it was not rerun during this review. Measure an EEVEE export before choosing it for batch rendering; its behavior on this old Radeon GPU has not been tested for this track.
- Add a converter and validator for dimensions, allowed keys, outline space, grounded bottom-row occupancy, frame registration, and reproducible regeneration. Runtime builds consume generated data and should not require Blender.

Deliverable: repeatable export of one test silhouette and an old/new comparison page. Do not yet replace all species.

### 2. T. rex prototype

- Model the existing 66×44 shape envelope (68×46 painted canvas), with a balanced tail, deep skull, small arms, and clearly separated hind legs.
- Produce the two existing pose slots first. Keep existing palette and stripe behavior; inspect the generated baby at 60% size and fix missing eyes or merged toes through source cleanup patches.
- Route `paintDino()` and `dinoShape()` through the experimental grid for this species behind the proposed comparison switch. Preserve palette overrides, dimensions, facing, touch bounds, and status marker placement.
- Put the original/generated shape choice in one resolver used by both functions. Choose the comparison mode before game texture creation and reload between modes to avoid stale Phaser texture keys. Keep the mode outside save data and development-only during the pilot.
- Compare at the actual phone zoom. A useful improvement must survive the game's smallest ordinary display size, rather than only look impressive at 4×.

Deliverable: a reproducible `.blend` source, generated grid, cleanup data, and matching before/after captures. Proceed only if anatomy and readability improve without losing the retro style.

### 3. Triceratops and viewing tower

- Triceratops tests a quadruped: preserve its 60×34 grid, frill/horn silhouette, palette, and leg spacing. Reuse the export scene and simplify the rig where possible.
- The viewing tower tests a static prop: retain the binocular shape, its current `paintSprite(24, 42, ...)` source dimensions, present footprint, bottom anchor, shadow behavior, and shop-card identity. Use a building-specific palette/grid adapter rather than forcing its colors into dinosaur roles.
- Measure exporter time and hands-on cleanup effort for all three prototypes. This determines whether Blender is economical for the remaining species and buildings.

Deliverable: a small representative art set with one shared workflow and documented exceptions.

### 4. Expand animation after the art direction is accepted

- Add four walk frames for the pilot land species and a frame metadata type. Replace the hard-coded `0 | 1` assumptions and texture registration coherently.
- Drive land animation from existing movement progress and speed; pause must stop the walk cycle. Keep idle poses distinct from moving poses and avoid accumulating separate timers per animal.
- Expand flyers and swimmers separately. Check sleeping flyers, flight height, waterline crop (currently 62% of image height), ripples, and both facing directions. A full-body gallery is insufficient evidence for water animals.
- Author babies separately only where the existing reduction produces unreadable heads or anatomy. Add subtle idle motion if it remains clear and inexpensive.

Deliverable: smoother movement without changing simulation timestep, species stats, save format, or gameplay rules.

### 5. Roll out approved assets and integrate

- Extend to the other land species in small groups, then aquatic/flying animals, then selected buildings and decorative props.
- Keep terrain, fences, procedural scenery variation, and tiny people until the primary art set proves worthwhile. Terrain changes can be a later graphics task with their own scene comparisons.
- Update README/HANDOFF to describe the Blender source and generated assets, regeneration commands, and remaining procedural painters.
- Bring the branch up to date with `main`, complete validation, and prepare a PR with before/after images at native game size. Publish only as a later integration step.

## Proposed repository layout

```text
assets-source/blender/template.blend
assets-source/blender/dinos/tyrannosaurus.blend
assets-source/blender/dinos/triceratops.blend
assets-source/blender/buildings/tower.blend
assets-source/export-manifest.json          # camera, roles, frames, settings, versions
assets-source/pixel-cleanup/                 # repeatable edits and role mappings
assets-source/README.md                     # Blender version and regeneration
scripts/art/render_sprites.py
scripts/art/convert_sprites.*               # choose tooling after the export spike
src/render/generated/                      # small checked-in role grids / palettes
src/render/                               # shared adapter and original fallbacks
```

Keep `.blend` files and intermediate renders outside `public/` so they do not ship to players. Track compressed model sources, scripts, cleanup data, and generated runtime assets; ignore Blender backups and temporary renders. Evaluate Git LFS only if source sizes justify it.

## Acceptance and validation

- **Visual:** identifiable silhouettes at normal zoom; readable eyes, horns, feet, and baby faces; consistent outlines/palettes; no clipped extremities, floating feet, or unintended frame jitter. Compare grass, sand, water, and dusk/night backgrounds.
- **Game integration:** consistent art in park, catalog, guide, menu, stickers, fossil dig, photo, and icon. Preserve the icon's palette override, touch selection, z-order, care effects, sleep/sickness/escape markers, and habitat behavior.
- **Build and saves:** `npm test` and `npm run build` before implementation commits, as required by this repo. No save-version bump is needed for a purely visual change; if later work changes state shape, follow the repository migration rules.
- **Browser checks:** use the existing dino/baby galleries, shaped-building gallery, care, habitats, attractions, dig, stickers, day/night, HUD/info-overlap, iPad, and relevant UI tour scripts. Add targeted assertions for asset contracts and page errors; screenshots alone are not pass/fail evidence.
- **Performance:** proposed pilot limits are no more than 10% regression in renderer p95 frame time or startup time on a matched baseline, and no more than 250 KB extra compressed production transfer. Treat these as initial targets to verify, not measured results. Revisit the budget before all-species rollout.
- **PWA:** verify a built preview under the GitHub Pages subpath and offline restart after assets have been cached. PNG/JSON are already in the precache patterns; generated TypeScript is bundled with JS. Respect the existing 5 MB per-file cache ceiling and the update prompt.
- **Device review:** headless Chrome provides repeatable comparisons; actual iPhone and iPad Safari checks remain necessary before merging the completed art set. Use the external drive for Blender sources and renders because the internal SSD has little free space.

## First implementation task

Build the repeatable export scene and a T. rex silhouette/pose comparison. The first decision is whether that result looks better at normal game size and is practical to regenerate. Keep the rest of the asset conversion queued until that evidence exists.

This milestone is complete, including the representative Triceratops/tower set and four walk poses for the two land species. Review `http://localhost:5173/scripts/art/review.html` and play `/?quickstart&seed=7&art=blender`. Regeneration instructions are in `assets-source/README.md`.

## Implemented pilot and measured results

- Blender MCP authored and exported a reusable template, four T. rex poses, four Triceratops poses and one tower. Saved `.blend` files contain all poses for their asset, alongside canonical authoring scripts, the export manifest and repeatable pixel cleanup patches.
- Every exported grid regenerated with an identical SHA-256 hash. CPU render/conversion times in the final reproduction were 0.111 s for all T. rex poses, 0.182 s for all Triceratops poses and 0.018 s for the tower; these timings exclude MCP call overhead, mesh construction and source-file saving.
- One resolver serves `paintDino()` and `dinoShape()`. Unconverted species retain procedural art. All pilot frames preserve their adult dimensions, bottom-row registration, binary pixel alpha and generated baby eyes. The tower retains its 24×42 painter contract.
- The two pilot dinosaurs use four walk poses. Land animation follows movement interpolation; a shared animal clock freezes idle, swimming and flying motion while paused. Habitat cropping, sleeping flight and horizontal mirroring passed targeted browser assertions.
- `npm test`: 240 regular tests plus the separate performance test passed. Normal production and `art-preview` production builds passed. All 13 existing browser tours passed with `ART_STYLE=blender`, and the targeted integration check passed for 844×390, 667×375, 1180×820 and 820×1180 layouts.
- The final matched headless run used 32 dinosaurs and 150 visitors at 844×390. Both modes measured 50 ms p95 frame intervals and about 1.2 ms p95 entity updates. Dev startup was 3,054 ms for original and 2,531 ms for the pilot in this run. These are single-run software-rendering observations; startup order/cache effects and physical Safari performance remain unmeasured.
- Gzipping each production file measured 575,457 bytes before the pilot and 577,947 bytes after it: **2,490 bytes extra**, within the proposed transfer budget. This is a local file-compression comparison, not a measured network transfer.
- The separate cached preview passed `/dino-tycoon/` subpath loading, new-art menu verification, v21 save creation and saved-park resume after an offline restart. Regular production builds retain original art; the branch has not been deployed to `main`.

Generated review images/logs are in `docs/art-review/` (ignored). An early stress-fixture run accidentally expired its visitors by changing the clock; it was discarded. The final comparison uses a corrected fixture initialized before scene creation with 150 visitors whose departure times remain in the future.

The owner accepted the pilot on 2026-10-04 and requested the complete species/building set plus a correction to backward-looking walking. That rollout is implemented below. Physical iPhone/iPad Safari checks and integration review remain pending.

## Implementation checkpoints

- [x] Review current graphics code and historical dinosaur/building galleries.
- [x] Verify local Blender installation version and MCP scene inspection.
- [x] Capture fresh native-size baselines and renderer/startup measurements.
- [x] Create and save the export scene, scripts, and manifest using Blender MCP.
- [x] Export and regenerate two T. rex poses with matching hashes (subsequently expanded to four).
- [x] Produce the shared-painter adult/baby comparison and game-size park captures.
- [x] Evaluate the visual result before starting Triceratops and the tower.
- [x] Validate representative prototypes and expand the two pilot species to four poses.
- [x] Owner visual review before remaining-species rollout (approved 2026-10-04).
- [ ] Complete build, browser, device, performance, and offline checks before integration.

Pilot review status: the owner accepted the visual direction. Its headless checks passed; physical device checks remain open. Gameplay state and save version remain v21.


## Full-set rollout and gait correction (2026-10-04)

The owner's request authorizes conversion of the remaining artwork. All 16 species now have four Blender-authored poses, all 10 buildings have matching models and individual palettes, and the regular production build uses them by default. Distinct species retain their identifying anatomy, including crests, feathers, plates, horns, long necks, flippers and wings. Original artwork remains available for development comparisons. Source scenes total about 2.5 MB and stay outside the shipped build.

The backwards-walking appearance came from lifting the foot while its offset moved backward, then planting it while its offset moved forward. Stance now travels backward relative to the body; the lifted swing travels forward. Far limbs alternate and quadrupeds alternate diagonal pairs. Left-facing movement mirrors the artwork without reversing frame order. The extra walking bob is removed for authored poses so planted feet remain on the ground. Swimming and flight select all four poses; flying contours fit the canvas.

All 74 frame hashes and all 12 land-species foot-contact exports reproduced exactly through Blender MCP. Gait regression checks inspect contact positions extracted from the actual Blender foot meshes and the exported ground-contact pixels, including both facing directions. The shared dinosaur painter serves the park, babies, catalog, guide, fossils, menu and icon; all building painters use the same generated data. The comparison page exposes all 26 assets with native/4× views and translated animation.

Full-set validation passed 255 regular tests plus the separate performance test, both production build modes, all 13 existing browser tours and targeted integration checks for all four poses of every species in both directions. An isolated matched fixture with 32 dinosaurs and 150 visitors measured equal 50.1 ms p95 frame intervals and about 1.3 ms p95 entity updates; dev startup was 3,383 ms original and 3,328 ms Blender. Locally gzipped production files total 586,911 bytes, 11,454 bytes above the pre-pilot build. Full-set details are in the PR draft and local `docs/art-review/` reports. Physical iPhone/iPad Safari testing remains pending before integration; this branch has not been deployed.
