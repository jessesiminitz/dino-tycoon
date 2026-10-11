# Game-scale menu animation correction

Menu dinosaurs now use the same `dinoWorldScale` and animation painter as their park counterparts. One shared zoom fits the parade's height. The old individual portrait fitting and per-frame cropping made different species look similarly sized and made frames of changing silhouette width expand/contract. Fixed full canvases preserve proportions, frame positions and foot placement. In particular, Nigersaurus no longer alternates between differently fitted image sizes, and its menu greeting is a gentle nod.

The browser review checks all 896 adult poses (28 species × four clips × eight frames) per artwork style. Every clip has a stable canvas; core-game body dimensions match the game's painted silhouettes; all displayed species share the same CSS zoom within subpixel rounding. Phone interaction checks also cover Nigersaurus nods and chewing, plus keyboard access and reduced motion.

Run `npm run check:menu-scale` with the dev server on port 5174, or supply `BASE_URL`; use `ART_STYLE=cartoon` for that edition. [Core Nigersaurus frames](blender/nigersaurus.png), [core menu](blender/menu-desktop.png), [cartoon Nigersaurus frames](cartoon/nigersaurus.png).

Release checks: 487 regular tests plus the performance benchmark passed; TypeScript and production build passed. Both editions passed phone/tablet interactions and fixed-frame checks. Seamless scrolling, keyboard access, offline menu artwork, saved-park resume, hatching and saved baby names passed.
