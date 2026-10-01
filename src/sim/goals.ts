import { calendar, NEVER, type GameState } from './GameState';
import { allFenceEdges, fenceHp } from './fences';
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
    case 'profitStreak':
      return `Make a profit ${g.target} days in a row`;
    case 'debtFree':
      return 'Pay off every bank loan';
    case 'dinosHome':
      return 'Every dinosaur back in its paddock';
    case 'calmDays':
      return `${g.target} days in a row with no escapes`;
    case 'fencesOk':
      return g.target >= 100 ? 'Every fence in good repair' : `${g.target}% of fences in good repair`;
    case 'eruptionOver':
      return 'Survive the eruption';
    case 'noLosses':
      return 'Lose no dinosaurs';
    case 'floodsSurvived':
      return `Get through ${g.target} flood${g.target === 1 ? '' : 's'}`;
    case 'floodProof':
      return 'A flood that reaches no path, building or dino';
  }
}

/** Fence sections this worn count as needing repair. */
export const FENCE_OK_HP = 60;

/** Percent of fence sections in good repair (100 with no fences at all). Broken sections count as needing repair. */
export function fencesOkPercent(state: GameState): number {
  let all = 0;
  let ok = 0;
  for (const e of allFenceEdges(state)) {
    all++;
    if (fenceHp(state, e) >= FENCE_OK_HP) ok++;
  }
  return all === 0 ? 100 : Math.floor((100 * ok) / all);
}

/** How a goal's progress reads next to it, e.g. "7/12 home" or "$40,000 of loans left". */
export function goalShown(state: GameState, g: Goal, value: number): string {
  switch (g.kind) {
    case 'cash':
      return usd(value);
    case 'fencesOk':
      return `${value}%`;
    case 'dinosHome': {
      const home = state.dinos.filter((d) => !d.escaped).length;
      return `${home}/${state.dinos.length} home`;
    }
    case 'debtFree':
      return value >= 1 ? 'paid off' : `${usd(totalDebt(state))} owed`;
    case 'eruptionOver': {
      const stage = state.eruption?.stage ?? 'rumbling';
      return { rumbling: 'rumbling…', erupting: 'erupting!', cooling: 'cooling', over: 'over' }[stage];
    }
    case 'noLosses':
      return value >= 1 ? 'all safe' : `${state.stats.dinosLost} lost`;
    case 'floodProof':
      return value >= 1 ? 'done!' : 'not yet';
    case 'profitStreak':
    case 'calmDays':
      return `${value}/${g.target} days`;
    default:
      return `${value}/${g.target}`;
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
    case 'profitStreak':
      return state.stats.profitStreak;
    case 'debtFree':
      return state.finance.loans.length === 0 ? 1 : 0;
    case 'dinosHome':
      return state.dinos.length === 0 ? 100 : Math.floor((100 * state.dinos.filter((d) => !d.escaped).length) / state.dinos.length);
    case 'calmDays': {
      const since = state.stats.lastEscapeHour === NEVER ? state.hours : state.hours - state.stats.lastEscapeHour;
      return Math.floor(since / 24);
    }
    case 'fencesOk':
      return fencesOkPercent(state);
    case 'eruptionOver':
      return state.eruption?.stage === 'over' ? 1 : 0;
    case 'noLosses':
      return state.stats.dinosLost === 0 ? 1 : 0;
    case 'floodsSurvived':
      return state.flood?.survived ?? 0;
    case 'floodProof':
      return state.flood?.lastDry && state.flood.survived > 0 ? 1 : 0;
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

  // Scripted story beats, once each.
  const story = sc.timeline ?? [];
  while (state.scenario.timeline < story.length && story[state.scenario.timeline].hour <= state.hours) {
    const beat = story[state.scenario.timeline++];
    ctx.emit({ text: beat.text, kind: beat.kind });
  }

  // A park that has already broken a hard rule can't earn a medal; the game ends at midnight.
  const fatal = fatalLoss(state);
  if (!fatal && goalProgress(state).every((g) => g.done)) {
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
  const reason = fatal ?? (daysLeft(state) === 0 ? 'Out of time' : null);
  if (reason) {
    state.scenario.status = 'lost';
    ctx.emit({ text: `${reason}: ${sc.name} is over.`, kind: 'bad', outcome: 'lost' });
  }
}

/** A hard rule the park has broken (bankruptcy, or the scenario's own limits), in words, or null. */
function fatalLoss(state: GameState): string | null {
  if (state.money < BANKRUPT_BELOW) return 'The bank has stepped in';
  const lose = SCENARIOS[state.scenario.id].loseIf;
  if (lose?.dinosLostAbove !== undefined && state.stats.dinosLost > lose.dinosLostAbove) return 'Too many dinosaurs were lost';
  if (lose?.reputationBelow !== undefined && state.reputation < lose.reputationBelow) return 'The park’s reputation fell too low';
  return null;
}
