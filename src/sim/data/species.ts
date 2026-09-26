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
  | 'tyrannosaurus';

export type Diet = 'herbivore' | 'carnivore';

/** Body template used to paint the sprite (see render/dinoArt.ts). */
export type BodyTemplate = 'raptor' | 'theropod' | 'ceratops' | 'stego' | 'ankylo' | 'hadro' | 'sauropod';

export interface Species {
  id: SpeciesId;
  name: string;
  diet: Diet;
  price: number;
  /** 1 (tiny) – 5 (huge). Carnivores can only hunt prey no bigger than themselves. */
  size: number;
  /** Hunger gained per game-hour (hunger runs 0 = full … 100 = starving). */
  hungerRate: number;
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
  fact: string;
  art: { template: BodyTemplate; body: string; dark: string; accent: string };
}

export const SPECIES: Record<SpeciesId, Species> = {
  protoceratops: {
    id: 'protoceratops', name: 'Protoceratops', diet: 'herbivore', price: 3000, size: 2,
    hungerRate: 2, meal: 10, fenceNeeded: 1, space: 12, appeal: 2, pace: 2, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 1.8,
    fact: 'A sheep-sized plant eater from the Gobi Desert. One famous fossil shows it locked in combat with a Velociraptor.',
    art: { template: 'ceratops', body: '#c9a36b', dark: '#8a6a3e', accent: '#b5694a' },
  },
  parasaurolophus: {
    id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'herbivore', price: 6000, size: 3,
    hungerRate: 2, meal: 18, fenceNeeded: 1, space: 20, appeal: 4, pace: 2, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 9.5,
    fact: 'Its long hollow head crest worked like a trumpet, letting herds call to each other across the plains.',
    art: { template: 'hadro', body: '#6f9e7a', dark: '#3f6b4a', accent: '#d9713f' },
  },
  stegosaurus: {
    id: 'stegosaurus', name: 'Stegosaurus', diet: 'herbivore', price: 9000, size: 3,
    hungerRate: 1.8, meal: 25, fenceNeeded: 2, space: 30, appeal: 5, pace: 3, social: false, starter: true,
    period: 'Late Jurassic', lengthM: 9,
    fact: 'The plates on its back may have helped control body heat; the spiked tail, called a thagomizer, was for defence.',
    art: { template: 'stego', body: '#8fa05a', dark: '#56662f', accent: '#c9573b' },
  },
  triceratops: {
    id: 'triceratops', name: 'Triceratops', diet: 'herbivore', price: 12000, size: 3,
    hungerRate: 1.8, meal: 28, fenceNeeded: 2, space: 30, appeal: 6, pace: 3, social: true, starter: true,
    period: 'Late Cretaceous', lengthM: 9,
    fact: 'One of the last non-bird dinosaurs. Its skull, with three horns and a huge frill, could be over two metres long.',
    art: { template: 'ceratops', body: '#7d8a96', dark: '#4b5560', accent: '#d9c7a3' },
  },
  compsognathus: {
    id: 'compsognathus', name: 'Compsognathus', diet: 'carnivore', price: 2500, size: 1,
    hungerRate: 3, meal: 6, fenceNeeded: 1, space: 6, appeal: 1, pace: 1, social: true, starter: true,
    period: 'Late Jurassic', lengthM: 1,
    fact: 'About the size of a turkey. Fossils have been found with lizards in their stomachs, a quick hunter of small prey.',
    art: { template: 'raptor', body: '#9bbf5a', dark: '#5f7f2a', accent: '#e0c050' },
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', diet: 'carnivore', price: 7000, size: 2,
    hungerRate: 2.5, meal: 14, fenceNeeded: 2, space: 20, appeal: 5, pace: 1, social: false, starter: true,
    period: 'Early Jurassic', lengthM: 7,
    fact: 'Named for the pair of thin crests on its head. There is no evidence it could spit venom or had a neck frill.',
    art: { template: 'raptor', body: '#b8a14a', dark: '#7a6a2a', accent: '#d9573b' },
  },
  pachycephalosaurus: {
    id: 'pachycephalosaurus', name: 'Pachycephalosaurus', diet: 'herbivore', price: 8000, size: 2,
    hungerRate: 2, meal: 14, fenceNeeded: 2, space: 18, appeal: 4, pace: 2, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 4.5,
    fact: 'Its skull dome was up to 25 cm thick. Scientists still debate whether rivals butted heads or flanks.',
    art: { template: 'hadro', body: '#a07f5a', dark: '#6b5238', accent: '#e8d8b0' },
  },
  ankylosaurus: {
    id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'herbivore', price: 14000, size: 3,
    hungerRate: 1.6, meal: 26, fenceNeeded: 2, space: 28, appeal: 5, pace: 4, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 7,
    fact: 'Covered in bony armour plates, with a heavy club of fused bone at the end of its tail.',
    art: { template: 'ankylo', body: '#7a6f5a', dark: '#4a4336', accent: '#b0a17a' },
  },
  velociraptor: {
    id: 'velociraptor', name: 'Velociraptor', diet: 'carnivore', price: 15000, size: 2,
    hungerRate: 2.8, meal: 10, fenceNeeded: 3, space: 16, appeal: 7, pace: 1, social: true, starter: false,
    period: 'Late Cretaceous', lengthM: 2,
    fact: 'Really about the size of a large dog, and feathered. It had a large sickle-shaped claw on each foot.',
    art: { template: 'raptor', body: '#8c6a4a', dark: '#5a4028', accent: '#3f7fb0' },
  },
  allosaurus: {
    id: 'allosaurus', name: 'Allosaurus', diet: 'carnivore', price: 22000, size: 4,
    hungerRate: 2.4, meal: 30, fenceNeeded: 3, space: 40, appeal: 8, pace: 2, social: false, starter: false,
    period: 'Late Jurassic', lengthM: 9.5,
    fact: 'The top predator of the Jurassic in North America, with small horns above its eyes and dozens of serrated teeth.',
    art: { template: 'theropod', body: '#a8703f', dark: '#6b4424', accent: '#d9b060' },
  },
  brachiosaurus: {
    id: 'brachiosaurus', name: 'Brachiosaurus', diet: 'herbivore', price: 30000, size: 5,
    hungerRate: 1.4, meal: 60, fenceNeeded: 2, space: 60, appeal: 9, pace: 4, social: true, starter: false,
    period: 'Late Jurassic', lengthM: 22,
    fact: 'Its front legs were longer than its back legs, letting it browse treetops about 12 metres off the ground.',
    art: { template: 'sauropod', body: '#6f8a9e', dark: '#44596b', accent: '#9fb8c9' },
  },
  tyrannosaurus: {
    id: 'tyrannosaurus', name: 'Tyrannosaurus rex', diet: 'carnivore', price: 40000, size: 5,
    hungerRate: 2.2, meal: 45, fenceNeeded: 4, space: 60, appeal: 10, pace: 2, social: false, starter: false,
    period: 'Late Cretaceous', lengthM: 12,
    fact: 'Had one of the strongest bites of any land animal, strong enough to crunch through bone.',
    art: { template: 'theropod', body: '#6b7a4a', dark: '#40492a', accent: '#c9573b' },
  },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
export const STARTER_SPECIES = SPECIES_IDS.filter((id) => SPECIES[id].starter);

/** Pet names handed out to new arrivals. */
export const DINO_NAMES = [
  'Rex', 'Daisy', 'Pebbles', 'Spike', 'Clover', 'Bruno', 'Maple', 'Tank', 'Juniper', 'Ziggy',
  'Hazel', 'Rocco', 'Pip', 'Olive', 'Moss', 'Buster', 'Fern', 'Gus', 'Poppy', 'Boulder',
  'Kiwi', 'Sage', 'Nugget', 'Willow', 'Chomp', 'Button', 'Ember', 'Pickle', 'Thistle', 'Duke',
];
