import { MAX_LOG, type GameState } from './GameState';
import { applyCommand, type Command, type CommandResult } from './commands';
import { computeRegions, type RegionMap } from './regions';
import { Rng } from './rng';
import type { GameEvent, SimContext } from './systems/context';
import { hourlyDinos, stepDinos, STEPS_PER_HOUR } from './systems/dinos';
import { hourlyBreeding } from './systems/breeding';
import { hourlyRequests, updateRequests } from './systems/requests';
import { stepJeeps } from './systems/rides';
import { hourlyChoices } from './systems/choices';
import { hourlyVisitors, stepVisitors } from './systems/visitors';
import { hourlyEconomy } from './systems/economy';
import { hourlyFences, hourlyHealth, stepEscapes } from './systems/incidents';
import { stepStaff } from './systems/staff';
import { hourlyEvents } from './systems/events';
import { hourlyFossils } from './systems/fossils';
import { hourlyScenario } from './goals';

/** Real-time milliseconds per game-hour at 1× speed: a game day takes a minute. */
/** Real milliseconds per game-hour at 1× speed: a game day lasts five minutes. */
export const MS_PER_HOUR = 12_500;
/** Real-time milliseconds per movement step at 1× speed. */
export const MS_PER_STEP = MS_PER_HOUR / STEPS_PER_HOUR;

export type Speed = 0 | 1 | 3 | 8;

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
  /** Bumped whenever the built world changes (fences built or broken, land), so renderers and paddocks update. */
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

  /** How far through the current game-hour we are (0–1), for the clock's minutes. */
  get stepProgressInHour(): number {
    return Math.min(1, (this.state.stepInHour + (this.speed === 0 ? 0 : this.accumulator / MS_PER_STEP)) / STEPS_PER_HOUR);
  }

  /** Progress (0–1) from the last step toward the next, for smooth rendering. */
  get stepProgress(): number {
    return this.speed === 0 ? 1 : this.accumulator / MS_PER_STEP;
  }

  /** One movement step; every STEPS_PER_HOUR steps is a game-hour. */
  step(): void {
    const { state } = this;
    const rng = new Rng(state.rngState);
    const ctx: SimContext = {
      state,
      rng,
      regions: this.regions(),
      emit: (e) => this.emitEvent(e),
      invalidateWorld: () => this.worldRevision++,
    };
    stepDinos(ctx);
    stepEscapes(ctx);
    stepVisitors(ctx);
    stepJeeps(ctx);
    stepStaff(ctx);
    state.stepInHour++;
    if (state.stepInHour >= STEPS_PER_HOUR) {
      state.stepInHour = 0;
      state.hours++;
      hourlyDinos(ctx);
      hourlyBreeding(ctx);
      hourlyHealth(ctx);
      hourlyFences(ctx);
      hourlyEvents(ctx);
      hourlyVisitors(ctx);
      hourlyFossils(ctx);
      hourlyEconomy(ctx);
      hourlyScenario(ctx);
      hourlyRequests(ctx);
      hourlyChoices(ctx);
    }
    state.rngState = rng.snapshot;
  }

  dispatch(cmd: Command): CommandResult {
    const result = applyCommand(this.state, cmd);
    // A decision's outcome goes in the park log like any other news.
    if (result.ok && cmd.type === 'chooseOption') this.emitEvent({ text: result.message, kind: 'info' });
    if (result.ok) {
      // Building a stall or buying a species can meet a request straight away.
      updateRequests(this.state, (e) => this.emitEvent(e));
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
    const log = this.state.log;
    log.push({ hour: this.state.hours, text: e.text, kind: e.kind });
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
    for (const fn of this.eventListeners) fn(e);
  }
}
