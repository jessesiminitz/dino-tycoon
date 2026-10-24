import type { GameState } from '../GameState';
import type { SpeciesId } from '../data/species';
import type { RegionMap } from '../regions';
import type { Rng } from '../rng';

export interface GameEvent {
  birth?: { dinoId: number };
  text: string;
  kind: 'info' | 'good' | 'bad';
  /** Set when this event completes a round of milestones or ends a scenario. */
  outcome?: 'won' | 'lost' | 'milestone';
  /** Set on a dig site's find (already credited), for the dig mini-game. */
  fossil?: { species: SpeciesId; bone: string; have: number; needed: number; unlocked: boolean };
}

/** What a system gets each step: the state, seeded randomness, current regions and an event sink. */
export interface SimContext {
  /** Ready land eggs wait for the player; headless simulations hatch automatically. */
  interactiveHatching?: boolean;
  state: GameState;
  rng: Rng;
  regions: RegionMap;
  /** Paddocks as built, broken fences included (see computeRegions); defaults to `regions`. */
  enclosures?: RegionMap;
  emit(event: GameEvent): void;
  /** Presentation only; never stored in a save or the park log. */
  animate?(action: DinoAction): void;
  /** Call when fences break or get fixed, so paddocks are recomputed. */
  invalidateWorld(): void;
}

export interface DinoAction {
  kind: 'eat';
  dinoId: number;
  feederId: number;
}
