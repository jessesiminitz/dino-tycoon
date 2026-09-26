import type { Diet } from './species';

export type FeederKind = 'plants' | 'meat';

export interface FeederType {
  kind: FeederKind;
  name: string;
  diet: Diet;
  /** Build cost; a new feeder comes full. */
  cost: number;
  capacity: number;
  /** Cost per food unit when refilling. */
  unitCost: number;
}

export const FEEDER_TYPES: Record<FeederKind, FeederType> = {
  plants: { kind: 'plants', name: 'Plant feeder', diet: 'herbivore', cost: 400, capacity: 100, unitCost: 3 },
  meat: { kind: 'meat', name: 'Meat feeder', diet: 'carnivore', cost: 400, capacity: 100, unitCost: 6 },
};

export const FEEDER_REFUND = 0.25;
/** Fraction of the purchase price returned when selling a dinosaur. */
export const DINO_RESALE = 0.5;
