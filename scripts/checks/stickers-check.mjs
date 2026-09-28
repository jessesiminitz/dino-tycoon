// Earn a few stickers in a park, see the badge and the pop-up, and open the book.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '667x375').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.removeItem('dino-tycoon:stickers'));
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1200);
await page.evaluate(() => {
  const { sim } = window.__dino; const s = sim.state; s.money = 1e6;
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  const { x: ex, y: ey } = s.entrance;
  const A = { x: ex - 4, y: ey - 10 }, C = { x: ex + 4, y: ey - 4 };
  const edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 2 });
  sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 2, y: A.y + 2 });
  sim.dispatch({ type: 'buyDino', species: 'stegosaurus', x: A.x + 5, y: A.y + 3 });
  sim.dispatch({ type: 'photoDino', id: s.dinos[0].id });
  s.dinos.push({ ...s.dinos[0], id: 99123, name: 'Pip', baby: true });
});
await sleep(2600);
const badge = await page.$eval('#stickers-badge', (b) => ({ text: b.textContent, hidden: b.classList.contains('hidden') }));
console.log('badge:', badge, '| toasts:', await page.$$eval('.toast', (t) => t.map((x) => x.textContent).filter((x) => x.includes('sticker'))));
await page.screenshot({ path: `${OUT}stickers-0-toast-${W}.png` });
await (await page.$('#btn-book')).tap(); await sleep(500);
const book = await page.evaluate(() => ({
  count: document.querySelector('.stickers-count').textContent,
  earned: document.querySelectorAll('.sticker.earned').length,
  fresh: document.querySelectorAll('.sticker-new').length,
  pages: [...document.querySelectorAll('.sticker-page h3')].map((h) => h.textContent),
  cardBottom: Math.round(document.querySelector('#stickers .modal-card').getBoundingClientRect().bottom), vh: innerHeight,
}));
console.log('book:', book);
await page.screenshot({ path: `${OUT}stickers-1-book-${W}.png` });
await page.evaluate(() => { document.querySelector('.sticker-grid.medals').scrollIntoView(); });
await sleep(200);
await page.screenshot({ path: `${OUT}stickers-2-trophies-${W}.png` });
await (await page.$('#stickers .modal-close')).tap(); await sleep(200);
console.log('badge after reading:', await page.$eval('#stickers-badge', (b) => b.classList.contains('hidden') ? 'cleared' : b.textContent));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
