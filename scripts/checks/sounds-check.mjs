// Every species' call, the cheer, splash and flap, and the ambience switching, with no errors.
import puppeteer from 'puppeteer-core';
import { finish, ready } from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' }); await ready(page);
await sleep(1200);
await page.touchscreen.tap(420, 250); // unlock audio
await sleep(500);
const result = await page.evaluate(async () => {
  const audio = await import('/src/audio/audio.ts');
  const { SPECIES_IDS } = await import('/src/sim/data/species.ts');
  const played = [];
  for (const id of SPECIES_IDS) {
    audio.playCall(id, false);
    await new Promise((r) => setTimeout(r, 380));
    audio.playCall(id, true);
    await new Promise((r) => setTimeout(r, 380));
    played.push(id);
  }
  for (const s of ['cheer', 'splash', 'flap']) {
    audio.playSfx(s);
    await new Promise((r) => setTimeout(r, 200));
  }
  audio.setAmbience('day');
  await new Promise((r) => setTimeout(r, 2500));
  audio.setAmbience('night');
  await new Promise((r) => setTimeout(r, 2500));
  audio.setAmbience('off');
  return { played: played.length, state: window.__dino.audioDebug()?.state };
});
console.log(result);
finish(errors);
await browser.close();
