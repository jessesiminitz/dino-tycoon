// A lagoon and an aviary in the park, and digging a pond with the Garden tool.
import puppeteer from 'puppeteer-core';
import { HERE, check, finish, ready, shopPick, toScreen } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
await sleep(1200);
const setup = await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(0);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  s.unlockedSpecies.push('plesiosaurus', 'mosasaurus', 'pteranodon', 'dimorphodon');
  const { x: ex, y: ey } = s.entrance; const w = s.map.width;
  const box = (x0, y0, x1, y1, fence) => {
    const edges = [];
    for (let x = x0; x < x1; x++) edges.push({ dir: 'h', x, y: y0 }, { dir: 'h', x, y: y1 });
    for (let y = y0; y < y1; y++) edges.push({ dir: 'v', x: x0, y }, { dir: 'v', x: x1, y });
    return sim.dispatch({ type: 'buildFences', edges, fence }).message;
  };
  // Level both building sites to plain grass first (the island has rocks and water about).
  for (let y = ey - 13; y < ey - 3; y++) for (let x = ex - 11; x < ex + 10; x++) s.map.tiles[y * w + x] = 3;
  sim.dispatch({ type: 'photoDino', id: -1 }); // bump the world so the map redraws
  const out = [];
  const L = { x: ex - 10, y: ey - 12 };
  out.push(box(L.x, L.y, L.x + 9, L.y + 7, 3));
  const pond = []; for (let y = L.y + 1; y < L.y + 6; y++) for (let x = L.x + 1; x < L.x + 8; x++) pond.push(y * w + x);
  out.push(sim.dispatch({ type: 'digPonds', tiles: pond }).message);
  out.push(sim.dispatch({ type: 'placeFeeder', kind: 'fish', x: L.x + 1, y: L.y + 1 }).message);
  out.push(sim.dispatch({ type: 'buyDino', species: 'plesiosaurus', x: L.x + 3, y: L.y + 3 }).message);
  out.push(sim.dispatch({ type: 'buyDino', species: 'mosasaurus', x: L.x + 6, y: L.y + 4 }).message);
  const A = { x: ex + 1, y: ey - 12 };
  out.push(box(A.x, A.y, A.x + 8, A.y + 7, 5));
  out.push(sim.dispatch({ type: 'placeFeeder', kind: 'fish', x: A.x + 1, y: A.y + 5 }).message);
  out.push(sim.dispatch({ type: 'buyDino', species: 'pteranodon', x: A.x + 3, y: A.y + 3 }).message);
  out.push(sim.dispatch({ type: 'buyDino', species: 'dimorphodon', x: A.x + 5, y: A.y + 2 }).message);
  sim.worldRevision++;
  sim.setSpeed(1);
  const cam = game.scene.getScene('park').cameras.main; cam.setZoom(2); cam.centerOn((ex - 1) * 16, (ey - 8) * 16);
  return { out, dinos: s.dinos.map((d) => d.species), ex, ey };
});
console.log(JSON.stringify(setup, null, 1));
await sleep(2500);
await page.screenshot({ path: `${OUT}habitats-1-park-${W}.png` });
check('lagoon and aviary animals bought', ['plesiosaurus', 'mosasaurus', 'pteranodon', 'dimorphodon'].every((sp) => setup.dinos.includes(sp)), setup.dinos);
// Dig a pond by dragging with Garden → Pond, along the strip of grass levelled below the paddocks.
await shopPick(page, 'decor', 'pond');
console.log('hint:', await page.$eval('#info-text', (e) => e.textContent));
const before = await page.evaluate(() => window.__dino.sim.state.map.tiles.filter((t) => t === 8).length);
// Scroll the strip to the middle of the screen, clear of the hint panel.
await page.evaluate(({ ex, ey }) => window.__dino.game.scene.getScene('park').cameras.main.centerOn((ex - 7) * 16, (ey - 3.5) * 16), setup);
await sleep(200);
const p = await toScreen(page, setup.ex - 9.5, setup.ey - 3.5);
const q = await toScreen(page, setup.ex - 4.5, setup.ey - 3.5);
await page.touchscreen.touchStart(p.x, p.y);
for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(p.x + ((q.x - p.x) * i) / 8, p.y);
await page.touchscreen.touchEnd(); await sleep(400);
const after = await page.evaluate(() => window.__dino.sim.state.map.tiles.filter((t) => t === 8).length);
check('dragging digs pond tiles', after > before, `${after - before} dug | ${await page.$$eval('.toast', (t) => t.at(-1)?.textContent)}`);
await page.screenshot({ path: `${OUT}habitats-2-dig-${W}.png` });
finish(errors);
await browser.close();
