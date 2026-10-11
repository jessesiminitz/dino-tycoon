# Playable local cartoon edition

The prior Blender export quantized rendered scenes into tiny palette-role grids, and Phaser and CSS enlarged them with nearest-neighbor filtering. The new default cartoon renderer uses smooth contour layers, flat colors, outlined silhouettes and expressive eyes. The T. rex has bespoke rounded character curves and an articulated walk/eat/idle/rest set based on the approved concept.

All 28 species retain four eight-frame clips and adult/baby appearances. Buildings and scenery draw directly from local editable Blender contours. Terrain, people, eggs, feeders, jeeps, fence segments, shop samples, app icons and interface receive matching native cartoon drawing. High-resolution texture dimensions are separated from logical world dimensions so sprite placement, water cropping, depth, touch targets and shadows stay aligned.

The simulation and v21 save schema are unchanged. Development comparisons remain available with `?art=blender` and `?art=original`. Work stays local on `art/cartoon`; nothing has been published.

## Local review

- Game: `http://127.0.0.1:5173/`
- Animated gallery: `http://127.0.0.1:5173/scripts/art/cartoon.html`
- Curve sources: `src/render/cartoonArt.ts` and `src/render/cartoonRex.ts`
- Source regeneration: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/art/export_cartoon.py`
- Browser checks: `npm run art:cartoon`

The exporter reads source scenes and animation shape keys without rendering or overwriting `.blend` files. Shared contours reduce the asset pack from ~7.1 MB to ~3.5 MB (about 0.9 MB compressed for transfer). The complete 56 animation atlas appearances use about 116 MB, created lazily by species; gallery canvases use higher resolution than the in-game textures.

## Validation

Regular tests and the performance benchmark pass. Type checking and the production build pass, including service-worker precaching. The cartoon browser review checks all 69 asset types, all 1,792 adult/baby atlas frames, transparent antialiased edges, logical dinosaur sizes, selection, behavior, pause, save compatibility and phone/tablet controls. Final results and screenshots are in `docs/cartoon-review/`.

This is a first playable cartoon pass. Other species derive their anatomy from the existing local models and can receive further character-specific redesign after visual review. Desktop headless Chrome checks establish behavior and layout, not physical iPhone/iPad frame performance.
