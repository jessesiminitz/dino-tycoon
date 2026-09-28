import type { GameState } from './GameState';
import { LOAN_MONTHLY_RATE, LOAN_TERM_MONTHS, MAX_DEBT } from './data/economy';

export const INCOME_CATEGORIES = ['admissions', 'food', 'snacks', 'souvenirs', 'rides', 'sales', 'awards', 'loans'] as const;
export const EXPENSE_CATEGORIES = [
  'construction',
  'land',
  'dinosaurs',
  'feed',
  'wages',
  'maintenance',
  'upkeep',
  'fines',
  'treats',
  'interest',
  'repayments',
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<IncomeCategory | ExpenseCategory, string> = {
  admissions: 'Admissions',
  food: 'Restaurant',
  snacks: 'Snack stalls',
  souvenirs: 'Souvenir shops',
  rides: 'Rides & attractions',
  sales: 'Sales & refunds',
  awards: 'Awards',
  loans: 'Loans received',
  construction: 'Construction',
  land: 'Land',
  dinosaurs: 'Dinosaurs',
  feed: 'Dino food',
  wages: 'Staff wages',
  maintenance: 'Repairs & medicine',
  upkeep: 'Building upkeep',
  fines: 'Fines',
  treats: 'Dino treats',
  interest: 'Loan interest',
  repayments: 'Loan repayments',
};

export interface Ledger {
  income: Record<IncomeCategory, number>;
  expenses: Record<ExpenseCategory, number>;
  visitors: number;
}

export interface MonthReport {
  /** 1-based month number. */
  month: number;
  ledger: Ledger;
  endMoney: number;
  reputation: number;
}

export interface Loan {
  id: number;
  principal: number;
  balance: number;
}

export interface Finance {
  today: Ledger;
  month: Ledger;
  /** Closed months, oldest first (last 12 kept). */
  history: MonthReport[];
  loans: Loan[];
}

export function emptyLedger(): Ledger {
  return {
    income: Object.fromEntries(INCOME_CATEGORIES.map((c) => [c, 0])) as Record<IncomeCategory, number>,
    expenses: Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>,
    visitors: 0,
  };
}

/** Adds categories introduced after a save was made, as zeros. */
export function normalizeFinance(f: Finance): void {
  const fix = (l: Ledger) => {
    for (const c of INCOME_CATEGORIES) l.income[c] ??= 0;
    for (const c of EXPENSE_CATEGORIES) l.expenses[c] ??= 0;
  };
  fix(f.today);
  fix(f.month);
  for (const h of f.history) fix(h.ledger);
}

export function newFinance(): Finance {
  return { today: emptyLedger(), month: emptyLedger(), history: [], loans: [] };
}

export function totalIncome(l: Ledger): number {
  return INCOME_CATEGORIES.reduce((s, c) => s + l.income[c], 0);
}

export function totalExpenses(l: Ledger): number {
  return EXPENSE_CATEGORIES.reduce((s, c) => s + l.expenses[c], 0);
}

/** Operating profit: excludes loan money in and out, which isn't earnings. */
export function operatingProfit(l: Ledger): number {
  return totalIncome(l) - l.income.loans - (totalExpenses(l) - l.expenses.repayments);
}

/** All money in goes through here so the books always match the balance. */
export function earn(state: GameState, category: IncomeCategory, amount: number): void {
  state.money += amount;
  state.finance.today.income[category] += amount;
  state.finance.month.income[category] += amount;
}

/** All money out goes through here. */
export function spend(state: GameState, category: ExpenseCategory, amount: number): void {
  state.money -= amount;
  state.finance.today.expenses[category] += amount;
  state.finance.month.expenses[category] += amount;
}

export function totalDebt(state: GameState): number {
  return state.finance.loans.reduce((s, l) => s + l.balance, 0);
}

export function loanBlocker(state: GameState, amount: number): string | null {
  if (totalDebt(state) + amount > MAX_DEBT) return `The bank won't lend more than $${MAX_DEBT.toLocaleString('en-US')} in total`;
  return null;
}

/** Payment due at month end: interest on the balance plus 1/12 of the principal. */
export function loanPayment(loan: Loan): { interest: number; principal: number } {
  return {
    interest: Math.round(loan.balance * LOAN_MONTHLY_RATE),
    principal: Math.min(loan.balance, Math.ceil(loan.principal / LOAN_TERM_MONTHS)),
  };
}
