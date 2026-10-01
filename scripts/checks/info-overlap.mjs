import puppeteer from 'puppeteer-core';
import { HERE, ready } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const tag = process.argv[2] ?? 'before';
const long = 'Gap in the fence (2 missing, 1 broken, circled in red). Close it to let your Triceratops in.';
for (const [w, h, safe] of [[667, 375, 0], [812, 375, 44], [844, 390, 47], [932, 430, 59], [1180, 820, 0]]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'networkidle0' }); await ready(page);
  await page.addStyleTag({ content: `:root{--safe-left:${safe}px !important;--safe-right:${safe}px !important;--safe-bottom:${safe ? 21 : 0}px !important}` });
  await sleep(400);
  const results = [];
  for (const mode of ['select', 'fence', 'building', 'decor', 'path', 'feeder']) {
    const r = await page.evaluate(async (mode, long) => {
      const { ui, game } = window.__dino;
      ui.setMode(mode);
      const scene = game.scene.getScene('park');
      scene.hud.showInfo(long, { label: 'Close gap · $138', onClick() {} });
      await new Promise((r) => setTimeout(r, 150));
      const rect = (el) => el.getBoundingClientRect();
      const info = rect(document.getElementById('info'));
      const blocks = [...document.querySelectorAll('.toolbar .hud-group:not(.hidden), #tutorial:not(.hidden), .toast, #hud .hud-group')];
      const hits = blocks.filter((b) => { const o = rect(b); return info.left < o.right && o.left < info.right && info.top < o.bottom && o.top < info.bottom; })
        .map((b) => b.id || b.className);
      const text = document.getElementById('info-text'); 
      return { mode, info: [Math.round(info.left), Math.round(info.top), Math.round(info.width), Math.round(info.height)], textW: Math.round(rect(text).width), hits };
    }, mode, long);
    results.push(r);
    if (mode === 'building') await page.screenshot({ path: `${OUT}info-${tag}-${w}.png` });
  }
  console.log(w + 'x' + h, results.filter((r) => r.hits.length || r.textW < 150).map((r) => `${r.mode}: text ${r.textW}px ${r.hits.join(',')}`).join(' | ') || 'OK');
}
await browser.close();
