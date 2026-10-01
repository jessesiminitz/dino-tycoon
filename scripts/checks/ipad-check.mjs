import puppeteer from 'puppeteer-core';
import { HERE, finish, ready } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h, name] of [[1180, 820, 'air-land'], [820, 1180, 'air-port'], [1024, 768, 'ipad9-land'], [768, 1024, 'mini-port']]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load', timeout: 60000 }); await ready(page);
  await sleep(1500);
  const r = await page.evaluate(() => {
    const hint = document.querySelector('.rotate-hint');
    const vis = hint && getComputedStyle(hint).display !== 'none';
    const rects = [...document.querySelectorAll('#hud .hud-group, .toolbar .hud-group:not(.hidden)')].map((e) => e.getBoundingClientRect());
    const off = rects.some((r) => r.right > innerWidth + 1 || r.left < -1);
    let overlap = false;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap = true;
    }
    return { rotateHint: vis, offscreen: off, overlap, scrollW: document.documentElement.scrollWidth };
  });
  console.log(name, w + 'x' + h, JSON.stringify(r));
  await page.screenshot({ path: `${OUT}ipad-${name}.png` });
  await page.close();
}
finish(errors);
await browser.close();
