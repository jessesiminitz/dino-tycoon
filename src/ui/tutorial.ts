import type { Simulation } from '../sim/Simulation';
import { FEEDER_TYPES } from '../sim/data/feeders';
import { onWalkway } from '../sim/paths';

interface Step {
  text: string;
  /** Element to pulse while this step is showing. */
  target?: string;
  /** Checked a few times a second; the step completes once true. Omit for a "Next" button. */
  done?: (sim: Simulation) => boolean;
  button?: string;
}

const STEPS: Step[] = [
  {
    text: 'Welcome to your island! Drag to look around and pinch to zoom. Your land is inside the white line, and visitors arrive at the gate on the beach.',
    button: 'Let’s build',
  },
  {
    text: 'Dinosaurs need a paddock. Tap 🚧 Fence, then drag from one corner to the opposite corner, and drag again to close the box.',
    target: '.tool-btn[data-mode="fence"]',
    done: (sim) => sim.regions().regions.some((r) => r.kind === 'paddock'),
  },
  {
    text: 'Dinosaurs get hungry. Tap 🍖 Feeder and place a plant feeder inside your paddock.',
    target: '.tool-btn[data-mode="feeder"]',
    done: (sim) => {
      const { regions, tileRegion } = sim.regions();
      const w = sim.state.map.width;
      return sim.state.feeders.some(
        (f) => FEEDER_TYPES[f.kind].diet === 'herbivore' && regions[tileRegion[f.y * w + f.x]]?.kind === 'paddock',
      );
    },
  },
  {
    text: 'Now the fun part! Tap 🦖 Dinos, buy a Protoceratops, then tap inside your paddock to let it out.',
    target: '#btn-catalog',
    done: (sim) => sim.state.dinos.length > 0,
  },
  {
    text: 'Visitors walk on paths. Tap 🛤️ Path and drag from the gate up to your paddock, so they can see your dinosaur.',
    target: '.tool-btn[data-mode="path"]',
    done: (sim) => {
      const { state } = sim;
      const w = state.map.width;
      const { x: gx, y: gy } = state.entrance;
      const touchesGate = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => state.paths[(gy + dy) * w + gx + dx] === 1);
      const nearDino = state.paths.some(
        (p, i) => p === 1 && state.dinos.some((d) => Math.abs(d.x - (i % w)) <= 4 && Math.abs(d.y - Math.floor(i / w)) <= 4),
      );
      return touchesGate && nearDino && onWalkway(state, gy * w + gx);
    },
  },
  {
    text: 'Hungry visitors spend money. Tap 🏪 Build and put a Restaurant right next to your path.',
    target: '.tool-btn[data-mode="building"]',
    done: (sim) => sim.state.buildings.some((b) => b.kind === 'restaurant'),
  },
  {
    text: 'Staff keep the park running. Open 📊 Park, go to the Staff tab and hire a Worker to refill feeders and fix fences.',
    target: '#btn-park',
    done: (sim) => sim.state.staff.some((m) => m.role === 'worker'),
  },
  {
    text: 'You’re open for business! Tap ▶▶ to speed up time, and check 🏆 Goals to see what it takes to win. Good luck!',
    target: '#btn-goals',
    button: 'Finish',
  },
];

const CHECK_MS = 400;
const CELEBRATE_MS = 1200;

/** Guided first steps for the First Steps scenario. Progress is saved with the park. */
export function mountTutorial(sim: Simulation, toast: (text: string) => void): void {
  if (sim.state.tutorialStep === null) return;
  const card = document.getElementById('tutorial')!;
  const text = card.querySelector<HTMLElement>('.tutorial-text')!;
  const count = card.querySelector<HTMLElement>('.tutorial-count')!;
  const next = card.querySelector<HTMLButtonElement>('.tutorial-next')!;
  const skipStep = card.querySelector<HTMLButtonElement>('.tutorial-skip-step')!;
  let highlighted: Element | null = null;
  let celebrating = false;

  const highlight = (selector?: string) => {
    highlighted?.classList.remove('tutorial-target');
    highlighted = selector ? document.querySelector(selector) : null;
    highlighted?.classList.add('tutorial-target');
  };

  const finish = (message: string) => {
    sim.state.tutorialStep = null;
    highlight();
    card.classList.add('hidden');
    window.clearInterval(timer);
    toast(message);
  };

  const show = () => {
    const i = sim.state.tutorialStep;
    if (i === null) return;
    const step = STEPS[i];
    text.textContent = step.text;
    count.textContent = `${i + 1} / ${STEPS.length}`;
    next.hidden = !step.button;
    next.textContent = step.button ?? '';
    // Action steps can be skipped one at a time (steps with a button just use it).
    skipStep.hidden = !step.done;
    card.classList.remove('hidden', 'celebrate');
    highlight(step.target);
  };

  const advance = () => {
    const i = sim.state.tutorialStep;
    if (i === null) return;
    if (i + 1 >= STEPS.length) return finish('Tutorial complete. Have fun!');
    sim.state.tutorialStep = i + 1;
    show();
  };

  next.addEventListener('click', advance);
  skipStep.addEventListener('click', () => {
    if (!celebrating) advance();
  });
  card.querySelector('.tutorial-skip-all')!.addEventListener('click', () => finish('Tutorial skipped. Tips are in each tool’s hint.'));

  const timer = window.setInterval(() => {
    const i = sim.state.tutorialStep;
    if (i === null || celebrating) return;
    if (STEPS[i].done?.(sim)) {
      celebrating = true;
      text.textContent = '✅ Nice work!';
      card.classList.add('celebrate');
      highlight();
      window.setTimeout(() => {
        celebrating = false;
        advance();
      }, CELEBRATE_MS);
    }
  }, CHECK_MS);

  show();
}

export const TUTORIAL_STEPS = STEPS.length;
