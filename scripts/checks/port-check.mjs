// The ferry port: jetty, pier and harbor, ferries sailing in and docking, passengers walking ashore,
// the Port tab in the Park report, and tapping the pier.
// Usage: node port-check.mjs   (BASE_URL=http://localhost:5180 for another dev server, ART_STYLE=cartoon)
import puppeteer from 'puppeteer-core';
import { HERE, check, finish, gameUrl, ready } from './lib.mjs';
const OUT = HERE + 'tour/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(gameUrl('/?quickstart&seed=7'), { waitUntil: 'load' });
await ready(page);
await sleep(1500);

/** Sets the port and the clock (hour of day 1 plus steps), centres on the port and reports what is on screen. */
const show = (setup) =>
  page.evaluate(async ({ level, ferries, hour, step, loads }) => {
    const { sim, game } = window.__dino;
    sim.setSpeed(0);
    const s = sim.state;
    s.port.level = level;
    s.port.ferries = ferries;
    s.port.loads = loads ?? ferries.map(() => 0);
    s.hours = hour - 8;
    s.stepInHour = step;
    const scene = game.scene.getScene('park');
    scene.update(game.loop.now, 16);
    const site = scene.port.site;
    const cam = scene.cameras.main;
    cam.setZoom(3);
    cam.centerOn((site.x + 0.5) * 16, (site.y1 + 1.5) * 16);
    await new Promise((r) => setTimeout(r, 300));
    const visible = (list) => list.filter((i) => i.visible).length;
    return { ferries: visible(scene.port.ferries), walkers: visible(scene.port.walkers), props: scene.port.props.length, site };
  }, setup);

const shots = [
  ['jetty-arriving', { level: 0, ferries: ['medium'], hour: 11, step: 14 }],
  ['jetty-docked', { level: 0, ferries: ['medium'], hour: 12, step: 1, loads: [9] }],
  ['pier-two-ferries', { level: 1, ferries: ['large', 'medium'], hour: 12, step: 7 }],
  ['pier-landing', { level: 1, ferries: ['large', 'large'], hour: 12, step: 9, loads: [12, 12] }],
  ['harbor', { level: 2, ferries: ['large', 'large', 'small'], hour: 12, step: 1, loads: [12, 0, 0] }],
  ['harbor-night', { level: 2, ferries: ['large', 'large', 'large'], hour: 22, step: 0 }],
];
const seen = {};
for (const [name, setup] of shots) {
  seen[name] = await show(setup);
  console.log(name, JSON.stringify(seen[name]));
  await page.screenshot({ path: `${OUT}port-${name}.png` });
}
check('a ferry sails in to the jetty', seen['jetty-arriving'].ferries === 1);
check('passengers walk ashore from a docked ferry', seen['jetty-docked'].walkers > 3, seen['jetty-docked']);
check('two ferries share the pier timetable', seen['pier-two-ferries'].ferries === 2, seen['pier-two-ferries']);
check('a pier has a ticket hut and a harbor a lighthouse too', seen['pier-two-ferries'].props === 1 && seen.harbor.props === 2);
check('only the first ferry stays overnight', seen['harbor-night'].ferries === 1, seen['harbor-night']);

// Tapping the pier offers the Port, which opens the Park report there.
await page.evaluate(async () => {
  const { sim, game } = window.__dino;
  sim.state.port.level = 0;
  sim.state.port.ferries = ['medium'];
  sim.state.money = 60000;
  sim.state.hours = 4;
  const scene = game.scene.getScene('park');
  scene.update(game.loop.now, 16);
  await new Promise((r) => setTimeout(r, 200));
});
const tap = await page.evaluate(() => {
  const scene = window.__dino.game.scene.getScene('park');
  const site = scene.port.site;
  const cam = scene.cameras.main;
  const p = cam.getWorldPoint(0, 0);
  const x = ((site.x + 0.5) * 16 - p.x) * cam.zoom;
  const y = ((site.y0 + 0.5) * 16 - p.y) * cam.zoom;
  return { x, y };
});
await page.touchscreen.tap(tap.x, tap.y);
await sleep(700);
const info = await page.evaluate(() => document.getElementById('info')?.textContent ?? '');
check('tapping the pier names the ferry port', /Ferry port/.test(info), info.trim().slice(0, 80));
const portButton = await page.$('#info button:not(.hidden)');
if (portButton) await portButton.tap();
await sleep(500);
const tab = await page.evaluate(() => ({
  open: !document.getElementById('park').classList.contains('hidden'),
  active: document.querySelector('#park .tab-btn.active')?.dataset.tab,
  overflow: document.getElementById('park-body').scrollWidth - document.getElementById('park-body').clientWidth,
}));
check('the Port button opens the Port tab', tab.open && tab.active === 'port', tab);
check('the Port tab fits without sideways scrolling', tab.overflow <= 1, tab);
await page.screenshot({ path: `${OUT}port-tab.png` });
// The report refreshes every second, so press buttons through the page rather than holding a handle.
const press = (sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
await press('[data-port-up]');
await sleep(300);
const after = await page.evaluate(() => ({ level: window.__dino.sim.state.port.level, berths: document.querySelectorAll('[data-ferry-buy]:not([disabled])').length }));
check('building a pier from the Port tab', after.level === 1 && after.berths > 0, after);
await press('[data-ferry-buy="large"]');
await sleep(300);
const fleet = await page.evaluate(() => window.__dino.sim.state.port.ferries);
check('buying a big ferry from the Port tab', fleet.join() === 'medium,large', fleet);
await page.screenshot({ path: `${OUT}port-tab-pier.png` });
await page.evaluate(() => {
  document.querySelector('#park-body').scrollTop = 1000;
});
await sleep(200);
await page.screenshot({ path: `${OUT}port-tab-ferries.png` });
finish(errors);
await browser.close();
