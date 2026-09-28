import type { Simulation } from '../sim/Simulation';

/** One thing you can build: a card with its picture, a few facts and a button. */
export interface ShopItem {
  id: string;
  art: HTMLCanvasElement;
  name: string;
  /** A small coloured label beside the name, e.g. "🍟 Food". */
  tag?: string;
  facts: [string, string][];
  blurb: string;
  /** Button text, e.g. "Build · $3,000". */
  button: string;
  /** The least money you need to pick it (the whole price, or one tile's worth). */
  cost: number;
}

export interface Shop {
  open(): void;
  /** The chosen item's picture as an image URL, for the toolbar chip. */
  artUrl(id: string): string;
  item(id: string): ShopItem | undefined;
}

/**
 * A "Buy Dinosaurs"-style sheet for one tool (buildings, feeders, fences…).
 * Picking a card closes the sheet and hands the choice back.
 */
export function mountShop(sim: Simulation, title: string, items: ShopItem[], current: () => string | null, onPick: (id: string) => void): Shop {
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', title);
  modal.innerHTML = `
    <div class="modal-card sheet">
      <header class="modal-head"><h2></h2><button class="modal-close" aria-label="Close">✕</button></header>
      <div class="species-grid shop-grid"></div>
    </div>`;
  modal.querySelector('h2')!.textContent = title;
  const grid = modal.querySelector<HTMLElement>('.shop-grid')!;
  const urls = new Map<string, string>();
  const buttons = new Map<string, HTMLButtonElement>();

  for (const it of items) {
    const card = document.createElement('article');
    card.className = 'species-card shop-card';
    card.dataset.id = it.id;
    const art = document.createElement('img');
    art.className = 'species-art';
    art.alt = '';
    const url = it.art.toDataURL();
    urls.set(it.id, url);
    art.src = url;
    const head = document.createElement('header');
    const h3 = document.createElement('h3');
    h3.textContent = it.name;
    head.appendChild(h3);
    if (it.tag) {
      const tag = document.createElement('span');
      tag.className = 'shop-tag';
      tag.textContent = it.tag;
      head.appendChild(tag);
    }
    const dl = document.createElement('dl');
    for (const [k, v] of it.facts) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    const fact = document.createElement('p');
    fact.className = 'fact';
    fact.textContent = it.blurb;
    const buy = document.createElement('button');
    buy.className = 'action-btn';
    buy.textContent = it.button;
    buy.addEventListener('click', () => {
      close();
      onPick(it.id);
    });
    buttons.set(it.id, buy);
    card.append(art, head, dl, fact, buy);
    grid.appendChild(card);
  }
  document.body.appendChild(modal);

  const close = () => modal.classList.add('hidden');
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return {
    open() {
      const chosen = current();
      for (const it of items) {
        const b = buttons.get(it.id)!;
        const short = it.cost > sim.state.money;
        b.disabled = short;
        b.textContent = short ? `Need ${it.button.split('·').pop()!.trim()}` : it.button;
        b.closest('.shop-card')!.classList.toggle('current', it.id === chosen);
      }
      modal.classList.remove('hidden');
      grid.scrollTop = 0;
    },
    artUrl: (id) => urls.get(id) ?? '',
    item: (id) => items.find((it) => it.id === id),
  };
}
