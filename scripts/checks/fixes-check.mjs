// Top buttons (plain, lit only while their panel is open) and a fence box drawn with one drag.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart&seed=20231', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready); await sleep(1300);
await page.evaluate(() => window.__dino.sim.setSpeed(0));
const lit = () => page.evaluate(() => [...document.querySelectorAll('.hud-btn')].filter((b) => b.classList.contains('active')).map((b) => b.id));
console.log('lit at start:', await lit());
await page.screenshot({ path: `${OUT}fix-hud.png`, clip: { x: 0, y: 0, width: 844, height: 70 } });
await (await page.$('#btn-people')).tap(); await sleep(300);
console.log('lit with People open:', await lit());
await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'))); await sleep(200);
console.log('lit after closing:', await lit());
// Fence: one drag from corner to corner on the map.
await page.evaluate(() => window.__dino.ui.setMode('fence'));
const box = await page.evaluate(() => {
  const scene = window.__dino.game.scene.getScene('park');
  const cam = scene.cameras.main;
  const { x, y } = window.__dino.sim.state.entrance;
  const toScreen = (tx, ty) => ({ x: (tx * 16 - cam.worldView.x) * cam.zoom, y: (ty * 16 - cam.worldView.y) * cam.zoom });
  return { a: toScreen(x - 3, y - 8), b: toScreen(x + 3, y - 3) };
});
await page.touchscreen.touchStart(box.a.x, box.a.y);
for (let k = 1; k <= 12; k++) { await page.touchscreen.touchMove(box.a.x + ((box.b.x - box.a.x) * k) / 12, box.a.y + ((box.b.y - box.a.y) * k) / 12); await sleep(30); }
await page.screenshot({ path: `${OUT}fix-fence-preview.png` });
await page.touchscreen.touchEnd(); await sleep(400);
const result = await page.evaluate(() => {
  const s = window.__dino.sim.state;
  return { h: s.hFences.filter(Boolean).length, v: s.vFences.filter(Boolean).length, paddocks: window.__dino.sim.regions().regions.filter((r) => r.kind === 'paddock').length };
});
console.log('fences after one drag:', JSON.stringify(result));
await page.screenshot({ path: `${OUT}fix-fence-built.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
