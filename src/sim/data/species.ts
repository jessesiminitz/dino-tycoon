import type { FenceTypeId } from './fences';

export type SpeciesId =
  | 'protoceratops'
  | 'parasaurolophus'
  | 'stegosaurus'
  | 'triceratops'
  | 'compsognathus'
  | 'dilophosaurus'
  | 'pachycephalosaurus'
  | 'ankylosaurus'
  | 'velociraptor'
  | 'allosaurus'
  | 'brachiosaurus'
  | 'tyrannosaurus'
  | 'plesiosaurus'
  | 'mosasaurus'
  | 'pteranodon'
  | 'dimorphodon'
  | (typeof EXPANSION_SPECIES_IDS)[number];

/** The twelve Blender-authored additions, also grouped on the artwork review page. */
export const EXPANSION_SPECIES_IDS = [
  'spinosaurus',
  'therizinosaurus',
  'amargasaurus',
  'kentrosaurus',
  'styracosaurus',
  'carnotaurus',
  'yutyrannus',
  'iguanodon',
  'microraptor',
  'diplodocus',
  'argentinosaurus',
  'nigersaurus'
] as const;

/** Fish-eaters (including Spinosaurus, sea reptiles and flying reptiles) use fish feeders and do not hunt dinosaurs. */
export type Diet = 'herbivore' | 'carnivore' | 'piscivore';

/** Where an animal lives: land paddocks, a lagoon (a paddock with a pond) or an aviary (a paddock fenced with nets). */
export type Habitat = 'land' | 'water' | 'air';

/** Body template used to paint the sprite (see render/dinoArt.ts). */
export type BodyTemplate = 'raptor' | 'theropod' | 'ceratops' | 'trike' | 'stego' | 'ankylo' | 'hadro' | 'dome' | 'sauropod' | 'swimmer' | 'flyer';

export interface Species {
  id: SpeciesId;
  name: string;
  diet: Diet;
  price: number;
  /** 1 (tiny) – 5 (huge). Carnivores can only hunt prey no bigger than themselves. */
  size: number;
  /** Hunger gained per game-hour (hunger runs 0 = full … 100 = starving). */
  hungerRate: number;
  /** Land unless set. */
  habitat?: Habitat;
  /** Active at night instead of sleeping. */
  nocturnal?: boolean;
  /** Food units eaten per meal from a feeder. */
  meal: number;
  /** Minimum fence strength that holds this species (escapes arrive in Milestone 5). */
  fenceNeeded: FenceTypeId;
  /** Paddock tiles each animal wants to itself. */
  space: number;
  /** Visitor draw, used once visitors arrive (Milestone 4). */
  appeal: number;
  /** Movement steps between tile moves: 1 = fastest. */
  pace: number;
  /** Unhappy when kept without another of its own kind. */
  social: boolean;
  /** Available from the start; the rest are unlocked by fossil digs (Milestone 6). */
  starter: boolean;
  period: string;
  lengthM: number;
  /** Rough adult weight, as a display string (estimates vary). */
  weight: string;
  /** Who named it, when, and where its fossils come from. */
  discovered: string;
  /** Short fact for the buy catalog. */
  fact: string;
  /** More facts for the Dino Guide. */
  facts: string[];
  /** Fossil fragments needed to unlock a non-starter species. */
  fossilsNeeded: number;
  /** Relative chance a dig turns up this species (rarer = lower). */
  fossilWeight: number;
  art: { template: BodyTemplate; body: string; dark: string; accent: string; pattern?: 'stripes' | 'spots' };
}

export const SPECIES: Record<SpeciesId, Species> = {
  protoceratops: {
    id: 'protoceratops', name: 'Protoceratops', diet: 'herbivore', price: 3000, size: 2,
    hungerRate: 2, meal: 10, fenceNeeded: 1, space: 12, appeal: 2, pace: 2, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 1.8,
    fact: 'A sheep-sized plant eater from the Gobi Desert, with a bony neck frill and a parrot-like beak.',
    weight: 'about 80 kg',
    discovered: 'Named in 1923 from fossils found in Mongolia’s Gobi Desert.',
    facts: [
      'Hundreds of skeletons are known, from hatchlings to adults, making it one of the best-understood dinosaurs.',
      'The famous “Fighting Dinosaurs” fossil, found in 1971, shows one locked in a struggle with a Velociraptor.',
      'It was an early relative of Triceratops, but had no real brow horns.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'ceratops', body: '#c9a36b', dark: '#8a6a3e', accent: '#b5694a' },
  },
  parasaurolophus: {
    id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'herbivore', price: 6000, size: 3,
    hungerRate: 2, meal: 18, fenceNeeded: 1, space: 20, appeal: 4, pace: 2, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 9.5,
    fact: 'Its long hollow head crest worked like a trumpet, letting herds call to each other across the plains.',
    weight: 'about 2.5 tonnes',
    discovered: 'Named in 1922 from a skeleton found in Alberta, Canada.',
    facts: [
      'A hadrosaur, or duck-billed dinosaur, with rows of hundreds of grinding teeth.',
      'Air passages ran up through the crest and back, so it may have made deep, low calls.',
      'It could walk on two legs or four.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'hadro', body: '#6f9e7a', dark: '#3f6b4a', accent: '#d9713f', pattern: 'spots' },
  },
  stegosaurus: {
    id: 'stegosaurus', name: 'Stegosaurus', diet: 'herbivore', price: 9000, size: 3,
    hungerRate: 1.8, meal: 25, fenceNeeded: 2, space: 30, appeal: 5, pace: 3, social: false, starter: true,
    period: 'Late Jurassic', lengthM: 9,
    fact: 'The plates on its back may have helped control body heat; the spiked tail, called a thagomizer, was for defence.',
    weight: 'about 5 tonnes',
    discovered: 'Named in 1877 by Othniel Charles Marsh from fossils in the western United States.',
    facts: [
      'Its brain was tiny for its size, roughly the size of a lime.',
      'The largest back plates were around 60 cm tall.',
      'The name “thagomizer” for its tail spikes began as a joke in a 1982 cartoon, and scientists adopted it.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'stego', body: '#8fa05a', dark: '#56662f', accent: '#c9573b', pattern: 'spots' },
  },
  triceratops: {
    id: 'triceratops', name: 'Triceratops', diet: 'herbivore', price: 12000, size: 3,
    hungerRate: 1.8, meal: 28, fenceNeeded: 2, space: 30, appeal: 6, pace: 3, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 9,
    fact: 'One of the last non-bird dinosaurs. Its skull, with three horns and a huge frill, could be over two metres long.',
    weight: '6 to 12 tonnes',
    discovered: 'Named in 1889 by Othniel Charles Marsh from fossils in the western United States.',
    facts: [
      'It lived alongside Tyrannosaurus rex, and some Triceratops bones carry T. rex bite marks.',
      'Its beak and shearing teeth could slice through tough plants.',
      'It is one of the most commonly found dinosaurs in rocks from the very end of the dinosaur age.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'trike', body: '#7d8a96', dark: '#4b5560', accent: '#d9c7a3' },
  },
  compsognathus: {
    id: 'compsognathus', name: 'Compsognathus', diet: 'carnivore', nocturnal: true, price: 2500, size: 1,
    hungerRate: 3, meal: 6, fenceNeeded: 1, space: 6, appeal: 1, pace: 1, social: true, starter: true,
    period: 'Late Jurassic', lengthM: 1,
    fact: 'About the size of a turkey. Fossils have been found with lizards in their stomachs, a quick hunter of small prey.',
    weight: 'about 3 kg',
    discovered: 'Described in 1859 from a skeleton found in southern Germany.',
    facts: [
      'For a long time it was thought to be the smallest dinosaur.',
      'It was one of the first dinosaurs known from a nearly complete skeleton.',
      'It had long hind legs and a long tail for balance, built for speed.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'raptor', body: '#9bbf5a', dark: '#5f7f2a', accent: '#e0c050', pattern: 'spots' },
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', diet: 'carnivore', price: 7000, size: 2,
    hungerRate: 2.5, meal: 14, fenceNeeded: 2, space: 20, appeal: 5, pace: 1, social: false, starter: true,
    period: 'Early Jurassic', lengthM: 7,
    fact: 'Named for the pair of thin crests on its head. There is no evidence it could spit venom or had a neck frill.',
    weight: 'about 400 kg',
    discovered: 'Named in 1970 from fossils found in Arizona, USA.',
    facts: [
      'It was one of the largest land predators of its time.',
      'The venom-spitting and neck frill in the movies were invented; fossils show neither.',
      'Its twin head crests were thin and fragile, probably for display.',
    ],
    fossilsNeeded: 0, fossilWeight: 0,
    art: { template: 'raptor', body: '#b8a14a', dark: '#7a6a2a', accent: '#d9573b', pattern: 'stripes' },
  },
  pachycephalosaurus: {
    id: 'pachycephalosaurus', name: 'Pachycephalosaurus', diet: 'herbivore', price: 8000, size: 2,
    hungerRate: 2, meal: 14, fenceNeeded: 2, space: 18, appeal: 4, pace: 2, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 4.5,
    fact: 'Its skull dome was up to 25 cm thick. Scientists still debate whether rivals butted heads or flanks.',
    weight: 'about 400 kg',
    discovered: 'Named in 1943 from fossils in the western United States.',
    facts: [
      'It is known mostly from skulls; the thick domes fossilise far better than the rest of the skeleton.',
      'Knobs and short spikes ringed the back of its dome.',
      'Its name means “thick-headed lizard”.',
    ],
    fossilsNeeded: 3, fossilWeight: 30,
    art: { template: 'dome', body: '#a07f5a', dark: '#6b5238', accent: '#e8d8b0' },
  },
  ankylosaurus: {
    id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'herbivore', price: 14000, size: 3,
    hungerRate: 1.6, meal: 26, fenceNeeded: 2, space: 28, appeal: 5, pace: 4, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 7,
    fact: 'Covered in bony armour plates, with a heavy club of fused bone at the end of its tail.',
    weight: 'about 5 to 8 tonnes',
    discovered: 'Named in 1908 from fossils found in Montana, USA.',
    facts: [
      'Some of its armoured relatives even had bony plates on their eyelids.',
      'The tail club was made of fused bony plates and could swing with bone-breaking force.',
      'It was one of the last and largest of the armoured dinosaurs.',
    ],
    fossilsNeeded: 4, fossilWeight: 25,
    art: { template: 'ankylo', body: '#7a6f5a', dark: '#4a4336', accent: '#b0a17a' },
  },
  velociraptor: {
    id: 'velociraptor', name: 'Velociraptor', diet: 'carnivore', nocturnal: true, price: 15000, size: 2,
    hungerRate: 2.8, meal: 10, fenceNeeded: 3, space: 16, appeal: 7, pace: 1, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 2,
    fact: 'Really about the size of a large dog, and feathered. It had a large sickle-shaped claw on each foot.',
    weight: 'about 15 to 20 kg',
    discovered: 'Named in 1924 from fossils found in Mongolia’s Gobi Desert.',
    facts: [
      'Bumps on its arm bones show where feathers attached, so it was feathered like a bird.',
      'Its name means “swift seizer”.',
      'The raptors in the movies were modelled on a larger relative, Deinonychus.',
    ],
    fossilsNeeded: 5, fossilWeight: 18,
    art: { template: 'raptor', body: '#8c6a4a', dark: '#5a4028', accent: '#3f7fb0', pattern: 'stripes' },
  },
  allosaurus: {
    id: 'allosaurus', name: 'Allosaurus', diet: 'carnivore', price: 22000, size: 4,
    hungerRate: 2.4, meal: 30, fenceNeeded: 3, space: 40, appeal: 8, pace: 2, social: false, starter: false,
    period: 'Late Jurassic', lengthM: 9.5,
    fact: 'The top predator of the Jurassic in North America, with small horns above its eyes and dozens of serrated teeth.',
    weight: 'about 2 tonnes',
    discovered: 'Named in 1877 by Othniel Charles Marsh from fossils in the western United States.',
    facts: [
      'One Allosaurus backbone has a wound that matches a Stegosaurus tail spike.',
      'A skeleton nicknamed “Big Al” shows many healed injuries and infections.',
      'It is one of the most common large predators in the rocks of the Late Jurassic.',
    ],
    fossilsNeeded: 6, fossilWeight: 12,
    art: { template: 'theropod', body: '#a8703f', dark: '#6b4424', accent: '#d9b060', pattern: 'stripes' },
  },
  brachiosaurus: {
    id: 'brachiosaurus', name: 'Brachiosaurus', diet: 'herbivore', price: 30000, size: 5,
    hungerRate: 1.4, meal: 60, fenceNeeded: 2, space: 60, appeal: 9, pace: 4, social: true, starter: false,
    period: 'Late Jurassic', lengthM: 22,
    fact: 'Its front legs were longer than its back legs, letting it browse treetops about 12 metres off the ground.',
    weight: '30 to 50 tonnes (estimates vary)',
    discovered: 'Named in 1903 from a skeleton found in Colorado, USA.',
    facts: [
      'The nasal openings in its skull sat high up, above its eyes.',
      'A similar giant from Tanzania, now called Giraffatitan, was once thought to be the same animal.',
      'It swallowed plants without chewing, eating huge amounts every day.',
    ],
    fossilsNeeded: 8, fossilWeight: 9,
    art: { template: 'sauropod', body: '#6f8a9e', dark: '#44596b', accent: '#9fb8c9' },
  },
  tyrannosaurus: {
    id: 'tyrannosaurus', name: 'Tyrannosaurus rex', diet: 'carnivore', price: 40000, size: 5,
    hungerRate: 2.2, meal: 45, fenceNeeded: 4, space: 60, appeal: 10, pace: 2, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 12,
    fact: 'Had one of the strongest bites of any land animal, strong enough to crunch through bone.',
    weight: '8 to 14 tonnes',
    discovered: 'Named in 1905 from fossils found in Montana, USA.',
    facts: [
      'The specimen nicknamed “Sue” is one of the most complete T. rex skeletons ever found.',
      'Its arms were short but muscular, with two fingers on each hand.',
      'It had some of the largest teeth of any meat-eating dinosaur, up to about 30 cm long including the root.',
    ],
    fossilsNeeded: 12, fossilWeight: 6,
    art: { template: 'theropod', body: '#6b7a4a', dark: '#40492a', accent: '#c9573b', pattern: 'stripes' },
  },
  plesiosaurus: {
    id: 'plesiosaurus', name: 'Plesiosaurus', diet: 'piscivore', habitat: 'water', price: 14000, size: 3,
    hungerRate: 1.8, meal: 20, fenceNeeded: 1, space: 16, appeal: 7, pace: 2, social: true, starter: false,
    period: 'Early Jurassic', lengthM: 3.5,
    fact: 'A sea reptile with a small head on a long neck, a broad body and four big paddle-shaped flippers.',
    weight: 'about 450 kg',
    discovered: 'Named in 1821. Mary Anning found the first nearly complete skeleton in 1823, at Lyme Regis in England.',
    facts: [
      'It was not a dinosaur: plesiosaurs were marine reptiles that lived alongside the dinosaurs.',
      'It “flew” through the water by beating its four flippers, a bit like a sea turtle or a penguin.',
      'Fossils show that plesiosaurs gave birth to live young in the water instead of laying eggs.',
      'It probably snapped up fish and squid-like animals with its long, sharp teeth.',
    ],
    fossilsNeeded: 3, fossilWeight: 20,
    art: { template: 'swimmer', body: '#4f8a9e', dark: '#2f5a6b', accent: '#9fd0d8' },
  },
  mosasaurus: {
    id: 'mosasaurus', name: 'Mosasaurus', diet: 'piscivore', habitat: 'water', price: 32000, size: 5,
    hungerRate: 2.4, meal: 40, fenceNeeded: 3, space: 30, appeal: 11, pace: 2, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 12,
    fact: 'A giant sea lizard with powerful jaws, paddle flippers and a tail fin: a top predator of the ancient oceans.',
    weight: 'several tonnes',
    discovered: 'Its skull was found in the 1700s in a quarry near Maastricht in the Netherlands, and named in 1822.',
    facts: [
      'It was a marine reptile, more closely related to today’s lizards and snakes than to dinosaurs.',
      'It had a second row of teeth on the roof of its mouth to help grip slippery prey.',
      'It swam by sweeping its tail, which ended in a fin a little like a shark’s.',
      'It was one of the very first prehistoric reptiles ever described by scientists.',
    ],
    fossilsNeeded: 8, fossilWeight: 7,
    art: { template: 'swimmer', body: '#4a6b7a', dark: '#2b4450', accent: '#c9d8c0', pattern: 'stripes' },
  },
  pteranodon: {
    id: 'pteranodon', name: 'Pteranodon', diet: 'piscivore', habitat: 'air', price: 11000, size: 2,
    hungerRate: 1.6, meal: 12, fenceNeeded: 1, space: 14, appeal: 7, pace: 1, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 6,
    fact: 'A huge flying reptile with a wingspan of about six metres, a long toothless beak and a swept-back head crest.',
    weight: 'about 25 kg',
    discovered: 'Named in 1876 from fossils found in the chalk of Kansas, in the United States.',
    facts: [
      'It was a pterosaur, a flying reptile: not a dinosaur and not a bird.',
      'Its name means “wing without a tooth”: its beak had no teeth at all.',
      'Its wings were sheets of skin stretched from an incredibly long fourth finger to its legs.',
      'It probably soared over the sea like an albatross, scooping up fish.',
    ],
    fossilsNeeded: 3, fossilWeight: 28,
    art: { template: 'flyer', body: '#c9b48a', dark: '#8a7250', accent: '#d9573b' },
  },
  dimorphodon: {
    id: 'dimorphodon', name: 'Dimorphodon', diet: 'piscivore', habitat: 'air', price: 6000, size: 1,
    hungerRate: 1.8, meal: 8, fenceNeeded: 1, space: 10, appeal: 5, pace: 1, social: true, starter: false,
    period: 'Early Jurassic', lengthM: 1.4,
    fact: 'A small flying reptile with an oversized, puffin-like head, two kinds of teeth and a long stiff tail.',
    weight: 'about 2 kg',
    discovered: 'Mary Anning found the first skeleton in 1828 at Lyme Regis; it was named in 1859.',
    facts: [
      'Its name means “two-form tooth”: long fangs at the front of its jaws and small teeth behind.',
      'Its head was big but light, full of openings that saved weight.',
      'It may have been better at climbing and scrambling than at long flights.',
      'Its long tail probably ended in a little vane that helped it steer.',
    ],
    fossilsNeeded: 3, fossilWeight: 35,
    art: { template: 'flyer', body: '#7a8f4a', dark: '#4d5e2a', accent: '#e0a040', pattern: 'spots' },
  },
  spinosaurus: {
    id: 'spinosaurus', name: 'Spinosaurus', diet: 'piscivore', price: 44000, size: 5,
    hungerRate: 2.3, meal: 42, fenceNeeded: 3, space: 60, appeal: 11, pace: 2, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 14,
    fact: 'A towering back sail, narrow crocodile-like jaws and a deep tail made this fish hunter unmistakable.',
    weight: 'about 7 tonnes (estimates vary)',
    discovered: 'Named by Ernst Stromer in 1915 from Egyptian fossils.',
    facts: [
      'Its jaws held cone-shaped teeth suited to gripping fish.',
      'Its short hind legs and paddle-shaped tail set it apart from many other large theropods.',
      'Scientists still debate how much time it spent swimming or hunting along the shore.',
    ],
    fossilsNeeded: 12, fossilWeight: 5,
    art: { template: 'theropod', body: '#547f84', dark: '#305459', accent: '#ec9560', pattern: 'stripes' },
  },
  therizinosaurus: {
    id: 'therizinosaurus', name: 'Therizinosaurus', diet: 'herbivore', price: 36000, size: 4,
    hungerRate: 1.8, meal: 42, fenceNeeded: 3, space: 48, appeal: 10, pace: 3, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 10,
    fact: 'A pot-bellied plant eater with a small beaked head and extraordinarily long hand claws.',
    weight: 'several tonnes (estimates vary)',
    discovered: 'Named by Evgeny Maleev in 1954 from Mongolian fossils.',
    facts: [
      'It belonged to the theropods, the group that also includes many meat-eating dinosaurs.',
      'Its enormous claws gave it the name “scythe lizard”.',
      'Its full appearance is reconstructed using incomplete fossils and better-known relatives.',
    ],
    fossilsNeeded: 10, fossilWeight: 6,
    art: { template: 'theropod', body: '#8eab79', dark: '#516d50', accent: '#e2bb6f', pattern: 'spots' },
  },
  amargasaurus: {
    id: 'amargasaurus', name: 'Amargasaurus', diet: 'herbivore', price: 24000, size: 4,
    hungerRate: 1.5, meal: 38, fenceNeeded: 2, space: 42, appeal: 8, pace: 3, social: true, starter: false,
    period: 'Early Cretaceous', lengthM: 12,
    fact: 'A smaller long-necked dinosaur with two striking rows of tall spines running along its neck.',
    weight: 'about 9 tonnes (estimates vary)',
    discovered: 'Named by Leonardo Salgado and José Bonaparte in 1991 from Argentina.',
    facts: [
      'The neck spines were extensions of its vertebrae.',
      'Some reconstructions show skin linking the spines; their exact covering remains uncertain.',
      'Its name comes from the La Amarga area of Argentina.',
    ],
    fossilsNeeded: 7, fossilWeight: 11,
    art: { template: 'sauropod', body: '#ad845c', dark: '#705238', accent: '#dd7356' },
  },
  kentrosaurus: {
    id: 'kentrosaurus', name: 'Kentrosaurus', diet: 'herbivore', price: 13000, size: 3,
    hungerRate: 1.8, meal: 24, fenceNeeded: 2, space: 28, appeal: 6, pace: 3, social: false, starter: false,
    period: 'Late Jurassic', lengthM: 5,
    fact: 'A spiky relative of Stegosaurus, with small back plates and long spikes toward its tail.',
    weight: 'roughly 1 to 2 tonnes',
    discovered: 'Named by Edwin Hennig in 1915 from fossils found in Tanzania.',
    facts: [
      'Its name means “spiky lizard”.',
      'Its fossils were found at Tendaguru in present-day Tanzania.',
      'It walked on four legs and ate plants.',
    ],
    fossilsNeeded: 4, fossilWeight: 26,
    art: { template: 'stego', body: '#70958d', dark: '#42645d', accent: '#e8af69', pattern: 'spots' },
  },
  styracosaurus: {
    id: 'styracosaurus', name: 'Styracosaurus', diet: 'herbivore', price: 14500, size: 3,
    hungerRate: 1.8, meal: 28, fenceNeeded: 2, space: 30, appeal: 7, pace: 3, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 5.5,
    fact: 'A horned dinosaur with a huge nose horn and a crown of long spikes around its neck frill.',
    weight: 'about 2.7 tonnes',
    discovered: 'Named by Lawrence Lambe in 1913 from Canadian fossils.',
    facts: [
      'Unlike Triceratops, it had a prominent nose horn rather than long brow horns.',
      'Several skeletons together in bone beds suggest it may have lived in herds.',
      'Its beak and slicing teeth helped it crop plants.',
    ],
    fossilsNeeded: 5, fossilWeight: 19,
    art: { template: 'trike', body: '#997187', dark: '#614659', accent: '#e0ba7a' },
  },
  carnotaurus: {
    id: 'carnotaurus', name: 'Carnotaurus', diet: 'carnivore', price: 26000, size: 4,
    hungerRate: 2.6, meal: 30, fenceNeeded: 3, space: 40, appeal: 9, pace: 1, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 8,
    fact: 'A bull-horned predator with a short, deep skull and astonishingly tiny arms.',
    weight: 'roughly 1 to 2 tonnes',
    discovered: 'Named by José Bonaparte in 1985 from fossils found in Argentina.',
    facts: [
      'Its name means “meat-eating bull”.',
      'Fossil skin impressions preserve scales across parts of its body.',
      'The purpose of its two head horns is still debated.',
    ],
    fossilsNeeded: 7, fossilWeight: 10,
    art: { template: 'theropod', body: '#bd7059', dark: '#773f38', accent: '#e7c68a', pattern: 'spots' },
  },
  yutyrannus: {
    id: 'yutyrannus', name: 'Yutyrannus', diet: 'carnivore', price: 28000, size: 4,
    hungerRate: 2.4, meal: 32, fenceNeeded: 3, space: 42, appeal: 9, pace: 2, social: false, starter: false,
    period: 'Early Cretaceous', lengthM: 7.5,
    fact: 'A large, shaggy tyrannosaur relative whose fossils preserve evidence of feathers.',
    weight: 'about 1.1 tonnes',
    discovered: 'Named by Xu Xing and colleagues in 2012 from Chinese fossils.',
    facts: [
      'Its name means “feathered tyrant”.',
      'Unlike T. rex, it had longer arms and three fingers on each hand.',
      'Feather impressions were found beside several parts of its body.',
    ],
    fossilsNeeded: 8, fossilWeight: 10,
    art: { template: 'theropod', body: '#9b91ab', dark: '#5e556f', accent: '#e8d2a1', pattern: 'spots' },
  },
  iguanodon: {
    id: 'iguanodon', name: 'Iguanodon', diet: 'herbivore', price: 10000, size: 3,
    hungerRate: 2, meal: 26, fenceNeeded: 2, space: 28, appeal: 6, pace: 2, social: true, starter: false,
    period: 'Early Cretaceous', lengthM: 10,
    fact: 'A sturdy plant eater with a beaked mouth and a pointed thumb spike on each hand.',
    weight: 'about 4 tonnes',
    discovered: 'The genus was named in 1825; famous later skeletons came from Bernissart, Belgium.',
    facts: [
      'It could move on two legs or four.',
      'Its cheek teeth helped it process plant food.',
      'Its name means “iguana tooth”, after the resemblance of its teeth to an iguana’s.',
    ],
    fossilsNeeded: 4, fossilWeight: 29,
    art: { template: 'hadro', body: '#648ea2', dark: '#3a5b6d', accent: '#dca46a', pattern: 'stripes' },
  },
  microraptor: {
    id: 'microraptor', name: 'Microraptor', diet: 'carnivore', price: 5500, size: 1,
    hungerRate: 2.8, meal: 6, fenceNeeded: 1, space: 8, appeal: 5, pace: 1, social: true, starter: false,
    period: 'Early Cretaceous', lengthM: 0.8,
    fact: 'A tiny feathered hunter with long wing feathers on both its arms and its legs.',
    weight: 'about 1 kg',
    discovered: 'Named by Xu Xing and colleagues in 2000 from Chinese fossils.',
    facts: [
      'It was a relative of Velociraptor, but much smaller.',
      'Fossils show that it ate small animals, including fish and lizards.',
      'Its four feathered limbs helped it move through the air; scientists study how it flew.',
    ],
    fossilsNeeded: 3, fossilWeight: 40,
    art: { template: 'raptor', body: '#586d87', dark: '#303f54', accent: '#83b8b0' },
  },
  diplodocus: {
    id: 'diplodocus', name: 'Diplodocus', diet: 'herbivore', price: 34000, size: 5,
    hungerRate: 1.4, meal: 58, fenceNeeded: 2, space: 64, appeal: 10, pace: 4, social: true, starter: false,
    period: 'Late Jurassic', lengthM: 26,
    fact: 'A long, low sauropod with a slender neck and an exceptionally long, whip-like tail.',
    weight: 'about 15 tonnes (estimates vary)',
    discovered: 'Named by Othniel Charles Marsh in 1878 from fossils in the western USA.',
    facts: [
      'Its name means “double beam”, referring to bones underneath its tail.',
      'Its narrow teeth could strip leaves from plants.',
      'Its fossils come from the Morrison Formation of the western United States.',
    ],
    fossilsNeeded: 9, fossilWeight: 7,
    art: { template: 'sauropod', body: '#7f9a68', dark: '#4c633c', accent: '#d8b875', pattern: 'stripes' },
  },
  argentinosaurus: {
    id: 'argentinosaurus', name: 'Argentinosaurus', diet: 'herbivore', price: 52000, size: 5,
    hungerRate: 1.5, meal: 80, fenceNeeded: 3, space: 80, appeal: 12, pace: 4, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 35,
    fact: 'An immense titanosaur with a bulky body, pillar-like legs and a long neck for reaching plants.',
    weight: 'perhaps 70 tonnes; estimates vary widely',
    discovered: 'Named by José Bonaparte and Rodolfo Coria in 1993 from Argentine fossils.',
    facts: [
      'It was among the largest land animals ever discovered.',
      'Its remains are incomplete, so estimates of its size differ.',
      'Titanosaurs were a successful group of long-necked plant eaters during the Cretaceous.',
    ],
    fossilsNeeded: 14, fossilWeight: 4,
    art: { template: 'sauropod', body: '#788da0', dark: '#485b6f', accent: '#cdb79a', pattern: 'spots' },
  },
  nigersaurus: {
    id: 'nigersaurus', name: 'Nigersaurus', diet: 'herbivore', price: 18000, size: 3,
    hungerRate: 1.7, meal: 30, fenceNeeded: 2, space: 32, appeal: 7, pace: 3, social: true, starter: false,
    period: 'Early Cretaceous', lengthM: 9,
    fact: 'A low-browsing long-neck with a broad, straight-edged muzzle and hundreds of replacement teeth.',
    weight: 'a few tonnes (estimates vary)',
    discovered: 'Named by Paul Sereno and colleagues in 1999 from fossils found in Niger.',
    facts: [
      'Its skull held batteries of as many as 500 slender teeth.',
      'It cropped soft plants close to the ground.',
      'Its skull bones were remarkably thin and light.',
    ],
    fossilsNeeded: 6, fossilWeight: 16,
    art: { template: 'sauropod', body: '#ab9b63', dark: '#6c613b', accent: '#d9c999', pattern: 'spots' },
  },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

export const habitatOf = (id: SpeciesId): Habitat => SPECIES[id].habitat ?? 'land';

export const DIET_LABELS: Record<Diet, string> = { carnivore: '🥩 Carnivore', herbivore: '🌿 Herbivore', piscivore: '🐟 Fish-eater' };
export const HABITAT_LABELS: Record<Habitat, string> = { land: '🌳 Paddock', water: '🌊 Lagoon', air: '🪽 Aviary' };
/** Where each kind of animal needs to live, for the catalog and guide. */
export const HABITAT_HELP: Record<Habitat, string> = {
  land: 'a fenced paddock',
  water: 'a lagoon: a pond inside a fenced paddock (dig one with Garden → Pond)',
  air: 'an aviary: a paddock fenced all the way round with aviary net',
};
export const STARTER_SPECIES = SPECIES_IDS.filter((id) => SPECIES[id].starter);

/** Pet names handed out to new arrivals. */
export const DINO_NAMES = [
  'Rex', 'Daisy', 'Pebbles', 'Spike', 'Clover', 'Bruno', 'Maple', 'Tank', 'Juniper', 'Ziggy',
  'Hazel', 'Rocco', 'Pip', 'Olive', 'Moss', 'Buster', 'Fern', 'Gus', 'Poppy', 'Boulder',
  'Kiwi', 'Sage', 'Nugget', 'Willow', 'Chomp', 'Button', 'Ember', 'Pickle', 'Thistle', 'Duke',
];
