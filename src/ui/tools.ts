import type { Simulation } from '../sim/Simulation';
import { FENCE_TYPE_IDS, FENCE_TYPES, NET, type FenceTypeId } from '../sim/data/fences';
import { FEEDER_TYPES, type FeederKind } from '../sim/data/feeders';
import { DIET_LABELS } from '../sim/data/species';
import { POND_COST } from '../sim/commands';
import { BUILDING_TYPES, PATH_COST, TRACK_COST, type BuildingKind } from '../sim/data/economy';
import { DECOR_KINDS, DECOR_TYPES, type DecorKind } from '../sim/data/decor';
import { paintBuilding, paintDecor, paintTrough } from '../render/sceneryArt';
import { paintFenceSample, paintPathSample, paintPondSample, withCross } from '../render/shopArt';
import { mountShop, type Shop, type ShopItem } from './shop';
import type { Mode, UiState } from './uiState';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const $ = (n: number) => money.format(n);
const stars = (n: number, of: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

const BUILDING_TAGS: Record<BuildingKind, string> = {
  restaurant: '🍟 Food',
  snackstall: '🍿 Food',
  giftshop: '🛍️ Shop',
  restroom: '🚻 Comfort',
  trashcan: '🧹 Tidy',
  station: '🚙 Ride',
  tower: '🔭 Fun',
  petting: '💗 Fun',
  digsite: '🦴 Fossils',
};

function buildingItems(): ShopItem[] {
  return (Object.keys(BUILDING_TYPES) as BuildingKind[]).map((kind) => {
    const t = BUILDING_TYPES[kind];
    const facts: [string, string][] = [
      ['Price', $(t.cost)],
      ['Upkeep', `${$(t.upkeep)} a day`],
    ];
    if (t.salePrice) facts.push(['Visitors pay', $(t.salePrice)]);
    facts.push(['Goes', t.needsPath ? 'next to a path' : 'on a fossil bed']);
    return { id: kind, art: paintBuilding(kind), name: t.name, tag: BUILDING_TAGS[kind], facts, blurb: t.description, button: `Build · ${$(t.cost)}`, cost: t.cost };
  });
}

const FEEDER_BLURBS: Record<FeederKind, string> = {
  plants: 'Fresh leaves and ferns for plant-eating dinosaurs. It comes full, and workers keep it topped up.',
  meat: 'Meat for the hunters. A well-fed meat-eater is far less likely to test its fence!',
  fish: 'Fish for sea reptiles and flying reptiles. Put it in their lagoon or aviary.',
};

function feederItems(): ShopItem[] {
  return (Object.keys(FEEDER_TYPES) as FeederKind[]).map((kind) => {
    const t = FEEDER_TYPES[kind];
    return {
      id: kind,
      art: paintTrough(kind, true),
      name: t.name,
      tag: DIET_LABELS[t.diet],
      facts: [
        ['Price', $(t.cost)],
        ['Refill', `${$(t.unitCost * t.capacity)} when empty`],
        ['Goes', 'inside a paddock'],
      ],
      blurb: FEEDER_BLURBS[kind],
      button: `Build · ${$(t.cost)}`,
      cost: t.cost,
    };
  });
}

const FENCE_BLURBS: Record<FenceTypeId, string> = {
  1: 'Cheap and cheerful. Fine for small, gentle plant-eaters.',
  2: 'Sturdy metal bars for bigger dinosaurs.',
  3: 'A zappy fence that keeps most hunters inside.',
  4: 'Thick walls for the biggest, fiercest dinosaurs. Hardly wears out.',
  5: 'Fence a whole paddock with netting to make an aviary for flying reptiles.',
};

const wear = (perDay: number) => (perDay <= 1 ? 'very slowly' : perDay <= 2.5 ? 'slowly' : perDay <= 3 ? 'steadily' : 'quickly');

function fenceItems(): ShopItem[] {
  const strongest = Math.max(...FENCE_TYPE_IDS.map((id) => FENCE_TYPES[id].strength));
  return FENCE_TYPE_IDS.map((id) => {
    const t = FENCE_TYPES[id];
    return {
      id: String(id),
      art: paintFenceSample(id),
      name: t.name,
      tag: id === NET ? '🪽 Aviary' : undefined,
      facts: [
        ['Price', `${$(t.cost)} a section`],
        ['Strength', stars(t.strength, strongest)],
        ['Wears out', wear(t.decayPerDay)],
      ],
      blurb: FENCE_BLURBS[id],
      button: `Choose · ${$(t.cost)}`,
      cost: t.cost,
    };
  });
}

function pathItems(): ShopItem[] {
  const path = paintPathSample(false);
  const track = paintPathSample(true);
  return [
    {
      id: 'path',
      art: path,
      name: 'Path',
      tag: '🚶 Visitors',
      facts: [['Price', `${$(PATH_COST)} a tile`]],
      blurb: 'Visitors walk on paths. Join them to the gate and lead them past your paddocks.',
      button: `Choose · ${$(PATH_COST)}`,
      cost: PATH_COST,
    },
    {
      id: 'track',
      art: track,
      name: 'Jeep track',
      tag: '🚙 Safari',
      facts: [['Price', `${$(TRACK_COST)} a tile`]],
      blurb: 'Safari jeeps drive on track. Start it beside a Safari station and make a loop past your dinosaurs.',
      button: `Choose · ${$(TRACK_COST)}`,
      cost: TRACK_COST,
    },
    {
      id: 'path-erase',
      art: withCross(path),
      name: 'Remove path',
      facts: [['Refund', 'a quarter back']],
      blurb: 'Drag over paths to take them up.',
      button: 'Choose',
      cost: 0,
    },
    {
      id: 'track-erase',
      art: withCross(track),
      name: 'Remove track',
      facts: [['Refund', 'a quarter back']],
      blurb: 'Drag over jeep track to take it up.',
      button: 'Choose',
      cost: 0,
    },
  ];
}

function gardenItems(): ShopItem[] {
  const items: ShopItem[] = DECOR_KINDS.map((kind) => {
    const t = DECOR_TYPES[kind];
    const facts: [string, string][] = [['Price', $(t.cost)]];
    if (t.upkeep) facts.push(['Upkeep', `${$(t.upkeep)} a day`]);
    facts.push(['Cheers up', stars(t.charm, 3)]);
    return { id: kind, art: paintDecor(kind), name: t.name, facts, blurb: `${t.description} Visitors nearby are happier.`, button: `Build · ${$(t.cost)}`, cost: t.cost };
  });
  items.push({
    id: 'pond',
    art: paintPondSample(),
    name: 'Pond',
    tag: '🌊 Lagoon',
    facts: [['Price', `${$(POND_COST)} a tile`]],
    blurb: 'Dig water into grass or sand. A pond inside a paddock makes a lagoon for sea reptiles.',
    button: `Choose · ${$(POND_COST)}`,
    cost: POND_COST,
  });
  return items;
}

/** Tools that pick from a build screen before you place anything. */
type ShopMode = Extract<Mode, 'building' | 'feeder' | 'fence' | 'path' | 'decor'>;
const SHOP_MODES: ShopMode[] = ['building', 'feeder', 'fence', 'path', 'decor'];
const isShopMode = (m: string): m is ShopMode => (SHOP_MODES as string[]).includes(m);

/**
 * The bottom toolbar. Build tools open a picture sheet of everything they can
 * make; choosing one starts placing it, and a chip above the toolbar shows
 * what's chosen (tap it to change).
 */
export function mountTools(sim: Simulation, ui: UiState): void {
  const current: Record<ShopMode, () => string> = {
    building: () => ui.buildingKind,
    feeder: () => ui.feederKind,
    fence: () => String(ui.fenceType),
    path: () => `${ui.pathTrack ? 'track' : 'path'}${ui.pathErase ? '-erase' : ''}`,
    decor: () => ui.decorKind,
  };
  const pick: Record<ShopMode, (id: string) => void> = {
    building: (id) => ui.setBuildingKind(id as BuildingKind),
    feeder: (id) => ui.setFeederKind(id as FeederKind),
    fence: (id) => ui.setFenceType(Number(id) as FenceTypeId),
    path: (id) => ui.setPathErase(id.endsWith('-erase'), id.startsWith('track')),
    decor: (id) => ui.setDecorKind(id as DecorKind | 'pond'),
  };
  const shop = (mode: ShopMode, title: string, items: ShopItem[]) =>
    mountShop(sim, title, items, () => (ui.mode === mode ? current[mode]() : null), (id) => {
      pick[mode](id);
      ui.setMode(mode);
    });
  const shops: Record<ShopMode, Shop> = {
    building: shop('building', '🏪 Buildings', buildingItems()),
    feeder: shop('feeder', '🍖 Feeders', feederItems()),
    fence: shop('fence', '🚧 Fences', fenceItems()),
    path: shop('path', '🛤️ Paths & tracks', pathItems()),
    decor: shop('decor', '🌳 Garden', gardenItems()),
  };

  const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool-btn[data-mode]'));
  for (const b of toolButtons) {
    b.addEventListener('click', () => {
      const mode = b.dataset.mode as Mode;
      // Tapping the active tool again goes back to Look.
      if (ui.mode === mode) ui.setMode('select');
      else if (isShopMode(mode)) shops[mode].open();
      else ui.setMode(mode);
    });
  }

  const chip = document.getElementById('pick-chip')!;
  const chipImg = chip.querySelector('img')!;
  const chipName = chip.querySelector('b')!;
  const chipPrice = chip.querySelector('small')!;
  chip.querySelector('button')!.addEventListener('click', () => isShopMode(ui.mode) && shops[ui.mode].open());

  const render = () => {
    for (const b of toolButtons) b.classList.toggle('active', b.dataset.mode === ui.mode);
    if (!isShopMode(ui.mode)) {
      chip.classList.add('hidden');
      return;
    }
    const id = current[ui.mode]();
    const it = shops[ui.mode].item(id);
    if (!it) return;
    chipImg.src = shops[ui.mode].artUrl(id);
    chipName.textContent = it.name;
    chipPrice.textContent = it.facts[0][1];
    chip.classList.remove('hidden');
  };
  ui.onChange(render);
  render();
}
