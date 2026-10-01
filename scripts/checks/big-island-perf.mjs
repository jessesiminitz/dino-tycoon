// Rough frame-time comparison: a normal and a big island, zoomed out, at 8× speed with a busy park.
import puppeteer from 'puppeteer-core';
import { ready } from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const big of [false, true]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:5173/?quickstart&shape=river&seed=7${big ? '&big' : ''}`, { waitUntil: 'load' }); await ready(page);
  await sleep(1500);
  const r = await page.evaluate(async () => {
    const { sim, game } = window.__dino;
    const cam = game.scene.getScene('park').cameras.main;
    cam.setZoom(cam.zoom * 0.5);
    const t0 = performance.now();
    for (let i = 0; i < 16 * 24; i++) sim.step();
    const stepMs = (performance.now() - t0) / (16 * 24);
    sim.setSpeed(8);
    const frames = [];
    let last = performance.now();
    await new Promise((res) => {
      const tick = (t) => { frames.push(t - last); last = t; if (frames.length < 180) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
    frames.sort((a, b) => a - b);
    return { map: `${sim.state.map.width}x${sim.state.map.height}`, stepMs: stepMs.toFixed(3), medianFrame: frames[90].toFixed(1), p95Frame: frames[171].toFixed(1) };
  });
  console.log(JSON.stringify(r));
  await page.close();
}
await browser.close();
