// Screenshots of the game in each candidate style: the park report open, and the Dinos catalog.
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
const DIR = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const theme of (process.argv[2] ?? 'current,dos,jungle,pixel').split(',')) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
  await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=VT323&family=Pixelify+Sans:wght@400;600&display=swap' });
  if (theme !== 'current') await page.addStyleTag({ content: readFileSync(`${DIR}${theme}.css`, 'utf8') });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1400);
  await page.evaluate(() => {
    const { sim } = window.__dino; const s = sim.state; s.money = 48_250; sim.setSpeed(0);
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    const { x: ex, y: ey } = s.entrance;
    const A = { x: ex - 4, y: ey - 10 }, C = { x: ex + 4, y: ey - 4 };
    const edges = [];
    for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
    for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
    s.money = 1e6; sim.dispatch({ type: 'buildFences', edges, fence: 2 });
    sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 3, y: A.y + 3 });
    s.money = 48_250;
  });
  await (await page.$('#btn-park')).tap(); await sleep(500);
  await page.screenshot({ path: `${DIR}style-${theme}-1-report.png` });
  await page.evaluate(() => document.getElementById('park').classList.add('hidden'));
  await (await page.$('#btn-catalog')).tap(); await sleep(600);
  await page.screenshot({ path: `${DIR}style-${theme}-2-catalog.png` });
  await page.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
