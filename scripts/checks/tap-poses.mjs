// Tapping a dinosaur: a walker winks only once it stops, and a sleeper stays lying down.
import puppeteer from 'puppeteer-core';
import { check, finish, gameUrl, ready } from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(gameUrl('/?quickstart'), { waitUntil: 'load' }); await ready(page); await sleep(1000);
const id = await page.evaluate(() => {
  const { sim } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(1); s.parcelsOwned = s.parcelsOwned.map(() => true); if (!s.unlockedSpecies.includes('triceratops')) s.unlockedSpecies.push('triceratops');
  const { x: ex, y: ey } = s.entrance; const A = { x: ex - 9, y: ey - 14 }, C = { x: ex + 9, y: ey - 3 }, edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 4 });
  sim.step = () => {}; // the check moves the animal itself
  for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 4 + dx, y: A.y + 5 + dy }).ok) { const d = s.dinos.at(-1); const cam = window.__dino.game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn(d.x * 16, d.y * 16); return d.id; }
});
const sample = async (n) => { const out = []; for (let i = 0; i < n; i++) { out.push(await page.evaluate((id) => window.__dino.game.scene.getScene('park').entities.dinoSprite(id).frame.name, id)); await sleep(50); } return out; };
const greet = () => page.evaluate((id) => window.__dino.game.scene.getScene('park').entities.greet(id), id);
const step = () => page.evaluate((id) => { const d = window.__dino.sim.state.dinos.find((d) => d.id === id); d.px = d.x; d.py = d.y; d.x += 1; }, id);
const halt = () => page.evaluate((id) => { const d = window.__dino.sim.state.dinos.find((d) => d.id === id); d.px = d.x; d.py = d.y; }, id);

await step(); await sleep(150); await greet();
const walking = []; for (let i = 0; i < 6; i++) { await step(); walking.push(...await sample(3)); }
check('a walking dino keeps walking when tapped', walking.every((f) => f.startsWith('walk-')), walking);
await halt(); const stopped = await sample(16);
check('it winks once it stops (tapped under 3 s ago)', stopped.some((f) => f.startsWith('wink-')), stopped);

await page.evaluate(async (id) => { const { calendar } = await import('/src/sim/GameState.ts'); const s = window.__dino.sim.state; while (calendar(s).hour !== 23) s.hours++; const d = s.dinos.find((d) => d.id === id); d.path = []; d.hunger = 0; d.px = d.x; d.py = d.y; }, id);
await sleep(1200);
await greet(); const asleep = await sample(16);
check('a sleeping dino stays lying down when tapped', asleep.every((f) => f.startsWith('rest-')), asleep);
await page.evaluate((id) => window.__dino.game.scene.getScene('park').entities.careEffect(id, 'hearts', 'pat'), id);
const patted = await sample(12);
check('and when patted', patted.every((f) => f.startsWith('rest-')), patted);
await browser.close();
finish(errors);
