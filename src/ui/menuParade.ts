import { SPECIES, SPECIES_IDS, habitatOf, type SpeciesId } from '../sim/data/species';
import { paintMenuDino } from '../render/menuDino';
import { motionFrame, type MotionClip } from '../render/immersionMotion';
import { playCall, playSfx } from '../audio/audio';
import { getSettings } from './settings';

type Animal = { button: HTMLButtonElement; img: HTMLImageElement; id: SpeciesId; index: number; taps: number; reactionUntil: number; clip: MotionClip; frame: number };

export function mountMenuParade(root: HTMLElement): void {
  const parade = root.querySelector<HTMLElement>('.menu-parade')!;
  const track = document.createElement('div'); track.className = 'menu-parade-track';
  const group = document.createElement('div'); group.className = 'menu-parade-group';
  const status = document.createElement('p'); status.className = 'menu-parade-hint';
  status.setAttribute('aria-live', 'polite'); status.textContent = 'Tap a dinosaur to say hello!';
  const animals: Animal[] = [];
  const frames = new Map<string, string>();
  function image(id: SpeciesId, clip: MotionClip, frame: number): string {
    const key = `${id}:${clip}:${frame}`;
    let url = frames.get(key);
    if (!url) { url = paintMenuDino(id, clip, frame).toDataURL(); frames.set(key, url); }
    return url;
  }
  const featured: SpeciesId[] = ['tyrannosaurus','compsognathus','triceratops','stegosaurus'];
  for (const id of [...featured, ...SPECIES_IDS.filter(id => !featured.includes(id))]) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'menu-dino'; button.dataset.species = id;
    button.setAttribute('aria-label', `Say hello to ${SPECIES[id].name}`);
    const img = document.createElement('img'); img.alt = ''; img.draggable = false;
    img.src = image(id, 'walk', 0); img.dataset.poster = img.src;
    const label = document.createElement('span'); label.className = 'menu-dino-name'; label.textContent = SPECIES[id].name;
    button.append(img, label); group.append(button);
  }
  const duplicate = group.cloneNode(true) as HTMLElement;
  duplicate.setAttribute('aria-hidden','true');
  duplicate.querySelectorAll('button').forEach(b => b.tabIndex = -1);
  track.append(group, duplicate); parade.replaceChildren(status, track);
  for (const [index, button] of [...track.querySelectorAll<HTMLButtonElement>('.menu-dino')].entries()) {
    const animal: Animal = {button,img:button.querySelector('img')!,id:button.dataset.species as SpeciesId,index,taps:0,reactionUntil:0,clip:'walk',frame:0};
    animals.push(animal);
    button.addEventListener('focus', () => {
      if (!button.matches(':focus-visible') || matchMedia('(prefers-reduced-motion: reduce)').matches || !getSettings().animation) return;
      track.style.animation = 'none';
      track.style.transform = `translateX(${16 - button.offsetLeft}px)`;
    });
    button.addEventListener('blur', e => {
      if ((e.relatedTarget as HTMLElement | null)?.closest('.menu-dino')) return;
      track.style.animation = ''; track.style.transform = '';
    });
    button.addEventListener('click', () => {
      const habitat = habitatOf(animal.id);
      const snack = animal.taps++ % 3 === 1;
      const reaction = snack ? 'munch' : habitat === 'air' ? 'flutter' : habitat === 'water' ? 'splash' : animal.taps % 3 === 0 ? 'wiggle' : 'hop';
      animal.clip = snack ? 'eat' : reaction === 'wiggle' ? 'idle' : 'walk';
      animal.reactionUntil = performance.now() + 1800; animal.frame = -1;
      button.dataset.reaction = reaction;
      status.textContent = snack ? `${SPECIES[animal.id].name} says yum!` : `${SPECIES[animal.id].name} says hello!`;
      track.classList.add('is-playing');
      if (snack) playSfx('chirp'); else { playCall(animal.id); if (habitat === 'water') playSfx('splash'); }
    });
  }
  const resize = new ResizeObserver(() => {
    const width = group.getBoundingClientRect().width;
    if (width > 0) track.style.animationDuration = `${width / 30}s`;
  }); resize.observe(group);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let lastFrame = 0, request = 0;
  function tick(now: number): void {
    if (root.classList.contains('hidden')) { resize.disconnect(); return; }
    request = requestAnimationFrame(tick);
    if (document.hidden || root.dataset.screen !== 'main' || now - lastFrame < 120) return;
    lastFrame = now;
    parade.classList.toggle('motion-off', !getSettings().animation);
    let playing = false;
    for (const a of animals) {
      const reacting = a.reactionUntil > now;
      if (reacting) playing = true;
      else if (a.button.dataset.reaction) { delete a.button.dataset.reaction; a.clip = 'walk'; }
      const r = a.button.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth) continue;
      const animate = !reduced.matches && getSettings().animation;
      const frame = animate ? motionFrame(a.id,a.clip,now + a.index * 137) : 0;
      if (frame !== a.frame) { a.img.src = image(a.id,a.clip,frame); a.frame = frame; }
    }
    if (!playing && track.classList.contains('is-playing')) status.textContent = 'Tap a dinosaur to say hello!';
    track.classList.toggle('is-playing',playing);
  }
  request = requestAnimationFrame(tick);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(request); resize.disconnect(); }, {once:true});
}
