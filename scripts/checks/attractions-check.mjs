// A safari track loop past a paddock, a station, a tower and a petting pen, with visitors riding.
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
const setup = await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(0);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance; const w = s.map.width;
  // Level a building site.
  for (let y = ey - 14; y < ey; y++) for (let x = ex - 10; x < ex + 11; x++) s.map.tiles[y * w + x] = 3;
  const out = [];
  const P = { x: ex - 8, y: ey - 13 };
  const edges = [];
  for (let x = P.x; x < P.x + 7; x++) edges.push({ dir: 'h', x, y: P.y }, { dir: 'h', x, y: P.y + 6 });
  for (let y = P.y; y < P.y + 6; y++) edges.push({ dir: 'v', x: P.x, y }, { dir: 'v', x: P.x + 7, y });
  out.push(sim.dispatch({ type: 'buildFences', edges, fence: 2 }).message);
  sim.dispatch({ type: 'placeFeeder', kind: 'plants', x: P.x + 1, y: P.y + 1 });
  for (const [sp, dx, dy] of [['triceratops', 2, 2], ['stegosaurus', 5, 3], ['parasaurolophus', 3, 4]]) out.push(sim.dispatch({ type: 'buyDino', species: sp, x: P.x + dx, y: P.y + dy }).message);
  // Footpath from the gate up to the attractions.
  const path = []; for (let y = ey - 5; y <= ey; y++) path.push(y * w + ex); for (let x = ex - 6; x <= ex + 6; x++) path.push((ey - 5) * w + x);
  out.push(sim.dispatch({ type: 'buildPaths', tiles: path }).message);
  // Track: a loop round the paddock's east and south, joining a bay by the station.
  const T = []; const x0 = P.x + 7, x1 = P.x + 10, y0 = P.y, y1 = P.y + 7;
  for (let x = x0; x <= x1; x++) T.push(y0 * w + x, y1 * w + x);
  for (let y = y0; y <= y1; y++) T.push(y * w + x0, y * w + x1);
  for (let y = y1; y <= ey - 6; y++) T.push(y * w + x1);
  out.push(sim.dispatch({ type: 'buildTracks', tiles: T }).message);
  out.push(sim.dispatch({ type: 'placeBuilding', kind: 'station', x: x1 + 1, y: ey - 6 }).message);
  out.push(sim.dispatch({ type: 'placeBuilding', kind: 'tower', x: ex - 3, y: ey - 6 }).message);
  out.push(sim.dispatch({ type: 'placeBuilding', kind: 'petting', x: ex + 5, y: ey - 4 }).message);
  sim.dispatch({ type: 'hireStaff', role: 'worker' });
  s.ticketPrice = 10; s.reputation = 90;
  for (let i = 0; i < 16 * 5; i++) sim.step();
  sim.setSpeed(1);
  const cam = game.scene.getScene('park').cameras.main; cam.setZoom(2); cam.centerOn((ex - 1) * 16, (ey - 8) * 16);
  return {
    out,
    jeeps: s.jeeps.map((j) => ({ riders: j.riders.length, steps: j.steps })),
    rode: s.visitors.reduce((a, v) => { for (const r of v.rode) a[r] = (a[r] ?? 0) + 1; return a; }, {}),
    rides: s.finance.today.income.rides,
  };
});
console.log(JSON.stringify(setup, null, 1));
await sleep(1500);
await page.screenshot({ path: `${OUT}attractions-${W}.png` });
// The Path picker with its four buttons.
await (await page.$('.tool-btn[data-mode="path"]')).tap(); await sleep(300);
const picker = await page.evaluate(() => { const p = document.getElementById('path-picker').getBoundingClientRect(); return { left: Math.round(p.left), right: Math.round(p.right), vw: innerWidth }; });
console.log('path picker:', picker);
await page.screenshot({ path: `${OUT}attractions-picker-${W}.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
