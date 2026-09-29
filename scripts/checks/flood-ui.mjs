// Flood Season: the card, story card, forecast stripes, a flood in progress, and sandbags + pump holding it back.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const shot = (name) => page.screenshot({ path: `${OUT}${w}-flood-${name}.png` });
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(500); };
const start = async () => {
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('dino-tycoon-challenges', JSON.stringify({ 'great-escape': 1, 'fire-mountain': 1 })));
  await page.reload({ waitUntil: 'load' }); await sleep(800);
  await click('[data-go="new"]'); await click('[data-folder="challenges"]');
};
await start();
await shot('0-menu');
await click('[data-scenario="flood-season"]');
await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1500);
await shot('1-briefing');
await click('#briefing [data-go]');
const look = () => page.evaluate(() => {
  const { sim, game } = window.__dino; sim.setSpeed(0);
  const cam = game.scene.getScene('park').cameras.main; const { x, y } = sim.state.entrance;
  cam.setZoom(1.3); cam.centerOn(x * 16, (y - 10) * 16);
});
const until = (hour) => page.evaluate((hour) => { const { sim } = window.__dino; while (sim.state.hours < hour) sim.step(); }, hour);
await until(22); await look(); await sleep(700);
await shot('2-forecast');
await until(36); await look(); await sleep(700);
console.log(await page.evaluate(() => document.querySelector('#goal-tracker').textContent.replace(/\s+/g, ' ').trim()));
await shot('3-flood');
// A second park: sandbags along both banks and a pump by the bridge, then the same flood.
await start();
await click('[data-scenario="flood-season"]');
await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1500);
await click('#briefing [data-go]');
console.log(await page.evaluate(() => {
  const { sim } = window.__dino; const { x, y } = sim.state.entrance;
  const edges = [];
  for (let dx = -13; dx <= 13; dx++) if (dx !== 0) edges.push({ dir: 'h', x: x + dx, y: y - 12 }, { dir: 'h', x: x + dx, y: y - 10 });
  return [sim.dispatch({ type: 'buildFences', edges, fence: 6 }).message, sim.dispatch({ type: 'placeBuilding', kind: 'pump', x: x + 1, y: y - 14 }).message].join(' | ');
}));
await until(36); await look(); await sleep(700);
await shot('4-protected');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
