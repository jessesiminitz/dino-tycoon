export type BuildingKind = 'restaurant' | 'snackstall' | 'giftshop' | 'restroom' | 'trashcan' | 'digsite';

export interface BuildingType {
  kind: BuildingKind;
  name: string;
  cost: number;
  /** Charged every midnight. */
  upkeep: number;
  /** What a visitor pays per purchase (0 for buildings visitors don't use). */
  salePrice: number;
  /** Visitors must be able to reach it from a path. */
  needsPath: boolean;
  description: string;
}

export const BUILDING_TYPES: Record<BuildingKind, BuildingType> = {
  restaurant: {
    kind: 'restaurant', name: 'Restaurant', cost: 3000, upkeep: 40, salePrice: 8, needsPath: true,
    description: 'Hungry visitors buy meals here.',
  },
  snackstall: {
    kind: 'snackstall', name: 'Snack stall', cost: 1200, upkeep: 15, salePrice: 4, needsPath: true,
    description: 'Ice cream, popcorn, hot dogs and sodas. Peckish or thirsty visitors grab one as they pass.',
  },
  giftshop: {
    kind: 'giftshop', name: 'Souvenir shop', cost: 2000, upkeep: 25, salePrice: 0, needsPath: true,
    description: 'Sells dino plushes, caps, balloons, and ponchos and umbrellas (a hit in storms).',
  },
  restroom: {
    kind: 'restroom', name: 'Restrooms', cost: 1500, upkeep: 20, salePrice: 0, needsPath: true,
    description: 'Visitors need the bathroom, especially after eating. Unhappy without one nearby.',
  },
  trashcan: {
    kind: 'trashcan', name: 'Trash can', cost: 100, upkeep: 2, salePrice: 0, needsPath: true,
    description: 'Visitors nearby bin their cups and wrappers instead of dropping them on the path.',
  },
  digsite: {
    kind: 'digsite', name: 'Dig site', cost: 2500, upkeep: 150, salePrice: 0, needsPath: false,
    description: 'A fossil crew digs here every day. Must go on a fossil bed; richer beds find more, and rarer species.',
  },
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

/** Souvenirs visitors buy and carry around (and you can see on them). */
export type ItemKind = 'plush' | 'hat' | 'balloon' | 'poncho' | 'umbrella';

export const SOUVENIRS: Record<ItemKind, { name: string; price: number }> = {
  plush: { name: 'dino plush', price: 14 },
  hat: { name: 'dino cap', price: 9 },
  balloon: { name: 'balloon', price: 5 },
  poncho: { name: 'rain poncho', price: 7 },
  umbrella: { name: 'umbrella', price: 10 },
};

/** Nightly chance a dig site on an ordinary fossil bed turns up a fossil. */
export const DIG_FIND_CHANCE = 0.2;
/** What a museum pays for a find once every species is unlocked. */
export const MUSEUM_PRICE = 600;
