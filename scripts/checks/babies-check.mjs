// A paddock with grown-ups, a baby and an egg about to hatch; the People panel's Babies & eggs filter.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1200);
const setup = await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e6; sim.setSpeed(0);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance;
  const A = { x: ex - 5, y: ey - 11 }, C = { x: ex + 5, y: ey - 3 };
  const edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 2 });
  sim.dispatch({ type: 'placeFeeder', kind: 'plants', x: A.x + 1, y: A.y + 1 });
  for (const [dx, dy] of [[2, 3], [6, 3]]) sim.dispatch({ type: 'buyDino', species: 'stegosaurus', x: A.x + dx, y: A.y + dy });
  const mum = s.dinos[0];
  s.dinos.push({ ...mum, id: 99001, name: 'Pip', x: A.x + 4, y: A.y + 6, px: A.x + 4, py: A.y + 6, baby: true, bornHour: s.hours - 24 * 3 });
  s.eggs.push({ id: 99002, species: 'stegosaurus', x: A.x + 7, y: A.y + 6, laidHour: s.hours - 47 });
  const cam = game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn((A.x + 5) * 16, (A.y + 5) * 16);
  return { A };
});
await sleep(900);
await page.screenshot({ path: `${OUT}babies-1-park.png` });
// Tap the egg.
const p = await page.evaluate(({ A }) => { const c = window.__dino.game.scene.getScene('park').cameras.main; const cx = c.width / 2, cy = c.height / 2; return { x: ((A.x + 7.5) * 16 - c.scrollX - cx) * c.zoom + cx, y: ((A.y + 6.6) * 16 - c.scrollY - cy) * c.zoom + cy }; }, setup);
await page.touchscreen.tap(p.x, p.y); await sleep(300);
console.log('egg info:', await page.$eval('#info-text', (e) => e.textContent));
// People → Dinos → Babies & eggs.
await (await page.$('#btn-people')).tap(); await sleep(300);
await (await page.$('[data-tab="dinos"]')).tap(); await sleep(300);
await (await page.$('[data-filter="babies"]')).tap(); await sleep(300);
console.log('cards:', await page.$$eval('#people .person-card', (c) => c.map((x) => x.querySelector('.pname')?.textContent + ' / ' + x.querySelector('.sub')?.textContent)));
await page.screenshot({ path: `${OUT}babies-2-panel.png` });
await (await page.$('#people .modal-close')).tap(); await sleep(200);
// Let the egg hatch.
const hatched = await page.evaluate(() => { const { sim } = window.__dino; for (let i = 0; i < 16 * 2; i++) sim.step(); return { babies: sim.state.dinos.filter((d) => d.baby).map((d) => d.name), eggs: sim.state.eggs.length, log: sim.state.log.slice(-3).map((l) => l.text) }; });
console.log('after hatching:', hatched);
await sleep(600);
await page.screenshot({ path: `${OUT}babies-3-hatched.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
