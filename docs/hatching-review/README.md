# Interactive hatching

When a land egg is ready, the park pauses for an egg-opening dialog. Tap one adds a central crack; tap two adds branching cracks; tap three creates exactly one baby, plays the celebration, and reveals the species' existing baby artwork. Every tap plays synthesized shell-cracking audio through the normal sound settings. The welcome screen offers an optional name (20 characters maximum), saves, and restores the previous park speed.

Ready eggs use the existing v21 save format and remain eggs until tap three. Reloading an unfinished hatch restarts its three taps without creating or losing a dinosaur. Simultaneous hatchings queue. Sea reptiles retain live birth and receive the congratulations/naming screen directly. Native dialog behavior keeps focus and interaction inside the popup; keyboard activation works through the egg button and naming form. Reduced-motion settings suppress the reveal animation.

Validation: 484 regular tests plus the performance benchmark; TypeScript; production build. Browser checks covered all 28 matching species pictures, first/second taps without births, synthesized shell audio, saved names, reload recovery, queued eggs and pause restoration. Production offline checks also confirmed that tap three saves exactly one matching baby and that naming persists without a connection. Core and cartoon phone layouts passed at 667×375, 844×390, 390×844 and 820×1180.

Run `npm run check:hatching` with the dev server on port 5174, or supply `BASE_URL`. `--smoke` checks Compsognathus, T. rex and Mosasaurus plus reload/queue/layout behavior; `ART_STYLE=cartoon` exercises the alternative. For the production/offline flow, run `BASE_URL=http://127.0.0.1:5174 REVIEW_HATCHING=1 npm run art:offline` after building.

Preview: [cracked egg](egg-cracked.png), [pixel baby and naming](baby-reveal.png), [cartoon phone reveal](cartoon/baby-667x375.png).
