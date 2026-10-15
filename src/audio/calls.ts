import type { SpeciesId } from '../sim/data/species';

/** Evidence-informed sound design, not recordings or exact reconstructions.
 * Low closed-mouth booms/coos use living archosaurs as analogues; the
 * Parasaurolophus voice adds crest-like resonance. Other reptiles are speculative.
 * Research and the limits of each inference: docs/dinosaur-audio.md.
 */
export type CallKind = 'boom' | 'crest' | 'coo' | 'grunt' | 'cluck' | 'rasp' | 'breath';

export interface Call {
  kind: CallKind;
  /** Base pitch in Hz. */
  pitch: number;
  /** Seconds. */
  length: number;
}

export const CALLS: Record<SpeciesId, Call> = {
  protoceratops: { kind: 'grunt', pitch: 190, length: 0.35 },
  parasaurolophus: { kind: 'crest', pitch: 74, length: 1.4 },
  stegosaurus: { kind: 'grunt', pitch: 130, length: 0.5 },
  triceratops: { kind: 'grunt', pitch: 100, length: 0.7 },
  compsognathus: { kind: 'cluck', pitch: 620, length: 0.15 },
  dilophosaurus: { kind: 'rasp', pitch: 220, length: 0.5 },
  pachycephalosaurus: { kind: 'coo', pitch: 230, length: 0.4 },
  ankylosaurus: { kind: 'grunt', pitch: 85, length: 0.6 },
  velociraptor: { kind: 'cluck', pitch: 360, length: 0.3 },
  allosaurus: { kind: 'boom', pitch: 120, length: 0.9 },
  brachiosaurus: { kind: 'boom', pitch: 48, length: 1.3 },
  tyrannosaurus: { kind: 'boom', pitch: 54, length: 1.3 },
  plesiosaurus: { kind: 'breath', pitch: 190, length: 1 },
  mosasaurus: { kind: 'breath', pitch: 90, length: 1.2 },
  pteranodon: { kind: 'rasp', pitch: 420, length: 0.5 },
  dimorphodon: { kind: 'cluck', pitch: 850, length: 0.2 },
  spinosaurus: { kind: 'boom', pitch: 85, length: 1.2 },
  therizinosaurus: { kind: 'coo', pitch: 100, length: 1 },
  amargasaurus: { kind: 'coo', pitch: 95, length: 0.8 },
  kentrosaurus: { kind: 'grunt', pitch: 145, length: 0.5 },
  styracosaurus: { kind: 'grunt', pitch: 115, length: 0.7 },
  carnotaurus: { kind: 'boom', pitch: 135, length: 0.8 },
  yutyrannus: { kind: 'boom', pitch: 145, length: 0.9 },
  iguanodon: { kind: 'coo', pitch: 170, length: 0.8 },
  microraptor: { kind: 'cluck', pitch: 780, length: 0.2 },
  diplodocus: { kind: 'coo', pitch: 65, length: 1.4 },
  argentinosaurus: { kind: 'grunt', pitch: 50, length: 1.5 },
  nigersaurus: { kind: 'coo', pitch: 180, length: 0.6 },
};

/** Babies: higher, shorter and softer. */
export function callFor(species: SpeciesId, baby: boolean): Call & { volume: number } {
  const c = CALLS[species];
  return baby ? { ...c, pitch: c.pitch * 1.8, length: c.length * 0.6, volume: 0.7 } : { ...c, volume: 1 };
}
