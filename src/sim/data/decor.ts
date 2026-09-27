export type DecorKind = 'tree' | 'palm' | 'flowers' | 'fountain' | 'bench';

export interface DecorType {
  kind: DecorKind;
  name: string;
  cost: number;
  /** Charged every midnight. */
  upkeep: number;
  /** How much it lifts the mood of visitors within DECOR_RADIUS tiles each hour. */
  charm: number;
  description: string;
}

export const DECOR_TYPES: Record<DecorKind, DecorType> = {
  tree: { kind: 'tree', name: 'Shade tree', cost: 150, upkeep: 0, charm: 1, description: 'A leafy broadleaf tree.' },
  palm: { kind: 'palm', name: 'Palm tree', cost: 200, upkeep: 0, charm: 1, description: 'Tropical and tall.' },
  flowers: { kind: 'flowers', name: 'Flower bed', cost: 120, upkeep: 0, charm: 1, description: 'A splash of colour.' },
  bench: { kind: 'bench', name: 'Bench', cost: 80, upkeep: 0, charm: 1, description: 'Somewhere to rest tired feet.' },
  fountain: { kind: 'fountain', name: 'Fountain', cost: 900, upkeep: 10, charm: 3, description: 'A splashing centrepiece visitors love.' },
};

export const DECOR_KINDS = Object.keys(DECOR_TYPES) as DecorKind[];
/** Tiles (Chebyshev) within which visitors enjoy a decoration. */
export const DECOR_RADIUS = 2;
/** Most a visitor's mood can rise per hour from scenery, however much there is. */
export const MAX_DECOR_CHARM = 4;
export const DECOR_REFUND = 0.25;
