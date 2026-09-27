import { calendar, MAX_REVIEWS, type Building, type GameState, type Mess, type SnackKind, type Visitor } from '../GameState';
import { thoughtText, TOPICS, visitorName, type ThoughtVars, type Topic } from '../data/thoughts';
import { hash2 } from '../rng';
import {
  BUILDING_TYPES,
  CLOSE_HOUR,
  LAST_ENTRY_HOUR,
  MAX_VISITORS,
  OPEN_HOUR,
  SOUVENIRS,
  type BuildingKind,
  type ItemKind,
} from '../data/economy';
import { SPECIES } from '../data/species';
import { DECOR_RADIUS, DECOR_TYPES, MAX_DECOR_CHARM } from '../data/decor';
import { earn } from '../finance';
import { canStep, findPath, walkableNeighbours } from '../pathfind';
import { onWalkway } from '../paths';
import type { RegionMap } from '../regions';
import type { SimContext } from './context';

/** Tiles (Chebyshev distance) within which a visitor can see a dinosaur. */
const VIEW_RADIUS = 4;
/** A day out starts out fun; what they see (or don't) moves it from here. */
const START_SATISFACTION = 60;
const HUNGRY = 60;
/** Peckish enough to buy a snack in passing. */
const PECKISH = 25;
const SNACK_CHANCE = 0.5;
const SNACK_FILLS = 35;
const SNACK_HOURS = 2;
const SOUVENIR_CHANCE = 0.3;
/** Most visitors caught in a storm near a souvenir shop buy a poncho. */
const PONCHO_CHANCE = 0.7;
const MAX_SOUVENIRS = 2;
/** Bladder: rises every hour and after eating; visitors look for restrooms past NEEDS_RESTROOM. */
const BLADDER_PER_HOUR = 12;
const NEEDS_RESTROOM = 70;
const DESPERATE = 90;
/** Desperate visitors at one time before they complain (once a day) about missing restrooms. */
const RESTROOM_COMPLAINT = 4;
const KID_CHANCE = 0.25;
const MASCOT_RADIUS = 3;
const PAUSE_CHANCE = 0.2;
const LOOKS = 6;
/** Visitors within this many tiles of an escaped carnivore run for the gate. */
const PANIC_RADIUS = 3;
const INJURY_CHANCE = 0.1;
const GUIDE_RADIUS = 3;
/** Fraction of the usual arrivals who still come in a storm. */
const STORM_ARRIVALS = 0.4;
const THIRST_PER_HOUR = 7;
const THIRSTY = 60;
const SODA_QUENCHES = 55;
const SODA_HOURS = 2;
/** At a full bladder with no restroom in reach, the chance per hour of an accident. */
const ACCIDENT_CHANCE = 0.1;
/** Visitors bin rubbish if a trash can is this close (Chebyshev); otherwise some drop it. */
const TRASH_RADIUS = 3;
const LITTER_CHANCE = 0.2;
const MAX_MESSES = 300;
/** Litter on the ground before the park is warned about it (once a day). */
const LITTER_WARNING = 25;
const MESS_RADIUS = 1;
const MESS_GROSS = 2;
const LITTER_GROSS = 1;
const MAX_LITTER_GROSS = 1;
/** A stray wrapper or two goes unnoticed; a pile-up doesn't. */
const LITTER_NOTICED = 3;
/** Thoughts kept per visitor, and hours before the same thought comes up again. */
const MAX_THOUGHTS = 6;
const REPEAT_HOURS = 4;
const SNACKS: SnackKind[] = ['icecream', 'popcorn', 'hotdog'];
export const SNACK_NAMES: Record<SnackKind, string> = { icecream: 'ice cream', popcorn: 'popcorn', hotdog: 'hot dog' };

/** Record what a visitor thinks, unless they thought the same thing recently. */
export function think(state: GameState, v: Visitor, topic: Topic, good: boolean, vars: ThoughtVars = {}, text?: string): void {
  if (v.thoughts.some((t) => t.topic === topic && t.good === good && state.hours - t.hour < REPEAT_HOURS)) return;
  const roll = hash2(v.id, state.hours * 16 + TOPICS.indexOf(topic), good ? 71 : 73);
  v.thoughts.push({ hour: state.hours, topic, good, text: text ?? thoughtText(topic, good, vars, roll) });
  if (v.thoughts.length > MAX_THOUGHTS) v.thoughts.shift();
}

export const isDry = (v: Visitor) => v.items.includes('poncho') || v.items.includes('umbrella');

const usd = (n: number) => `$${Math.round(n)}`;

function starsFor(satisfaction: number): number {
  return satisfaction >= 80 ? 5 : satisfaction >= 65 ? 4 : satisfaction >= 45 ? 3 : satisfaction >= 25 ? 2 : 1;
}

const GENERIC_REVIEWS: Record<number, string> = {
  5: 'An amazing day out!',
  4: 'A fun day. Would come again.',
  3: 'It was fine.',
  2: 'Not great, honestly.',
  1: 'Terrible. Never again.',
};

/** Leaving visitors sum up their day, pointing at what stood out most. */
function review(state: GameState, v: Visitor): void {
  const stars = starsFor(v.satisfaction);
  const good = stars >= 3;
  // Any of their thoughts that match the verdict, picked stably so reviews vary.
  const matching = v.thoughts.filter((t) => t.good === good);
  const pick = matching[Math.floor(hash2(v.id, state.hours, 5) * matching.length)];
  state.reviews.push({
    hour: state.hours,
    name: v.name,
    stars,
    text: pick?.text ?? GENERIC_REVIEWS[stars],
    topic: pick?.topic ?? null,
    good,
  });
  if (state.reviews.length > MAX_REVIEWS) state.reviews.shift();
}

function drop(state: GameState, kind: Mess['kind'], x: number, y: number): void {
  if (state.messes.length >= MAX_MESSES) return;
  state.messes.push({ id: state.nextId++, kind, x, y, hour: state.hours });
}

const trashCanNear = (state: GameState, x: number, y: number) =>
  state.buildings.some((b) => b.kind === 'trashcan' && Math.abs(b.x - x) <= TRASH_RADIUS && Math.abs(b.y - y) <= TRASH_RADIUS);

/** Finished a snack or soda: into a bin if there's one handy, otherwise often onto the path. */
function finishWith(ctx: SimContext, v: Visitor): void {
  const { state, rng } = ctx;
  if (trashCanNear(state, v.x, v.y)) return;
  if (rng.chance(LITTER_CHANCE)) drop(state, 'litter', v.x, v.y);
}

/**
 * How much there is to see: each dino in a paddock adds its species' appeal,
 * scaled by how lively (happy) it is, plus a bonus per distinct species.
 */
export function parkAppeal(state: GameState, regions: RegionMap): number {
  const species = new Set<string>();
  let appeal = 0;
  for (const d of state.dinos) {
    if (regions.regions[regions.tileRegion[d.y * state.map.width + d.x]]?.kind !== 'paddock') continue;
    appeal += SPECIES[d.species].appeal * (0.5 + d.happiness / 200);
    species.add(d.species);
  }
  // Gardens make the whole park more inviting, a little.
  const charm = state.decor.reduce((sum, d) => sum + DECOR_TYPES[d.kind].charm, 0);
  return appeal + species.size * 3 + Math.min(8, charm * 0.15);
}

/** Mood lift per hour from gardens around a spot. */
export function sceneryCharm(state: GameState, x: number, y: number): number {
  let charm = 0;
  for (const d of state.decor) {
    if (Math.abs(d.x - x) <= DECOR_RADIUS && Math.abs(d.y - y) <= DECOR_RADIUS) charm += DECOR_TYPES[d.kind].charm;
  }
  return Math.min(MAX_DECOR_CHARM, charm);
}

/** The ticket price visitors consider fair for what's on show. */
export function fairPrice(appeal: number): number {
  return Math.round(8 + appeal * 0.6);
}

/** Expected new visitors per open hour. */
export function expectedArrivals(state: GameState, regions: RegionMap): number {
  const appeal = parkAppeal(state, regions);
  const priceFactor = Math.max(0, Math.min(1.5, 2 - state.ticketPrice / fairPrice(appeal)));
  const weather = state.stormHours > 0 ? STORM_ARRIVALS : 1;
  return (2 + appeal * 0.25) * (0.5 + state.reputation / 100) * priceFactor * weather;
}

function buildingNear(state: GameState, x: number, y: number, kind: BuildingKind): Building | undefined {
  return state.buildings.find((b) => b.kind === kind && Math.abs(b.x - x) + Math.abs(b.y - y) <= 1);
}

/** Each departing visitor nudges reputation toward their satisfaction: a slow moving average. */
const REPUTATION_WEIGHT = 0.005;

function leave(state: GameState, v: Visitor): void {
  state.visitors.splice(state.visitors.indexOf(v), 1);
  review(state, v);
  state.reputation += (v.satisfaction - state.reputation) * REPUTATION_WEIGHT;
}

/** Hourly: new arrivals pay at the gate; everyone gets hungrier. */
export function hourlyVisitors(ctx: SimContext): void {
  const { state, rng, regions } = ctx;
  const { hour } = calendar(state);

  const near = (role: string, v: Visitor, r: number) =>
    state.staff.some((m) => m.role === role && Math.abs(m.x - v.x) <= r && Math.abs(m.y - v.y) <= r);
  const has = (kind: BuildingKind) => state.buildings.some((b) => b.kind === kind);
  const day = calendar(state).day;
  // Messes and litter by tile, so each visitor only checks their surroundings.
  const w = state.map.width;
  const dirt = new Map<number, { mess: number; litter: number }>();
  for (const m of state.messes) {
    if (m.kind === 'dung') continue; // inside the paddocks, out of visitors' way
    const k = m.y * w + m.x;
    const c = dirt.get(k) ?? { mess: 0, litter: 0 };
    c[m.kind]++;
    dirt.set(k, c);
  }
  const dirtAround = (x: number, y: number) => {
    let mess = 0;
    let litter = 0;
    for (let dy = -MESS_RADIUS; dy <= MESS_RADIUS; dy++)
      for (let dx = -MESS_RADIUS; dx <= MESS_RADIUS; dx++) {
        const c = dirt.get((y + dy) * w + x + dx);
        if (!c) continue;
        mess += c.mess;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) litter += c.litter;
      }
    return { mess, litter };
  };

  let desperate = 0;
  let accidents = 0;
  for (const v of [...state.visitors]) {
    if (near('guide', v, GUIDE_RADIUS)) {
      v.satisfaction += 3;
      think(state, v, 'staff', true, {}, 'The tour guide knows so much about dinosaurs!');
    }
    // Meeting the mascot is a highlight, especially for kids.
    if (near('mascot', v, MASCOT_RADIUS)) {
      v.satisfaction += v.kid ? 8 : 4;
      think(state, v, 'staff', true, {}, v.kid ? 'I hugged the dino mascot!!' : 'The dino mascot is adorable.');
    }
    const charm = sceneryCharm(state, v.x, v.y);
    v.satisfaction += charm;
    if (charm >= 2) think(state, v, 'scenery', true);
    v.hunger = Math.min(100, v.hunger + 8);
    v.thirst = Math.min(100, v.thirst + THIRST_PER_HOUR);
    v.bladder = Math.min(100, v.bladder + BLADDER_PER_HOUR);
    if (v.hunger >= 90) {
      v.satisfaction -= 3;
      think(state, v, 'food', false);
    }
    if (v.thirst >= 90) {
      v.satisfaction -= 3;
      think(state, v, 'drink', false);
    }
    if (v.bladder >= DESPERATE) {
      v.satisfaction -= 8;
      desperate++;
      think(state, v, 'restroom', false);
    } else if (v.bladder >= NEEDS_RESTROOM) v.satisfaction -= 2; // uncomfortable
    if (v.bladder >= 100 && rng.chance(ACCIDENT_CHANCE)) {
      // Couldn't make it. Mortified, they head straight home.
      drop(state, 'mess', v.x, v.y);
      accidents++;
      v.bladder = 0;
      v.satisfaction -= 30;
      v.leaveHour = state.hours;
      v.path = [];
      v.thoughts.push({ hour: state.hours, topic: 'restroom', good: false, text: "Couldn't find a restroom in time. So embarrassing. I'm going home." });
      if (v.thoughts.length > MAX_THOUGHTS) v.thoughts.shift();
    }
    if (v.seen.length === 0) {
      v.satisfaction -= 4; // bored: nothing to see
      think(state, v, 'dinos', false);
    }
    if (state.stormHours > 0) {
      if (!isDry(v)) {
        v.satisfaction -= 2; // soaked
        think(state, v, 'weather', false);
      } else think(state, v, 'weather', true, { item: v.items.includes('umbrella') ? 'umbrella' : 'poncho' });
    }
    const { mess, litter } = dirtAround(v.x, v.y);
    if (mess > 0) {
      v.satisfaction -= MESS_GROSS;
      think(state, v, 'mess', false);
    }
    if (litter >= LITTER_NOTICED) {
      v.satisfaction -= Math.min(MAX_LITTER_GROSS, litter * LITTER_GROSS);
      think(state, v, 'litter', false);
    }
    v.satisfaction = Math.max(0, Math.min(100, v.satisfaction));
  }
  if (accidents > 0 && state.stats.messDay !== day) {
    state.stats.messDay = day;
    ctx.emit({
      text: `🤢 A visitor couldn't find a restroom in time and left a mess on the path! ${has('restroom') ? 'Build more restrooms' : 'Build restrooms'}${state.staff.some((m) => m.role === 'janitor') ? '' : ' and hire a janitor'}.`,
      kind: 'bad',
    });
  }
  const litterCount = state.messes.filter((m) => m.kind === 'litter').length;
  if (litterCount >= LITTER_WARNING && state.stats.litterDay !== day) {
    state.stats.litterDay = day;
    const fix = [has('trashcan') ? '' : 'build trash cans by the paths', state.staff.some((m) => m.role === 'janitor') ? 'hire more janitors' : 'hire a janitor'].filter(Boolean);
    ctx.emit({ text: `🗑️ Litter is piling up on the paths: ${fix.join(' and ')}.`, kind: 'bad' });
  }
  if (desperate >= RESTROOM_COMPLAINT && !has('restroom') && state.stats.restroomComplaintDay !== day) {
    state.stats.restroomComplaintDay = day;
    ctx.emit({ text: '🚻 Visitors are desperate for restrooms! Build some next to your paths.', kind: 'bad' });
  }

  if (hour < OPEN_HOUR || hour > LAST_ENTRY_HOUR) return;
  const expected = expectedArrivals(state, regions);
  let n = Math.floor(expected) + (rng.chance(expected % 1) ? 1 : 0);
  n = Math.min(n, MAX_VISITORS - state.visitors.length);
  const fair = fairPrice(parkAppeal(state, regions));
  const pricePenalty = state.ticketPrice > fair ? Math.min(30, (state.ticketPrice / fair - 1) * 40) : 0;

  for (let i = 0; i < n; i++) {
    const v = spawnVisitor(ctx, START_SATISFACTION - pricePenalty, state.ticketPrice);
    if (pricePenalty >= 5) think(state, v, 'price', false, { price: usd(state.ticketPrice) });
    else if (state.ticketPrice <= fair * 0.7) think(state, v, 'price', true, { price: usd(state.ticketPrice) });
  }
}

/** A new visitor at the gate who pays `ticket` for admission. */
export function spawnVisitor(ctx: SimContext, satisfaction: number, ticket: number, kid?: boolean): Visitor {
  const { state, rng } = ctx;
  const { x, y } = state.entrance;
  const id = state.nextId++;
  const v: Visitor = {
    id,
    x,
    y,
    px: x,
    py: y,
    from: -1,
    path: [],
    hunger: rng.int(0, 40),
    satisfaction,
    seen: [],
    leaveHour: state.hours + rng.int(3, 6),
    items: [],
    snack: null,
    snackUntil: 0,
    sodaUntil: 0,
    thirst: rng.int(0, 30),
    bladder: rng.int(0, 30),
    kid: kid ?? rng.chance(KID_CHANCE),
    look: rng.int(0, LOOKS - 1),
    name: visitorName(id, hash2(id, 3, 11)),
    thoughts: [],
  };
  state.visitors.push(v);
  earn(state, 'admissions', ticket);
  state.finance.today.visitors++;
  state.finance.month.visitors++;
  return v;
}

/** Souvenir shopping: ponchos when it's pouring, otherwise a plush, cap or balloon (kids love balloons). */
function shop(ctx: SimContext, v: Visitor): void {
  const { state, rng } = ctx;
  const buy = (item: ItemKind) => {
    v.items.push(item);
    v.satisfaction = Math.min(100, v.satisfaction + 3);
    earn(state, 'souvenirs', SOUVENIRS[item].price);
    think(state, v, 'shop', true, { item: SOUVENIRS[item].name });
  };
  if (state.stormHours > 0 && !isDry(v)) {
    // Kids get ponchos; grown-ups pick either.
    if (rng.chance(PONCHO_CHANCE)) buy(v.kid || rng.chance(0.5) ? 'poncho' : 'umbrella');
    return;
  }
  const extras = v.items.filter((i) => i !== 'poncho' && i !== 'umbrella');
  if (extras.length >= MAX_SOUVENIRS) return;
  const mascotNearby = state.staff.some((m) => m.role === 'mascot' && Math.abs(m.x - v.x) <= 4 && Math.abs(m.y - v.y) <= 4);
  if (!rng.chance(SOUVENIR_CHANCE * (mascotNearby ? 1.5 : 1))) return;
  const wants: [ItemKind, number][] = (
    v.kid
      ? [['balloon', 3], ['plush', 2], ['hat', 1]]
      : [['plush', 2], ['hat', 2], ['balloon', 1]]
  ).filter(([item]) => !v.items.includes(item as ItemKind)) as [ItemKind, number][];
  if (wants.length === 0) return;
  let roll = rng.next() * wants.reduce((sum, [, w]) => sum + w, 0);
  buy(wants.find(([, w]) => (roll -= w) < 0)?.[0] ?? wants[0][0]);
}

/** One movement step for every visitor: look, shop, eat, walk, or head home. */
export function stepVisitors(ctx: SimContext): void {
  const { state, rng } = ctx;
  const { width } = state.map;
  const gate = state.entrance.y * width + state.entrance.x;
  const { hour } = calendar(state);
  const closing = hour >= CLOSE_HOUR || hour < OPEN_HOUR;
  const has = (kind: BuildingKind) => state.buildings.some((b) => b.kind === kind);
  const routeTo = (from: number, kind: BuildingKind) =>
    findPath(state, from, (i) => buildingNear(state, i % width, Math.floor(i / width), kind) !== undefined, 60, onWalkway);

  const loose = state.dinos.filter((d) => d.escaped);

  for (const v of [...state.visitors]) {
    v.px = v.x;
    v.py = v.y;
    const here = v.y * width + v.x;

    // Escaped dinosaurs: carnivores send visitors fleeing (some get hurt); herbivores unsettle them.
    const near = (r: number) => loose.filter((d) => Math.abs(d.x - v.x) <= r && Math.abs(d.y - v.y) <= r);
    const predator = near(PANIC_RADIUS).find((d) => SPECIES[d.species].diet === 'carnivore');
    if (predator) {
      v.satisfaction = Math.max(0, v.satisfaction - 40);
      if (rng.chance(INJURY_CHANCE)) {
        state.reputation = Math.max(0, state.reputation - 2);
        ctx.emit({ text: `🚑 A visitor was hurt by an escaped ${SPECIES[predator.species].name}!`, kind: 'bad' });
      }
      leave(state, v);
      continue;
    }
    if (near(2).length > 0) v.satisfaction = Math.max(0, v.satisfaction - 2);

    if (near(VIEW_RADIUS + 2).length > 0) think(state, v, 'safety', false, { species: SPECIES[near(VIEW_RADIUS + 2)[0].species].name });

    for (const d of state.dinos) {
      if (Math.abs(d.x - v.x) <= VIEW_RADIUS && Math.abs(d.y - v.y) <= VIEW_RADIUS && !v.seen.includes(d.id)) {
        v.seen.push(d.id);
        v.satisfaction = Math.min(100, v.satisfaction + Math.max(4, SPECIES[d.species].appeal * 3));
        if (!d.escaped) think(state, v, 'dinos', true, { species: SPECIES[d.species].name, name: d.name });
      }
    }
    if (v.snack && state.hours >= v.snackUntil) {
      v.snack = null;
      finishWith(ctx, v);
    }
    if (v.sodaUntil > 0 && state.hours >= v.sodaUntil) {
      v.sodaUntil = 0;
      finishWith(ctx, v);
    }
    if (buildingNear(state, v.x, v.y, 'giftshop')) shop(ctx, v);
    if (v.bladder >= 40 && buildingNear(state, v.x, v.y, 'restroom')) {
      v.bladder = 0;
      v.path = [];
      v.satisfaction = Math.min(100, v.satisfaction + 4); // relief!
    }
    if (v.hunger >= HUNGRY && buildingNear(state, v.x, v.y, 'restaurant')) {
      v.hunger = 0;
      v.thirst = Math.max(0, v.thirst - 40); // a drink with the meal
      v.bladder = Math.min(100, v.bladder + 15);
      v.path = [];
      v.satisfaction = Math.min(100, v.satisfaction + 5);
      earn(state, 'food', BUILDING_TYPES.restaurant.salePrice);
      think(state, v, 'food', true, { item: 'meal' });
    } else if (buildingNear(state, v.x, v.y, 'snackstall')) {
      if (v.thirst >= PECKISH && v.sodaUntil === 0 && rng.chance(SNACK_CHANCE)) {
        v.thirst = Math.max(0, v.thirst - SODA_QUENCHES);
        v.bladder = Math.min(100, v.bladder + 10);
        v.sodaUntil = state.hours + SODA_HOURS;
        v.satisfaction = Math.min(100, v.satisfaction + 3);
        if (v.path.length && v.thirst < THIRSTY) v.path = [];
        earn(state, 'snacks', BUILDING_TYPES.snackstall.salePrice);
        think(state, v, 'drink', true);
      }
      if (v.hunger >= PECKISH && !v.snack && rng.chance(SNACK_CHANCE)) {
        const snack = v.kid && rng.chance(0.5) ? 'icecream' : SNACKS[rng.int(0, SNACKS.length - 1)];
        v.hunger = Math.max(0, v.hunger - SNACK_FILLS);
        v.bladder = Math.min(100, v.bladder + 10);
        v.snack = snack;
        v.snackUntil = state.hours + SNACK_HOURS;
        v.satisfaction = Math.min(100, v.satisfaction + 3);
        if (v.hunger < HUNGRY) v.path = [];
        earn(state, 'snacks', BUILDING_TYPES.snackstall.salePrice);
        think(state, v, 'food', true, { item: SNACK_NAMES[snack] });
      }
    }

    const leaving = closing || state.hours >= v.leaveHour;
    if (leaving && here === gate) {
      leave(state, v);
      continue;
    }

    if (v.path.length === 0) {
      if (leaving) {
        const home = findPath(state, here, (i) => i === gate, Infinity, onWalkway);
        if (!home) {
          // Stranded (the path home was removed): they find their own way out, unhappily.
          v.satisfaction = Math.max(0, v.satisfaction - 20);
          leave(state, v);
          continue;
        }
        v.path = home;
      } else if (v.bladder >= NEEDS_RESTROOM && has('restroom')) {
        v.path = routeTo(here, 'restroom') ?? [];
      } else if (v.hunger >= HUNGRY && (has('restaurant') || has('snackstall'))) {
        v.path = (has('restaurant') ? routeTo(here, 'restaurant') : null) ?? routeTo(here, 'snackstall') ?? [];
      } else if (v.thirst >= THIRSTY && has('snackstall')) {
        v.path = routeTo(here, 'snackstall') ?? [];
      }
      if (v.path.length === 0 && !leaving && !rng.chance(PAUSE_CHANCE)) {
        // Wander the path network, avoiding doubling back unless at a dead end.
        const options = walkableNeighbours(state, here, onWalkway);
        const forward = options.filter((n) => n !== v.from);
        const choices = forward.length > 0 ? forward : options;
        if (choices.length > 0) v.path = [choices[rng.int(0, choices.length - 1)]];
      }
    }

    const next = v.path.shift();
    if (next === undefined) continue;
    if (!canStep(state, here, next, onWalkway)) {
      v.path = [];
      continue;
    }
    v.from = here;
    v.x = next % width;
    v.y = Math.floor(next / width);
  }
}
