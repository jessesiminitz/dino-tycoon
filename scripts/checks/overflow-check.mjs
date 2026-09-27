// Measures whether menus and alerts fit on phone screens and don't collide with buttons.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const tag = process.argv[2] ?? 'before';
for (const [w, h] of [[667, 375], [844, 390]]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'networkidle0' });
  await sleep(600);
  // Pause menu with settings open.
  await (await page.$('#btn-menu')).tap(); await sleep(200);
  await (await page.$('[data-pause="settings"]')).tap(); await sleep(200);
  const pause = await page.evaluate(() => {
    const card = document.querySelector('#pause .modal-card').getBoundingClientRect();
    const last = [...document.querySelectorAll('#pause .menu-btn')].pop().getBoundingClientRect();
    const card2 = document.querySelector('#pause .modal-card');
    return { vh: innerHeight, cardTop: Math.round(card.top), cardBottom: Math.round(card.bottom), lastButtonBottom: Math.round(last.bottom), scrollable: card2.scrollHeight > card2.clientHeight };
  });
  const lastVisible = pause.lastButtonBottom <= pause.vh || pause.scrollable;
  console.log(`${w}x${h} pause+settings: ${JSON.stringify(pause)} -> ${lastVisible ? 'OK' : 'SPILLS OFF SCREEN'}`);
  await page.screenshot({ path: `${OUT}overflow-pause-${tag}-${w}.png` });
  await (await page.$('[data-pause="resume"]')).tap(); await sleep(200);
  // Alerts: fire the update banner plus several toasts, then check overlaps with buttons/panels.
  const alerts = await page.evaluate(async () => {
    const { offerUpdate } = await import('/src/ui/overlays.ts');
    offerUpdate(() => {});
    const { sim } = window.__dino;
    sim.dispatch({ type: 'hireStaff', role: 'worker' });
    for (const t of ['🚨 Rex the Tyrannosaurus rex has escaped!', '⛈️ A storm is rolling in! Fences will take a beating and fewer visitors will come.', '🦴 Fossil find: an Ankylosaurus skull fragment (1/4)']) {
      (sim).eventListeners?.forEach?.((fn) => fn({ text: t, kind: 'bad' }));
    }
    await new Promise((r) => setTimeout(r, 400));
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const alertEls = [document.getElementById('update-banner'), ...document.querySelectorAll('.toast')].filter((e) => e && !e.classList.contains('hidden') && e.offsetParent !== null);
    const others = [...document.querySelectorAll('#hud .hud-group, .toolbar .hud-group:not(.hidden), #info:not(.hidden), #tutorial:not(.hidden)')];
    const clashes = [];
    alertEls.forEach((a, i) => {
      for (const o of others) if (overlap(rect(a), rect(o))) clashes.push(`${a.id || 'toast' + i} x ${o.id || o.className}`);
      alertEls.forEach((b, j) => { if (j > i && overlap(rect(a), rect(b))) clashes.push(`${a.id || 'toast' + i} x ${b.id || 'toast' + j}`); });
    });
    return { alerts: alertEls.length, clashes };
  });
  console.log(`${w}x${h} alerts: ${JSON.stringify(alerts)}`);
  await page.screenshot({ path: `${OUT}overflow-alerts-${tag}-${w}.png` });
}
await browser.close();
