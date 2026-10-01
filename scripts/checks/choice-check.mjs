// A decision card: pops up and pauses; "Decide later" leaves a ❓ button; answering logs the result.
import puppeteer from 'puppeteer-core';
import { HERE, finish, ready } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '667x375').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
await sleep(1200);
await page.evaluate(() => {
  const { sim } = window.__dino; const s = sim.state; s.money = 1e6; sim.setSpeed(1);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance;
  const A = { x: ex - 4, y: ey - 10 }, C = { x: ex + 4, y: ey - 4 };
  const edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 2 });
  sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 3, y: A.y + 3 });
  // A TV crew turns up.
  s.pendingChoice = { eventId: 'tv', dinoId: s.dinos[0].id, createdHour: s.hours, expiresHour: s.hours + 4 };
  sim.setSpeed(1);
});
await sleep(600);
const card = await page.evaluate(() => {
  const m = document.getElementById('choice'); const c = m.querySelector('.modal-card').getBoundingClientRect();
  return { open: !m.classList.contains('hidden'), title: m.querySelector('.choice-title').textContent, options: [...m.querySelectorAll('[data-option]')].map((b) => b.textContent), paused: window.__dino.sim.speed === 0, top: Math.round(c.top), bottom: Math.round(c.bottom), vh: innerHeight };
});
console.log('card:', card);
await page.screenshot({ path: `${OUT}choice-1-card-${W}.png` });
await (await page.$('.choice-later')).tap(); await sleep(300);
console.log('later:', await page.evaluate(() => ({ cardHidden: document.getElementById('choice').classList.contains('hidden'), button: !document.getElementById('choice-btn').classList.contains('hidden'), running: window.__dino.sim.speed > 0 })));
await page.screenshot({ path: `${OUT}choice-2-button-${W}.png` });
await (await page.$('#choice-btn')).tap(); await sleep(300);
await (await page.$('[data-option="0"]')).tap(); await sleep(400);
console.log('answered:', await page.evaluate(() => ({ pending: window.__dino.sim.state.pendingChoice, log: window.__dino.sim.state.log.at(-1)?.text, button: !document.getElementById('choice-btn').classList.contains('hidden'), running: window.__dino.sim.speed > 0 })));
finish(errors);
await browser.close();
