import type { Simulation } from '../sim/Simulation';
import { BUILDING_TYPES, LOAN_AMOUNTS, LOAN_MONTHLY_RATE, LOAN_TERM_MONTHS, MAX_DEBT, MAX_TICKET_PRICE, TICKET_STEP } from '../sim/data/economy';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  loanBlocker,
  loanPayment,
  operatingProfit,
  totalDebt,
  totalExpenses,
  totalIncome,
  type Ledger,
} from '../sim/finance';
import { expectedArrivals, fairPrice, parkAppeal } from '../sim/systems/visitors';
import { STAFF_ROLES, STAFF_TYPES } from '../sim/data/staff';
import { dailyWages, describeTask } from '../sim/systems/staff';
import { MEDALS, SCENARIOS } from '../sim/data/scenarios';
import { daysLeft, describeReward, goalProgress } from '../sim/goals';
import { formatMoney, type Hud } from './hud';
import { playSfx } from '../audio/audio';

type Tab = 'goals' | 'overview' | 'staff' | 'finances' | 'bank';

/** Validated against the beige panel surface with the dataviz palette checker (all checks pass). */
const BAR_COLOR = '#2a78d6';
const REFRESH_MS = 1000;

export function reputationLabel(r: number): string {
  if (r >= 85) return 'Legendary';
  if (r >= 70) return 'Great';
  if (r >= 55) return 'Good';
  if (r >= 40) return 'Fair';
  return 'Poor';
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** Park report: overview & ticket price, month-by-month finances, and the bank. */
export function mountParkPanel(sim: Simulation, hud: Hud): { open(tab?: Tab): void } {
  const modal = document.getElementById('park')!;
  const body = document.getElementById('park-body')!;
  const tabs = Array.from(modal.querySelectorAll<HTMLButtonElement>('.tab-btn'));
  const hasGoals = SCENARIOS[sim.state.scenario.id].rounds.length > 0;
  // Opens on the goals first, so it's always clear what to aim for.
  let tab: Tab = hasGoals ? 'goals' : 'overview';
  for (const t of tabs) if (t.dataset.tab === 'goals') t.hidden = !hasGoals;
  let timer: number | undefined;

  const act = (r: { ok: boolean; message: string }) => {
    hud.toast(r.message, r.ok ? 'ok' : 'error');
    playSfx(r.ok ? 'cash' : 'error');
    render();
  };

  function overview(): string {
    const { state } = sim;
    const regions = sim.regions();
    const appeal = parkAppeal(state, regions);
    const fair = fairPrice(appeal);
    const perHour = expectedArrivals(state, regions);
    const upkeep = state.buildings.reduce((s, b) => s + BUILDING_TYPES[b.kind].upkeep, 0);
    const rep = Math.round(state.reputation);
    const priceNote =
      state.ticketPrice > fair * 1.15
        ? 'so this feels steep: fewer will come, and they’ll leave less happy.'
        : state.ticketPrice < fair * 0.85
          ? 'so this is a bargain. You could charge more.'
          : 'so this is about right.';
    return `
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Guests in the park</span><span class="stat-value">${state.visitors.length}</span></div>
        <div class="stat"><span class="stat-label">Visitors today</span><span class="stat-value">${state.finance.today.visitors}</span></div>
        <div class="stat"><span class="stat-label">Visitors this month</span><span class="stat-value">${state.finance.month.visitors}</span></div>
        <div class="stat">
          <span class="stat-label">Reputation</span>
          <span class="stat-value">${rep} <small>${reputationLabel(rep)}</small></span>
          <span class="meter" role="meter" aria-valuenow="${rep}" aria-valuemin="0" aria-valuemax="100"><span style="width:${rep}%"></span></span>
        </div>
      </div>
      <section class="panel-section">
        <h3>Ticket price</h3>
        <div class="stepper">
          <button class="step-btn" data-price="${-TICKET_STEP}" aria-label="Lower price" ${state.ticketPrice <= 0 ? 'disabled' : ''}>−</button>
          <span class="stepper-value">${formatMoney(state.ticketPrice)}</span>
          <button class="step-btn" data-price="${TICKET_STEP}" aria-label="Raise price" ${state.ticketPrice >= MAX_TICKET_PRICE ? 'disabled' : ''}>+</button>
        </div>
        <p class="note">Visitors think about <b>${formatMoney(fair)}</b> is fair for what’s on show, ${priceNote}
          Expect about <b>${perHour.toFixed(1)}</b> new visitors an hour while open (08:00–18:00).</p>
      </section>
      <section class="panel-section">
        <p class="note">Weather: <b>${state.stormHours > 0 ? `⛈️ storm (about ${state.stormHours}h left)` : '🌤️ clear'}</b> ·
          Species unlocked: <b>${state.unlockedSpecies.length}/12</b>${state.buildings.some((b) => b.kind === 'digsite') ? '' : ' (build a dig site to find more)'}</p>
        <p class="note">Daily costs: wages <b>${formatMoney(dailyWages(state))}</b> · building upkeep <b>${formatMoney(upkeep)}</b> · Debt: <b>${formatMoney(totalDebt(state))}</b></p>
        <p class="note">Tips: build paths from the gate past your paddocks so visitors can see the dinos. Restaurants and restrooms keep them happy; snack stalls and souvenir shops earn extra; gardens cheer them up.</p>
      </section>
      <p class="note version">Version ${__APP_VERSION__} · ${__BUILD_DATE__}</p>`;
  }

  function ledgerRows(current: Ledger, last: Ledger | undefined): string {
    const row = (label: string, a: number, b: number | undefined, cls = '') =>
      `<tr class="${cls}"><th scope="row">${label}</th><td>${formatMoney(a)}</td><td>${b === undefined ? '—' : formatMoney(b)}</td></tr>`;
    const lines: string[] = [];
    lines.push(`<tr class="group"><th colspan="3">Income</th></tr>`);
    for (const c of INCOME_CATEGORIES) {
      if (current.income[c] || last?.income[c]) lines.push(row(CATEGORY_LABELS[c], current.income[c], last?.income[c]));
    }
    lines.push(row('Total income', totalIncome(current), last && totalIncome(last), 'total'));
    lines.push(`<tr class="group"><th colspan="3">Expenses</th></tr>`);
    for (const c of EXPENSE_CATEGORIES) {
      if (current.expenses[c] || last?.expenses[c]) lines.push(row(CATEGORY_LABELS[c], current.expenses[c], last?.expenses[c]));
    }
    lines.push(row('Total expenses', totalExpenses(current), last && totalExpenses(last), 'total'));
    lines.push(row('Operating profit', operatingProfit(current), last && operatingProfit(last), 'total profit'));
    return lines.join('');
  }

  /** Monthly operating profit: one series, bars up or down from a zero baseline. */
  function profitChart(): string {
    const { history, month } = sim.state.finance;
    const points = [
      ...history.map((h) => ({ label: `M${h.month}`, value: operatingProfit(h.ledger), partial: false })),
      { label: `M${history.length ? history[history.length - 1].month + 1 : 1}`, value: operatingProfit(month), partial: true },
    ];
    const W = 520;
    const H = 150;
    const top = 18;
    const bottom = 22;
    const left = 8;
    const max = Math.max(1, ...points.map((p) => p.value));
    const min = Math.min(0, ...points.map((p) => p.value));
    const scale = (H - top - bottom) / (max - min);
    const zeroY = top + max * scale;
    const slot = (W - left * 2) / Math.max(points.length, 6);
    const barW = Math.min(28, slot * 0.6);
    const bars = points
      .map((p, i) => {
        const cx = left + slot * i + slot / 2;
        const h = Math.max(1, Math.abs(p.value) * scale);
        const x = cx - barW / 2;
        const r = Math.min(4, h, barW / 2);
        // 4px rounded data end; square where the bar meets the baseline.
        const d =
          p.value >= 0
            ? `M${x},${zeroY} V${zeroY - h + r} Q${x},${zeroY - h} ${x + r},${zeroY - h} H${x + barW - r} Q${x + barW},${zeroY - h} ${x + barW},${zeroY - h + r} V${zeroY} Z`
            : `M${x},${zeroY} V${zeroY + h - r} Q${x},${zeroY + h} ${x + r},${zeroY + h} H${x + barW - r} Q${x + barW},${zeroY + h} ${x + barW},${zeroY + h - r} V${zeroY} Z`;
        const tip = `${p.label}${p.partial ? ' (so far)' : ''}: ${formatMoney(p.value)}`;
        // Label above the bar top, or for a loss just above the zero line (clear of the month labels).
        const labelY = p.value >= 0 ? zeroY - h - 5 : zeroY - 5;
        const showLabel = i === points.length - 1 || i === points.length - 2;
        return `<g class="bar" data-tip="${esc(tip)}" tabindex="0">
            <rect x="${cx - slot / 2}" y="${top - 10}" width="${slot}" height="${H - top}" fill="transparent"/>
            <path d="${d}" fill="${BAR_COLOR}" opacity="${p.partial ? 0.55 : 1}"/>
            ${showLabel ? `<text x="${cx}" y="${labelY}" text-anchor="middle" class="bar-value">${formatMoney(p.value)}</text>` : ''}
            <text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis-label">${p.label}${p.partial ? '*' : ''}</text>
          </g>`;
      })
      .join('');
    return `
      <figure class="chart">
        <figcaption>Operating profit by month <span class="note">(* = this month so far; loans excluded)</span></figcaption>
        <div class="chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Operating profit by month">
            <line x1="0" x2="${W}" y1="${zeroY}" y2="${zeroY}" class="baseline"/>
            ${bars}
          </svg>
          <div class="chart-tip hidden"></div>
        </div>
      </figure>`;
  }

  function finances(): string {
    const { history, month } = sim.state.finance;
    const last = history[history.length - 1];
    return `
      ${profitChart()}
      <table class="ledger">
        <thead><tr><th></th><th scope="col">This month</th><th scope="col">${last ? `Month ${last.month}` : 'Last month'}</th></tr></thead>
        <tbody>${ledgerRows(month, last?.ledger)}</tbody>
      </table>`;
  }

  function goalsTab(): string {
    const { state } = sim;
    const sc = SCENARIOS[state.scenario.id];
    const left = daysLeft(state);
    const done = state.scenario.round;
    const medal = MEDALS[Math.min(done, MEDALS.length - 1)];
    const status =
      state.scenario.status === 'won'
        ? '🏆 All three milestones complete! Keep building as long as you like.'
        : state.scenario.status === 'lost'
          ? 'This scenario has ended; you can keep playing for fun.'
          : `${medal.icon} <b>${medal.name} milestone</b>${left !== null ? ` · <b>${left}</b> day${left === 1 ? '' : 's'} left` : ''}`;
    // The medal track: done, current, and what's still to come.
    const track = sc.rounds
      .map((r, i) => {
        const m = MEDALS[i];
        const state_ = i < done ? 'done' : i === done && state.scenario.status === 'playing' ? 'current' : 'todo';
        // Finished rounds show what was actually paid out; the rest, what's on offer now.
        const reward = i < done ? (state.scenario.earned[i] ?? []) : describeReward(state, r.reward);
        return `<li class="medal ${state_}"><span class="medal-icon">${i < done ? m.icon : state_ === 'current' ? m.icon : '🔒'}</span>
          <span><b>${m.name}</b>${i < done ? ' ✓' : ''}<br><small>${reward.length ? `${i < done ? 'Earned' : 'Reward'}: ${reward.join(', ')}` : i < done ? 'Earned' : 'Reward: bragging rights'}</small></span></li>`;
      })
      .join('');
    const rows = goalProgress(state)
      .map((g) => {
        const pct = Math.min(100, (100 * Math.max(0, g.value)) / g.goal.target);
        const shown = g.goal.kind === 'cash' ? formatMoney(g.value) : `${g.value}/${g.goal.target}`;
        return `<li class="goal ${g.done ? 'done' : ''}">
          <span>${g.done ? '✅' : '⬜'} ${g.label}</span><span class="goal-value">${shown}</span>
          <span class="meter"><span style="width:${pct}%"></span></span>
        </li>`;
      })
      .join('');
    return `
      <h3>${sc.name}</h3>
      <p class="note">${sc.blurb}</p>
      <ol class="medal-track">${track}</ol>
      <p class="note">${status}</p>
      ${state.scenario.status === 'won' ? '' : `<ul class="goals">${rows}</ul>`}`;
  }

  function staffTab(): string {
    const { state } = sim;
    const escaped = state.dinos.filter((d) => d.escaped).length;
    const sick = state.dinos.filter((d) => d.sick).length;
    const worn = [...state.hFenceHp.filter((hp, i) => state.hFences[i] && hp < 50), ...state.vFenceHp.filter((hp, i) => state.vFences[i] && hp < 50)].length;
    const cards = STAFF_ROLES.map((role) => {
      const t = STAFF_TYPES[role];
      const n = state.staff.filter((m) => m.role === role).length;
      return `<div class="staff-card">
          <div><b>${t.name}</b> <span class="note">· ${formatMoney(t.wage)}/day · on staff: ${n}</span></div>
          <p class="note">${t.description}</p>
          <button class="action-btn" data-hire="${role}">Hire</button>
        </div>`;
    }).join('');
    const roster = state.staff
      .map(
        (m) => `<li class="loan">
          <span><b>${esc(m.name)}</b> · ${STAFF_TYPES[m.role].name} · ${esc(describeTask(state, m))}</span>
          <button class="step-btn fire-btn" data-fire="${m.id}" aria-label="Fire ${esc(m.name)}">Fire</button>
        </li>`,
      )
      .join('');
    return `
      <p class="note">Needs attention: <b>${worn}</b> worn fence segment${worn === 1 ? '' : 's'} · <b>${sick}</b> sick · <b>${escaped}</b> escaped.
        Wages: <b>${formatMoney(dailyWages(state))}</b> a day, paid at midnight.</p>
      <div class="staff-grid">${cards}</div>
      <section class="panel-section">
        <h3>Your staff</h3>
        ${roster ? `<ul class="loans">${roster}</ul>` : '<p class="note">Nobody yet. Feeders and fences won’t look after themselves!</p>'}
      </section>`;
  }

  function bank(): string {
    const { state } = sim;
    const debt = totalDebt(state);
    const offers = LOAN_AMOUNTS.map((a) => {
      const blocked = loanBlocker(state, a);
      return `<button class="action-btn" data-loan="${a}" ${blocked ? 'disabled' : ''}>Borrow ${formatMoney(a)}</button>`;
    }).join('');
    const loans = state.finance.loans
      .map((l) => {
        const p = loanPayment(l);
        return `<li class="loan">
          <span>${formatMoney(l.principal)} loan · <b>${formatMoney(l.balance)}</b> left · next payment ${formatMoney(p.principal + p.interest)} (${formatMoney(p.interest)} interest)</span>
          <button class="action-btn" data-repay="${l.id}" ${l.balance > state.money ? 'disabled' : ''}>Pay off ${formatMoney(l.balance)}</button>
        </li>`;
      })
      .join('');
    return `
      <section class="panel-section">
        <p class="note">The bank lends up to <b>${formatMoney(MAX_DEBT)}</b> in total at ${(LOAN_MONTHLY_RATE * 100).toFixed(1)}% interest a month.
          Each loan is repaid in ${LOAN_TERM_MONTHS} monthly instalments, taken automatically at month end.</p>
        <p class="note">You owe <b>${formatMoney(debt)}</b>.</p>
        <div class="loan-offers">${offers}</div>
      </section>
      <section class="panel-section">
        <h3>Your loans</h3>
        ${loans ? `<ul class="loans">${loans}</ul>` : '<p class="note">No loans.</p>'}
      </section>`;
  }

  function render(): void {
    for (const t of tabs) t.classList.toggle('active', t.dataset.tab === tab);
    body.innerHTML =
      tab === 'goals'
        ? goalsTab()
        : tab === 'overview'
          ? overview()
          : tab === 'staff'
            ? staffTab()
            : tab === 'finances'
              ? finances()
              : bank();
  }

  body.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-price],[data-loan],[data-repay],[data-hire],[data-fire],.bar');
    if (!el) return;
    if (el.dataset.price) act(sim.dispatch({ type: 'setTicketPrice', price: sim.state.ticketPrice + Number(el.dataset.price) }));
    else if (el.dataset.loan) act(sim.dispatch({ type: 'takeLoan', amount: Number(el.dataset.loan) }));
    else if (el.dataset.repay) act(sim.dispatch({ type: 'repayLoan', id: Number(el.dataset.repay) }));
    else if (el.dataset.hire) act(sim.dispatch({ type: 'hireStaff', role: el.dataset.hire as (typeof STAFF_ROLES)[number] }));
    else if (el.dataset.fire) act(sim.dispatch({ type: 'fireStaff', id: Number(el.dataset.fire) }));
    else showTip(el);
  });
  body.addEventListener('pointerover', (e) => {
    const bar = (e.target as HTMLElement).closest<HTMLElement>('.bar');
    if (bar && e.pointerType === 'mouse') showTip(bar);
  });
  body.addEventListener('pointerleave', () => body.querySelector('.chart-tip')?.classList.add('hidden'));

  function showTip(bar: HTMLElement): void {
    const tip = body.querySelector<HTMLElement>('.chart-tip');
    const wrap = body.querySelector<HTMLElement>('.chart-wrap');
    if (!tip || !wrap) return;
    const b = bar.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    tip.textContent = bar.dataset.tip ?? '';
    tip.style.left = `${b.left - w.left + b.width / 2}px`;
    tip.classList.remove('hidden');
  }

  for (const t of tabs) {
    t.addEventListener('click', () => {
      tab = t.dataset.tab as Tab;
      render();
    });
  }
  const close = () => {
    modal.classList.add('hidden');
    window.clearInterval(timer);
  };
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return {
    open(t?: Tab) {
      if (t) tab = t;
      render();
      modal.classList.remove('hidden');
      window.clearInterval(timer);
      // Live numbers, but not the chart tab while someone may be reading a tooltip.
      timer = window.setInterval(() => tab !== 'finances' && render(), REFRESH_MS);
    },
  };
}
