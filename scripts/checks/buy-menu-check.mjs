// One Buy button, a condensed top bar and longer-lasting pop-ups, on both phone sizes.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish, gameUrl, ready, reach } from './lib.mjs';
const out = fileURLToPath(new URL('../../docs/buy-menu-check/', import.meta.url)); mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [w, h] of [[844, 390], [667, 375]]) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(gameUrl('/?quickstart'), { waitUntil: 'load' }); await ready(page); await sleep(1500);
    await page.evaluate(() => document.querySelector('.tutorial-skip-all')?.click());
    const tap = async (sel) => { await (await page.waitForSelector(sel, { visible: true })).tap(); await sleep(300); };
    const shown = (sel) => page.$eval(sel, (e) => !e.classList.contains('hidden') && !e.hidden);
    const onScreen = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });

    // Bottom bar: only the Buy button until a tool is in use.
    const bottom = await page.$$eval('.toolbar button', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.id || b.className));
    check(`${w}: the bottom bar is one Buy button`, bottom.length === 1 && bottom[0] === 'btn-buy', bottom);
    check(`${w}: Buy sits bottom-right`, await page.$eval('#btn-buy', (b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth - 40 && r.bottom > innerHeight - 40; }));
    const top = await page.$$eval('#hud button', (bs) => bs.filter((b) => b.offsetParent).length);
    check(`${w}: the top bar has 6 buttons (Park, Requests, News, pause, speed, menu)`, top === 6, top);

    await tap('#btn-buy');
    check(`${w}: Buy opens the sheet of every tool`, (await shown('#buy')) && (await page.$$('#buy .tool-btn')).length === 8);
    check(`${w}: the whole sheet fits on screen`, await onScreen('#buy .modal-card'));
    await page.screenshot({ path: `${out}${w}-sheet.png` });
    await tap('#buy .tool-btn[data-mode="fence"]');
    check(`${w}: a tool closes the sheet and opens its picker`, !(await shown('#buy')) && (await page.$$('.modal:not(.hidden) .shop-card[data-id="1"]')).length === 1);
    await tap('.modal:not(.hidden) .shop-card[data-id="1"] button');
    check(`${w}: picking a fence starts fencing, with a chip and Done`, (await page.evaluate(() => window.__dino.ui.mode)) === 'fence' && (await shown('#pick-chip')));
    check(`${w}: chip and Buy fit on screen`, (await onScreen('#pick-chip')) && (await onScreen('#btn-buy')));
    await page.screenshot({ path: `${out}${w}-chip.png` });
    await tap('#pick-chip .chip-done');
    check(`${w}: Done goes back to looking`, (await page.evaluate(() => window.__dino.ui.mode)) === 'select' && !(await shown('#pick-chip')));
    await tap('#btn-buy'); await tap('#buy .tool-btn[data-mode="demolish"]');
    check(`${w}: Remove gets a Done chip too`, (await page.evaluate(() => window.__dino.ui.mode)) === 'demolish' && (await shown('#pick-chip')));
    await tap('#pick-chip .chip-done');
    await tap('#btn-buy'); await tap('#btn-catalog');
    check(`${w}: Dinosaurs opens the catalog`, await shown('#catalog'));
    await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')));

    // Speed: pause, then one button that cycles 1× → 3× → 8×.
    const speed = () => page.evaluate(() => window.__dino.sim.speed);
    await tap('.speed-btn[data-speed="0"]'); const paused = await speed();
    await tap('#btn-speed'); const one = await speed();
    await tap('#btn-speed'); const three = await speed();
    await tap('#btn-speed'); const eight = await speed();
    const glyph = await page.$eval('#btn-speed', (b) => b.textContent);
    await tap('.speed-btn[data-speed="0"]'); await tap('#btn-speed'); const resumed = await speed();
    check(`${w}: pause and the speed cycle`, paused === 0 && one === 1 && three === 3 && eight === 8 && glyph === '▶▶▶' && resumed === 8, { paused, one, three, eight, glyph, resumed });

    // People and the Dino book are in ☰.
    await (await reach(page, '#btn-people')).tap(); await sleep(300);
    check(`${w}: ☰ → People opens People and closes the menu`, (await shown('#people')) && !(await shown('#pause')));
    await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')));
    await (await reach(page, '#btn-book')).tap(); await sleep(300);
    check(`${w}: ☰ → Dino book opens the book`, (await shown('#guide')) || (await shown('#stickers')));
    await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')));

    // Pop-ups: park news shows three at a time and the rest wait, each staying at least 5 s;
    // a reply to the player's own tap shows straight away.
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
    const news = (from, to) => page.evaluate((from, to) => { const { sim } = window.__dino; sim.setSpeed(0); for (let i = from; i <= to; i++) sim.emitEvent({ text: `Test news ${i}`, kind: 'info' }); }, from, to);
    await news(1, 2); await sleep(250); await news(3, 4); await sleep(250); await news(5, 5); await sleep(300);
    const first = await page.$$eval('.toast', (t) => t.map((x) => x.textContent));
    await sleep(4200);
    const later = await page.$$eval('.toast', (t) => t.map((x) => x.textContent));
    await sleep(1500);
    const after = await page.$$eval('.toast', (t) => t.map((x) => x.textContent));
    check(`${w}: news pop-ups queue three at a time and stay 5 s`, first.join() === 'Test news 1,Test news 2,Test news 3' && later.join() === first.join() && after.includes('Test news 4'), { first, later, after });
    await page.evaluate(() => window.__dino.hud.toast('Nope! Too hungry for pats'));
    const reply = await page.$$eval('.toast', (t) => t.map((x) => x.textContent));
    check(`${w}: a reply to a tap shows at once`, reply.at(-1) === 'Nope! Too hungry for pats' && reply.length <= 3, reply);
    await page.close();
  }
} finally { await browser.close(); }
finish(errors);
