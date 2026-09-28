// iPads held upright: no rotate screen, top bar and toolbar on screen and not overlapping, panels fit.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h, name] of [[744, 1133, 'mini'], [820, 1180, 'air'], [1024, 1366, 'pro13'], [390, 844, 'iphone-upright']]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
  await sleep(1300);
  const r = await page.evaluate(() => {
    const hint = document.querySelector('.rotate-hint');
    const shown = (el) => el && getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden');
    const boxes = [...document.querySelectorAll('#hud .hud-group, .toolbar .hud-group:not(.hidden)')].map((e) => e.getBoundingClientRect());
    const off = boxes.some((b) => b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1);
    let overlap = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap = true;
    }
    const clipped = (() => { const l = document.querySelector('#hud .hud-group'); return l.scrollWidth > l.clientWidth + 1; })();
    return { rotateHint: shown(hint), offscreen: off, overlap, clipped };
  });
  // Open a couple of panels and make sure they fit.
  const panels = {};
  for (const [btn, modal] of [['#btn-people', '#people'], ['#btn-stickers', '#stickers'], ['#btn-park', '#park']]) {
    await (await page.$(btn))?.tap(); await sleep(300);
    panels[modal] = await page.evaluate((m) => { const c = document.querySelector(`${m} .modal-card`)?.getBoundingClientRect(); return c ? c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1 : 'n/a'; }, modal);
    await page.evaluate((m) => document.querySelector(m)?.classList.add('hidden'), modal);
  }
  console.log(`${name} ${w}x${h}`, JSON.stringify({ ...r, panels }));
  await page.screenshot({ path: `${OUT}portrait-${name}.png` });
  await page.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
