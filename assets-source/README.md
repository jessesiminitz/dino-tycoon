# Blender sprite authoring

The full set contains **16 dinosaur species × four poses and 10 park buildings**. Blender **4.5.14 LTS** renders extruded mesh profiles with CPU Cycles, flat emission region colors and an orthographic camera at native pixel resolution. Dinosaurs keep the game's species palettes, highlights, patterns, outlines and 60% baby painter; each building has its own palette. Blender artwork is the default in development and production.

## Review locally

```sh
npm run dev
```

- All 26 assets, poses, babies, backgrounds, directions and moving comparison: `http://localhost:5173/scripts/art/review.html`
- Park: `http://localhost:5173/?quickstart&seed=7`
- Original artwork comparison: `http://localhost:5173/?quickstart&seed=7&art=original`
- Busy fixture: `http://localhost:5173/?quickstart&stress`

The art choice is made before textures and DOM artwork are created. Reload to change the set. Saves remain v21 and contain no art selection. Development and `npm run build:art` previews support `?art=original`; regular production always uses Blender artwork and strips development hooks. `build:art` remains available for a separate `dist-art/` preview.

## Sources and generated data

- `scripts/art/render_sprites.py`: isolated scenes, pilot models, renderer, camera and region conversion.
- `scripts/art/models.py`: the other species and buildings; shared leg modeling and species-specific anatomy, crests, feathers, plates, horns, flippers and wings.
- `export-manifest.json`: dimensions, phases, versions, colors, rendering settings and per-building palettes. Camera `(width/2, -100, height/2)`, orthographic scale `max(width,height)`.
- `pixel-cleanup/patches.json`: repeatable eye, brow and lens pixel corrections. `all` edits apply to every pose; frame-number keys apply to one pose. `.` erases a pixel.
- `blender/dinos/*.blend`, `blender/buildings/*.blend`: compressed, inspectable scenes for every asset and pose. Only this exporter's named scenes are rebuilt. Update the authoring functions or cleanup data to retain changes during regeneration.
- `renders/`: ignored diagnostic PNGs and JSON grids with SHA-256 hashes, timings and foot-contact coordinates extracted from the actual foot meshes.
- `src/render/generated/blenderArt.ts`: checked-in runtime rows and building palettes.
- `walk-contacts.json`: generated land-foot positions for gait regression tests. It is not shipped in the game.

Regions `B D F A G W E M` mean body, belly, far limbs, accent, far accent, horn/claw/teeth, eye and mouth. Dino alpha remains binary. Building rows feed the existing outline/shadow painter. No Blender or MCP connection is needed at runtime.

## Animation

Right-facing land animals plant the near foot at the front, move it backward during stance, then lift it while swinging forward. Far legs alternate; quadrupeds alternate diagonal pairs. Mirroring the artwork handles left-facing movement without reversing the frame order. Regression tests check ground-contact pixels and mesh positions for all 12 land species in both directions. The park does not add a walk bob to these poses, which keeps planted feet on the ground. Swimming and flying select all four authored poses; the shared animal clock freezes when paused. Water cropping and sleeping flight retain their existing behavior.

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

Use any asset ID from `export-manifest.json`. `art['build'](asset, frame)` prepares an inspectable scene without rendering. `get_scene_info` / `get_object_info` inspect the parts; the comparison page displays the final painted pixels. The command-line equivalent exports one asset:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/render_sprites.py -- --asset tyrannosaurus
```

After exporting every asset:

```sh
npm run art:convert
npm run art:check
```

All **74 frame hashes** and land-foot coordinates reproduced exactly through MCP during the full rollout. The converter rejects unknown interior colors, missing eyes, floating grounded sprites, malformed dimensions and duplicate poses. `art:check` compares checked-in data with local render JSONs; regenerate first on a fresh checkout because intermediate renders are ignored.

## Validate integration

```sh
npm test
npm run build
npm run art:integration
npm run art:ui
npm run art:review
npm run art:offline
```

Browser checks require the dev server and installed Google Chrome; each uses a temporary browser profile. Run expensive test and browser suites sequentially on this iMac. `BASE_URL` can select a different dev server. `art:ui` runs 13 existing UI tours. `art:review` captures the full native/4× gallery and matched busy-park renderer measurements. `art:offline` serves the regular production `dist/` under `/dino-tycoon/`, checks all 16 menu sprites, creates a v21 park and resumes it offline. Set `ART_DIST=dist-art` to check the separate preview instead.

Generated captures and logs live under ignored `docs/art-review/`. Headless Chrome software rendering does not establish physical iPhone/iPad Safari performance. The graphics branch remains separate from main pending device/integration review.
