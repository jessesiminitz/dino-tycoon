import type { GameState } from './GameState';
import { applyCommand, type Command, type CommandResult } from './commands';
import { computeRegions, type RegionMap } from './regions';
import { Rng } from './rng';
import type { GameEvent, SimContext } from './systems/context';
import { hourlyDinos, stepDinos, STEPS_PER_HOUR } from './systems/dinos';

/** Real-time milliseconds per game-hour at 1× speed. */
export const MS_PER_HOUR = 1000;
/** Real-time milliseconds per movement step at 1× speed. */
export const MS_PER_STEP = MS_PER_HOUR / STEPS_PER_HOUR;

export type Speed = 0 | 1 | 2 | 4;

type Listener = (state: GameState) => void;
type EventListener = (event: GameEvent) => void;

/**
 * Owns the GameState and advances it on a fixed timestep, independent of
 * render frame rate: several movement steps per game-hour, with hourly
 * systems (hunger, health...) on the hour. Rendering reads `state`;
 * player input goes through `dispatch`.
 */
export class Simulation {
  speed: Speed = 1;
  /** Bumped whenever the built world changes (fences, land), so renderers know to redraw. */
  worldRevision = 0;
  private accumulator = 0;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  private regionCache?: { revision: number; map: RegionMap };

  constructor(public state: GameState) {}

  /** Feed real elapsed time; runs zero or more whole steps. Returns steps run. */
  advance(realMs: number): number {
    if (this.speed === 0) return 0;
    // Clamp so returning from a backgrounded tab doesn't fast-forward days.
    this.accumulator += Math.min(realMs, 250) * this.speed;
    let steps = 0;
    while (this.accumulator >= MS_PER_STEP) {
      this.accumulator -= MS_PER_STEP;
      this.step();
      steps++;
    }
    if (steps > 0) this.emit();
    return steps;
  }

  /** Progress (0–1) from the last step toward the next, for smooth rendering. */
  get stepProgress(): number {
    return this.speed === 0 ? 1 : this.accumulator / MS_PER_STEP;
  }

  /** One movement step; every STEPS_PER_HOUR steps is a game-hour. */
  step(): void {
    const { state } = this;
    const rng = new Rng(state.rngState);
    const ctx: SimContext = { state, rng, regions: this.regions(), emit: (e) => this.emitEvent(e) };
    stepDinos(ctx);
    state.stepInHour++;
    if (state.stepInHour >= STEPS_PER_HOUR) {
      state.stepInHour = 0;
      state.hours++;
      hourlyDinos(ctx);
    }
    state.rngState = rng.snapshot;
  }

  dispatch(cmd: Command): CommandResult {
    const result = applyCommand(this.state, cmd);
    if (result.ok) {
      this.worldRevision++;
      this.emit();
    }
    return result;
  }

  /** Paddocks and other connected areas, recomputed only after the world changes. */
  regions(): RegionMap {
    if (this.regionCache?.revision !== this.worldRevision) {
      this.regionCache = { revision: this.worldRevision, map: computeRegions(this.state) };
    }
    return this.regionCache.map;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Things that happened in the park (a dino starved, a feeder ran dry...). */
  onEvent(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  private emitEvent(e: GameEvent): void {
    for (const fn of this.eventListeners) fn(e);
  }
}
