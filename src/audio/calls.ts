import type { SpeciesId } from '../sim/data/species';

/**
 * Each species' voice, synthesised in audio.ts. Nobody knows exactly what
 * these animals sounded like, so these are playful guesses: big meat-eaters
 * roar, duck-bills and long-necks hoot, horned and armoured plant-eaters
 * bellow, small hunters chirp, pterosaurs screech and sea reptiles sing.
 */
export type CallKind = 'roar' | 'honk' | 'bellow' | 'chirp' | 'screech' | 'song';

export interface Call {
  kind: CallKind;
  /** Base pitch in Hz. */
  pitch: number;
  /** Seconds. */
  length: number;
}

export const CALLS: Record<SpeciesId, Call> = {
  protoceratops: { kind: 'bellow', pitch: 190, length: 0.35 },
  parasaurolophus: { kind: 'honk', pitch: 150, length: 0.9 },
  stegosaurus: { kind: 'bellow', pitch: 130, length: 0.5 },
  triceratops: { kind: 'bellow', pitch: 100, length: 0.7 },
  compsognathus: { kind: 'chirp', pitch: 1500, length: 0.15 },
  dilophosaurus: { kind: 'screech', pitch: 480, length: 0.5 },
  pachycephalosaurus: { kind: 'honk', pitch: 230, length: 0.4 },
  ankylosaurus: { kind: 'bellow', pitch: 85, length: 0.6 },
  velociraptor: { kind: 'chirp', pitch: 900, length: 0.3 },
  allosaurus: { kind: 'roar', pitch: 120, length: 0.9 },
  brachiosaurus: { kind: 'honk', pitch: 70, length: 1.3 },
  tyrannosaurus: { kind: 'roar', pitch: 70, length: 1.3 },
  plesiosaurus: { kind: 'song', pitch: 260, length: 1 },
  mosasaurus: { kind: 'song', pitch: 110, length: 1.2 },
  pteranodon: { kind: 'screech', pitch: 800, length: 0.5 },
  dimorphodon: { kind: 'chirp', pitch: 1800, length: 0.2 },
};

/** Babies: higher, shorter and softer. */
export function callFor(species: SpeciesId, baby: boolean): Call & { volume: number } {
  const c = CALLS[species];
  return baby ? { ...c, pitch: c.pitch * 1.8, length: c.length * 0.6, volume: 0.7 } : { ...c, volume: 1 };
}
