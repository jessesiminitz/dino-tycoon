import type { FenceTypeId } from '../sim/data/fences';
import type { FeederKind } from '../sim/data/feeders';
import type { SpeciesId } from '../sim/data/species';

export type Mode = 'select' | 'fence' | 'demolish' | 'land' | 'feeder' | 'place-dino';

type Listener = (ui: UiState) => void;

/** Which tool is active. Shared by the DOM toolbar and the Phaser scene. Not saved. */
export class UiState {
  mode: Mode = 'select';
  fenceType: FenceTypeId = 1;
  feederKind: FeederKind = 'plants';
  /** Species being released while in 'place-dino' mode. */
  placing: SpeciesId | null = null;
  private listeners = new Set<Listener>();

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== 'place-dino') this.placing = null;
    this.emit();
  }

  setFenceType(type: FenceTypeId): void {
    this.fenceType = type;
    this.emit();
  }

  setFeederKind(kind: FeederKind): void {
    this.feederKind = kind;
    this.emit();
  }

  startPlacing(species: SpeciesId): void {
    this.placing = species;
    this.mode = 'place-dino';
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this);
  }
}
