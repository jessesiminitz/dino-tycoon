# Bigger, playful menu dinosaurs

The menu displays each species at a readable portrait size instead of sharing the park's metre scale. T. rex, Compsognathus, Triceratops and Stegosaurus lead a complete 28-species walking parade. Tap animals for happy hops, wiggles, wing flutters, swimmer bobs and a chewing/snack response. The scrolling pauses during the reaction, then resumes. Species labels and keyboard buttons make the animals discoverable.

Park pats and treats now trigger body reactions and chewing poses as well as hearts. These reactions use real time and finish even while park time is paused; normal movement and simulation positions remain unchanged. Animation preferences are respected. Saves remain version 21.

Browser verification covered both artwork styles at desktop, 667×375, 844×390, 390×844 and 820×1180. Compsognathus renders about 66px tall on short landscape screens and about 84–96px on taller screens. All menu species remain visible/readable, New park is unobstructed, and tap reactions return to scrolling. The spacing/seam review also covered a 7680px-wide viewport, keyboard navigation and reduced motion. Real phone taps verified selection, treating, hungry-dinosaur refusal and photo capture. Unit tests cover habitat-specific care, every chewing frame, cleanup and animation-off feedback.

Run `npm run check:menu-fun` with the dev server on port 5174, or set `BASE_URL`; `ART_STYLE=cartoon` reviews the alternative. See [core phone menu](blender/menu-844x390.png) and [cartoon phone menu](cartoon/menu-844x390.png).

Final validation: 487 regular tests plus the performance benchmark passed; TypeScript and production build passed. Production/offline checks confirmed the new menu portraits, saved-park resume, animation, three-tap hatching and persisted baby names. Rotated care reactions use transformed silhouette bounds for fence masking.
