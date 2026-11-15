import type Phaser from 'phaser';
import { SPECIES, habitatOf, type SpeciesId } from '../sim/data/species';
import { hash2 } from '../sim/rng';
import { BLENDER_MOTION, FUN_CLIPS, IDLE_CLIPS } from './generated/blenderMotion';
import { REX_ART, REX_WALK_CONTACTS, REX_WALK_CYCLE } from './generated/rexArt';
import { paintDinoRows, paintRexRows, dinoCanvasBounds, type DinoPixelBounds } from './dinoArt';
import { motionFrame, motionWalkSpeed, type MotionClip } from './immersionMotion';
import { dinoWorldScale } from './dinoSize';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { cartoonMetadata, paintCartoonAsset } from './cartoonArt';

export type FunClip = (typeof FUN_CLIPS)[number];
export type IdleClip = (typeof IDLE_CLIPS)[number];
export const MOTION_CLIPS: MotionClip[] = ['walk', 'idle', 'eat', 'rest', ...FUN_CLIPS, ...IDLE_CLIPS];
const isExtra = (clip: MotionClip): boolean => (FUN_CLIPS as readonly string[]).includes(clip) || (IDLE_CLIPS as readonly string[]).includes(clip);
/** Frames across one line of the atlas; a longer clip (the sixteen-pose walk) wraps onto more lines. */
const ATLAS_COLUMNS = 8;

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
  if (style === 'cartoon') return paintCartoonAsset(species, frame, SPECIES[species], baby, scale, isExtra(clip) ? 'idle' : clip);
  if (handDrawnRex(species, style)) return paintRexRows(REX_ART[baby ? 'baby' : 'adult'].clips[clip][frame], baby, blenderWidth(species, baby));
  const rows = BLENDER_MOTION[species][clip].frames[frame];
  return paintDinoRows(SPECIES[species], clip === 'rest' ? shutEyes(rows) : rows, baby, scale);
}

/** A sleeping animal's eyes are shut: the white goes, and the pupil is left as a one-row lid line. */
export function shutEyes(rows: readonly string[]): string[] {
  const lid = rows.reduce((last, row, y) => (row.includes('E') ? y : last), -1);
  return rows.map((row, y) => row.replace(/Y/g, 'B').replace(/E/g, y === lid ? 'E' : 'B'));
}

/** How many poses a clip has: the walk sixteen (the cartoon edition eight), every other clip eight. */
export function clipFrames(species: SpeciesId, clip: MotionClip, style: ArtStyle = ART_STYLE): number {
  if (style === 'cartoon') return 8;
  if (handDrawnRex(species, style)) return REX_ART.adult.clips[clip].length;
  return BLENDER_MOTION[species][clip].frames.length;
}

/** One GPU texture per appearance, prepared only when that animal is first seen: a row per clip. */
export function motionTexture(scene: Phaser.Scene, species: SpeciesId, baby: boolean): string {
  const key = `motion-${species}${baby ? '-baby' : ''}`;
  if (scene.textures.exists(key)) return key;
  const painted = MOTION_CLIPS.map((clip) => [...Array(clipFrames(species, clip))].map((_, frame) => paintMotionFrame(species, clip, frame, baby)));
  const widths = painted.map((row) => Math.max(...row.map((c) => c.width)));
  const heights = painted.map((row) => Math.max(...row.map((c) => c.height)));
  const lines = painted.map((row) => Math.ceil(row.length / ATLAS_COLUMNS));
  const sheet = document.createElement('canvas');
  sheet.width = Math.max(...widths) * ATLAS_COLUMNS; sheet.height = heights.reduce((sum, h, r) => sum + h * lines[r], 0);
  const ctx = sheet.getContext('2d')!;
  const bounds = new Map<string, DinoPixelBounds>();
  let top = 0;
  const tops = painted.map((row, r) => {
    row.forEach((canvas, frame) => {
      ctx.drawImage(canvas, (frame % ATLAS_COLUMNS) * widths[r], top + Math.floor(frame / ATLAS_COLUMNS) * heights[r]);
      bounds.set(`${MOTION_CLIPS[r]}-${frame}`, dinoCanvasBounds(canvas));
    });
    top += heights[r] * lines[r];
    return top - heights[r] * lines[r];
  });
  const texture = scene.textures.addCanvas(key, sheet)!;
  const resolution = cartoonMetadata(painted[0][0])?.resolution ?? 1;
  MOTION_CLIPS.forEach((clip, r) => {
    for (let frame = 0; frame < painted[r].length; frame++) {
      const name = `${clip}-${frame}`;
      Object.assign(texture.add(name, 0, (frame % ATLAS_COLUMNS) * widths[r], tops[r] + Math.floor(frame / ATLAS_COLUMNS) * heights[r], widths[r], heights[r])!.customData, { dinoBounds: bounds.get(name), renderResolution: resolution });
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
  // the cartoon edition's eight walk poses are every other one of the sixteen measured here
  const every = walk.contacts.length / clipFrames(species, 'walk', style);
  const foot = walk.contacts[to * every].find((f) => f.planted && !walk.contacts[from * every].find((old) => old.name === f.name)?.planted);
  return foot && (foot.x - walk.width / 2) * dinoWorldScale(species, style) * size;
}

/** Park pixels covered by one walk cycle, so planted feet stay put on the ground. */
export function walkCycle(species: SpeciesId, baby: boolean, style: ArtStyle = ART_STYLE): number {
  const size = baby ? .6 : 1;
  if (handDrawnRex(species, style)) return REX_WALK_CYCLE * size;
  return motionWalkSpeed(species) * BLENDER_MOTION[species].walk.durationMs / 1000 * dinoWorldScale(species, style) * size;
}

/** Where in the walk cycle the legs match the standing pose, so a walk steps off from it and settles back into it. */
export const standPhase = (species: SpeciesId, style: ArtStyle = ART_STYLE): number => handDrawnRex(species, style) ? 7 / 12 : 1 / 6;
/** After the last step, the legs come to the standing pose one walk frame at a time, this far apart. */
const SETTLE_MS = 55;

export interface AnimalMotion {
  x: number; y: number; distance: number; clip: MotionClip; started: number; frame: number;
  /** A playful or small idle clip shown in place of standing about; `frame` is then its frame. */
  fun?: MotionClip;
  /** Which stretch of standing about this is (see idleMove): it changes when a new move may start. */
  turn?: number;
  /** When the legs last stepped toward the standing pose. */
  settled?: number;
}

/** A playful move comes every third turn of standing about (every 11 to 18 s); the hunters like to roar. */
const FUN_BY_DIET: Record<string, readonly FunClip[]> = {
  carnivore: ['roar', 'stomp', 'wink', 'sneeze', 'roar', 'hop'],
  piscivore: ['roar', 'hop', 'wink', 'sneeze', 'dance'],
  herbivore: ['dance', 'hop', 'wink', 'sneeze', 'stomp', 'dance'],
};
/** In the turns between, something small: a look round, a sniff at the ground, a swish of the tail, a yawn. */
const IDLE_BY_DIET: Record<string, readonly IdleClip[]> = {
  carnivore: ['look', 'swish', 'sniff', 'look', 'yawn'],
  piscivore: ['look', 'swish', 'yawn', 'look', 'sniff'],
  herbivore: ['sniff', 'look', 'swish', 'sniff', 'yawn'],
};
const FUN_EVERY = 3;
export interface IdleMove { clip: MotionClip; frame: number; turn: number }
/** How long one turn of standing about lasts for this animal: 3.6 to 6 s. */
export const idleTurnMs = (offset: number): number => 3600 + Math.floor(hash2(offset, 7, 31) * 2400);
/**
 * What an animal standing about is doing, `idleMs` after it stopped. Its time is cut into turns; each turn
 * after the first may open with a move. `drink` (it stands beside water) swaps some small moves for a drink.
 */
export function idleMove(species: SpeciesId, offset: number, idleMs: number, happiness = 50, drink = false): IdleMove | undefined {
  const every = idleTurnMs(offset);
  const turn = Math.floor(idleMs / every), into = idleMs - turn * every;
  if (turn < 1) return undefined;
  const diet = SPECIES[species].diet, habitat = habitatOf(species);
  let clip: MotionClip;
  if (turn % FUN_EVERY === 0) {
    const round = turn / FUN_EVERY;
    const list = FUN_BY_DIET[diet] ?? FUN_BY_DIET.herbivore;
    // a happy animal dances every other time
    clip = happiness >= 75 && round % 2 === 0 && habitat !== 'water' ? 'dance' : list[(round + offset) % list.length];
  } else {
    const roll = hash2(offset, turn, 53);
    if (roll < .18) return undefined;   // now and then it just stands
    const list = (IDLE_BY_DIET[diet] ?? IDLE_BY_DIET.herbivore).filter((c) => habitat === 'land' || c !== 'sniff');
    clip = drink && roll > .55 ? 'eat' : list[Math.floor(hash2(turn, offset, 59) * list.length) % list.length];
  }
  const duration = BLENDER_MOTION[species][clip].durationMs;
  return into < duration ? { clip, frame: Math.min(7, Math.floor(into / duration * 8)), turn } : undefined;
}

/** Distance advances the gait; time advances stationary behaviors. Teleports don't stride. */
export function advanceMotion(previous: AnimalMotion | undefined, input: {
  species: SpeciesId; baby: boolean; x: number; y: number; time: number;
  offset?: number; paused: boolean; moving: boolean; asleep: boolean; eatingSince?: number; ambient: boolean;
  style?: ArtStyle; happiness?: number; drink?: boolean;
}): AnimalMotion {
  if (previous && input.paused) return previous;
  const style = input.style ?? 'blender';
  const frames = clipFrames(input.species, 'walk', style);
  const cycle = Math.max(1e-6, walkCycle(input.species, input.baby, style));
  const land = habitatOf(input.species) === 'land';
  const stand = standPhase(input.species, style);
  const walkFrameAt = (d: number) => Math.floor(d / cycle * frames + 1e-7) % frames;
  const delta = previous ? Math.hypot(input.x - previous.x, input.y - previous.y) : 0;
  let distance = previous?.distance ?? 0;
  // a land animal steps off from the pose it stands in
  if (input.moving && land && previous && previous.clip !== 'walk') distance = (Math.round(stand * frames) % frames) * cycle / frames;
  if (input.moving && delta <= 32) distance += delta;
  let clip: MotionClip = input.moving ? 'walk' : input.asleep ? 'rest' : input.eatingSince !== undefined && input.time - input.eatingSince < 600 ? 'eat' : 'idle';
  let settled: number | undefined;
  if (!input.moving && previous?.clip === 'walk' && land && input.ambient) {
    // the last step is done: bring the legs to the standing pose the short way round, a frame at a time
    const at = walkFrameAt(distance), target = Math.round(stand * frames) % frames;
    if (at !== target) {
      clip = 'walk';
      settled = previous.settled ?? input.time;
      if (input.time - settled >= SETTLE_MS) {
        const forward = (target - at + frames) % frames;
        distance = ((at + (forward <= frames / 2 ? 1 : -1) + frames) % frames + .5) * cycle / frames;
        settled = input.time;
      }
    }
  }
  const started = previous?.clip === clip ? previous.started : input.time;
  let frame: number, fun: AnimalMotion['fun'], turn: number | undefined;
  if (clip === 'walk') {
    frame = walkFrameAt(distance);
  } else if (clip === 'eat') {
    frame = Math.min(7, Math.floor((input.time - input.eatingSince!) / 600 * 8));
  } else {
    const idleMs = input.time - started;
    if (clip === 'idle') turn = Math.floor(idleMs / idleTurnMs(input.offset ?? 0));
    const move = clip === 'idle' && input.ambient && hasFunClips(style) ? idleMove(input.species, input.offset ?? 0, idleMs, input.happiness, input.drink) : undefined;
    fun = move?.clip;
    frame = move ? move.frame : input.ambient ? motionFrame(input.species, clip, idleMs) : 0;
  }
  return { x: input.x, y: input.y, distance, clip, started, frame, ...(fun ? { fun } : {}), ...(turn !== undefined ? { turn } : {}), ...(settled !== undefined ? { settled } : {}) };
}
