import type { GameState } from './GameState';
import { BUILDING_TYPES, DAYS_PER_MONTH, type BuildingKind } from './data/economy';
import { DECOR_TYPES } from './data/decor';
import { STAFF_ROLES, STAFF_TYPES, type StaffRole } from './data/staff';
import { loanPayment } from './finance';
import { touchesWalkway } from './paths';
import type { RegionMap } from './regions';
import { fairPrice, parkAppeal } from './systems/visitors';

export interface CostLine {
  label: string;
  perDay: number;
  /** A plain-words nudge when this looks like waste. */
  hint?: string;
}

/** Roughly how many of each role a park this size needs. */
function staffNeeded(state: GameState, role: StaffRole, regions: RegionMap): number {
  const dinos = state.dinos.length;
  const paddocks = regions.regions.filter((r) => r.kind === 'paddock').length;
  const visitors = Math.max(state.visitors.length, state.finance.today.visitors / 3);
  switch (role) {
    case 'worker':
      return Math.max(1, Math.ceil((paddocks + state.feeders.length) / 6));
    case 'guard':
    case 'vet':
      return dinos ? Math.max(1, Math.ceil(dinos / 12)) : 0;
    case 'janitor':
      return Math.max(1, Math.ceil(visitors / 40));
    case 'guide':
      return Math.ceil(visitors / 30);
    default:
      return 1;
  }
}

const trackBeside = (state: GameState, x: number, y: number) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => state.tracks[(y + dy) * state.map.width + x + dx] === 1);

/**
 * Where the money goes each day, biggest first, with a hint wherever it
 * looks like waste: more staff than the park needs, buildings visitors can't
 * reach (or rides with no track), loans eating interest, dear tickets.
 */
export function dailyCosts(state: GameState, regions: RegionMap): { lines: CostLine[]; tips: string[] } {
  const lines: CostLine[] = [];
  for (const role of STAFF_ROLES) {
    const n = state.staff.filter((m) => m.role === role).length;
    if (!n) continue;
    const need = staffNeeded(state, role, regions);
    const name = STAFF_TYPES[role].name.toLowerCase();
    lines.push({
      label: `${n} ${name}${n === 1 ? '' : 's'}`,
      perDay: n * STAFF_TYPES[role].wage,
      hint: n > need + 1 ? `About ${need || 'no'} ${name}${need === 1 ? '' : 's'} would do for a park this size` : undefined,
    });
  }
  const kinds = [...new Set(state.buildings.map((b) => b.kind))] as BuildingKind[];
  for (const kind of kinds) {
    const all = state.buildings.filter((b) => b.kind === kind);
    const t = BUILDING_TYPES[kind];
    if (!t.upkeep) continue;
    const stranded = all.filter((b) => t.needsPath && !touchesWalkway(state, b.x, b.y)).length;
    const noTrack = kind === 'station' ? all.filter((b) => !trackBeside(state, b.x, b.y)).length : 0;
    const hint = stranded
      ? `${stranded} can’t be reached from a path: upkeep, but no visitors`
      : noTrack
        ? `${noTrack} ${noTrack === 1 ? 'has' : 'have'} no jeep track, so ${noTrack === 1 ? 'it earns' : 'they earn'} nothing`
        : undefined;
    lines.push({ label: `${all.length} ${t.name.toLowerCase()}${all.length === 1 || t.name.endsWith('s') ? '' : 's'}`, perDay: all.length * t.upkeep, hint });
  }
  const decor = state.decor.reduce((sum, d) => sum + DECOR_TYPES[d.kind].upkeep, 0);
  if (decor) lines.push({ label: 'Garden upkeep', perDay: decor });
  const loans = state.finance.loans.reduce((sum, l) => {
    const p = loanPayment(l);
    return sum + p.interest + p.principal;
  }, 0);
  if (loans) {
    lines.push({
      label: `Loan payments (${state.finance.loans.length} loan${state.finance.loans.length === 1 ? '' : 's'})`,
      perDay: Math.round(loans / DAYS_PER_MONTH),
    });
  }
  lines.sort((a, b) => b.perDay - a.perDay);

  const tips: string[] = [];
  if (loans) tips.push('Loans are paid monthly. Paying one off early (Bank tab) stops its interest.');
  const fair = fairPrice(parkAppeal(state, regions));
  if (state.ticketPrice > fair * 1.15) tips.push(`Tickets cost more than visitors think is fair (about $${Math.round(fair)}), so fewer come.`);
  for (const l of lines) if (l.hint) tips.push(`${l.label}: ${l.hint}.`);
  return { lines, tips };
}
