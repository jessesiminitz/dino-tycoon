// The Dinos & people button: one top-bar button opens a sheet with the Dino book and People, each opening
// its own panel; the sticker badge shows on the button; ☰ keeps only save, settings and the main menu.
// Phones sideways (they are always held so), iPad both ways up. Run with the dev server up (npm run dev).
import puppeteer from 'puppeteer-core';
import { HERE, check, finish, ready, gameUrl } from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [W, H] of [[844, 390], [667, 375], [568, 320], [820, 1180], [1180, 820]]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(gameUrl('/?quickstart'), { waitUntil: 'load' }); await ready(page); await sleep(800);
  const tap = async (sel) => { await (await page.waitForSelector(sel, { visible: true })).tap(); await sleep(300); };
  const visible = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return !el.closest('.hidden') && r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
  const size = `${W}×${H}`;
  check(`${size}: the Dinos button is on the top bar, on screen`, await visible('#btn-folks'));
  check(`${size}: ☰ still fits beside it`, await visible('#btn-menu'));
  await tap('#btn-folks');
  check(`${size}: it opens the sheet with the Dino book and People`, await visible('#btn-book') && await visible('#btn-people'));
  await page.screenshot({ path: `${HERE}folks-1-sheet-${W}.png` });
  await tap('#btn-people');
  check(`${size}: People opens the people panel, and the sheet closes`, await page.$eval('#folks', (el) => el.classList.contains('hidden')) && await page.$$eval('.modal:not(.hidden)', (m) => m.length === 1));
  await page.screenshot({ path: `${HERE}folks-2-people-${W}.png` });
  await page.evaluate(() => document.querySelectorAll('.modal:not(.hidden) .modal-close').forEach((b) => b.click())); await sleep(250);
  await tap('#btn-folks'); await tap('#btn-book');
  check(`${size}: the Dino book opens`, await page.$$eval('.modal:not(.hidden)', (m) => m.length === 1 && !!m[0].querySelector('.book-tabs')));
  await page.evaluate(() => document.querySelectorAll('.modal:not(.hidden) .modal-close').forEach((b) => b.click())); await sleep(250);
  await tap('#btn-folks');
  await page.touchscreen.tap(6, H - 6); await sleep(300);
  check(`${size}: tapping outside closes the sheet`, await page.$eval('#folks', (el) => el.classList.contains('hidden')));
  // a new sticker's badge shows on the top-bar button
  await page.evaluate(() => { const b = document.getElementById('stickers-badge'); b.textContent = '2'; b.classList.remove('hidden'); }); await sleep(100);
  check(`${size}: the sticker badge shows on the Dinos button`, await page.$eval('#folks-badge', (b) => !b.classList.contains('hidden') && b.textContent === '2'));
  await tap('#btn-menu');
  check(`${size}: ☰ no longer holds People or the Dino book`, await page.$$eval('#pause button', (bs) => bs.every((b) => !/People|Dino book/.test(b.textContent))));
  await tap('#pause [data-pause="resume"]');
  await page.close();
}
await browser.close();
finish(errors);
