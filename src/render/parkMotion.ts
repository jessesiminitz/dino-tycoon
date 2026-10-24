import type Phaser from 'phaser';
import { SPECIES, habitatOf, type SpeciesId } from '../sim/data/species';
import { hash2 } from '../sim/rng';
import { BLENDER_MOTION, FUN_CLIPS } from './generated/blenderMotion';
import { REX_ART, REX_WALK_CONTACTS, REX_WALK_CYCLE } from './generated/rexArt';
import { paintDinoRows, paintRexRows, dinoCanvasBounds, type DinoPixelBounds } from './dinoArt';
import { motionFrame, motionWalkSpeed, type MotionClip } from './immersionMotion';
import { dinoWorldScale } from './dinoSize';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { cartoonMetadata, paintCartoonAsset } from './cartoonArt';

export type FunClip = (typeof FUN_CLIPS)[number];
export const MOTION_CLIPS: MotionClip[] = ['walk', 'idle', 'eat', 'rest', ...FUN_CLIPS];
const isFun = (clip: MotionClip): clip is FunClip => (FUN_CLIPS as readonly string[]).includes(clip);

/** The pixel park's T-rex is hand-drawn (generated/rexArt.ts); every other animal comes from Blender. */
export const handDrawnRex = (species: SpeciesId, style: ArtStyle = ART_STYLE): boolean => species === 'tyrannosaurus' && style === 'blender';
/** The playful clips exist for the pixel art only; the cartoon edition keeps to its four. */
export const hasFunClips = (style: ArtStyle = ART_STYLE): boolean => style !== 'cartoon';

const blenderWidths = new Map<string, number>();
/** The width of a Blender clip's painted canvas, which the hand-drawn T-rex is padded to. */
function blenderWidth(species: SpeciesId, baby: boolean): number {
  const key = `${species}${baby ? '-baby' : ''}`;
  if (!blenderWidths.has(key)) blenderWidths.set(key, paintDinoRows(SPECIES[species], BLENDER_MOTION[species].walk.frames[0], baby, dinoWorldScale(species, 'blender')).width);
  return blenderWidths.get(key)!;
}

/** One pose of a clip, at the park's size, in the chosen art style. */
export function paintMotionFrame(species: SpeciesId, clip: MotionClip, frame: number, baby: boolean, style: ArtStyle = ART_STYLE): HTMLCanvasElement {
  const scale = dinoWorldScale(species, style);
  if (style === 'cartoon') return paintCartoonAsset(species, frame, SPECIES[species], baby, scale, isFun(clip) ? 'idle' : clip);
  if (handDrawnRex(species, style)) return paintRexRows(REX_ART[baby ? 'baby' : 'adult'].clips[clip][frame], baby, blenderWidth(species, baby));
  return paintDinoRows(SPECIES[species], BLENDER_MOTION[species][clip].frames[frame], baby, scale);
}

/** One GPU texture per appearance, prepared only when that animal is first seen: a row per clip. */
export function motionTexture(scene: Phaser.Scene, species: SpeciesId, baby: boolean): string {
  const key = `motion-${species}${baby ? '-baby' : ''}`;
  if (scene.textures.exists(key)) return key;
  const painted = MOTION_CLIPS.map((clip) => [...Array(8)].map((_, frame) => paintMotionFrame(species, clip, frame, baby)));
  const widths = painted.map((row) => Math.max(...row.map((c) => c.width)));
  const heights = painted.map((row) => Math.max(...row.map((c) => c.height)));
  const sheet = document.createElement('canvas');
  sheet.width = Math.max(...widths) * 8; sheet.height = heights.reduce((a, b) => a + b, 0);
  const ctx = sheet.getContext('2d')!;
  const bounds = new Map<string, DinoPixelBounds>();
  let top = 0;
  const tops = painted.map((row, r) => {
    row.forEach((canvas, frame) => {
      ctx.drawImage(canvas, frame * widths[r], top);
      bounds.set(`${MOTION_CLIPS[r]}-${frame}`, dinoCanvasBounds(canvas));
    });
    top += heights[r];
    return top - heights[r];
  });
  const texture = scene.textures.addCanvas(key, sheet)!;
  const resolution = cartoonMetadata(painted[0][0])?.resolution ?? 1;
  MOTION_CLIPS.forEach((clip, r) => {
    for (let frame = 0; frame < 8; frame++) {
      const name = `${clip}-${frame}`;
      Object.assign(texture.add(name, 0, frame * widths[r], tops[r], widths[r], heights[r])!.customData, { dinoBounds: bounds.get(name), renderResolution: resolution });
    }
  });
  return key;
}

/** Where a foot that just landed on the walk sits, in park pixels from the middle of the animal (facing right). */
export function walkLanding(species: SpeciesId, baby: boolean, from: number, to: number, style: ArtStyle = ART_STYLE): number | undefined {
  const size = baby ? .6 : 1;
  if (handDrawnRex(species, style)) {
    const foot = REX_WALK_CONTACTS[to].find((f) => f.planted && !REX_WALK_CONTACTS[from].find((old) => old.name === f.name)?.planted);
    const rexWidth = REX_ART.adult.clips.walk[0][0].length;
    return foot && (foot.x - rexWidth / 2) * size;
  }
  const walk = BLENDER_MOTION[species].walk;
  const foot = walk.contacts[to].find((f) => f.planted && !walk.contacts[from].find((old) => old.name === f.name)?.planted);
  return foot && (foot.x - walk.width / 2) * dinoWorldScale(species, style) * size;
}

/** Park pixels covered by one walk cycle, so planted feet stay put on the ground. */
export function walkCycle(species: SpeciesId, baby: boolean, style: ArtStyle = ART_STYLE): number {
  const size = baby ? .6 : 1;
  if (handDrawnRex(species, style)) return REX_WALK_CYCLE * size;
  return motionWalkSpeed(species) * BLENDER_MOTION[species].walk.durationMs / 1000 * dinoWorldScale(species, style) * size;
}

export interface AnimalMotion {
  x: number; y: number; distance: number; clip: MotionClip; started: number; frame: number;
  /** A playful clip shown in place of standing about; `frame` is then its frame. */
  fun?: FunClip;
}

/** Every 10 to 18 s of standing about, a dinosaur does something silly; the hunters like to roar. */
const FUN_BY_DIET: Record<string, readonly FunClip[]> = {
  carnivore: ['roar', 'stomp', 'sneeze', 'roar', 'hop'],
  piscivore: ['roar', 'hop', 'sneeze', 'dance'],
  herbivore: ['dance', 'hop', 'sneeze', 'stomp', 'dance'],
};
export function idleFun(species: SpeciesId, offset: number, idleMs: number, happiness = 50): { clip: FunClip; frame: number } | undefined {
  const every = 10_000 + Math.floor(hash2(offset, 7, 31) * 8000);
  const turn = Math.floor(idleMs / every), into = idleMs - turn * every;
  if (turn < 1) return undefined;
  const list = FUN_BY_DIET[SPECIES[species].diet] ?? FUN_BY_DIET.herbivore;
  // a happy animal dances every other time
  const clip = happiness >= 75 && turn % 2 === 0 && habitatOf(species) !== 'water' ? 'dance' : list[(turn + offset) % list.length];
  const duration = BLENDER_MOTION[species][clip].durationMs;
  return into < duration ? { clip, frame: Math.min(7, Math.floor(into / duration * 8)) } : undefined;
}

/** Distance advances the gait; time advances stationary behaviors. Teleports don't stride. */
export function advanceMotion(previous: AnimalMotion | undefined, input: {
  species: SpeciesId; baby: boolean; x: number; y: number; time: number;
  offset?: number; paused: boolean; moving: boolean; asleep: boolean; eatingSince?: number; ambient: boolean;
  style?: ArtStyle; happiness?: number;
}): AnimalMotion {
  if (previous && input.paused) return previous;
  const style = input.style ?? 'blender';
  const delta = previous ? Math.hypot(input.x - previous.x, input.y - previous.y) : 0;
  const distance = (previous?.distance ?? 0) + (input.moving && delta <= 32 ? delta : 0);
  const clip: MotionClip = input.moving ? 'walk' : input.asleep ? 'rest' : input.eatingSince !== undefined && input.time - input.eatingSince < 600 ? 'eat' : 'idle';
  const started = previous?.clip === clip ? previous.started : input.time-(clip==='idle'?(input.offset??0):0);
  let frame: number, fun: AnimalMotion['fun'];
  if (clip === 'walk') {
    frame = Math.floor(distance / Math.max(1e-6, walkCycle(input.species, input.baby, style)) * 8 + 1e-7) % 8;
  } else if (clip === 'eat') {
    frame = Math.min(7, Math.floor((input.time - input.eatingSince!) / 600 * 8));
  } else {
    const playful = clip === 'idle' && input.ambient && hasFunClips(style) ? idleFun(input.species, input.offset ?? 0, input.time - started, input.happiness) : undefined;
    fun = playful?.clip;
    frame = playful ? playful.frame : input.ambient ? motionFrame(input.species, clip, input.time - started) : 0;
  }
  return { x: input.x, y: input.y, distance, clip, started, frame, ...(fun ? { fun } : {}) };
}
