import type Phaser from 'phaser';
import { SPECIES, type SpeciesId } from '../sim/data/species';
import { BLENDER_MOTION } from './generated/blenderMotion';
import { paintDinoRows } from './dinoArt';
import { motionFrame, motionWalkSpeed, type MotionClip } from './immersionMotion';

export const MOTION_CLIPS: MotionClip[] = ['walk', 'idle', 'eat', 'rest'];

/** One GPU texture per appearance, prepared only when that animal is first seen. */
export function motionTexture(scene: Phaser.Scene, species: SpeciesId, baby: boolean): string {
  const key = `motion-${species}${baby ? '-baby' : ''}`;
  if (scene.textures.exists(key)) return key;
  const clips = BLENDER_MOTION[species];
  const sample = paintDinoRows(SPECIES[species], clips.walk.frames[0], baby);
  const width = sample.width, height = sample.height;
  const sheet = document.createElement('canvas');
  sheet.width = width * 8; sheet.height = height * 4;
  const ctx = sheet.getContext('2d')!;
  for (const [row, clip] of MOTION_CLIPS.entries()) {
    clips[clip].frames.forEach((rows, frame) => ctx.drawImage(paintDinoRows(SPECIES[species], rows, baby), frame * width, row * height));
  }
  const texture = scene.textures.addCanvas(key, sheet)!;
  for (const [row, clip] of MOTION_CLIPS.entries()) {
    for (let frame = 0; frame < 8; frame++) texture.add(`${clip}-${frame}`, 0, frame * width, row * height, width, height);
  }
  return key;
}

export interface AnimalMotion {
  x: number; y: number; distance: number; clip: MotionClip; started: number; frame: number;
}

/** Distance advances the gait; time advances stationary behaviors. Teleports don't stride. */
export function advanceMotion(previous: AnimalMotion | undefined, input: {
  species: SpeciesId; baby: boolean; x: number; y: number; time: number;
  offset?: number; paused: boolean; moving: boolean; asleep: boolean; eatingSince?: number; ambient: boolean;
}): AnimalMotion {
  if (previous && input.paused) return previous;
  const delta = previous ? Math.hypot(input.x - previous.x, input.y - previous.y) : 0;
  const distance = (previous?.distance ?? 0) + (input.moving && delta <= 32 ? delta : 0);
  const clip: MotionClip = input.moving ? 'walk' : input.asleep ? 'rest' : input.eatingSince !== undefined && input.time - input.eatingSince < 600 ? 'eat' : 'idle';
  const started = previous?.clip === clip ? previous.started : input.time-(clip==='idle'?(input.offset??0):0);
  let frame: number;
  if (clip === 'walk') {
    const scale = input.baby ? .6 : 1;
    const cycle = motionWalkSpeed(input.species) * BLENDER_MOTION[input.species].walk.durationMs / 1000 * scale;
    frame = Math.floor(distance / Math.max(1, cycle) * 8 + 1e-7) % 8;
  } else if (clip === 'eat') {
    frame = Math.min(7, Math.floor((input.time - input.eatingSince!) / 600 * 8));
  } else frame = input.ambient ? motionFrame(input.species, clip, input.time - started) : 0;
  return { x: input.x, y: input.y, distance, clip, started, frame };
}
