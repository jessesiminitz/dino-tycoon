import { BLENDER_MOTION } from './generated/blenderMotion';

export type MotionSpecies = keyof typeof BLENDER_MOTION;
export type MotionClip = keyof (typeof BLENDER_MOTION)['carnotaurus'];
export const MOTION_SPECIES: MotionSpecies[] = ['carnotaurus','diplodocus','yutyrannus'];

export function motionFrame(species: MotionSpecies, clip: MotionClip, timeMs: number): number {
  const motion = BLENDER_MOTION[species][clip];
  return Math.floor(Math.max(0,timeMs)%motion.durationMs/motion.durationMs*motion.frames.length);
}

/** Native pixels / second, measured from the backward travel of a planted mesh. */
export function motionWalkSpeed(species: MotionSpecies): number {
  const walk = BLENDER_MOTION[species].walk;
  const before = walk.contacts[0].find(foot => foot.name === (species === 'diplodocus' ? 'near_back_foot' : 'near_foot'))!;
  const after = walk.contacts[1].find(foot => foot.name === before.name)!;
  return (before.x-after.x)*walk.frames.length*1000/walk.durationMs;
}
