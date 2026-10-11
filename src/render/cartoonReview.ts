import { CARTOON_GEOMETRY, paintCartoonAsset, paintCartoonTerrain } from './cartoonArt';
import { SPECIES, SPECIES_IDS } from '../sim/data/species';
import { TERRAIN_COUNT, TERRAIN_NAMES, type Terrain } from '../sim/terrain';
import { BLENDER_MOTION } from './generated/blenderMotion';

const clip = document.querySelector<HTMLSelectElement>('#clip')!;
const baby = document.querySelector<HTMLInputElement>('#baby')!;
const left = document.querySelector<HTMLInputElement>('#left')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let clock = 0, previous = 0, drawn = '';
const frames = new Map<string, HTMLCanvasElement>();
const stages = new Map<string, HTMLDivElement>();
function card(parent: string, id: string, label: string): HTMLDivElement {
  const article = document.createElement('article'); article.dataset.asset = id;
  const stage = document.createElement('div'); stage.className = 'stage';
  const title = document.createElement('h3'); title.textContent = label;
  article.append(stage, title); document.getElementById(parent)!.append(article); return stage;
}
for (const id of SPECIES_IDS) stages.set(id, card('dinosaurs', id, SPECIES[id].name));
for (const id of Object.keys(CARTOON_GEOMETRY).filter(id => !SPECIES_IDS.includes(id as typeof SPECIES_IDS[number]))) {
  const canvas = paintCartoonAsset(id); canvas.style.width = `${canvas.width / 4 * 4}px`;
  card('environment', id, id).append(canvas);
}
for (let t = 0; t < TERRAIN_COUNT; t++) {
  const canvas = paintCartoonTerrain(t as Terrain, 0); canvas.style.width = '128px'; canvas.style.height = '128px';
  card('terrain', `terrain-${t}`, TERRAIN_NAMES[t as Terrain]).append(canvas);
}
pause.textContent = paused ? 'Play' : 'Pause';
pause.onclick = () => { paused = !paused; pause.textContent = paused ? 'Play' : 'Pause'; };
document.querySelector<HTMLInputElement>('#checker')!.onchange = e => document.body.classList.toggle('checker', (e.target as HTMLInputElement).checked);
function draw(time: number): void {
  if (!paused && previous) clock += Math.min(100, time - previous);
  previous = time;
  const stamp = `${Math.floor(clock / 100)}:${clip.value}:${baby.checked}:${left.checked}`;
  if (stamp !== drawn) for (const id of SPECIES_IDS) {
    const behavior = clip.value as 'walk' | 'idle' | 'eat' | 'rest';
    const index = Math.floor(clock / BLENDER_MOTION[id][behavior].durationMs * 8) % 8;
    const key = `${id}:${behavior}:${index}:${baby.checked}`;
    let canvas = frames.get(key);
    if (!canvas) {
      canvas = paintCartoonAsset(id, index, SPECIES[id], baby.checked, 1, behavior);
      canvas.style.width = `${canvas.width}px`;
      // Bound the gallery cache while browsing different behaviors.
      if (frames.size > 450) frames.clear();
      frames.set(key, canvas);
    }
    canvas.style.transform = left.checked ? 'scaleX(-1)' : '';
    const stage = stages.get(id)!; if (stage.firstChild !== canvas) stage.replaceChildren(canvas);
  }
  drawn = stamp; requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
