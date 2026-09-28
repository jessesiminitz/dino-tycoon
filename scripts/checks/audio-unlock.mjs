// With the browser's "sound only after a gesture" rule on: a tap or a drag on the map (not a button) starts the music.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
const errors = [];
for (const how of ['tap', 'drag']) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
  await sleep(1200);
  const before = await page.evaluate(() => window.__dino.audioDebug()?.state ?? 'no audio yet');
  if (how === 'tap') await page.touchscreen.tap(420, 250);
  else {
    await page.touchscreen.touchStart(420, 250);
    for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(420 - i * 15, 250);
    await page.touchscreen.touchEnd();
  }
  await sleep(800);
  const after = await page.evaluate(() => window.__dino.audioDebug());
  console.log(`${how} on the map: before=${before} after=${after?.state} song=${after?.song?.title ?? '-'} note=${after?.song?.note ?? '-'}`);
  await page.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
