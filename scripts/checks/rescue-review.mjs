import puppeteer from 'puppeteer-core';
import { check, finish, ready, gameUrl } from './lib.mjs';
import { mkdir } from 'node:fs/promises';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
await mkdir('docs/rescue-review', { recursive: true });
try {
  for (const [width, height] of [[667,375], [844,390]]) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(gameUrl('/?quickstart'), { waitUntil: 'load' });
    await ready(page);
    const id = await page.evaluate(async () => {
      const { newPark } = await import('/src/sim/challenges.ts');
      const { sim, game } = window.__dino;
      sim.state = newPark('great-escape', 1); sim.worldRevision++; sim.setSpeed(0);
      const d = sim.state.dinos.find(d => d.species === 'velociraptor');
      const sc = game.scene.getScene('park');
      sc.entities.selection = { kind: 'dino', id: d.id }; sc.showSelection();
      sc.cameras.main.centerOn(d.x * 16, d.y * 16);
      return d.id;
    });
    const rescue = await page.waitForSelector('#info-action', { visible: true });
    check(`rescue disabled before lure ${width}`, await rescue.evaluate(b => b.disabled));
    await (await page.$('#info-actions button:first-child')).tap();
    check(`rescue enabled after lure ${width}`, await page.$eval('#info-action', b => !b.disabled));
    const bounds = await page.$$eval('#info-actions button', buttons => buttons.map(b => {const r = b.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, w:r.width, h:r.height };}));
    check(`phone controls fit ${width}`, bounds.every(b => b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height && b.h >= 40), bounds);
    await page.screenshot({ path: `docs/rescue-review/lured-${width}.png` });
    await (await page.$('#info-action')).tap();
    check(`tap transports dinosaur home ${width}`, await page.evaluate(id => {const d=window.__dino.sim.state.dinos.find(d=>d.id===id); return !d.escaped && d.x===d.homeX && d.y===d.homeY;}, id));
    await page.close();
  }
  finish(errors);
} finally { await browser.close(); }
