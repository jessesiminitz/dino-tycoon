import type Phaser from 'phaser';
import { SPECIES, type SpeciesId } from '../sim/data/species';
import { BLENDER_MOTION } from './generated/blenderMotion';
import { paintDinoRows, dinoCanvasBounds, type DinoPixelBounds } from './dinoArt';
import { motionFrame, motionWalkSpeed, type MotionClip } from './immersionMotion';
import { dinoWorldScale } from './dinoSize';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { cartoonMetadata, paintCartoonAsset } from './cartoonArt';

export const MOTION_CLIPS: MotionClip[] = ['walk', 'idle', 'eat', 'rest'];

/** One GPU texture per appearance, prepared only when that animal is first seen. */
export function motionTexture(scene: Phaser.Scene, species: SpeciesId, baby: boolean): string {
  const key = `motion-${species}${baby ? '-baby' : ''}`;
  if (scene.textures.exists(key)) return key;
  const clips = BLENDER_MOTION[species];
  const scale = dinoWorldScale(species, ART_STYLE);
  const paint = (clip: MotionClip, frame: number) => ART_STYLE === 'cartoon'
    ? paintCartoonAsset(species, frame, SPECIES[species], baby, scale, clip)
    : paintDinoRows(SPECIES[species], clips[clip].frames[frame], baby, scale);
  const sample = paint('walk', 0);
  const width = sample.width, height = sample.height;
  const sheet = document.createElement('canvas');
  sheet.width = width * 8; sheet.height = height * 4;
  const ctx = sheet.getContext('2d')!;
  const bounds = new Map<string, DinoPixelBounds>();
  for (const [row, clip] of MOTION_CLIPS.entries()) {
    clips[clip].frames.forEach((_rows, frame) => {
      const canvas = paint(clip, frame);
      ctx.drawImage(canvas, frame * width, row * height);
      bounds.set(`${clip}-${frame}`, dinoCanvasBounds(canvas));
    });
  }
  const texture = scene.textures.addCanvas(key, sheet)!;
  for (const [row, clip] of MOTION_CLIPS.entries()) {
    for (let frame = 0; frame < 8; frame++) {
      const name = `${clip}-${frame}`;
      Object.assign(texture.add(name, 0, frame * width, row * height, width, height)!.customData, { dinoBounds: bounds.get(name), renderResolution: cartoonMetadata(sample)?.resolution ?? 1 });
    }
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
  style?: ArtStyle;
}): AnimalMotion {
  if (previous && input.paused) return previous;
  const delta = previous ? Math.hypot(input.x - previous.x, input.y - previous.y) : 0;
  const distance = (previous?.distance ?? 0) + (input.moving && delta <= 32 ? delta : 0);
  const clip: MotionClip = input.moving ? 'walk' : input.asleep ? 'rest' : input.eatingSince !== undefined && input.time - input.eatingSince < 600 ? 'eat' : 'idle';
  const started = previous?.clip === clip ? previous.started : input.time-(clip==='idle'?(input.offset??0):0);
  let frame: number;
  if (clip === 'walk') {
    const scale = dinoWorldScale(input.species, input.style ?? 'blender') * (input.baby ? .6 : 1);
    const cycle = motionWalkSpeed(input.species) * BLENDER_MOTION[input.species].walk.durationMs / 1000 * scale;
    frame = Math.floor(distance / Math.max(1e-6, cycle) * 8 + 1e-7) % 8;
  } else if (clip === 'eat') {
    frame = Math.min(7, Math.floor((input.time - input.eatingSince!) / 600 * 8));
  } else frame = input.ambient ? motionFrame(input.species, clip, input.time - started) : 0;
  return { x: input.x, y: input.y, distance, clip, started, frame };
}
