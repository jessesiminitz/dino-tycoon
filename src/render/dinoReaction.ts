import { habitatOf, SPECIES, type SpeciesId } from '../sim/data/species';
import type { MotionClip } from './immersionMotion';
import { BLENDER_MOTION } from './generated/blenderMotion';
export type DinoReactionAction = 'pat' | 'treat';
export const REACTION_MS = 1200;
export interface DinoReaction { clip?: MotionClip; frame: number; lift: number; angle: number }

/** Tapping a dinosaur in the pixel park: it winks back. */
export function winkReaction(id: SpeciesId, elapsed: number, animate = true): DinoReaction | undefined {
  const duration = BLENDER_MOTION[id].wink.durationMs;
  if (!animate || elapsed < 0 || elapsed >= duration) return undefined;
  return {clip:'wink',frame:Math.min(7,Math.floor(elapsed/duration*8)),lift:0,angle:0};
}

/**
 * Player gestures use a real-time clock, so a paused park can still answer a pat. A pat starts the happy
 * dance where the art has one (`playful`, the pixel edition); fliers still flutter up and swimmers dip.
 */
export function dinoReaction(id: SpeciesId, action: DinoReactionAction, elapsed: number, animate = true, playful = false): DinoReaction {
  if (elapsed < 0 || elapsed >= REACTION_MS) return {frame:0,lift:0,angle:0};
  const t = elapsed / REACTION_MS;
  if (action === 'treat') return {clip:'eat',frame:animate ? Math.min(7,Math.floor(t*8)) : 0,lift:0,angle:0};
  const habitat = habitatOf(id);
  const pulse = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI);
  const height = habitat === 'air' ? 5 : habitat === 'water' ? 2 : SPECIES[id].size <= 2 ? 3 : 1.5;
  // the dance bounces on its own, so a land animal no longer hops as a whole
  const dancing = playful && habitat === 'land';
  return {clip:playful ? 'dance' : habitat==='air' ? 'walk' : 'idle',frame:animate ? Math.min(7,Math.floor(t*8)) : 0,
    lift:animate && !dancing ? (habitat==='water' ? pulse : Math.abs(pulse))*height : 0,
    angle:animate && !dancing ? pulse*(habitat==='air'?5:3) : 0};
}
