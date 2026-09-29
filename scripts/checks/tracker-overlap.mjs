// First Steps on every phone: the goal tracker, the tutorial card and alerts must not overlap.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
for (const [w, h, safe] of [[667, 375, 0], [812, 375, 44], [844, 390, 47], [932, 430, 59], [1180, 820, 0]]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  await page.addStyleTag({ content: `:root{--safe-left:${safe}px !important;--safe-right:${safe}px !important}` });
  await page.evaluate(() => document.querySelector('[data-go="new"]').click()); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-scenario="first-steps"]').click()); await sleep(400);
  // All park slots taken by earlier runs: replace the first.
  await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1500);
  const r = await page.evaluate(() => {
    const { sim } = window.__dino; sim.setSpeed(0);
    const box = (s) => { const e = document.querySelector(s); if (!e || e.hidden || e.classList.contains('hidden')) return null; return e.getBoundingClientRect(); };
    const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const t = box('#goal-tracker'), tut = box('#tutorial'), hud = [...document.querySelectorAll('#hud .hud-group')].map((e) => e.getBoundingClientRect());
    return { tracker: !!t, tutorial: !!tut, clashTutorial: hit(t, tut), clashHud: hud.some((b) => hit(t, b)), trackerRight: t && Math.round(t.right), tutorialLeft: tut && Math.round(tut.left) };
  });
  console.log(`${w}x${h}`, JSON.stringify(r), r.clashTutorial || r.clashHud ? 'CLASH' : 'OK');
}
await browser.close();
