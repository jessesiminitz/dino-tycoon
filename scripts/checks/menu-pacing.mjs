import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish, gameUrl, ready } from './lib.mjs';

const out = new URL('../../docs/art-review/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameUrl('/'), { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('.menu-parade img')].every(img => img.complete && img.naturalWidth));
  for (const [width, height] of [[390, 844], [667, 375], [844, 390], [820, 1180], [7680, 1080]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.waitForFunction(() => {
      const track = document.querySelector('.menu-parade-track');
      const row = document.querySelector('.menu-parade-group');
      return Math.abs(parseFloat(track.style.animationDuration) * 30 - row.getBoundingClientRect().width) < 0.05;
    });
    const result = await page.evaluate(() => {
      const track = document.querySelector('.menu-parade-track');
      const animation = track.getAnimations()[0];
      animation.pause();
      const duration = animation.effect.getTiming().duration;
      let minGap = Infinity;
      let covered = true;
      // Sweep the entire loop, including immediately before and after its seam.
      for (const phase of [...Array.from({ length: 101 }, (_, i) => i / 100), 0.999999, 1.000001]) {
        animation.currentTime = duration * phase;
        const rects = [...track.querySelectorAll('img')].map(img => img.getBoundingClientRect()).sort((a, b) => a.left - b.left);
        for (let i = 1; i < rects.length; i++) minGap = Math.min(minGap, rects[i].left - rects[i - 1].right);
        covered &&= rects.some(rect => rect.right > 0 && rect.left < innerWidth);
      }
      animation.currentTime = 0;
      const before = track.getBoundingClientRect().left;
      animation.currentTime = 500;
      const movement = track.getBoundingClientRect().left - before;
      const rows = [...track.children];
      return { minGap, covered, movement, species: rows[0].childElementCount, identical: [...rows[0].querySelectorAll('.menu-dino')].map(b=>b.dataset.species).join() === [...rows[1].querySelectorAll('.menu-dino')].map(b=>b.dataset.species).join(), fits: document.documentElement.scrollWidth === innerWidth };
    });
    check(`parade has 48px gaps throughout the loop at ${width}×${height}`, result.minGap >= 47.9 && result.covered && result.fits, result);
    check('all 28 species move right together at 30px/s with a matching loop', result.species === 28 && result.identical && Math.abs(result.movement - 15) < 0.1);
    if (width === 844) await page.screenshot({ path: fileURLToPath(new URL('parade-spaced-phone.png', out)) });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  check('reduced motion stops the decorative parade', await page.$eval('.menu-parade-track', el => getComputedStyle(el).animationName === 'none'));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  await page.keyboard.press('Tab');
  await page.evaluate(()=>document.querySelectorAll('.menu-parade-group:first-child .menu-dino')[10].focus());
  await page.keyboard.press('Enter');
  const keyboard=await page.evaluate(()=>{const b=document.activeElement,r=b.getBoundingClientRect();return b.classList.contains('menu-dino')&&!!b.dataset.reaction&&r.left>=0&&r.right<=innerWidth&&document.querySelectorAll('.menu-dino:not([tabindex="-1"])').length===28;});
  check('keyboard brings each dinosaur into view and activates its reaction without duplicate tab stops',keyboard);

  await page.click('[data-go="settings"]');
  check('decorative parade stays off the settings screen',await page.$eval('.menu-parade',el=>getComputedStyle(el).display==='none'));
  await page.click('[data-go="main"]');
  check('parade returns on the title screen',await page.$eval('.menu-parade',el=>getComputedStyle(el).display!=='none'));

  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await page.goto(gameUrl('/?quickstart&stress'), { waitUntil: 'load' });
  await ready(page);
  const night = await page.evaluate(() => {
    const { sim, game } = window.__dino;
    game.loop.sleep();
    const scene = game.scene.getScene('park');
    sim.state.hours = 13;
    sim.state.stepInHour = 0;
    sim.accumulator = 0;
    sim.setSpeed(1);
    const label = document.getElementById('hud-clock').getAttribute('aria-label');
    // The one play button shows the chosen speed (▶ 1×, ▶▶ 3×, ▶▶▶ 8×).
    const selected = { '▶': '1', '▶▶': '3', '▶▶▶': '8' }[document.getElementById('btn-speed').textContent];
    let time = game.loop.now;
    scene.entities.update(time);
    const animalBefore = scene.entities.animalTime;
    const worldBefore = scene.worldTime;
    for (let i = 0; i < 80; i++) scene.update(time += 125, 125);
    const hours = sim.state.hours;
    const animalElapsed = scene.entities.animalTime - animalBefore;
    const worldElapsed = scene.worldTime - worldBefore;
    sim.setSpeed(0);
    const pausedHours = sim.state.hours;
    scene.update(time += 125, 125);
    const paused = sim.state.hours === pausedHours && scene.entities.animalTime - animalBefore === animalElapsed && scene.worldTime - worldBefore === worldElapsed;
    sim.state.hours = 21;
    sim.state.stepInHour = 0;
    sim.accumulator = 0;
    sim.setSpeed(1);
    const dawnLabel = document.getElementById('hud-clock').getAttribute('aria-label');
    for (let i = 0; i < 80; i++) scene.update(time += 125, 125);
    const hud = document.getElementById('hud').getBoundingClientRect();
    const menu = document.getElementById('btn-menu').getBoundingClientRect();
    return { hours, animalElapsed, worldElapsed, selected, label, paused, dawnHours: sim.state.hours, dawnLabel, fits: hud.left >= 0 && hud.right <= innerWidth && menu.right <= innerWidth };
  });
  check('night clock, animal and environment clocks advance together at 3×', night.hours === 16 && Math.abs(night.animalElapsed - 30_000) < 0.001 && Math.abs(night.worldElapsed - 30_000) < 0.001, night);
  check('normal speed stays selected and nighttime acceleration is accessible', night.selected === '1' && night.label.includes('3× speed until 05:00'));
  check('pause freezes the night and dawn restores daytime pacing', night.paused && night.dawnHours === 22 && !night.dawnLabel.includes('Night') && night.fits);
  finish(errors);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  let timer;
  await Promise.race([browser.close(), new Promise(resolve => {
    timer = setTimeout(() => { browser.disconnect(); browser.process()?.kill('SIGKILL'); resolve(); }, 10_000);
  })]);
  clearTimeout(timer);
}
process.exit(process.exitCode ?? 0);
