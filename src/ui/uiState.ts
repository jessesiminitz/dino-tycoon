import type { FenceTypeId } from '../sim/data/fences';

export type Mode = 'select' | 'fence' | 'demolish' | 'land';

type Listener = (ui: UiState) => void;

/** Which tool is active. Shared by the DOM toolbar and the Phaser scene. Not saved. */
export class UiState {
  mode: Mode = 'select';
  fenceType: FenceTypeId = 1;
  private listeners = new Set<Listener>();

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.emit();
  }

  setFenceType(type: FenceTypeId): void {
    this.fenceType = type;
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
