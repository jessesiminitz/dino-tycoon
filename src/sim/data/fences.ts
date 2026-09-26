export type FenceTypeId = 1 | 2 | 3 | 4;

export interface FenceType {
  id: FenceTypeId;
  name: string;
  /** Cost per tile-edge segment. */
  cost: number;
  /** Compared against a species' required strength once dinos arrive (Milestone 3). */
  strength: number;
  /** Render colours: rail and posts. */
  rail: number;
  post: number;
}

export const FENCE_TYPES: Record<FenceTypeId, FenceType> = {
  1: { id: 1, name: 'Wooden', cost: 25, strength: 1, rail: 0x9c6b3c, post: 0x5a3b1f },
  2: { id: 2, name: 'Steel', cost: 60, strength: 2, rail: 0xb8c0c8, post: 0x5d6770 },
  3: { id: 3, name: 'Electric', cost: 120, strength: 3, rail: 0xf2d24e, post: 0x3b3b3b },
  4: { id: 4, name: 'Concrete', cost: 200, strength: 4, rail: 0xd9d4c7, post: 0x8a8373 },
};

export const FENCE_TYPE_IDS = Object.keys(FENCE_TYPES).map(Number) as FenceTypeId[];

/** Fraction of the build cost returned when a fence is removed. */
export const FENCE_REFUND = 0.25;
