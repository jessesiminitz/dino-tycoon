import type { Simulation, Speed } from '../sim/Simulation';

/**
 * Popups that pause the park share one hold: the park stays paused while any of them is open,
 * and only when the last one closes does it go back to the speed it had before the first opened
 * (still paused, if the player had paused it). The holder is any object unique to the popup.
 */
const holds = new WeakMap<Simulation, { holders: Set<object>; before: Speed }>();

export function holdPause(sim: Simulation, holder: object): void {
  let h = holds.get(sim);
  if (!h) holds.set(sim, (h = { holders: new Set(), before: sim.speed }));
  if (h.holders.has(holder)) return;
  if (h.holders.size === 0) h.before = sim.speed;
  h.holders.add(holder);
  sim.setSpeed(0);
}

export function releasePause(sim: Simulation, holder: object): void {
  const h = holds.get(sim);
  if (!h?.holders.delete(holder) || h.holders.size > 0) return;
  // If the player picked a speed while the popup was up, keep it.
  if (sim.speed === 0) sim.setSpeed(h.before);
}
