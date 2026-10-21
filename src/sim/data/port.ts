/**
 * The ferry port: every visitor reaches the island by boat. The port's size
 * sets how many ferries can berth and how big they may be; each ferry makes
 * one round trip an hour while the gates are open, so the seats on the water
 * are the park's arrival limit.
 */
export type FerrySize = 'small' | 'medium' | 'large';
export const FERRY_SIZES: readonly FerrySize[] = ['small', 'medium', 'large'];

export interface FerryType {
  name: string;
  /** Visitors carried on each hourly trip. */
  seats: number;
  cost: number;
  /** Crew and fuel, charged every midnight. */
  upkeep: number;
  description: string;
}

export const FERRY_TYPES: Record<FerrySize, FerryType> = {
  small: { name: 'Water taxi', seats: 6, cost: 1500, upkeep: 15, description: 'A little motor boat. Cheap to run.' },
  medium: { name: 'Ferry', seats: 9, cost: 3500, upkeep: 30, description: 'A sturdy island ferry with a sun deck.' },
  large: { name: 'Big ferry', seats: 12, cost: 7000, upkeep: 45, description: 'Two decks and a funnel. Needs a pier or harbor.' },
};

export interface PortLevel {
  name: string;
  /** Ferries that can berth (and so run) at once. */
  berths: number;
  /** The biggest ferry this port can take. */
  biggest: FerrySize;
  /** Price to build this level, from the one below. */
  cost: number;
  upkeep: number;
  description: string;
}

export const PORT_LEVELS: readonly PortLevel[] = [
  { name: 'Jetty', berths: 1, biggest: 'medium', cost: 0, upkeep: 0, description: 'A wooden jetty with room for one ferry.' },
  { name: 'Pier', berths: 2, biggest: 'large', cost: 5000, upkeep: 30, description: 'A long pier with two berths and a ticket hut. Big ferries can dock.' },
  { name: 'Harbor', berths: 3, biggest: 'large', cost: 12000, upkeep: 60, description: 'A stone harbor with three berths and a lighthouse.' },
];

/** A new park's port: a jetty and one ferry. */
export const STARTING_FERRIES: FerrySize[] = ['medium'];
/** Saves from before the port get a pier and two big ferries: a little more than the old 150-visitor limit allowed. */
export const LEGACY_PORT = { level: 1, ferries: ['large', 'large'] as FerrySize[] };
/** Selling a ferry, or trading one in for a bigger boat, returns this share of its price. */
export const FERRY_TRADE_IN = 0.5;
