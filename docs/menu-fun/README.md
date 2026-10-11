# Playful menu dinosaurs

The menu uses the same species scales as the park, including the user's 2× Compsognathus adjustment, with one common responsive zoom. Dinosaur bodies retain their relative sizes; labels and tap targets remain large. Full animation canvases keep stable dimensions so walking and eating do not stretch or resize the body. T. rex, Compsognathus, Triceratops and Stegosaurus lead the 28-species parade.

Tap animals for greetings, small hops, wing flutters, swimming bobs and chewing. Large land animals such as Nigersaurus give gentle nods. Hops scale with body height and do not squash/stretch the image. Reactions pause the scrolling briefly and start their pose sequence from the tap. Park pats and treats still animate body reactions while park time is paused. Reduced motion, animation settings and keyboard access are supported. Saves remain v21.

Browser checks cover desktop, 667×375, 844×390, 390×844 and 820×1180, with one shared menu zoom and unobstructed New park controls. `menu-scale-review.mjs` checks all 896 adult frames per artwork style for stable dimensions and the correct source size; the Nigersaurus contact sheets show all eight poses for walking, idle and eating.

Run `npm run check:menu-fun` or `npm run check:menu-scale` with the dev server on port 5174, or set `BASE_URL`; `ART_STYLE=cartoon` reviews the alternative. See [core phone menu](blender/menu-844x390.png) and [cartoon phone menu](cartoon/menu-844x390.png).
