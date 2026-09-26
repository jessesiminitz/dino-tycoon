import { calendar } from '../GameState';
import { LAST_ENTRY_HOUR, MAX_VISITORS, OPEN_HOUR } from '../data/economy';
import { FENCE_TYPES, type FenceTypeId } from '../data/fences';
import { SPECIES } from '../data/species';
import { earn, spend } from '../finance';
import { allFenceEdges, fenceAt, fenceHp, setFenceHp } from '../fences';
import type { SimContext } from './context';
import { spawnVisitor } from './visitors';
import { SCENARIOS } from '../data/scenarios';

/** Rough hourly odds; e.g. a storm every ~12 days on average. */
export const EVENT_CHANCES = {
  storm: 1 / (24 * 12),
  outbreak: 1 / (24 * 25),
  schoolTrip: 1 / (11 * 8), // per open hour: roughly every 8 days
  inspection: 1 / (11 * 15), // per open hour: roughly every 15 days
};
export const INSPECTION_AWARD = 2000;
export const FINE_PER_ISSUE = 1000;
const MAX_FINE = 5000;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Hourly: run an ongoing storm, and maybe start something new. */
export function hourlyEvents(ctx: SimContext): void {
  const { state, rng } = ctx;
  const { hour } = calendar(state);
  const open = hour >= OPEN_HOUR && hour <= LAST_ENTRY_HOUR;

  if (state.stormHours > 0) {
    stormHour(ctx);
    state.stormHours--;
    if (state.stormHours === 0) ctx.emit({ text: '🌤️ The storm has passed', kind: 'info' });
  } else if (rng.chance(EVENT_CHANCES.storm * (SCENARIOS[state.scenario.id].stormRate ?? 1))) startStorm(ctx);

  if (state.dinos.length >= 2 && rng.chance(EVENT_CHANCES.outbreak)) outbreak(ctx);
  if (open && state.paths.some((p) => p === 1) && rng.chance(EVENT_CHANCES.schoolTrip)) schoolTrip(ctx);
  if (open && state.dinos.length > 0 && rng.chance(EVENT_CHANCES.inspection)) inspection(ctx);
}

export function startStorm(ctx: SimContext): void {
  ctx.state.stormHours = ctx.rng.int(6, 12);
  ctx.emit({ text: '⛈️ A storm is rolling in! Fences will take a beating and fewer visitors will come.', kind: 'bad' });
}

/** Chance per fence segment per storm hour of a falling tree or flying debris. */
const HEAVY_HIT_CHANCE = 0.01;

/**
 * Each storm hour batters every fence; now and then a falling tree does real
 * damage. Stronger fences shrug off more of it (concrete takes a quarter of
 * what wood does), so building well pays off in bad weather.
 */
export function stormHour(ctx: SimContext): void {
  const { state, rng } = ctx;
  let broken = 0;
  for (const e of allFenceEdges(state)) {
    const type = fenceAt(state, e);
    if (!type) continue;
    const toughness = 1.5 / FENCE_TYPES[type].strength;
    const hit = (rng.chance(HEAVY_HIT_CHANCE) ? rng.int(30, 50) : rng.int(1, 3)) * toughness;
    const next = fenceHp(state, e) - hit;
    setFenceHp(state, e, next);
    if (next <= 0) broken++;
  }
  if (broken > 0) {
    ctx.invalidateWorld();
    ctx.emit({ text: `⛈️ The storm knocked down ${broken} fence segment${broken === 1 ? '' : 's'}!`, kind: 'bad' });
  }
}

export function outbreak(ctx: SimContext): void {
  const { state, rng } = ctx;
  const healthy = state.dinos.filter((d) => !d.sick);
  const n = Math.min(healthy.length, rng.int(2, 3));
  const victims: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = healthy.splice(rng.int(0, healthy.length - 1), 1)[0];
    d.sick = true;
    victims.push(d.name);
  }
  if (victims.length > 0) ctx.emit({ text: `🦠 Outbreak! ${victims.join(', ')} fell ill. A vet would help.`, kind: 'bad' });
}

/** A coach of schoolchildren at half price: busy, but good for business. */
export function schoolTrip(ctx: SimContext): void {
  const { state, rng } = ctx;
  const n = Math.min(rng.int(12, 24), MAX_VISITORS - state.visitors.length);
  if (n <= 0) return;
  const ticket = Math.round(state.ticketPrice / 2);
  for (let i = 0; i < n; i++) spawnVisitor(ctx, 70, ticket);
  ctx.emit({ text: `🚌 A school trip of ${n} kids has arrived (half-price tickets)!`, kind: 'good' });
}

/** Problems a safety inspector would write up. */
export function safetyIssues(ctx: SimContext): string[] {
  const { state, regions } = ctx;
  const issues: string[] = [];
  const escaped = state.dinos.filter((d) => d.escaped).length;
  if (escaped) issues.push(`${escaped} escaped dinosaur${escaped === 1 ? '' : 's'}`);
  const broken = allFenceEdges(state).filter((e) => fenceHp(state, e) <= 0).length;
  if (broken) issues.push(`${broken} broken fence segment${broken === 1 ? '' : 's'}`);
  const weak = state.dinos.filter((d) => {
    const r = regions.regions[regions.tileRegion[d.y * state.map.width + d.x]];
    return r?.kind === 'paddock' && r.weakestFence !== 0 && r.weakestFence < SPECIES[d.species].fenceNeeded;
  });
  if (weak.length) {
    const names = [...new Set(weak.map((d) => SPECIES[d.species].name))];
    issues.push(`fences too weak for ${names.join(', ')} (need ${FENCE_TYPES[Math.max(...weak.map((d) => SPECIES[d.species].fenceNeeded)) as FenceTypeId].name.toLowerCase()})`);
  }
  const sick = state.dinos.filter((d) => d.sick).length;
  if (sick) issues.push(`${sick} sick animal${sick === 1 ? '' : 's'} untreated`);
  return issues;
}

export function inspection(ctx: SimContext): void {
  const { state } = ctx;
  const issues = safetyIssues(ctx);
  if (issues.length === 0) {
    earn(state, 'awards', INSPECTION_AWARD);
    state.stats.inspectionsPassed++;
    state.reputation = Math.min(100, state.reputation + 3);
    ctx.emit({ text: `📋 Safety inspection passed! You earned a ${usd(INSPECTION_AWARD)} safety award.`, kind: 'good' });
    return;
  }
  const fine = Math.min(MAX_FINE, FINE_PER_ISSUE * issues.length);
  spend(state, 'fines', fine);
  state.reputation = Math.max(0, state.reputation - 3);
  ctx.emit({ text: `📋 Failed safety inspection: ${issues.join('; ')}. Fined ${usd(fine)}.`, kind: 'bad' });
}
