// The park at noon, sunset and night: lamps and buildings glowing, dinos asleep; plus frame times at night.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1200);
await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(0);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance; const w = s.map.width;
  for (let y = ey - 13; y < ey; y++) for (let x = ex - 10; x < ex + 11; x++) s.map.tiles[y * w + x] = 3;
  const P = { x: ex - 7, y: ey - 12 };
  const edges = [];
  for (let x = P.x; x < P.x + 8; x++) edges.push({ dir: 'h', x, y: P.y }, { dir: 'h', x, y: P.y + 6 });
  for (let y = P.y; y < P.y + 6; y++) edges.push({ dir: 'v', x: P.x, y }, { dir: 'v', x: P.x + 8, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 2 });
  sim.dispatch({ type: 'placeFeeder', kind: 'plants', x: P.x + 1, y: P.y + 1 });
  for (const [sp, dx, dy] of [['triceratops', 2, 2], ['stegosaurus', 5, 3], ['velociraptor', 6, 1]]) sim.dispatch({ type: 'buyDino', species: sp, x: P.x + dx, y: P.y + dy });
  const path = []; for (let y = ey - 5; y <= ey; y++) path.push(y * w + ex); for (let x = ex - 7; x <= ex + 7; x++) path.push((ey - 5) * w + x);
  sim.dispatch({ type: 'buildPaths', tiles: path });
  for (const dx of [-6, -2, 2, 6]) sim.dispatch({ type: 'placeDecor', kind: 'lamp', x: ex + dx, y: ey - 6 });
  sim.dispatch({ type: 'placeBuilding', kind: 'restaurant', x: ex - 4, y: ey - 4 });
  sim.dispatch({ type: 'placeBuilding', kind: 'snackstall', x: ex + 4, y: ey - 4 });
  window.__camAt = () => { const cam = game.scene.getScene('park').cameras.main; cam.setZoom(2); cam.centerOn(ex * 16, (ey - 7) * 16); };
  window.__camAt();
});
for (const [label, hour] of [['noon', 12], ['sunset', 18.5], ['night', 23]]) {
  await page.evaluate((hour) => {
    const { sim } = window.__dino; const s = sim.state;
    s.hours = Math.floor((hour - 8 + 24) % 24) + 24; s.stepInHour = Math.round((hour % 1) * 16);
    for (const d of s.dinos) d.hunger = 5;
  }, hour);
  await sleep(700);
  await page.screenshot({ path: `${OUT}daynight-${label}-${W}.png` });
}
// Frame times over two seconds, at night and then at noon, to see what the lighting costs.
const frameTimes = () => page.evaluate(() => new Promise((res) => {
  const times = []; let last = performance.now(); const end = last + 2000;
  const tick = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else res(times.sort((a, b) => a - b)); };
  requestAnimationFrame(tick);
}));
const stat = (f) => `median ${f[Math.floor(f.length / 2)].toFixed(1)} p95 ${f[Math.floor(f.length * 0.95)].toFixed(1)}`;
const night = await frameTimes();
await page.evaluate(() => { window.__dino.sim.state.hours = 4; });
await sleep(300);
const noon = await frameTimes();
console.log('frame ms at night:', stat(night), '| at noon:', stat(noon));
console.log('asleep:', await page.evaluate(() => { const { sim } = window.__dino; return sim.state.dinos.map((d) => d.species + (d.species === 'velociraptor' ? ' (night-owl)' : '')); }));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
