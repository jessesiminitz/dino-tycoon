# Blender pixel dinosaur sizes

The pixel renderer previously used an 18-pixel minimum animal length and a compressed length exponent. That made Compsognathus disproportionately large and limited giant sauropods to near-native sprite dimensions.

Blender pixel art now uses six world pixels per registered metre, with a five-pixel minimum for tiny silhouettes and a 2.5× maximum source scale. Size is calculated from painted silhouette width, excluding transparent tail/camera padding. Compsognathus has a user-requested 2× visibility multiplier on its world scale (previously approximately 7×5 pixels including its outline); T. rex is approximately 74 pixels long, and Argentinosaurus approximately 212 pixels. Rasterization means these are approximate visual proportions, rather than a scientific scale diagram.

Existing cartoon/original size rules are unchanged. Adult/baby walk cycles use the selected renderer's scale. Small animals retain the minimum 20×20 world-pixel selection area, without enlarging their artwork. Saves, species data and simulation rules are unchanged.

Local game: `http://127.0.0.1:5173/?art=blender`

`lineup.png` compares all 28 species with the same visitor at a shared 3× zoom. `compsognathus.png` is the smallest-animal comparison. `results.json` records an exhaustive browser check of 1,792 animation frames, retained faces and the expanded Compsognathus touch target.

Validation covered all 479 regular tests and the performance benchmark. Three regular tests hit the default time limit while the Mac was under heavy load; they passed when rerun individually at the same default limits. Type checking passed. Keep build and browser/test runs sequential on this machine.

Regenerate with the dev server running:

```sh
node scripts/checks/pixel-size-review.mjs
```
