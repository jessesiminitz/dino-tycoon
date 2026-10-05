# Animate the full Blender roster and bring the prototype's ambience into the park

Dinosaurs previously used four shared walk poses while stationary animals stayed
mostly still. All 28 species now have eight-pose walk/swim/fly, idle, eat and rest
clips backed by 112 editable Blender timelines. Walk phase follows distance,
babies use the scaled gait, meals trigger chewing after actual feeder consumption,
and nighttime sleep selects rest. Pose and presentation clocks freeze on pause.
Save schema, simulation balance, RNG and feeding/pathfinding rules stay unchanged.

The park adds cached rooted foliage sway, drifting leaves, evening fireflies,
ground-contact dust and wet rings, swimming wakes and pond sparkle. Existing
lighting, volcano/fountain effects and rain follow the presentation clocks. A
World animation setting disables ambient movement and defaults off for reduced
motion. Motion sheets load lazily per appearance; effects and caches are bounded.
The review page exposes all four clips and all 28 animals alongside the canonical
art comparisons and the original three-animal enclosure demo.

The anatomy work corrects oversized or detached claws, horns, spikes, feathers
and tail clubs, and rebuilds all animation clips.
Spikes follow the neck during grazing; tail ornaments follow their shaft;
idle/rest movement preserves body and accessory joins. Stegosaurus and
Ankylosaurus carry their tails above the ground. Both export converters reject
detached native silhouettes, with fixtures for claws, spines and raster tips.

Stegosaurus, Spinosaurus, Brachiosaurus and Kentrosaurus have longer tails rooted
at their hips, with spikes spread along the shafts, a tapered Spinosaurus fin
and an elevated Brachiosaurus tail. Symmetric canvas room keeps the body scale
and world-relative foot placement; ground shadows exclude the transparent room.
Eight tail tests cover every affected canonical/animated pose and foot anchors;
browser checks also verify adult/baby shadow sizing and mobile access.

Validation is recorded in HANDOFF.md: unit/simulation tests, production build,
896 frame/hash/contact checks, full atlas/runtime/gallery browser checks, mobile
UI tours, offline populated-park resume and Blender source audits/parity renders.
Blender source files and review captures are excluded from the shipped app.
Physical Safari review and integration with main remain pending; no deployment.
