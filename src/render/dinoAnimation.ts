/** Pose selection uses movement interpolation, so simulation speed drives walking. */
export function walkFrame(count: number, moving: boolean, progress: number, paused: boolean, asleep: boolean): number {
  if (!moving || paused || asleep) return 0;
  return Math.min(count - 1, Math.floor(Math.max(0, progress) * count));
}
