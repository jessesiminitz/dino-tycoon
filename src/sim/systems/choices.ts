import { calendar, type Dino, type GameState, type PendingChoice } from '../GameState';
import { FEEDER_TYPES } from '../data/feeders';
import { LAST_ENTRY_HOUR, OPEN_HOUR } from '../data/economy';
import { SPECIES } from '../data/species';
import { VISITOR_FIRST_NAMES } from '../data/thoughts';
import { earn, spend } from '../finance';
import { Rng } from '../rng';
import type { GameEvent, SimContext } from './context';
import { lockedSpecies } from './fossils';

/**
 * Now and then something happens that needs a decision: a card with two
 * choices, each with its own consequences. Events only come up when they make
 * sense for the park (a birthday naming needs a baby to name). The game waits;
 * after CHOICE_HOURS the last (cautious) option is taken for you.
 */
export const CHOICE_HOURS = 4;
/** Chance per open hour of a new decision (about one a day). */
const CHOICE_CHANCE = 1 / 12;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export interface ChoiceOption {
  label: string;
  /** Applies the choice; returns what happened, for the log. */
  apply: (state: GameState, c: PendingChoice, rng: Rng) => string;
}

export interface ChoiceEvent {
  id: string;
  icon: string;
  title: string;
  /** The card's story, filled in for this park. */
  text: (state: GameState, c: PendingChoice) => string;
  /** What the event is about (an animal, an amount...), or null if it can't happen right now. */
  setup: (state: GameState, rng: Rng) => Omit<PendingChoice, 'eventId' | 'createdHour' | 'expiresHour'> | null;
  options: [ChoiceOption, ChoiceOption];
}

const dino = (state: GameState, c: PendingChoice): Dino | undefined => state.dinos.find((d) => d.id === c.dinoId);
const pick = <T>(rng: Rng, xs: T[]): T | undefined => (xs.length ? xs[rng.int(0, xs.length - 1)] : undefined);
const inPark = (state: GameState) => state.dinos.filter((d) => !d.escaped);

export const CHOICE_EVENTS: ChoiceEvent[] = [
  {
    id: 'tv',
    icon: '📺',
    title: 'Lights, camera, dinosaur!',
    text: (s, c) => `A TV crew wants to film ${dino(s, c)?.name ?? 'one of your animals'} at feeding time for the evening news. It's great publicity, but the bright lights might spook the poor thing.`,
    setup: (s, rng) => {
      const d = pick(rng, inPark(s));
      return d ? { dinoId: d.id } : null;
    },
    options: [
      {
        label: '🎬 Roll the cameras',
        apply: (s, c, rng) => {
          s.reputation = Math.min(100, s.reputation + 4);
          const d = dino(s, c);
          if (d && rng.chance(0.3)) {
            d.hunger = Math.min(100, d.hunger + 30);
            return `📺 The park was on the news (+4 reputation)! The lights did rattle ${d.name}, though: keep an eye on them.`;
          }
          return `📺 The park was on the news (+4 reputation), and ${d?.name ?? 'the star'} was a natural.`;
        },
      },
      { label: 'No, thank you', apply: () => '📺 You turned the TV crew away. Maybe next time.' },
    ],
  },
  {
    id: 'birthday',
    icon: '🎂',
    title: 'A birthday wish',
    text: (s, c) => {
      const d = dino(s, c);
      return `${c.name} is visiting the park for their birthday and has fallen in love with ${d?.name ?? 'your baby'}, the baby ${d ? SPECIES[d.species].name : 'dinosaur'}. Could the baby be named after them?`;
    },
    setup: (s, rng) => {
      const d = pick(rng, s.dinos.filter((x) => x.baby));
      if (!d || s.visitors.length === 0) return null;
      return { dinoId: d.id, name: pick(rng, VISITOR_FIRST_NAMES) };
    },
    options: [
      {
        label: '🎉 What a lovely idea',
        apply: (s, c) => {
          const d = dino(s, c);
          if (d && c.name) d.name = c.name;
          s.reputation = Math.min(100, s.reputation + 2);
          for (const v of s.visitors) v.satisfaction = Math.min(100, v.satisfaction + 5);
          return `🎂 Happy birthday, ${c.name}! The baby is now called ${c.name}, and everyone sang (+2 reputation).`;
        },
      },
      { label: 'Keep its name', apply: (_s, c) => `🎂 ${c.name} had a lovely birthday anyway.` },
    ],
  },
  {
    id: 'scientist',
    icon: '🧪',
    title: 'A scientific visit',
    text: (s, c) => {
      const d = dino(s, c);
      return `A scientist from the university offers ${usd(c.amount ?? 0)} to study ${d?.name ?? 'your animal'} the ${d ? SPECIES[d.species].name : 'dinosaur'} for a day. All those tests will leave it grumpy for a while.`;
    },
    setup: (s, rng) => {
      const d = pick(rng, inPark(s).filter((x) => !x.baby && SPECIES[x.species].price >= 9000));
      return d ? { dinoId: d.id, amount: Math.round((SPECIES[d.species].price * 0.25) / 100) * 100 } : null;
    },
    options: [
      {
        label: '🔬 Accept the offer',
        apply: (s, c) => {
          earn(s, 'awards', c.amount ?? 0);
          s.reputation = Math.min(100, s.reputation + 1);
          const d = dino(s, c);
          if (d) d.hunger = Math.min(100, d.hunger + 25);
          return `🧪 The scientist paid ${usd(c.amount ?? 0)} and learned a lot. ${d?.name ?? 'The animal'} is grumpy and hungry after all the tests.`;
        },
      },
      { label: 'Not today', apply: () => '🧪 You politely said no to the scientist.' },
    ],
  },
  {
    id: 'storm',
    icon: '🌧️',
    title: 'Storm warning',
    text: () => 'The weather service warns that a big storm is on its way this afternoon. Close the gates early so everyone goes home happy and dry, or stay open and sell more tickets?',
    setup: (s) => {
      const { hour } = calendar(s);
      return s.stormHours === 0 && hour >= OPEN_HOUR + 1 && hour <= LAST_ENTRY_HOUR - 3 && s.visitors.length > 0 ? {} : null;
    },
    options: [
      {
        label: '🚪 Close early',
        apply: (s, _c, rng) => {
          s.stormHours = rng.int(6, 10);
          s.stats.closedDay = calendar(s).day;
          for (const v of s.visitors) {
            v.satisfaction = Math.min(100, v.satisfaction + 8);
            v.leaveHour = s.hours;
          }
          return '🌧️ You closed early: visitors headed home happy and dry before the storm hit. No more tickets today.';
        },
      },
      {
        label: 'Stay open',
        apply: (s, _c, rng) => {
          s.stormHours = rng.int(6, 10);
          return "🌧️ The park stayed open. Here comes the rain! (Ponchos and umbrellas will sell well.)";
        },
      },
    ],
  },
  {
    id: 'collector',
    icon: '🦴',
    title: 'A fossil collector',
    text: (s, c) => {
      const n = s.fossils[c.species!] ?? 0;
      return `A private collector offers ${usd(c.amount ?? 0)} for your ${n} ${SPECIES[c.species!].name} fossil piece${n === 1 ? '' : 's'}. Sell them, and you'll have to dig them up all over again to unlock the species.`;
    },
    setup: (s, rng) => {
      const species = pick(rng, lockedSpecies(s).filter((id) => (s.fossils[id] ?? 0) > 0));
      return species ? { species, amount: (s.fossils[species] ?? 0) * 900 } : null;
    },
    options: [
      {
        label: '💰 Sell the fossils',
        apply: (s, c) => {
          earn(s, 'sales', c.amount ?? 0);
          s.fossils[c.species!] = 0;
          return `🦴 You sold the ${SPECIES[c.species!].name} fossils for ${usd(c.amount ?? 0)}.`;
        },
      },
      { label: 'Keep digging', apply: (s, c) => `🦴 You kept the ${SPECIES[c.species!].name} fossils. Only ${SPECIES[c.species!].fossilsNeeded - (s.fossils[c.species!] ?? 0)} more to go!` },
    ],
  },
  {
    id: 'presenter',
    icon: '⭐',
    title: 'A famous visitor',
    text: () => 'A famous nature presenter is in the park and would love a private tour. It will cost $500 in staff time, but everyone watches their show.',
    setup: (s) => (s.money >= 500 && inPark(s).length >= 3 ? {} : null),
    options: [
      {
        label: '🗺️ Give the tour',
        apply: (s) => {
          spend(s, 'wages', 500);
          s.reputation = Math.min(100, s.reputation + 5);
          return '⭐ The presenter loved the tour and raved about the park on their show (+5 reputation).';
        },
      },
      { label: "We're too busy", apply: () => '⭐ The presenter enjoyed the park on their own.' },
    ],
  },
  {
    id: 'fundraiser',
    icon: '🎁',
    title: 'A school fundraiser',
    text: (_s, c) => `The local school held a bake sale and raised ${usd(c.amount ?? 0)} for the park! Spend it on a free top-up for every feeder, or put it in the bank?`,
    setup: (s, rng) => (s.feeders.length ? { amount: rng.int(6, 15) * 100 } : null),
    options: [
      {
        label: '🥬 Fill every feeder',
        apply: (s) => {
          for (const f of s.feeders) f.stock = FEEDER_TYPES[f.kind].capacity;
          s.reputation = Math.min(100, s.reputation + 1);
          return '🎁 Every feeder is full to the brim, thanks to the school!';
        },
      },
      {
        label: 'Bank it',
        apply: (s, c) => {
          earn(s, 'awards', c.amount ?? 0);
          return `🎁 ${usd(c.amount ?? 0)} from the school's bake sale went into the bank. Thank you!`;
        },
      },
    ],
  },
  {
    id: 'lost-kid',
    icon: '🧒',
    title: 'A lost little one',
    text: (_s, c) => `A little one called ${c.name} has lost their grown-ups near the dinosaurs! Make an announcement over the loudspeaker, or have staff search quietly?`,
    setup: (s, rng) => {
      const kid = pick(rng, s.visitors.filter((v) => v.kid && v.riding === null));
      return kid ? { name: kid.name.split(' ')[0] } : null;
    },
    options: [
      {
        label: '📢 Loudspeaker',
        apply: (s, c) => {
          s.reputation = Math.min(100, s.reputation + 2);
          return `🧒 "Would ${c.name}'s grown-ups come to the gate?" Reunited within minutes (+2 reputation).`;
        },
      },
      {
        label: 'Search quietly',
        // The cautious answer (also taken if nobody decides): a happy ending, but no boost for doing nothing.
        apply: (_s, c) => `🧒 Staff found ${c.name}'s family by the snack stall. Happy tears all round.`,
      },
    ],
  },
];

export const choiceEvent = (id: string) => CHOICE_EVENTS.find((e) => e.id === id);

/** The event's own dice: seeded from the park and the hour, so the rest of the park's luck isn't disturbed. */
const diceFor = (state: GameState, salt: number) => new Rng((state.seed * 6007 + state.hours * 92_821 + salt) >>> 0);

/** Answers the waiting decision; returns what happened (for the log), or null if nothing's waiting. */
export function answerChoice(state: GameState, option: number): string | null {
  const c = state.pendingChoice;
  const ev = c && choiceEvent(c.eventId);
  if (!c || !ev) return null;
  state.pendingChoice = null;
  return ev.options[Math.max(0, Math.min(ev.options.length - 1, option))].apply(state, c, diceFor(state, 17));
}

/** Hourly: time out an unanswered decision, or (while the park is open) maybe start a new one. */
export function hourlyChoices(ctx: SimContext): void {
  const { state } = ctx;
  const c = state.pendingChoice;
  if (c) {
    if (state.hours >= c.expiresHour) {
      const ev = choiceEvent(c.eventId);
      const result = answerChoice(state, (ev?.options.length ?? 1) - 1);
      if (result) ctx.emit({ text: `⌛ No answer in time, so: ${result}`, kind: 'info' });
    }
    return;
  }
  const { hour } = calendar(state);
  if (hour < OPEN_HOUR || hour > LAST_ENTRY_HOUR) return;
  const dice = diceFor(state, 3);
  if (!dice.chance(CHOICE_CHANCE)) return;
  const order = [...CHOICE_EVENTS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = dice.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const ev of order) {
    const about = ev.setup(state, dice);
    if (!about) continue;
    state.pendingChoice = { ...about, eventId: ev.id, createdHour: state.hours, expiresHour: state.hours + CHOICE_HOURS };
    const event: GameEvent = { text: `${ev.icon} ${ev.title}: a decision is waiting for you`, kind: 'info' };
    ctx.emit(event);
    return;
  }
}
