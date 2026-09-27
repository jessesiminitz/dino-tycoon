import { calendar, type GameState } from './GameState';
import { BANKRUPT_BELOW, MEDALS, SCENARIOS, type Goal, type Reward, type Round } from './data/scenarios';
import { earn } from './finance';
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

/** The round being played (the last one once everything's done), or null for the sandbox. */
export function currentRound(state: GameState): Round | null {
  const { rounds } = SCENARIOS[state.scenario.id];
  if (rounds.length === 0) return null;
  return rounds[Math.min(state.scenario.round, rounds.length - 1)];
}

export function goalProgress(state: GameState): { goal: Goal; label: string; value: number; done: boolean }[] {
  return (currentRound(state)?.goals ?? []).map((goal) => {
    const value = goalValue(state, goal);
    return { goal, label: goalLabel(goal), value, done: value >= goal.target };
  });
}

/** Days left in the current round (null when there's no deadline). */
export function daysLeft(state: GameState): number | null {
  const round = currentRound(state);
  if (!round?.days) return null;
  return Math.max(0, round.days - (calendar(state).day - state.scenario.roundStart));
}

/** What a reward will give in this park, in words (species already unlocked turn into cash). */
export function describeReward(state: GameState, reward: Reward): string[] {
  const out: string[] = [];
  const fresh = (reward.unlock ?? []).filter((id) => !state.unlockedSpecies.includes(id));
  if (fresh.length > 3) out.push(`${fresh.length} new species unlocked`);
  else for (const id of fresh) out.push(`${SPECIES[id].name} unlocked`);
  const cash = (reward.money ?? 0) + unlockRefund(state, reward);
  if (cash > 0) out.push(`${usd(cash)} prize`);
  return out;
}

/** Species you'd already unlocked are paid out at half their price instead. */
function unlockRefund(state: GameState, reward: Reward): number {
  const owned = (reward.unlock ?? []).filter((id) => state.unlockedSpecies.includes(id));
  return reward.unlock && reward.unlock.length > 3 ? 0 : owned.reduce((sum, id) => sum + SPECIES[id].price / 2, 0);
}

function grant(state: GameState, reward: Reward): string[] {
  const words = describeReward(state, reward);
  const cash = (reward.money ?? 0) + unlockRefund(state, reward);
  for (const id of reward.unlock ?? []) if (!state.unlockedSpecies.includes(id)) state.unlockedSpecies.push(id);
  if (cash > 0) earn(state, 'awards', cash);
  return words;
}

/**
 * Hourly: when every goal in the round is met, hand out its reward and move on
 * to the next, harder round; finishing the third wins the scenario. At
 * midnight, lose on the round's deadline or if the park is deep in the red.
 * Either way the park carries on.
 */
export function hourlyScenario(ctx: SimContext): void {
  const { state } = ctx;
  if (state.scenario.status !== 'playing') return;
  const sc = SCENARIOS[state.scenario.id];
  const round = currentRound(state);
  if (!round) return;

  if (goalProgress(state).every((g) => g.done)) {
    const medal = MEDALS[state.scenario.round];
    const reward = grant(state, round.reward);
    state.scenario.earned.push(reward);
    state.scenario.round++;
    state.scenario.roundStart = calendar(state).day;
    const prize = reward.length ? ` Reward: ${reward.join(', ')}.` : '';
    if (state.scenario.round >= sc.rounds.length) {
      state.scenario.status = 'won';
      state.reputation = Math.min(100, state.reputation + 5);
      ctx.emit({ text: `🏆 ${medal.icon} ${sc.name} complete: all three milestones!${prize}`, kind: 'good', outcome: 'won' });
    } else {
      ctx.emit({ text: `${medal.icon} ${medal.name} milestone reached in ${sc.name}!${prize}`, kind: 'good', outcome: 'milestone' });
    }
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
