// Does any panel scroll sideways? Measures each sheet's content against its width on phones.
import puppeteer from 'puppeteer-core';
import { check, finish, ready } from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[667, 375], [844, 390], [1180, 820]]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
  await sleep(1200);
  const out = await page.evaluate(async () => {
    const res = {};
    // Shop sheets have no id: name them by their title instead.
    for (const m of document.querySelectorAll('.modal')) {
      const id = m.id || m.getAttribute('aria-label') || '(unnamed)';
      const wasHidden = m.classList.contains('hidden');
      m.classList.remove('hidden');
      await new Promise((r) => requestAnimationFrame(r));
      const wide = [...m.querySelectorAll('*')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && !el.matches('.tabs, nav'));
      const card = m.querySelector('.modal-card');
      res[id] = { card: card ? `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}` : '-', sideways: wide.map((el) => `${el.className || el.tagName}:${el.scrollWidth}>${el.clientWidth}`) };
      if (wasHidden) m.classList.add('hidden');
    }
    const hb = [...document.querySelectorAll('.hud-btn:not([hidden]), .speed-btn')].map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
    return { res, hud: hb.join(' ') };
  });
  console.log(`${w}x${h} hud: ${out.hud}`);
  for (const [k, v] of Object.entries(out.res)) check(`${w}x${h} ${k} doesn't scroll sideways`, v.sideways.length === 0, `${v.card} ${v.sideways.join(' ')}`);
  await page.close();
}
await browser.close();
finish(errors);
