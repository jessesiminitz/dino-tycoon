// The park log open while alerts keep arriving and a dino is selected: what shows on top, and where?
import puppeteer from 'puppeteer-core';
import { HERE, finish, ready } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '667x375').split('x').map(Number);
const tag = process.argv[3] ?? 'before';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
await sleep(1200);
await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e6;
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance;
  const A = { x: ex - 4, y: ey - 9 }, C = { x: ex + 4, y: ey - 3 };
  const edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 2 });
  sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 3, y: A.y + 3 });
  // A dino selected, so the info panel is up in the bottom-left.
  game.scene.getScene('park').entities.selection = { kind: 'dino', id: s.dinos[0].id };
  for (let i = 0; i < 16 * 30; i++) sim.step(); // a day and a bit of alerts
});
await sleep(400);
await (await page.$('#btn-log')).tap(); await sleep(300);
// More alerts arrive while the log is open.
await page.evaluate(() => window.__dino.sim.setSpeed(8));
await sleep(4000);
const layers = await page.evaluate(() => {
  const what = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return 'nothing';
    if (el.closest('#log .modal-card')) return 'log card';
    if (el.closest('.toast')) return 'toast';
    if (el.closest('#info')) return 'info panel';
    if (el.closest('#dig-btn')) return 'dig button';
    if (el.id === 'log') return 'log backdrop';
    return el.id || el.className || el.tagName;
  };
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), onTop: what(r.left + Math.min(20, r.width / 2), r.top + Math.min(8, r.height / 2)) }; };
  const shown = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  return {
    toasts: [...document.querySelectorAll('.toast')].map(box),
    info: shown(document.getElementById('info')) ? box(document.getElementById('info')) : null,
    card: box(document.querySelector('#log .modal-card')),
  };
});
console.log(JSON.stringify(layers, null, 1));
await page.screenshot({ path: `${OUT}log-popups-${tag}-${W}.png` });
finish(errors);
await browser.close();
