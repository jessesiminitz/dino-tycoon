import puppeteer from 'puppeteer-core';
const OUT = '/private/tmp/claude-501/-Volumes/ab3685c1-541d-4f67-beb0-215f65b774a1/scratchpad/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5173/', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await sleep(1500);
await p.screenshot({ path: OUT + 't-title.png' });
await p.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await sleep(1500);
await p.screenshot({ path: OUT + 't-hud.png' });
for (const id of ['btn-park', 'btn-catalog']) {
  await (await p.$('#' + id)).tap(); await sleep(500); await p.screenshot({ path: OUT + `t-${id}.png` });
  await p.evaluate(() => document.querySelectorAll('.modal:not(.hidden) .modal-close').forEach((c) => c.click())); await sleep(300);
}
const menu = await p.$('#btn-menu, .hud-menu, [aria-label="Menu"]'); if (menu) { await menu.tap(); await sleep(500); await p.screenshot({ path: OUT + 't-pause.png' }); }
console.log(errs);
await b.close();
