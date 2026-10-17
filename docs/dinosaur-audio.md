# Dinosaur voices: playful sound design and inspiration

The current mix uses original, procedural **playful animal-inspired voices**, with expressive pitch sweeps and brighter growl harmonics for small speakers. Calls play at roughly three times their previous gain, with a brief fade between overlapping calls.

These are artistic interpretations, not recordings, fossil-accurate reconstructions, or measured species pitches. Pitch, rhythm, roughness and baby scaling are artistic choices. There is no known recording of a non-avian dinosaur.

- [Riede et al., 2016, *Coos, booms, and hoots*](https://doi.org/10.1111/evo.12988) describes closed-mouth calls in living birds and infers that at least some extinct dinosaurs could have made such calls. It does not establish the voice of T. rex or any other particular game species. The large theropods and sauropods receive soft-edged low booms and throaty pulses inspired by living archosaurs, rather than mammalian movie roars.
- [Sandia / New Mexico Museum crest modelling, 1997](https://www.sandia.gov/labnews/1997/12/19/dinosaur-story/) used CT scans to model the resonance of Parasaurolophus air passages and produced low-frequency, pitch-changing sounds. The researchers modelled alternatives with and without vocal cords. Our Parasaurolophus call layers a low voice and resonant overtones; it is **not** that CT model, a copy of its sound, or proof of its exact natural call.
- [Yoshida et al., 2023, *An ankylosaur larynx provides insights for bird-like vocalization in non-avian dinosaurs*](https://doi.org/10.1038/s42003-023-04513-x) reports a Pinacosaurus larynx with features interpreted as a vocal modifier. This expands plausible possibilities; it does not tell us that Ankylosaurus sounded like a specific modern bird. Armoured and horned dinosaur grunts remain speculative.
- Small feathered theropods use short, irregular clucks/coos as a broad living-relative analogy. We do not assume that they possessed a modern songbird's vocal organ or could sing modern bird songs.
- Pterosaurs are not dinosaurs. Their airy rasps/clucks are speculative reptile sound design, with no species-specific voice reconstruction claimed.
- Plesiosaurs and mosasaurs are also not dinosaurs. Their quiet breathy/gruff sounds are especially uncertain. The old whale-like singing has been removed; these are game effects, not evidence that they communicated this way, underwater or in air.

The synthesis mixes gently drifting harmonics, filtered breath noise, non-musical pitch contours and soft attack/release envelopes. Large calls keep audible overtones for small speakers rather than depending on inaudible infrasound. Three modest variations reduce repetition. Babies are shorter, higher and softer as an artistic readability choice. Calls use the existing sound-effects toggle/volume; the cache is bounded and no third-party animal recordings are included.

Run `scripts/checks/calls-review.mjs` against the local Vite server to generate the WAV listening gallery under `docs/dinosaur-audio`. The gallery previews selected adult/baby voices; numeric checks cover all 28 species and both ages.
