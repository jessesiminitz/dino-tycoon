// Every building with its picture sign, in the park, zoomed in.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1200);
const out = await page.evaluate(() => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(0);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance; const w = s.map.width;
  for (let y = ey - 8; y < ey; y++) for (let x = ex - 10; x < ex + 11; x++) s.map.tiles[y * w + x] = 3;
  const path = []; for (let x = ex - 9; x <= ex + 9; x++) path.push((ey - 4) * w + x); for (let y = ey - 3; y <= ey; y++) path.push(y * w + ex);
  sim.dispatch({ type: 'buildPaths', tiles: path });
  const kinds = ["restaurant", "snackstall", "giftshop", "restroom", "trashcan", "station", "tower", "petting", "digsite"];
  const res = kinds.map((kind, i) => `${kind}: ${sim.dispatch({ type: 'placeBuilding', kind, x: ex - 8 + i * 2, y: ey - 5 }).ok}`);
  const cam = game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn(ex * 16 - 8, (ey - 6) * 16);
  return res;
});
console.log(out.join(' | '));
await sleep(800);
await page.screenshot({ path: `${OUT}signs-844.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
