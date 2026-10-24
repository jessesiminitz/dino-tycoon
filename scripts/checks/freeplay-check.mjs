// Title menu → Challenges (goal parks and parks in trouble) → New park with the dig switch → free-play goal tracker.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish, gameUrl } from './lib.mjs';
const out = fileURLToPath(new URL('../../docs/freeplay-check/', import.meta.url)); mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [w, h] of [[844, 390], [667, 375]]) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(gameUrl('/'), { waitUntil: 'load' });
    await page.evaluate(async () => { localStorage.clear(); await new Promise((r) => { const q = indexedDB.deleteDatabase('dino-tycoon'); q.onsuccess = q.onerror = q.onblocked = r; }); });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    const tap = async (sel) => { await (await page.waitForSelector(sel, { visible: true })).tap(); await sleep(350); };
    /** Every visible button inside the menu lies within the screen sideways (the menu scrolls up and down). */
    const fitsWide = () => page.$$eval('#menu button', (bs) => bs.filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }));

    check(`${w}: title menu has a Challenges button`, !!(await page.$('[data-go="challenges"]')));
    await tap('[data-go="challenges"]');
    await page.screenshot({ path: `${out}${w}-challenges-goals.png` });
    const goals = await page.$$eval('[data-scenario]', (c) => c.map((x) => x.dataset.scenario));
    check(`${w}: goal parks listed, free play not among them`, goals.includes('first-steps') && !goals.includes('sandbox'), goals);
    await tap('[data-folder="challenges"]');
    await page.screenshot({ path: `${out}${w}-challenges-trouble.png` });
    check(`${w}: parks in trouble listed`, (await page.$$('.scenario-card')).length === 4);
    check(`${w}: challenge cards fit the width`, await fitsWide());
    await tap('#menu [data-go="main"]');

    await tap('[data-go="new"]');
    check(`${w}: island screen defaults to digging`, await page.$eval('[data-discover="1"]', (b) => b.classList.contains('active')));
    await page.screenshot({ path: `${out}${w}-island-dig.png` });
    await tap('[data-discover="0"]');
    check(`${w}: switch picks every species`, await page.$eval('[data-discover="0"]', (b) => b.classList.contains('active')));
    await tap('[data-discover="1"]');
    check(`${w}: island screen fits the width`, await fitsWide());
    const start = await page.$eval('[data-start-sandbox]', (b) => { b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1; });
    check(`${w}: Start building can be reached`, start);
    await tap('[data-start-sandbox]');
    await page.waitForFunction(() => window.__dino?.sim, { timeout: 60000 }); await sleep(1500);
    const park = await page.evaluate(() => ({ unlocked: window.__dino.sim.state.unlockedSpecies.length, scenario: window.__dino.sim.state.scenario.id }));
    check(`${w}: dig park starts with the starter species`, park.scenario === 'sandbox' && park.unlocked === 6, park);
    // Skip a tutorial or briefing if one is showing.
    await page.evaluate(() => document.querySelector('.tutorial-skip-all')?.click());
    const tracker = await page.$eval('#goal-tracker', (e) => ({ hidden: e.hidden, text: e.textContent.replace(/\s+/g, ' ').trim(), r: e.getBoundingClientRect().toJSON() }));
    check(`${w}: tracker shows the first free-play goal`, !tracker.hidden && /first dinosaur/.test(tracker.text) && /0\/5 done/.test(tracker.text), tracker);
    await page.screenshot({ path: `${out}${w}-tracker.png` });
    await tap('#goal-tracker');
    const rows = await page.$$eval('#park-body .goal', (g) => g.length);
    check(`${w}: Park report lists the five goals`, rows === 5, rows);
    await page.screenshot({ path: `${out}${w}-goals-tab.png` });
    await page.close();
  }
} finally { await browser.close(); }
finish(errors);
