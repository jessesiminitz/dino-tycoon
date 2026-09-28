// A fossil find: the Dig! button, the sand pit, brushing it clear, the reveal.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '667x375').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
await sleep(1200);
// Fake a find the way the dig site reports one.
await page.evaluate(() => {
  const { sim } = window.__dino; sim.setSpeed(1);
  sim.state.fossils.triceratops = 0;
  sim.emitEvent?.({ text: '🦴 Fossil find: a Triceratops thigh bone (3/5)', kind: 'good', fossil: { species: 'triceratops', bone: 'thigh bone', have: 3, needed: 5, unlocked: false } });
});
await sleep(300);
const btn = await page.evaluate(() => { const b = document.getElementById('dig-btn'); const r = b.getBoundingClientRect(); return { hidden: b.classList.contains('hidden'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width)] }; });
console.log('dig button:', btn);
await page.screenshot({ path: `${OUT}dig-0-button-${W}.png` });
await (await page.$('#dig-btn')).tap(); await sleep(400);
console.log('paused:', await page.evaluate(() => window.__dino.sim.speed === 0));
await page.screenshot({ path: `${OUT}dig-1-sand-${W}.png` });
// Brush back and forth over the pit with a finger.
const box = await (await page.$('.dig-sand')).boundingBox();
const client = await page.createCDPSession();
const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
let revealed = false;
for (let row = 0; row < 14 && !revealed; row++) {
  const y = box.y + ((row + 0.5) / 14) * box.height;
  await touch('touchStart', box.x + 4, y);
  for (let i = 1; i <= 12; i++) await touch('touchMove', box.x + (box.width - 8) * (i / 12) + 4, y);
  await touch('touchEnd');
  if (row === 5) await page.screenshot({ path: `${OUT}dig-2-brushing-${W}.png` });
  revealed = await page.evaluate(() => !document.querySelector('.dig-done').classList.contains('hidden'));
}
await sleep(900);
console.log('revealed:', revealed, '| caption:', await page.$eval('.dig-caption', (e) => e.textContent));
await page.screenshot({ path: `${OUT}dig-3-reveal-${W}.png` });
await (await page.$('.dig-done')).tap(); await sleep(300);
console.log('closed & resumed:', await page.evaluate(() => ({ hidden: document.getElementById('dig').classList.contains('hidden'), speed: window.__dino.sim.speed, btn: document.getElementById('dig-btn').classList.contains('hidden') })));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
