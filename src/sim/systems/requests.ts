import { calendar, type GameState, type ParkRequest, type RequestKind } from '../GameState';
import { CLOSE_HOUR, OPEN_HOUR } from '../data/economy';
import { FEEDER_TYPES } from '../data/feeders';
import { SPECIES, type SpeciesId } from '../data/species';
import { earn } from '../finance';
import type { RegionMap } from '../regions';
import { Rng } from '../rng';
import type { GameEvent, SimContext } from './context';
import { expectedArrivals } from './visitors';

/** At most this many requests on the go at once. */
export const MAX_ACTIVE = 3;
/** Clock hours when new requests turn up (the gates open at 08:00). */
const ARRIVAL_HOURS = [OPEN_HOUR, 12, 16];
/** Finished requests stay on the board this long so you can see how you did. */
const KEEP_FINISHED_HOURS = 12;
/** A visitor on a path sees an animal this close (Chebyshev), as in the visitor system. */
const VIEW_RADIUS = 4;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const clock = (state: GameState, hour: number) => `${String(calendar({ ...state, hours: hour }).hour).padStart(2, '0')}:00`;

/** Hours from now until the gates close today (0 once they have). */
function hoursToClosing(state: GameState): number {
  return Math.max(0, CLOSE_HOUR - calendar(state).hour);
}

/** Whether visitors on a path can see an animal of this species (grown-up or baby) right now. */
export function onShow(state: GameState, species: SpeciesId): boolean {
  const w = state.map.width;
  return state.dinos.some((d) => {
    if (d.species !== species || d.escaped) return false;
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++)
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        const x = d.x + dx;
        const y = d.y + dy;
        if (x >= 0 && y >= 0 && x < w && y < state.map.height && state.paths[y * w + x]) return true;
      }
    return false;
  });
}

const placesToEat = (state: GameState) => state.buildings.filter((b) => b.kind === 'restaurant' || b.kind === 'snackstall').length;
const pathDirt = (state: GameState) => state.messes.filter((m) => m.kind !== 'dung').length;
const feedersOk = (state: GameState) => state.feeders.filter((f) => f.stock >= FEEDER_TYPES[f.kind].capacity / 2).length;
const hasPaths = (state: GameState) => state.paths.some((p) => p === 1);

type Draft = Omit<ParkRequest, 'id' | 'createdHour' | 'status' | 'progress'> & { progress?: number };

/**
 * Each template makes a request that suits this park right now, or returns
 * null if it wouldn't make sense (no paths yet, nothing affordable to show...).
 */
const TEMPLATES: Record<RequestKind, (state: GameState, regions: RegionMap, rng: Rng) => Draft | null> = {
  see(state, _regions, rng) {
    if (!hasPaths(state)) return null;
    // A species that's unlocked but not on show yet, and that the park could afford to buy.
    const options = state.unlockedSpecies.filter((id) => !onShow(state, id) && (SPECIES[id].price <= state.money || state.dinos.some((d) => d.species === id)));
    if (options.length === 0) return null;
    const species = options[rng.int(0, options.length - 1)];
    const hours = 8;
    return {
      kind: 'see',
      icon: '🚌',
      species,
      target: 1,
      text: `A school group wants to see a ${SPECIES[species].name} from the path before ${clock(state, state.hours + hours)}`,
      expiresHour: state.hours + hours,
      reward: { money: Math.round(600 + SPECIES[species].price * 0.1), reputation: 2 },
    };
  },
  food(state) {
    if (!hasPaths(state) || state.money < 1200) return null;
    const target = placesToEat(state) + 1;
    const hours = 6;
    return {
      kind: 'food',
      icon: '🍽️',
      target,
      text: `A food critic is coming: have ${target} places to eat (restaurants or snack stalls) by ${clock(state, state.hours + hours)}`,
      expiresHour: state.hours + hours,
      reward: { money: 900, reputation: 1 },
    };
  },
  visitors(state, regions) {
    const left = hoursToClosing(state) - 2; // last entry is two hours before closing
    if (!hasPaths(state) || left < 4) return null;
    const today = state.finance.today.visitors;
    // A stretch: about a quarter more than the park would get anyway, so it takes some effort.
    const extra = Math.round(expectedArrivals(state, regions) * left * 1.25);
    if (extra < 5) return null;
    const target = today + extra;
    return {
      kind: 'visitors',
      icon: '🎟️',
      target,
      text: `Welcome ${target} visitors today`,
      expiresHour: state.hours + hoursToClosing(state),
      reward: { money: extra * 20, reputation: 0 },
    };
  },
  review(state) {
    if (!hasPaths(state) || hoursToClosing(state) < 4 || state.reviews.length === 0) return null;
    const stars = state.reputation >= 70 ? 5 : 4;
    return {
      kind: 'review',
      icon: '⭐',
      target: 1,
      text: `Get a ${stars}-star review from a visitor before closing`,
      stars,
      expiresHour: state.hours + hoursToClosing(state),
      reward: { money: stars === 5 ? 1200 : 700, reputation: 0 },
    };
  },
  photo(state, _regions, rng) {
    if (state.dinos.length === 0) return null;
    const hours = 6;
    const base = { kind: 'photo' as const, icon: '📷', target: 1, expiresHour: state.hours + hours, reward: { money: 500, reputation: 1 } };
    if (state.dinos.some((d) => d.baby)) {
      return { ...base, baby: true, text: `A magazine wants a photo of a baby dinosaur by ${clock(state, state.hours + hours)}` };
    }
    const owned = [...new Set(state.dinos.map((d) => d.species))];
    const species = owned[rng.int(0, owned.length - 1)];
    return { ...base, species, text: `Take a photo of a ${SPECIES[species].name} for the park brochure by ${clock(state, state.hours + hours)}` };
  },
  treats(state) {
    if (state.dinos.length === 0 || state.money < 100) return null;
    const target = Math.min(4, Math.max(2, Math.ceil(state.dinos.length / 2)));
    const hours = 6;
    return {
      kind: 'treats',
      icon: '🍖',
      target,
      text: `Spoil your dinosaurs: give out ${target} treats by ${clock(state, state.hours + hours)}`,
      expiresHour: state.hours + hours,
      reward: { money: 150 + target * 50, reputation: 1 },
    };
  },
  clean(state) {
    if (!hasPaths(state) || pathDirt(state) < 2) return null;
    const hours = 5;
    return {
      kind: 'clean',
      icon: '🧹',
      target: 0,
      progress: pathDirt(state),
      text: `The mayor is visiting at ${clock(state, state.hours + hours)}: make the paths spotless (no litter or messes)`,
      expiresHour: state.hours + hours,
      reward: { money: 1000, reputation: 2 },
    };
  },
  feeders(state) {
    if (state.feeders.length === 0) return null;
    const hours = 5;
    return {
      kind: 'feeders',
      icon: '🥬',
      target: state.feeders.length,
      text: `A vet is checking the animals at ${clock(state, state.hours + hours)}: have every feeder at least half full`,
      expiresHour: state.hours + hours,
      reward: { money: 600, reputation: 1 },
    };
  },
};

const KINDS = Object.keys(TEMPLATES) as RequestKind[];

/** Brings a request's progress up to date; returns true when it's been met. */
function evaluate(state: GameState, r: ParkRequest): boolean {
  switch (r.kind) {
    case 'see':
      r.progress = onShow(state, r.species!) ? 1 : 0;
      return r.progress >= 1;
    case 'food':
      r.progress = placesToEat(state);
      return r.progress >= r.target;
    case 'visitors':
      r.progress = state.finance.today.visitors;
      return r.progress >= r.target;
    case 'review': {
      r.progress = state.reviews.filter((v) => v.hour >= r.createdHour && v.stars >= (r.stars ?? 4)).length;
      return r.progress >= r.target;
    }
    case 'photo':
    case 'treats':
      return r.progress >= r.target; // counted as they happen (see noteRequestAction)
    case 'clean':
      r.progress = pathDirt(state);
      return state.hours >= r.expiresHour && r.progress === 0; // judged when the mayor arrives
    case 'feeders':
      r.progress = feedersOk(state);
      return state.hours >= r.expiresHour && r.progress >= state.feeders.length;
  }
}

/** Short name for a request in alerts. */
function short(r: ParkRequest): string {
  const names: Record<RequestKind, string> = {
    see: 'the school group',
    food: 'the food critic',
    visitors: 'visitor numbers',
    review: 'a great review',
    photo: 'the photo',
    treats: 'spoiling the dinos',
    clean: "the mayor's visit",
    feeders: 'the vet check',
  };
  return names[r.kind];
}

/**
 * Checks every active request: pays out the ones that are met and retires the
 * ones whose time is up. Safe to call any time (hourly, and after the player acts).
 */
export function updateRequests(state: GameState, emit: (e: GameEvent) => void): void {
  for (const r of state.requests) {
    if (r.status !== 'active') continue;
    if (evaluate(state, r)) {
      r.status = 'done';
      if (r.reward.money) earn(state, 'awards', r.reward.money);
      state.reputation = Math.min(100, state.reputation + r.reward.reputation);
      state.stats.requestsDone++;
      emit({ text: `✅ Request complete: ${short(r)}! +${usd(r.reward.money)}${r.reward.reputation ? `, +${r.reward.reputation} reputation` : ''}`, kind: 'good' });
    } else if (state.hours >= r.expiresHour) {
      r.status = 'missed';
      emit({ text: `📋 A request ran out of time: ${short(r)}. Never mind, there'll be more!`, kind: 'info' });
    }
  }
}

/** Photos and treats count toward requests the moment they happen. */
export function noteRequestAction(state: GameState, action: 'photo' | 'treat', dino?: { species: SpeciesId; baby: boolean }): void {
  for (const r of state.requests) {
    if (r.status !== 'active') continue;
    if (action === 'treat' && r.kind === 'treats') r.progress++;
    if (action === 'photo' && r.kind === 'photo' && dino && (r.baby ? dino.baby : dino.species === r.species)) r.progress = 1;
  }
}

/** Hourly: tidy the board, top it up at the arrival hours, and check progress. */
export function hourlyRequests(ctx: SimContext): void {
  const { state } = ctx;
  state.requests = state.requests.filter((r) => r.status === 'active' || state.hours - r.expiresHour < KEEP_FINISHED_HOURS);
  // Requests draw on their own dice, so adding them doesn't reshuffle the rest of the park's luck.
  if (ARRIVAL_HOURS.includes(calendar(state).hour)) addRequests(state, ctx.regions, new Rng((state.seed * 7919 + state.hours * 104_729) >>> 0), ctx.emit);
  updateRequests(state, ctx.emit);
}

/** Tops the board up to MAX_ACTIVE with requests that suit the park, each of a different kind. */
export function addRequests(state: GameState, regions: RegionMap, rng: Rng, emit: (e: GameEvent) => void): ParkRequest[] {
  const added: ParkRequest[] = [];
  const active = () => state.requests.filter((r) => r.status === 'active');
  const kinds = KINDS.filter((k) => !active().some((r) => r.kind === k));
  // Shuffle, then take the first few that make sense here.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  for (const kind of kinds) {
    if (active().length >= MAX_ACTIVE) break;
    const draft = TEMPLATES[kind](state, regions, rng);
    if (!draft) continue;
    const r: ParkRequest = { ...draft, id: state.nextId++, createdHour: state.hours, status: 'active', progress: draft.progress ?? 0 };
    // Anything already met on arrival wouldn't be much of a request.
    const probe = { ...r };
    if (evaluate(state, probe) && r.kind !== 'clean' && r.kind !== 'feeders') continue;
    state.requests.push(r);
    added.push(r);
  }
  if (added.length) emit({ text: `📋 ${added.length === 1 ? 'A new park request' : `${added.length} new park requests`}: ${added[0].text}${added.length > 1 ? ' …and more' : ''}`, kind: 'info' });
  return added;
}
