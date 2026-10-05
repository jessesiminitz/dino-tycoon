import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish, gameUrl, ready } from './lib.mjs';

const out = new URL('../../docs/art-review/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await page.goto(gameUrl('/?quickstart&stress'), { waitUntil: 'load' });
  await ready(page);
  await page.waitForFunction(() => window.__dino.game.scene.getScene('park').entities?.dinos.size > 0);
  await page.evaluate(() => { window.__dino.sim.setSpeed(0); window.__dino.game.loop.sleep(); });

  const fitted = await page.evaluate(async () => {
    const { sim } = window.__dino;
    const { SPECIES_IDS } = await import('/src/sim/data/species.ts');
    const colors = new Set(['233,223,196', '251,245,228', '201,185,143', '179,162,122', '58,42,24']);
    const failures = [], before = JSON.stringify(sim.state.fossils);
    for (const species of SPECIES_IDS) {
      sim.emitEvent({ text: 'Fossil fixture', kind: 'good', fossil: { species, bone: 'rib', have: 1, needed: 2, unlocked: false } });
      document.getElementById('dig-btn').click();
      const canvas = document.querySelector('.dig-fossil'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!colors.has(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)) continue;
        count++;
        const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width);
        if (x < 6 || x >= canvas.width - 6 || y < 5 || y >= canvas.height - 5) failures.push(`${species}: clipped fossil`);
      }
      if (!count) failures.push(`${species}: empty fossil`);
      document.querySelector('.dig-skip').click();
    }
    return { failures, creditedUnchanged: JSON.stringify(sim.state.fossils) === before, species: SPECIES_IDS.length };
  });
  check('all 28 fossil silhouettes fit the scratch canvas, including long dinosaurs', fitted.species === 28 && fitted.failures.length === 0, fitted);
  check('skipping the mini-game preserves already-credited bone progress', fitted.creditedUnchanged);

  for (const [width, height] of [[667, 375], [844, 390], [820, 1180]]) {
    await page.setViewport({ width, height, isMobile: true, hasTouch: true });
    const brushing = await page.evaluate(() => {
      const { sim } = window.__dino;
      sim.setSpeed(3);
      sim.emitEvent({ text: 'Fossil fixture', kind: 'good', fossil: { species: 'tyrannosaurus', bone: 'jaw', have: 1, needed: 2, unlocked: false } });
      document.getElementById('dig-btn').click();
      const sand = document.querySelector('.dig-sand'), fossil = document.querySelector('.dig-fossil');
      const pixels = fossil.getContext('2d').getImageData(0, 0, fossil.width, fossil.height).data;
      const colors = new Set(['233,223,196', '251,245,228', '201,185,143', '179,162,122']);
      const bones = [], points = [];
      for (let i = 0; i < pixels.length; i += 4) {
        if (!colors.has(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)) continue;
        bones.push(i / 4);
        if (i / 4 % fossil.width % 3 === 0 && Math.floor(i / 4 / fossil.width) % 3 === 0) points.push(i / 4);
      }
      window.__scratchFixture = { bones, points, next: 0 };
      const r = document.querySelector('#dig .modal-card').getBoundingClientRect();
      return { paused: sim.speed === 0, fits: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 };
    });
    check(`scratch modal pauses and fits ${width}×${height}`, brushing.paused && brushing.fits, brushing);
    // Read real cleared pixels, using bone colors rather than the implementation's progress counter.
    const scratchTo = async target => page.evaluate(target => {
      const fixture = window.__scratchFixture, sand = document.querySelector('.dig-sand'), ctx = sand.getContext('2d');
      const box = sand.getBoundingClientRect();
      let share = 0;
      while (fixture.next < fixture.points.length && share < target && document.querySelector('.dig-done').classList.contains('hidden')) {
        const point = fixture.points[fixture.next++];
        sand.dispatchEvent(new PointerEvent('pointerup'));
        sand.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, pointerType: 'mouse',
          clientX: box.left + (point % sand.width + 0.5) / sand.width * box.width,
          clientY: box.top + (Math.floor(point / sand.width) + 0.5) / sand.height * box.height }));
        const pixels = ctx.getImageData(0, 0, sand.width, sand.height).data;
        share = fixture.bones.filter(i => pixels[i * 4 + 3] === 0).length / fixture.bones.length;
      }
      return { share, finished: !document.querySelector('.dig-done').classList.contains('hidden'), sandOpacity: sand.style.opacity };
    }, target);
    const partial = await scratchTo(0.8);
    check('uncovering about 80% leaves more brushing to do', partial.share >= 0.8 && partial.share < 0.94 && !partial.finished && partial.sandOpacity === '1', partial);
    if (width === 844) await page.screenshot({ path: fileURLToPath(new URL('fossil-more-brushing.png', out)) });
    const completed = await scratchTo(1);
    check('fossil finishes only when nearly all its bones are uncovered', completed.finished && completed.share >= 0.94 && completed.sandOpacity === '0', completed);
    const resumed = await page.evaluate(() => {
      document.querySelector('.dig-done').click();
      return { closed: document.getElementById('dig').classList.contains('hidden'), speed: window.__dino.sim.speed };
    });
    check('completing the fossil restores the selected speed', resumed.closed && resumed.speed === 3, resumed);
  }

  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  const order = await page.evaluate(async () => {
    const { sim, game } = window.__dino, state = sim.state, scene = game.scene.getScene('park'), e = scene.entities;
    const { tileDepth, fenceDepth, depthAt } = await import('/src/render/worldDepth.ts');
    const { hash2 } = await import('/src/sim/rng.ts');
    const template = state.dinos[0], person = state.visitors[0], staff = state.staff[0];
    window.__depthTemplate = { ...template };
    sim.setSpeed(0); state.hours = 4;
    state.hFences.fill(0); state.vFences.fill(0); state.hFenceHp.fill(0); state.vFenceHp.fill(0);
    state.paths.fill(0); state.tracks.fill(0);
    for (let y = 14; y <= 25; y++) for (let x = 12; x <= 35; x++) {
      state.map.tiles[y * state.map.width + x] = 3; // grass
      state.paths[y * state.map.width + x] = 1; // clear old trees in this fixture
    }
    for (let x = 14; x <= 31; x++) {
      const i = 21 * state.map.width + x; state.hFences[i] = 4; state.hFenceHp[i] = 100;
    }
    for (let y = 17; y <= 20; y++) {
      const i = y * (state.map.width + 1) + 21; state.vFences[i] = 4; state.vFenceHp[i] = 100;
    }
    const makeDino = (id, species, x) => ({ ...template, id, species, x, px: x, y: 20, py: 20, hunger: 0, sick: false, escaped: false, baby: false, path: [] });
    state.dinos = [makeDino(99001, 'stegosaurus', 18), makeDino(99002, 'tyrannosaurus', 28)];
    const ids = Array.from({ length: 100 }, (_, i) => 91000 + i).filter(id => Math.round((hash2(id, 2, 5) - 0.5) * 6) === 0);
    const makeVisitor = (id, x, y) => ({ ...person, id, x, px: x, y, py: y, riding: null, path: [], items: ['balloon'], snack: 'popcorn', sodaUntil: 1 });
    state.visitors = [makeVisitor(ids[0], 23, 20), makeVisitor(ids[1], 25, 21)];
    state.staff = [{ ...staff, id: 92000, role: 'janitor', x: 25, px: 25, y: 20, py: 20, task: null, progress: 0 }];
    state.jeeps = [{ id: 93000, x: 30, px: 30, y: 20, py: 20, steps: 0, riders: [{ id: ids[0] }] }];
    state.buildings = [{ id: 94000, kind: 'snackstall', x: 24, y: 20 }];
    state.feeders = [{ id: 95000, kind: 'plants', x: 22, y: 20, stock: 100 }];
    state.decor = [{ id: 96000, kind: 'lamp', x: 26, y: 20 }];
    state.eggs = []; state.messes = [];
    sim.worldRevision++;
    scene.update(game.loop.now, 0);
    scene.cameras.main.setZoom(2); scene.cameras.main.centerOn(23 * 16, 19.5 * 16);
    const wall = scene.layers.fenceRows[21].depth;
    const behind = e.visitors.get(ids[0]), front = e.visitors.get(ids[1]);
    const fixed = e.buildings.get(94000).texture.key === 'building-snackstall' && e.buildings.get(94000).depth === tileDepth(20) && e.feeders.get(95000).depth === tileDepth(20) && scene.scenery.decor.get(96000).depth === tileDepth(20);
    const attachments = [...e.attachments].map(([key, img]) => ({ key, depth: img.depth }));
    const follows = attachments.every(({ key, depth }) => {
      const [kind, id] = key.split(':');
      const owner = ({ visitor: e.visitors, staff: e.staff, jeep: e.jeeps })[kind].get(Number(id));
      return depth > owner.depth && depth - owner.depth < 0.00001 && (depth < wall) === (owner.depth < wall);
    });
    window.__originalEntityUpdate = e.update.bind(e);
    e.update = time => {
      window.__originalEntityUpdate(time);
      for (let row = 0; row < scene.layers.sideFenceRows.length; row++) scene.layers.sideFenceRows[row].setDepth(window.__depthBefore ? fenceDepth(row + 1, 'h') : fenceDepth(row, 'v'));
      for (const b of state.buildings) e.buildings.get(b.id).setDepth(window.__depthBefore ? depthAt((b.y + 1) * 16) : tileDepth(b.y));
      for (const f of state.feeders) e.feeders.get(f.id).setDepth(window.__depthBefore ? depthAt((f.y + 1) * 16) : tileDepth(f.y));
      for (const d of state.decor) scene.scenery.decor.get(d.id).setDepth(window.__depthBefore ? depthAt((d.y + 1) * 16) : tileDepth(d.y));
      if (window.__depthBefore) {
        for (const d of state.dinos) e.dinos.get(d.id).setDepth(depthAt(e.dinoPosition(d).y));
        for (const props of e.attachments.values()) props.setDepth(9);
      }
    };
    return { fixed, behind: behind.depth < wall, front: front.depth > wall, follows, attachments: attachments.length,
      dinos: state.dinos.every(d => e.dinos.get(d.id).depth > wall) };
  });
  check('buildings, feeders, decor and people agree about the front wall', order.fixed && order.behind && order.front, order);
  check('balloons, snacks, janitor tools and riders sort with their owners', order.follows && order.attachments === 4);
  check('nearby dinosaurs draw above the front wall', order.dinos);
  for (const before of [true, false]) {
    await page.evaluate(before => {
      window.__depthBefore = before;
      window.__dino.game.loop.wake();
    }, before);
    await new Promise(resolve => setTimeout(resolve, 350));
    await page.screenshot({ path: fileURLToPath(new URL(`fence-depth-${before ? 'before' : 'after'}.png`, out)) });
  }
  const roster = await page.evaluate(async () => {
    const { sim, game } = window.__dino, scene = game.scene.getScene('park'), e = scene.entities, state = sim.state;
    game.loop.sleep(); e.update = window.__originalEntityUpdate;
    const { SPECIES_IDS, habitatOf } = await import('/src/sim/data/species.ts');
    const { depthAt } = await import('/src/render/worldDepth.ts');
    const failures = []; let cases = 0;
    for (let type = 1; type <= 6; type++) {
      state.hFences.fill(0); state.hFenceHp.fill(0); state.vFences.fill(0); state.vFenceHp.fill(0);
      for (let x = 14; x <= 31; x++) { const i = 21 * state.map.width + x; state.hFences[i] = type; state.hFenceHp[i] = 100; }
      scene.layers.drawFences();
      const wall = scene.layers.fenceRows[21].depth;
      for (const species of SPECIES_IDS) for (const baby of [false, true]) for (const left of [false, true]) {
        const d = { ...window.__depthTemplate, id: 98000, species, baby, x: 24, px: 24, y: 20, py: 20, path: [], hunger: 0, sick: false, escaped: false };
        state.dinos = [d]; e.motions.delete(d.id); e.facingLeft.set(d.id, left); e.update(game.loop.now);
        const img = e.dinos.get(d.id);
        if (habitatOf(species) !== 'air' && img.depth <= wall) failures.push(`${species}:${baby}:${left}:${type}`);
        cases++;
      }
    }
    state.hFences.fill(0); state.hFenceHp.fill(0);
    state.hFences[21 * state.map.width + 60] = 4; state.hFenceHp[21 * state.map.width + 60] = 100;
    e.update(game.loop.now);
    const distant = e.dinos.get(98000).depth === depthAt(e.dinoPosition(state.dinos[0]).y);
    const graphics = [...e.attachments.values()];
    state.visitors = []; state.staff = []; state.jeeps = []; e.update(game.loop.now);
    return { cases, failures, distant, cleaned: e.attachments.size === 0 && graphics.every(g => !g.scene) };
  });
  check('all 28 species, babies and directions respect all six front fence types', roster.cases === 672 && roster.failures.length === 0, roster);
  check('distant fences keep normal ordering and removed owners clean up their props', roster.distant && roster.cleaned);
  finish(errors);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  let timer;
  await Promise.race([browser.close(), new Promise(resolve => {
    timer = setTimeout(() => { browser.disconnect(); browser.process()?.kill('SIGKILL'); resolve(); }, 10_000);
  })]);
  clearTimeout(timer);
}
process.exit(process.exitCode ?? 0);
