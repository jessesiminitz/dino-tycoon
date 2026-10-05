# Add twelve distinctive dinosaurs with Blender artwork

The catalog grows from 16 to 28 species. Each addition has a distinct Blender model, four grounded walking poses, a species palette, baby artwork, catalog/guide facts, fossil unlock requirements and a synthesized call. New Sandbox parks offer the full roster; campaign parks keep the same six starters and discover the additions through fossil digs. Existing save unlock lists are preserved. Save format stays v21.

The artwork review page gains a twelve-card gallery, “New” labels in the asset picker, direct links such as `/scripts/art/review.html?asset=spinosaurus`, and pose/baby/direction/animation controls. New species display one Blender panel because they have no historical original artwork. When reviewing an otherwise original-style park, these twelve still use their Blender sprites and all four poses. Large sprites scroll within their review stage on a phone.

## Roster and references

The pixel palettes and gameplay values are artistic choices. Natural-history descriptions were checked against the linked museum and research sources; uncertain size estimates and behaviors are described as uncertain in the guide.

| Dinosaur | Distinctive model feature | Facts reference |
| --- | --- | --- |
| Spinosaurus | Tall sail, short legs, narrow jaws and deep paddle tail | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/spinosaurus.html) |
| Therizinosaurus | Upright pot belly, long neck and three separated scythe claws | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/therizinosaurus.html) |
| Amargasaurus | Two rows of long neck spines | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/amargasaurus.html) |
| Kentrosaurus | Small back plates, shoulder spike and long tail spikes | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/kentrosaurus.html), [Museum für Naturkunde](https://artsandculture.google.com/asset/kentrosaurus-0107/MQFPIYDp4rIjbw) |
| Styracosaurus | Crown of frill spikes and a long nose horn | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/styracosaurus.html) |
| Carnotaurus | Bull horns, deep short head and tiny arms | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/carnotaurus.html) |
| Yutyrannus | Feather fringe, nasal crest and longer three-fingered arms | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/yutyrannus.html) |
| Iguanodon | Beaked head and pointed thumb spike | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/iguanodon.html), [naming history](https://www.nhm.ac.uk/discover/search-for-the-real-iguanodon.html) |
| Microraptor | Small body, tail fan and feathers on arms and hind limbs | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/microraptor.html) |
| Diplodocus | Long horizontal neck and exceptionally long whip tail | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html) |
| Argentinosaurus | Largest footprint, bulky trunk and pillar legs | [Natural History Museum](https://www.nhm.ac.uk/discover/dino-directory/argentinosaurus.html) |
| Nigersaurus | Low browsing neck and broad downward-facing muzzle | [University of Chicago researcher Paul Sereno](https://paulsereno.uchicago.edu/discoveries/nigersaurus/), [published skull study](https://knowledge.uchicago.edu/records/xvhx0-1a817) |

Spinosaurus uses a land paddock and a fish feeder in the game; its actual aquatic behavior remains debated. Microraptor's authored poses show it walking with folded feathered limbs in a land paddock. The expansion reuses the existing habitat, feeder and hunting rules.

## Sources and validation

`scripts/art/expansion_models.py` is the canonical model generator. Blender MCP created and rerendered the twelve compressed `.blend` sources under `assets-source/blender/dinos/`. All 48 new pose hashes reproduced exactly; the original 176 grids were unchanged. The total set now has 69 asset types and 224 grids. Exported foot-mesh coordinates also pass the existing planted-foot/backward-stance and lifted-forward-swing checks. Regeneration is documented in `assets-source/README.md`.

`npm test` passed 288 regular tests plus the separate performance test (289 total); `npm run build` and `npm run art:check` passed. Added simulation checks cover buying all twelve, fossil completion for every addition, Sandbox availability and v21 save compatibility. The expanded `art:integration` check verifies all 28 species in catalog/guide/Phaser textures, every walking pose in both directions, baby/fossil masks, pause, four catalog viewports and the new review gallery. It compares every new review pose/baby/facing combination with the shared painter, checks the largest sprite on a 390×844 viewport, and advances review animation. All 13 existing UI tours passed, with a targeted overlap-tour rerun after fixing disposable Chrome teardown. That tour now reports layout issues through its exit code and bounds browser cleanup to ten seconds. The production `art:offline` check passed with all 28 menu sprites and offline save/resume under the Pages subpath.

The production files total 604,389 bytes when individually gzipped, 9,202 bytes above the environment rollout. Vite reports that the main chunk exceeds its 2,000 kB advisory threshold; the build passes, and the PWA precaches it within the configured 5 MiB file limit. Source `.blend` files remain outside the build. The previous environment performance figures are historical; physical iPhone/iPad performance and integration with main remain pending. This is a local PR draft; nothing has been published or deployed.
