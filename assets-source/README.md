# Blender sprite authoring

The pilot contains T. rex and Triceratops with four walk poses each, plus the binocular viewing tower. It uses Blender **4.5.14 LTS**, CPU Cycles, flat emission region colors, an orthographic side camera, and binary pixel masks. All other species and buildings retain their procedural painters.

## Review locally

```sh
npm run dev
```

- Compare shapes, poses, babies, backgrounds and directions: `http://localhost:5173/scripts/art/review.html`
- Play with the pilot art: `http://localhost:5173/?quickstart&seed=7&art=blender`
- Original art with the same seed: `http://localhost:5173/?quickstart&seed=7&art=original`
- Busy fixture: `http://localhost:5173/?quickstart&stress&art=blender`

The choice is made before textures and DOM artwork are created. Reload to change the art set. It is not stored in a save. A normal production build retains original art; `npm run build:art` produces a separate `dist-art/` PWA with the pilot enabled for offline/device review. `?art=original` can compare that preview with the original artwork. No development hooks are exposed in either production build.

## Sources and generated data

- `scripts/art/render_sprites.py`: canonical mesh profiles, part layering, poses, camera setup, renderer and region converter. Profiles are extruded meshes with real depth; their projected contours are deliberately authored at native pixel size.
- `export-manifest.json`: dimensions, phase list, engine, seed, sampling, colors, camera direction and tool versions. The camera is placed at `(width / 2, -100, height / 2)` and its orthographic scale is `max(width, height)` for Blender's automatic sensor fit.
- `pixel-cleanup/patches.json`: repeatable edits to eye/brow and lens pixels, applied after classification. `all` edits apply to every pose; frame-number keys apply to one pose. `.` erases a pixel.
- `blender/dinos/*.blend` and `blender/buildings/tower.blend`: compressed, inspectable scenes for every exported pose. The original scene in the user's Blender session is preserved. Save edits to the authoring functions/cleanup data so regeneration retains them; exports rebuild the tool's named scenes.
- `renders/`: ignored diagnostic PNGs and row-grid JSONs with SHA-256 hashes and render/conversion timings.
- `src/render/generated/blenderArt.ts`: checked-in runtime rows and tower palette, produced by the Node converter. Runtime builds need neither Blender nor MCP.

Regions use `B D F A G W E M` for body, belly, far limbs, accent, far accent, horn/claw/teeth, eye and mouth. The existing dinosaur painter supplies palettes, upper-left highlights, patterns, outlines and 60% babies. Final dinosaur pixels have fully transparent or fully opaque alpha. The tower uses its own color mapping and the existing building outline/shadow painter.

## Regenerate through Blender MCP

Run small steps with `execute_blender_code`:

```python
import runpy
art = runpy.run_path(
    '/Volumes/Apple HDD 2TB/dino-tycoon-blender-art/scripts/art/render_sprites.py',
    run_name='dino_tycoon_art'
)
art['build']('tyrannosaurus', 0)   # inspect scene and named parts
```

Then reload the script in a separate call and run `art['export']('tyrannosaurus')`. Export `triceratops` and `tower` similarly. Variables from one MCP execution do not persist into the next call. Use `get_scene_info` / `get_object_info` to inspect parts; inspect the saved render or the comparison page to judge pixels.

Command-line equivalent, one asset per invocation:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/render_sprites.py -- --asset tyrannosaurus
```

After exporting all three assets:

```sh
npm run art:convert
npm run art:check
```

`art:check` compares runtime data with the local render JSONs; regenerate first on a fresh checkout because intermediate renders are ignored. Re-exporting unchanged sources must preserve the hashes. All nine pilot frames reproduced exactly through MCP during implementation. The converter rejects unknown interior colors, missing eyes, floating grounded sprites, invalid cleanup edits, malformed dimensions and duplicate poses.

## Validate integration

```sh
npm test
npm run build
npm run art:integration
npm run art:ui
npm run art:review
npm run build:art
npm run art:offline
```

Browser checks require the dev server and installed Google Chrome. Each runs in a temporary browser profile. `art:ui` runs the existing galleries, care/photo, habitat, attraction, fossil, sticker, lighting and layout checks sequentially with `ART_STYLE=blender`. `art:review` writes fixed-viewport park captures and matched original/candidate renderer measurements. `art:offline` serves `dist-art/` at `/dino-tycoon/`, checks the prototype menu art, starts a normal v21 park, and resumes it offline through the service worker.

Review images and logs are generated under the ignored `docs/art-review/` folder. Headless software rendering measures regressions on this iMac; it does not establish iPhone/iPad Safari performance. Device review and the remaining-species rollout follow the pilot review gate in `docs/PLAN-blender-pixel-art.md`.
