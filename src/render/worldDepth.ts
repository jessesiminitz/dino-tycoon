import type { GameState } from '../sim/GameState';
import type { FenceTypeId } from '../sim/data/fences';
import { edgeKey } from '../sim/grid';
import { TERRAIN_TILE_SIZE as TILE } from './terrainArt';

/** Logical ground contact shared by people, animals and tile-based objects. */
export const FOOT_Y = 13;
export const DEPTH_EPSILON = 0.00001;
export const FENCE_H: Record<FenceTypeId, number> = { 1: 8, 2: 9, 3: 9, 4: 10, 5: 13, 6: 6 };
const MAX_FENCE_H = Math.max(...Object.values(FENCE_H));

export const depthAt = (groundY: number): number => 4 + groundY / 10000;
export const tileDepth = (tileY: number): number => depthAt(tileY * TILE + FOOT_Y);

/** Crosswise fences stand on an edge; end-on fences sort at their ground midpoint. */
export const fenceDepth = (row: number, dir: 'h' | 'v'): number =>
  depthAt((row + (dir === 'v' ? 0.5 : 0)) * TILE) - DEPTH_EPSILON;

interface Bounds { left: number; right: number; top: number; bottom: number }
type FenceState = Pick<GameState, 'map' | 'hFences' | 'vFences' | 'hFenceHp' | 'vFenceHp'>;

/** Nearby foreground fence sections to soften, preserving the animal's ground depth. */
export function obscuringFenceKeys(state: FenceState, groundY: number, bounds: Bounds): string[] {
  const depth = depthAt(groundY);
  const keys: string[] = [];
  const { width, height } = state.map;
  const firstRow = Math.max(0, Math.floor(groundY / TILE - 0.5));
  const lastRow = Math.min(height, Math.floor((bounds.bottom + MAX_FENCE_H + 1) / TILE));
  const firstCol = Math.max(0, Math.floor((bounds.left - 2) / TILE));
  const lastCol = Math.min(width, Math.ceil((bounds.right + 2) / TILE));
  for (let row = firstRow; row <= lastRow; row++) {
    const y = row * TILE;
    const horizontal = fenceDepth(row, 'h');
    if (horizontal >= depth && bounds.top < y + 2) {
      for (let col = firstCol; col <= Math.min(width - 1, lastCol); col++) {
        const i = row * width + col;
        const kind = state.hFences[i] as FenceTypeId | 0;
        if (kind && state.hFenceHp[i] > 0 && bounds.bottom > y - FENCE_H[kind] - 1 &&
            bounds.left < (col + 1) * TILE + 2 && bounds.right > col * TILE - 2) {
          keys.push(edgeKey({ dir: 'h', x: col, y: row }));
        }
      }
    }
    const vertical = fenceDepth(row, 'v');
    if (row < height && vertical >= depth && bounds.top < y + TILE + 2) {
      for (let col = firstCol; col <= lastCol; col++) {
        const i = row * (width + 1) + col;
        const kind = state.vFences[i] as FenceTypeId | 0;
        if (kind && state.vFenceHp[i] > 0 && bounds.bottom > y - FENCE_H[kind] - 1 &&
            bounds.left < col * TILE + 2 && bounds.right > col * TILE - 2) {
          keys.push(edgeKey({ dir: 'v', x: col, y: row }));
        }
      }
    }
  }
  return keys;
}
