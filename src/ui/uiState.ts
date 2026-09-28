import type { FenceTypeId } from '../sim/data/fences';
import type { FeederKind } from '../sim/data/feeders';
import type { SpeciesId } from '../sim/data/species';
import type { BuildingKind } from '../sim/data/economy';
import type { DecorKind } from '../sim/data/decor';

export type Mode = 'select' | 'fence' | 'demolish' | 'land' | 'feeder' | 'place-dino' | 'path' | 'building' | 'decor';

type Listener = (ui: UiState) => void;

/** Which tool is active. Shared by the DOM toolbar and the Phaser scene. Not saved. */
export class UiState {
  mode: Mode = 'select';
  fenceType: FenceTypeId = 1;
  feederKind: FeederKind = 'plants';
  buildingKind: BuildingKind = 'restaurant';
  /** A garden item, 'pond' to dig water (for lagoons), or 'drain' to dry out marsh. */
  decorKind: DecorKind | 'pond' | 'drain' = 'tree';
  /** Path tool erases instead of building. */
  pathErase = false;
  /** Path tool works on safari jeep track instead of footpath. */
  pathTrack = false;
  /** Species being released while in 'place-dino' mode. */
  placing: SpeciesId | null = null;
  /** Someone the camera should jump to and select (set by the People panel, consumed by the park scene). */
  focusTarget: { kind: 'visitor' | 'dino' | 'staff' | 'egg'; id: number } | null = null;
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

  setBuildingKind(kind: BuildingKind): void {
    this.buildingKind = kind;
    this.emit();
  }

  setDecorKind(kind: DecorKind | 'pond' | 'drain'): void {
    this.decorKind = kind;
    this.emit();
  }

  setPathErase(erase: boolean, track = false): void {
    this.pathErase = erase;
    this.pathTrack = track;
    this.emit();
  }

  startPlacing(species: SpeciesId): void {
    this.placing = species;
    this.mode = 'place-dino';
    this.emit();
  }

  focus(kind: 'visitor' | 'dino' | 'staff' | 'egg', id: number): void {
    this.mode = 'select';
    this.placing = null;
    this.focusTarget = { kind, id };
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
