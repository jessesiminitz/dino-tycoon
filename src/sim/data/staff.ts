export type StaffRole = 'worker' | 'guard' | 'vet' | 'janitor' | 'guide' | 'mascot';

export interface StaffType {
  role: StaffRole;
  name: string;
  /** Charged every midnight. */
  wage: number;
  description: string;
}

export const STAFF_TYPES: Record<StaffRole, StaffType> = {
  worker: { role: 'worker', name: 'Worker', wage: 60, description: 'Refills feeders that run low, repairs worn or broken fences, and shovels dino dung.' },
  guard: { role: 'guard', name: 'Guard', wage: 80, description: 'Tracks down escaped dinosaurs and returns them to their paddock.' },
  vet: { role: 'vet', name: 'Vet', wage: 100, description: 'Treats sick and injured dinosaurs before illness spreads.' },
  janitor: { role: 'janitor', name: 'Janitor', wage: 40, description: 'Sweeps up litter and cleans up accidents on the paths, messes first.' },
  guide: { role: 'guide', name: 'Tour guide', wage: 50, description: 'Walks the paths telling visitors about the dinosaurs, keeping them happier.' },
  mascot: {
    role: 'mascot',
    name: 'Mascot',
    wage: 45,
    description: 'A friendly dino costume on the paths. Visitors love it (kids most of all), and souvenirs sell better nearby.',
  },
};

export const STAFF_ROLES = Object.keys(STAFF_TYPES) as StaffRole[];

/** Tiles a staff member covers per movement step (they drive a park buggy). */
export const STAFF_SPEED = 2;
/** Movement steps each job takes once on site. */
export const WORK_STEPS = { refill: 2, repair: 4, recapture: 4, treat: 4, clean: 1 } as const;
/** Janitors clean everything within this many tiles (Chebyshev) of where they stop. */
export const CLEAN_RADIUS = 1;

/** Workers refill feeders below this fraction of capacity. */
export const REFILL_BELOW = 0.4;
/** Workers repair fences below this condition. */
export const REPAIR_BELOW = 60;
/** Fraction of a fence's build cost charged to bring it back to full condition. */
export const REPAIR_COST_FRACTION = 0.3;
export const MEDICINE_COST = 150;

export const STAFF_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Jamie', 'Taylor', 'Robin', 'Drew',
  'Quinn', 'Avery', 'Rowan', 'Kai', 'Emery', 'Sky', 'Reese', 'Harper', 'Ellis', 'Noor',
];
