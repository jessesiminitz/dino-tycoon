import type { GameState } from './GameState';
import { edgeInBounds, edgeIndex, edgeTiles, type Edge } from './grid';
import { isTileOwned } from './land';
import { isLand, terrainAt } from './terrain';
import type { FenceTypeId } from './data/fences';

/** Fence type on an edge, or 0 for none. */
export function fenceAt(state: GameState, e: Edge): FenceTypeId | 0 {
  if (!edgeInBounds(e, state.map)) return 0;
  const arr = e.dir === 'h' ? state.hFences : state.vFences;
  return arr[edgeIndex(e, state.map)] as FenceTypeId | 0;
}

export function setFence(state: GameState, e: Edge, type: FenceTypeId | 0): void {
  const arr = e.dir === 'h' ? state.hFences : state.vFences;
  arr[edgeIndex(e, state.map)] = type;
}

/**
 * Why a fence can't go on this edge, or null if it can. An edge is buildable when
 * at least one side is land you own (so property-line fences are allowed).
 */
export function fenceBlocker(state: GameState, e: Edge): string | null {
  if (!edgeInBounds(e, state.map)) return 'Off the map';
  const ownedLandSide = edgeTiles(e).some(([x, y]) => {
    const t = terrainAt(state.map, x, y);
    return t !== undefined && isLand(t) && isTileOwned(state, x, y);
  });
  return ownedLandSide ? null : "You don't own land here";
}
