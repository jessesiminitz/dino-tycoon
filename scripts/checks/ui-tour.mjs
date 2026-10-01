// A tour of the main screens on an iPhone: top bar, each build screen, the chip, Dinos, Book and Park.
import puppeteer from 'puppeteer-core';
import { HERE, finish, ready } from './lib.mjs';
const OUT = HERE + 'tour/';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
await page.evaluate(() => document.fonts.ready); await sleep(1300);
await page.evaluate(() => window.__dino.sim.setSpeed(0));
const shot = (name) => page.screenshot({ path: `${OUT}${w}-${name}.png` });
const closeAll = () => page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')));
const tap = async (sel) => { await (await page.$(sel)).tap(); await sleep(450); };
await shot('0-hud');
for (const mode of ['building', 'feeder', 'fence', 'path', 'decor']) {
  await tap(`.tool-btn[data-mode="${mode}"]`);
  await shot(`1-${mode}`);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.modal:not(.hidden) .modal-card')].map((c) => { const r = c.getBoundingClientRect(); const g = c.querySelector('.shop-grid'); return `${Math.round(r.width)}x${Math.round(r.height)} sideways:${g.scrollWidth > g.clientWidth}`; }));
  console.log(mode, sizes.join());
  await page.evaluate(() => document.querySelector('.modal:not(.hidden) .shop-card:not(:has(button:disabled)) .action-btn').click());
  await sleep(300);
  if (mode === 'building') await shot('2-chip');
}
await page.evaluate(() => window.__dino.ui.setMode('select'));
for (const [btn, name] of [['#btn-catalog', 'dinos'], ['#btn-book', 'book'], ['#btn-park', 'park'], ['#btn-people', 'people'], ['#btn-log', 'news'], ['#btn-requests', 'requests']]) {
  await tap(btn);
  const size = await page.evaluate(() => { const c = document.querySelector('.modal:not(.hidden) .modal-card'); const r = c.getBoundingClientRect(); const wide = [...c.querySelectorAll('*')].some((el) => el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && !el.matches('.tabs, nav, .log-filters')); return `${Math.round(r.width)}x${Math.round(r.height)} sideways:${wide}`; });
  console.log(name, size);
  await shot(`3-${name}`);
  if (name === 'book') { await tap('#guide .book-tabs [data-book="stickers"]'); console.log('stickers tab ->', await page.evaluate(() => [...document.querySelectorAll('.modal:not(.hidden)')].map((m) => m.id).join())); await shot('3-book-stickers'); }
  await closeAll();
}
finish(errors);
await browser.close();
