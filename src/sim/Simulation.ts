import type { GameState } from './GameState';

/** Real-time milliseconds per game-hour at 1× speed. */
export const MS_PER_HOUR = 1000;

export type Speed = 0 | 1 | 2 | 4;

type Listener = (state: GameState) => void;

/**
 * Owns the GameState and advances it on a fixed timestep, independent of
 * render frame rate. Rendering reads `state`; input goes through `dispatch`
 * (commands arrive in Milestone 2).
 */
export class Simulation {
  speed: Speed = 1;
  private accumulator = 0;
  private listeners = new Set<Listener>();

  constructor(public state: GameState) {}

  /** Feed real elapsed time; runs zero or more whole ticks. Returns ticks run. */
  advance(realMs: number): number {
    if (this.speed === 0) return 0;
    // Clamp so returning from a backgrounded tab doesn't fast-forward days.
    this.accumulator += Math.min(realMs, 250) * this.speed;
    let ticks = 0;
    while (this.accumulator >= MS_PER_HOUR) {
      this.accumulator -= MS_PER_HOUR;
      this.tick();
      ticks++;
    }
    if (ticks > 0) this.emit();
    return ticks;
  }

  /** One game-hour. Systems (dinos, visitors, economy...) plug in here. */
  tick(): void {
    this.state.hours += 1;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}
