import { calendar } from '../GameState';
import { BUILDING_TYPES, DAYS_PER_MONTH } from '../data/economy';
import { STAFF_TYPES } from '../data/staff';
import { emptyLedger, loanPayment, operatingProfit, spend } from '../finance';
import type { SimContext } from './context';

const HISTORY_MONTHS = 12;
const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** Runs on the hour; at midnight closes the day, and every DAYS_PER_MONTH days closes the month. */
export function hourlyEconomy(ctx: SimContext): void {
  const { state } = ctx;
  const { day, hour } = calendar(state);
  if (hour !== 0) return;
  const finance = state.finance;

  // Midnight: wages and building upkeep, then the day's summary.
  for (const m of state.staff) spend(state, 'wages', STAFF_TYPES[m.role].wage);
  for (const b of state.buildings) spend(state, 'upkeep', BUILDING_TYPES[b.kind].upkeep);
  state.stats.bestDayVisitors = Math.max(state.stats.bestDayVisitors, finance.today.visitors);
  const dayProfit = operatingProfit(finance.today);
  ctx.emit({
    text: `Day ${day - 1}: ${finance.today.visitors} visitor${finance.today.visitors === 1 ? '' : 's'}, profit ${usd(dayProfit)}`,
    kind: dayProfit >= 0 ? 'good' : 'bad',
  });
  finance.today = emptyLedger();

  if ((day - 1) % DAYS_PER_MONTH !== 0) return;

  // Month end: loan payments are charged to the closing month, then it's archived.
  for (const loan of [...finance.loans]) {
    const { interest, principal } = loanPayment(loan);
    spend(state, 'interest', interest);
    spend(state, 'repayments', principal);
    loan.balance -= principal;
    if (loan.balance <= 0) finance.loans.splice(finance.loans.indexOf(loan), 1);
  }
  const month = (day - 1) / DAYS_PER_MONTH;
  finance.history.push({ month, ledger: finance.month, endMoney: state.money, reputation: Math.round(state.reputation) });
  if (finance.history.length > HISTORY_MONTHS) finance.history.shift();
  ctx.emit({ text: `Month ${month} closed: profit ${usd(operatingProfit(finance.month))}. See the Park report.`, kind: 'info' });
  finance.month = emptyLedger();
}
