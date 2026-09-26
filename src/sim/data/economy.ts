export type BuildingKind = 'restaurant' | 'giftshop';

export interface BuildingType {
  kind: BuildingKind;
  name: string;
  cost: number;
  /** Charged every midnight. */
  upkeep: number;
  /** What a visitor pays per purchase. */
  salePrice: number;
}

export const BUILDING_TYPES: Record<BuildingKind, BuildingType> = {
  restaurant: { kind: 'restaurant', name: 'Restaurant', cost: 3000, upkeep: 40, salePrice: 8 },
  giftshop: { kind: 'giftshop', name: 'Gift shop', cost: 2000, upkeep: 25, salePrice: 12 },
};

export const BUILDING_REFUND = 0.25;

export const PATH_COST = 10;
export const PATH_REFUND = 0.25;

/** Gates open to new arrivals from OPEN_HOUR until LAST_ENTRY_HOUR; everyone heads out at CLOSE_HOUR. */
export const OPEN_HOUR = 8;
export const LAST_ENTRY_HOUR = 18;
export const CLOSE_HOUR = 20;

export const DAYS_PER_MONTH = 30;

export const DEFAULT_TICKET_PRICE = 20;
export const MAX_TICKET_PRICE = 100;
export const TICKET_STEP = 5;

export const LOAN_AMOUNTS = [10_000, 25_000, 50_000];
export const MAX_DEBT = 100_000;
/** Interest per month on the outstanding balance. */
export const LOAN_MONTHLY_RATE = 0.015;
export const LOAN_TERM_MONTHS = 12;

export const MAX_VISITORS = 150;
