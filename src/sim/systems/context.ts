import type { GameState } from '../GameState';
import type { RegionMap } from '../regions';
import type { Rng } from '../rng';

export interface GameEvent {
  text: string;
  kind: 'info' | 'good' | 'bad';
  /** Set when this event completes a round of milestones or ends a scenario. */
  outcome?: 'won' | 'lost' | 'milestone';
}

/** What a system gets each step: the state, seeded randomness, current regions and an event sink. */
export interface SimContext {
  state: GameState;
  rng: Rng;
  regions: RegionMap;
  emit(event: GameEvent): void;
  /** Call when fences break or get fixed, so paddocks are recomputed. */
  invalidateWorld(): void;
}
