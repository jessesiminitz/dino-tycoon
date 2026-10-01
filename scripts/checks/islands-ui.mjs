// New park → scenario previews → Sandbox island picker → start a River Valley and look at waterfalls, bridges, marsh and springs up close.
import puppeteer from 'puppeteer-core';
import { HERE, finish } from './lib.mjs';
const OUT = HERE + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready); await sleep(800);
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(400); };
await click('[data-go="new"]');
await page.screenshot({ path: `${OUT}${w}-islands-0-new.png` });
await click('[data-go="island"]');
await page.screenshot({ path: `${OUT}${w}-islands-1-picker.png` });
await click('[data-shape="river"]');
await click('[data-start-sandbox]');
await sleep(1500);
const spots = await page.evaluate(() => {
  const { sim, game } = window.__dino;
  sim.setSpeed(0);
  const s = sim.state; const W = s.map.width;
  s.parcelsOwned = s.parcelsOwned.map(() => true); s.money = 1e6;
  const find = (t) => { const i = s.map.tiles.findIndex((x) => x === t); return i < 0 ? null : { x: i % W, y: Math.floor(i / W) }; };
  // A bridge: the first river tile with land either side (east–west).
  let bridge = null;
  for (let i = 0; i < s.map.tiles.length && !bridge; i++) {
    if (s.map.tiles[i] !== 9) continue;
    const l = s.map.tiles[i - 1], r = s.map.tiles[i + 1];
    if ([2, 3, 4, 5, 10].includes(l) && [2, 3, 4, 5, 10].includes(r)) bridge = i;
  }
  let res = null;
  if (bridge !== null) res = sim.dispatch({ type: 'buildPaths', tiles: [bridge - 2, bridge - 1, bridge, bridge + 1, bridge + 2] });
  return { fall: find(14), marsh: find(10), spring: find(12), bridge: bridge === null ? null : { x: bridge % W, y: Math.floor(bridge / W) }, res: res && res.message };
});
console.log(JSON.stringify(spots));
const look = async (p, name) => {
  if (!p) return;
  await page.evaluate((p) => { const cam = window.__dino.game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn(p.x * 16 + 8, p.y * 16); }, p);
  await sleep(700);
  await page.screenshot({ path: `${OUT}${w}-islands-2-${name}.png` });
};
await look(spots.fall, 'waterfall'); await look(spots.bridge, 'bridge'); await look(spots.marsh, 'marsh'); await look(spots.spring, 'spring');
finish(errors);
await browser.close();
