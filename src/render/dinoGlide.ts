/**
 * Smooth walking between tiles. The simulation moves an animal a whole tile at a time, and a big one only
 * every few steps; drawn as it is, that is a dash and a wait. A glide spreads each tile over the whole time
 * until the animal may move again, so it walks at a steady pace, easing away from a stand and into a stop.
 */
export interface Glide {
  /** The tile the glide ends on. */
  tileX: number; tileY: number;
  fromX: number; fromY: number; toX: number; toY: number;
  start: number; duration: number;
  /** Sets off from a stand, and comes to a stop (no more route ahead). */
  easeIn: boolean; easeOut: boolean;
}

/** Further than this in one move is a teleport (carried home, a new park): no walking across. */
const TELEPORT = 2.2;

/** Progress along a glide: its speed is 1 where it joins a neighbouring glide, 0 at a stand. */
export function glideEase(u: number, easeIn: boolean, easeOut: boolean): number {
  u = Math.min(1, Math.max(0, u));
  if (easeIn && easeOut) return u * u * (3 - 2 * u);
  if (easeIn) return u * u * (2 - u);
  if (easeOut) { const v = 1 - u; return 1 - v * v * (2 - v); }
  return u;
}

export function glideAt(glide: Glide, time: number): { x: number; y: number; moving: boolean } {
  const u = glide.duration <= 0 ? 1 : (time - glide.start) / glide.duration;
  if (u >= 1) return { x: glide.toX, y: glide.toY, moving: false };
  const p = glideEase(u, glide.easeIn, glide.easeOut);
  return { x: glide.fromX + (glide.toX - glide.fromX) * p, y: glide.fromY + (glide.toY - glide.fromY) * p, moving: true };
}

/**
 * Follows an animal's tile. `x`, `y` are where that tile is drawn, `tile` its size, `stepMs` the time until
 * the animal may move again, `last` whether its route ends here.
 */
export function advanceGlide(previous: Glide | undefined, input: {
  tileX: number; tileY: number; x: number; y: number; tile: number; time: number; stepMs: number; last: boolean;
}): Glide {
  const still: Glide = { tileX: input.tileX, tileY: input.tileY, fromX: input.x, fromY: input.y, toX: input.x, toY: input.y,
    start: input.time, duration: 0, easeIn: false, easeOut: false };
  if (!previous) return still;
  if (previous.tileX === input.tileX && previous.tileY === input.tileY) {
    // the route went on (or ended) after this tile was started: only the stop can still change
    return previous;
  }
  const now = glideAt(previous, input.time);
  if (Math.hypot(input.x - now.x, input.y - now.y) > TELEPORT * input.tile) return still;
  // still walking, or it arrived only a moment ago: carry on at the same pace
  const walking = now.moving || input.time - (previous.start + previous.duration) < input.stepMs * .25;
  return { tileX: input.tileX, tileY: input.tileY, fromX: now.x, fromY: now.y, toX: input.x, toY: input.y,
    start: input.time, duration: input.stepMs, easeIn: !walking || previous.duration === 0, easeOut: input.last };
}
