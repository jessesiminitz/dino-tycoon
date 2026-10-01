// Close-ups of each new kind of land, on islands known to have them. Usage: node terrain-closeups.mjs
import puppeteer from 'puppeteer-core';
import { HERE, finish, ready } from './lib.mjs';
const OUT = HERE + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Find an island with a waterfall first.
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
const fallSeed = await page.evaluate(async () => {
  const { newGame } = await import('/src/sim/GameState.ts');
  for (let seed = 1; seed < 400; seed++) if (newGame(seed, { shape: 'river' }).map.tiles.includes(14)) return seed;
  return 1;
});
for (const [shape, seed, terrain, name] of [['river', fallSeed, 14, 'waterfall'], ['fire', 1000, 12, 'springs'], ['fire', 1000, 11, 'lava'], ['crescent', 1000, 13, 'cliffs']]) {
  await page.goto(`http://localhost:5173/?quickstart&shape=${shape}&seed=${seed}`, { waitUntil: 'load' }); await ready(page);
  await sleep(1300);
  const p = await page.evaluate((t) => {
    const { sim, game } = window.__dino; sim.setSpeed(0);
    const s = sim.state; const W = s.map.width;
    const i = s.map.tiles.findIndex((x) => x === t);
    if (i < 0) return null;
    const cam = game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn((i % W) * 16 + 8, Math.floor(i / W) * 16);
    return { x: i % W, y: Math.floor(i / W) };
  }, terrain);
  console.log(name, JSON.stringify(p));
  await sleep(900);
  await page.screenshot({ path: `${OUT}closeup-${name}.png` });
}
finish(errors);
await browser.close();
