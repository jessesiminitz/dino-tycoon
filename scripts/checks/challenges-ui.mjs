// Challenges: menu folders (locked and open), story card, goal tracker, loose dinos, and the money report.
import puppeteer from 'puppeteer-core';
import { HERE, check, finish } from './lib.mjs';
const OUT = HERE + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const shot = (name) => page.screenshot({ path: `${OUT}${w}-ch-${name}.png` });
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(500); };
const report = (label) => page.evaluate((label) => {
  const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden || e.classList.contains('hidden')) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const card = r('.modal:not(.hidden) .modal-card');
  return `${label}: tracker ${JSON.stringify(r('#goal-tracker'))} card ${JSON.stringify(card)} fits ${card ? card[1] >= 0 && card[1] + card[3] <= innerHeight : '-'}`;
}, label);

for (const unlocked of [false, true]) {
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  // Unlocked: a Bronze in every challenge, so each one (whatever the order) is open.
  await page.evaluate(async (u) => {
    localStorage.clear();
    const { CHALLENGE_IDS } = await import('/src/sim/data/scenarios.ts');
    if (u) localStorage.setItem('dino-tycoon-challenges', JSON.stringify(Object.fromEntries(CHALLENGE_IDS.map((id) => [id, 1]))));
  }, unlocked);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await sleep(700);
  await click('[data-go="new"]');
  if (!unlocked) await shot('0-builds');
  await click('[data-folder="challenges"]');
  await shot(`1-challenges-${unlocked ? 'unlocked' : 'locked'}`);
  const locks = await page.$$eval('.locked-tag', (t) => t.length);
  check(`challenges ${unlocked ? 'all open' : 'locked after the first'}`, unlocked ? locks === 0 : locks > 0, `${locks} locked`);
}
// Start The Great Escape.
await click('[data-scenario="great-escape"]');
await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1500);
console.log(await report('briefing'));
await shot('2-briefing');
await click('#briefing [data-go]'); await sleep(800);
check('The Great Escape started', (await page.evaluate(() => window.__dino?.sim.state.scenario.id)) === 'great-escape');
await page.evaluate(() => window.__dino.sim.setSpeed(0));
console.log(await report('park'));
await shot('3-park');
await page.evaluate(() => { const cam = window.__dino.game.scene.getScene('park').cameras.main; const { x, y } = window.__dino.sim.state.entrance; cam.setZoom(2); cam.centerOn(x * 16, (y - 7) * 16); });
await sleep(600);
await shot('4-loose-dinos');
// The Money Pit's money report.
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await sleep(600);
await click('[data-go="new"]'); await click('[data-folder="challenges"]');
await click('[data-scenario="money-pit"]');
await page.evaluate(() => document.querySelector('[data-use]')?.click()); await sleep(1800);
await click('#briefing [data-go]');
check('The Money Pit started', (await page.evaluate(() => window.__dino?.sim.state.scenario.id)) === 'money-pit');
await page.evaluate(() => window.__dino.sim.setSpeed(0));
await click('#btn-park');
await click('#park [data-tab="finances"]');
console.log(await report('finances'));
await shot('5-money');
await click('#park [data-tab="overview"]');
await page.evaluate(() => document.querySelector('#park-body').scrollTop = 9999); await sleep(200);
await shot('6-close-gates');
finish(errors);
await browser.close();
