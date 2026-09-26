import { calendar, type GameState } from './GameState';
import { BANKRUPT_BELOW, SCENARIOS, type Goal } from './data/scenarios';
import { SPECIES } from './data/species';
import { totalDebt } from './finance';
import type { SimContext } from './systems/context';

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function goalLabel(g: Goal): string {
  switch (g.kind) {
    case 'dinos':
      return `Have ${g.target} dinosaurs`;
    case 'species':
      return `Show ${g.target} different species`;
    case 'dayVisitors':
      return `Welcome ${g.target} visitors in one day`;
    case 'reputation':
      return `Reach a reputation of ${g.target}`;
    case 'cash':
      return `Have ${usd(g.target)} after debts`;
    case 'unlocked':
      return `Unlock ${g.target} species`;
    case 'own':
      return `Own ${g.target === 1 ? 'a' : g.target} ${SPECIES[g.species!].name}`;
  }
}

export function goalValue(state: GameState, g: Goal): number {
  switch (g.kind) {
    case 'dinos':
      return state.dinos.length;
    case 'species':
      return new Set(state.dinos.map((d) => d.species)).size;
    case 'dayVisitors':
      return Math.max(state.stats.bestDayVisitors, state.finance.today.visitors);
    case 'reputation':
      return Math.round(state.reputation);
    case 'cash':
      return state.money - totalDebt(state);
    case 'unlocked':
      return state.unlockedSpecies.length;
    case 'own':
      return state.dinos.filter((d) => d.species === g.species).length;
  }
}

export function goalProgress(state: GameState): { goal: Goal; label: string; value: number; done: boolean }[] {
  return SCENARIOS[state.scenario.id].goals.map((goal) => {
    const value = goalValue(state, goal);
    return { goal, label: goalLabel(goal), value, done: value >= goal.target };
  });
}

/** Days left before the deadline (null when there's none). */
export function daysLeft(state: GameState): number | null {
  const sc = SCENARIOS[state.scenario.id];
  if (!sc.days) return null;
  return Math.max(0, sc.days - (calendar(state).day - 1));
}

/**
 * Hourly: win when every goal is met; at midnight, lose on the deadline or if
 * the park is deep in the red. Either way the park carries on as free play.
 */
export function hourlyScenario(ctx: SimContext): void {
  const { state } = ctx;
  if (state.scenario.status !== 'playing') return;
  const sc = SCENARIOS[state.scenario.id];

  if (goalProgress(state).every((g) => g.done)) {
    state.scenario.status = 'won';
    ctx.emit({ text: `🏆 Scenario complete: ${sc.name}!`, kind: 'good', outcome: 'won' });
    return;
  }
  if (calendar(state).hour !== 0) return;
  if (state.money < BANKRUPT_BELOW) {
    state.scenario.status = 'lost';
    ctx.emit({ text: `The bank has stepped in: ${sc.name} is over.`, kind: 'bad', outcome: 'lost' });
    return;
  }
  if (daysLeft(state) === 0) {
    state.scenario.status = 'lost';
    ctx.emit({ text: `Out of time: ${sc.name} is over.`, kind: 'bad', outcome: 'lost' });
  }
}
