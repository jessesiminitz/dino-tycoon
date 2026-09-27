// Reproduce: build a paddock, feeder, buy + release a dino, then delete a path, all through touch UI.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const tap = async (sel) => { const el = await page.waitForSelector(sel, { visible: true }); await el.tap(); await sleep(250); };
const toasts = () => page.$$eval('.toast', (t) => t.map((x) => x.textContent).join(' | '));
const info = () => page.$eval('#info-text', (e) => e.textContent);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
await page.evaluate(async () => { localStorage.clear(); await new Promise((r) => { const q = indexedDB.deleteDatabase('dino-tycoon'); q.onsuccess = q.onerror = q.onblocked = r; }); });
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);
await tap('[data-go="new"]');
await tap('[data-scenario="first-steps"]');
await sleep(900);
await tap('.tutorial-skip-all');
const { ex, ey } = await page.evaluate(() => ({ ex: window.__dino.sim.state.entrance.x, ey: window.__dino.sim.state.entrance.y }));
await page.evaluate((ex, ey) => { const c = window.__dino.game.scene.getScene('park').cameras.main; c.setZoom(2); c.centerOn(ex * 16, (ey - 6) * 16); }, ex, ey);
await sleep(300);
const toScreen = (vx, vy) => page.evaluate((vx, vy) => { const c = window.__dino.game.scene.getScene('park').cameras.main; const cx = c.width / 2, cy = c.height / 2; return { x: (vx * 16 - c.scrollX - cx) * c.zoom + cx, y: (vy * 16 - c.scrollY - cy) * c.zoom + cy }; }, vx, vy);
const drag = async (a, b, dir) => {
  const p = await toScreen(a.x, a.y), q = await toScreen(b.x, b.y);
  await page.touchscreen.touchStart(p.x, p.y);
  const mid = dir === 'h' ? { x: q.x, y: p.y } : { x: p.x, y: q.y };
  for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(p.x + ((mid.x - p.x) * i) / 6, p.y + ((mid.y - p.y) * i) / 6);
  for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(mid.x + ((q.x - mid.x) * i) / 6, mid.y + ((q.y - mid.y) * i) / 6);
  await page.touchscreen.touchEnd();
  await sleep(300);
};
const tapTile = async (x, y) => { const p = await toScreen(x + 0.5, y + 0.5); await page.touchscreen.tap(p.x, p.y); await sleep(300); };

// Paddock via fence drags
await tap('.tool-btn[data-mode="fence"]');
const A = { x: ex - 4, y: ey - 10 }, C = { x: ex + 3, y: ey - 4 };
await drag(A, C, 'h');
await drag(A, C, 'v');
console.log('fences:', await toasts());
const regions = await page.evaluate((A, C) => { const { sim } = window.__dino; const r = sim.regions(); const w = sim.state.map.width; const t = r.tileRegion[(A.y + 2) * w + A.x + 2]; return { kind: r.regions[t]?.kind, terrain: [...new Set(Array.from({ length: (C.x - A.x) * (C.y - A.y) }, (_, k) => sim.state.map.tiles[(A.y + Math.floor(k / (C.x - A.x))) * w + A.x + (k % (C.x - A.x))]))] }; }, A, C);
console.log('inside the box:', JSON.stringify(regions));
// The trap: a path laid into the empty paddock first.
await tap('.tool-btn[data-mode="path"]');
await drag({ x: A.x + 2.5, y: A.y + 2.5 }, { x: A.x + 5.5, y: A.y + 2.5 }, 'h');
console.log('path into empty paddock:', await toasts());
// Feeder
await tap('.tool-btn[data-mode="feeder"]');
await tapTile(A.x + 1, A.y + 1);
console.log('feeder:', await toasts());
// Dino via the catalog
await tap('#btn-catalog');
const btns = await page.$$('.species-card .action-btn');
await btns[0].tap();
await sleep(300);
console.log('placing hint:', await info());
await tapTile(A.x + 3, A.y + 3);
console.log('release:', await toasts(), '| dinos:', await page.evaluate(() => window.__dino.sim.state.dinos.length));
await page.screenshot({ path: `${OUT}repro-place.png` });

// Paths: lay a path from the gate, then try to delete it two ways.
await page.evaluate(() => window.__dino.ui.setMode('select'));
const probe = await page.evaluate(() => {
  const out = [];
  for (const b of document.querySelectorAll('.tool-btn')) {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.push(`${b.dataset.mode ?? b.id}: [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] hit=${el === b || b.contains(el) ? 'self' : (el?.id || el?.className || el?.tagName)}`);
  }
  return out;
});
console.log(probe.join('\n'));
await tap('.tool-btn[data-mode="path"]');
console.log('mode after tapping Path:', await page.evaluate(() => window.__dino.ui.mode));
await page.evaluate((ex, ey) => { const c = window.__dino.game.scene.getScene('park').cameras.main; c.centerOn(ex * 16, (ey - 2) * 16); }, ex, ey);
await sleep(200);
await drag({ x: ex + 0.5, y: ey - 0.5 }, { x: ex + 0.5, y: ey - 3.5 }, 'v');
const count = () => page.evaluate(() => window.__dino.sim.state.paths.filter((p) => p).length);
console.log('paths laid:', await count(), '|', await toasts());
await tap('.tool-btn[data-mode="demolish"]');
console.log('remove hint:', await info());
await tapTile(ex, ey - 2);
console.log('remove tool TAP on a path -> paths:', await count(), '|', await toasts());
await drag({ x: ex + 0.5, y: ey - 0.5 }, { x: ex + 0.5, y: ey - 3.5 }, 'v');
console.log('remove tool DRAG over paths -> paths:', await count(), '|', await toasts());
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
