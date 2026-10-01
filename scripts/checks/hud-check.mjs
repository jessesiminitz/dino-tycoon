import puppeteer from 'puppeteer-core';
import { HERE, ready } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = process.argv[2] ?? 'before';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// Landscape iPhones: width x height, notch inset (left/right), home-indicator inset.
const phones = [[667, 375, 0, 0, 'SE'], [812, 375, 44, 21, 'mini/11Pro'], [844, 390, 47, 21, '12-14'], [852, 393, 59, 21, '15/16'], [874, 402, 62, 21, '16Pro'], [932, 430, 59, 21, 'ProMax'], [956, 440, 62, 21, '16ProMax']];
for (const [w, h, side, bottom, name] of phones) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load', timeout: 60000 }); await ready(page);
  await page.addStyleTag({ content: `:root{--safe-left:${side}px !important;--safe-right:${side}px !important;--safe-bottom:${bottom}px !important}` });
  await sleep(1200);
  // Worst case: lots of money, a busy park and an unread-alerts badge.
  const r = await page.evaluate(() => {
    const { sim } = window.__dino; sim.state.money = 12_345_678; sim.state.hours = 24 * 99 + 5;
    document.getElementById('log-badge').textContent = '99+'; document.getElementById('log-badge').classList.remove('hidden');
    return new Promise((res) => setTimeout(() => {
      const menu = document.getElementById('btn-menu').getBoundingClientRect();
      const groups = [...document.querySelectorAll('#hud .hud-group')].map((g) => g.getBoundingClientRect());
      const hit = document.elementFromPoint(menu.left + menu.width / 2, menu.top + menu.height / 2);
      res({ menuRight: Math.round(menu.right), menuVisible: menu.right <= innerWidth - 0 && menu.width > 0 && (hit?.id === 'btn-menu' || hit?.closest?.('#btn-menu') !== null),
        overlap: groups[0].right > groups[1].left,
        clipped: (() => { const l = document.querySelector('#hud .hud-group'); return l.scrollWidth > l.clientWidth + 1; })(),
        fit: document.getElementById('hud').className, left: Math.round(groups[0].right), speedLeft: Math.round(groups[1].left), wrap: groups.map((g) => Math.round(g.height)) });
    }, 400));
  });
  console.log(name.padEnd(10), `${w}x${h}`, JSON.stringify(r), r.menuVisible && !r.overlap && !r.clipped ? 'OK' : 'BROKEN');
  await page.screenshot({ path: `${OUT}hud-${tag}-${w}.png` });
  await page.close();
}
await browser.close();
