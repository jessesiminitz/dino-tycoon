// Popups and pausing (audit B08–B10): closing the ☰ menu or a decision card keeps a park the player
// paused, paused; with a decision and an outcome both open, closing one leaves the park paused.
// Exits non-zero on a wrong speed or a page error.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1500);

const failures = [];
const speed = () => page.evaluate(() => window.__dino.sim.speed);
async function expectSpeed(label, want) {
  const got = await speed();
  console.log(`${got === want ? 'ok  ' : 'FAIL'} ${label}: speed ${got} (want ${want})`);
  if (got !== want) failures.push(label);
}
const click = (sel) => page.$eval(sel, (el) => el.click());
/** Puts a decision card up (a TV crew asks about a dinosaur). */
const pendChoice = () =>
  page.evaluate(() => {
    const { sim } = window.__dino;
    const s = sim.state;
    s.money = 1e6;
    s.parcelsOwned = s.parcelsOwned.map(() => true);
    const { x: ex, y: ey } = s.entrance;
    if (!s.dinos.length) {
      const A = { x: ex - 4, y: ey - 10 }, C = { x: ex + 4, y: ey - 4 };
      const edges = [];
      for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
      for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
      sim.dispatch({ type: 'buildFences', edges, fence: 2 });
      sim.dispatch({ type: 'buyDino', species: 'triceratops', x: A.x + 3, y: A.y + 3 });
    }
    s.pendingChoice = { eventId: 'tv', dinoId: s.dinos[0].id, createdHour: s.hours + Math.random(), expiresHour: s.hours + 4 };
    sim.setSpeed(sim.speed); // let the card notice
  });

// B08: pause, open ☰, Resume.
await click('.speed-btn[data-speed="0"]');
await click('#btn-menu');
await expectSpeed('☰ open', 0);
await click('[data-pause="resume"]');
await expectSpeed('B08 ☰ Resume after the player paused', 0);
// …and from 3×, Resume goes back to 3×.
await click('.speed-btn[data-speed="3"]');
await click('#btn-menu');
await click('[data-pause="resume"]');
await expectSpeed('☰ Resume after 3×', 3);

// B09: paused, a decision pops up, Decide later.
await click('.speed-btn[data-speed="0"]');
await pendChoice();
await sleep(300);
const shown = await page.$eval('#choice', (el) => !el.classList.contains('hidden'));
if (!shown) failures.push('decision card did not open');
await click('.choice-later');
await expectSpeed('B09 Decide later after the player paused', 0);

// B10: at 1×, a decision and an outcome both open; close the outcome first.
await click('.speed-btn[data-speed="1"]');
await page.evaluate(() => (window.__dino.sim.state.pendingChoice = null));
await pendChoice();
await sleep(300);
await page.evaluate(async () => {
  const { showOutcome } = await import('/src/ui/overlays.ts');
  showOutcome(window.__dino.sim, 'lost', () => {});
});
await expectSpeed('decision + outcome open', 0);
await click('#outcome [data-outcome="keep"]');
await expectSpeed('B10 outcome closed, decision still open', 0);
await click('.choice-later');
await expectSpeed('both closed', 1);

if (errors.length) console.log('page errors:', errors);
await browser.close();
if (failures.length || errors.length) {
  console.log(`\n${failures.length} failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('\nall pause checks passed');
