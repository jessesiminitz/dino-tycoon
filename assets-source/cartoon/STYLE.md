# Cartoon art direction

The owner approved `trex-v1/trex-concept.png` on October 11, 2026 and requested all artwork in this style. Work from local files in this checkout.

## Visual rules

- Smooth, clean black contours; readable silhouettes at phone size.
- Rounded forms, large white eyes with simple black pupils, expressive friendly faces.
- Saturated but restrained colors with cream undersides and simple cel shadows.
- Simpsons-inspired cartoon animation appearance; preserve recognizable dinosaur anatomy.
- Transparent backgrounds for sprites, without glow or baked scenery.
- Render at higher resolution and display with smooth filtering. Do not convert new artwork into palette-role pixel grids.
- Keep common ground anchors, consistent camera direction and stable body proportions across every animation frame.

## Complete coverage

The existing export manifest lists 69 asset types: 28 dinosaurs, 10 buildings, 15 environment objects and 16 terrain types, comprising 224 canonical poses/variants. Dinosaur motion currently contains four eight-frame clips per species (896 frames): walk/swim/fly, idle, eat and rest.

The manifest does not include all visuals. Visitors, staff, feeders, fences, paths, eggs, vehicles and effects are also painted in code. Include those in the conversion. UI, icons and title screen should match if the owner selects a complete visual refresh.

## Production work remaining

1. Create species and environment designs matching the approved character.
2. Turn approved designs into editable animation sources; generated stills alone do not supply stable articulated animation.
3. Export transparent high-resolution atlases with stable ground anchors, direction, adult/baby scale and collision-independent display bounds.
4. Add a cartoon renderer in Phaser while retaining existing simulation and save data. Replace the role-grid conversion for this art set with atlas loading.
5. Cover scenery footprints, seamless terrain, shoreline transitions, fence depth, shadows and effects.
6. Review at actual phone/tablet sizes, validate offline precaching and measure atlas memory and frame performance.

## Status

The first playable cartoon pass is implemented on local branch `art/cartoon`. The T. rex has bespoke editable character curves and articulated animation; the other dinosaurs, buildings and environment use smoothed contours from the local Blender scenes. Four animation clips per species are available, with adult/baby rendering. Terrain, people, feeders, eggs, jeeps, fences, shop samples and interface use native smooth drawing. The approved generated illustrations remain reference concepts rather than runtime sprites.

Use `/scripts/art/cartoon.html` for the art gallery and `/` to play. Existing game rules and v21 saves remain supported. This is the first playable style pass; individual character shapes and physical-device performance can be refined after review.
