// Fire Mountain: the card, story card, danger zone, moving a dino, the eruption and the cooled lava.
import puppeteer from 'puppeteer-core';
import { HERE, finish } from './lib.mjs';
const OUT = HERE + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const shot = (name) => page.screenshot({ path: `${OUT}${w}-fire-${name}.png` });
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(500); };
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.setItem('dino-tycoon-challenges', JSON.stringify({ 'great-escape': 1 })));
await page.reload({ waitUntil: 'load' }); await sleep(800);
await click('[data-go="new"]'); await click('[data-folder="challenges"]');
await shot('0-menu');
await click('[data-scenario="fire-mountain"]');
await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1500);
await shot('1-briefing');
await click('#briefing [data-go]');
const look = (dy, zoom = 1.5) => page.evaluate(({ dy, zoom }) => {
  const { sim, game } = window.__dino; sim.setSpeed(0);
  const cam = game.scene.getScene('park').cameras.main; const { x, y } = sim.state.entrance;
  cam.setZoom(zoom); cam.centerOn(x * 16, (y + dy) * 16);
}, { dy, zoom });
await look(-12); await sleep(600);
await shot('2-danger');
// Move a dinosaur from the danger zone: select it, tap 📦, tap the safe paddock.
const moved = await page.evaluate(async () => {
  const { sim, ui } = window.__dino;
  const { lavaPreview } = await import('/src/sim/systems/eruption.ts');
  const danger = lavaPreview(sim.state); const W = sim.state.map.width;
  const d = sim.state.dinos.find((o) => danger.has(o.y * W + o.x));
  ui.startMoving(d.id);
  return { name: d.name };
});
await sleep(300);
await shot('3-move-mode');
const res = await page.evaluate(() => { const { sim } = window.__dino; const { x, y } = sim.state.entrance; return sim.dispatch({ type: 'moveDino', id: window.__dino.ui.moving, x: x + 5, y: y - 3 }).message; });
console.log('move', moved.name, '->', res);
// Fast-forward into the eruption.
await page.evaluate(() => { const { sim } = window.__dino; while (sim.state.hours < sim.state.eruption.eruptHour + 8) sim.step(); });
await look(-12); await sleep(900);
console.log(await page.evaluate(() => document.querySelector('#goal-tracker').textContent.replace(/\s+/g, ' ').trim()));
await shot('4-erupting');
await page.evaluate(() => { const { sim } = window.__dino; while (sim.state.eruption.stage !== 'over') sim.step(); });
await look(-12); await sleep(900);
await shot('5-cooled');
finish(errors);
await browser.close();
