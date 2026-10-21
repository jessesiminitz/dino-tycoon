// The park through the year: thaw, blossom, summer, turning leaves, bare trees and snow.
// Usage: node seasons-check.mjs   (BASE_URL=http://localhost:5180 for another dev server)
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

// Year-days (0 = midnight starting spring) worth a look, all at midday.
const moments = [
  ['opening-day', null],
  ['early-spring-thaw', 1.5],
  ['spring-blossom', 4.5],
  ['summer', 10.5],
  ['fall-turning', 15.5],
  ['fall-colour', 17.5],
  ['late-fall-first-snow', 20.5],
  ['winter', 24.5],
];
const centre = await page.evaluate(() => {
  const { sim, game } = window.__dino;
  sim.setSpeed(0);
  const s = sim.state;
  const W = s.map.width;
  // Look at the forest nearest the gate, so trees fill the view.
  let best = -1, bestD = Infinity;
  s.map.tiles.forEach((t, i) => {
    if (t !== 4) return;
    const d = Math.hypot((i % W) - s.entrance.x, Math.floor(i / W) - s.entrance.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  const cam = game.scene.getScene('park').cameras.main;
  cam.setZoom(3);
  cam.centerOn((best % W) * 16, Math.floor(best / W) * 16);
  return { x: best % W, y: Math.floor(best / W) };
});
console.log('forest near', JSON.stringify(centre));

for (const [name, t] of moments) {
  const info = await page.evaluate(async (t) => {
    const { sim, game } = window.__dino;
    const start = sim.state.hours;
    if (t !== null) sim.state.hours = Math.round((t - 3) * 24 - 8 + 28 * 24 * 2);
    const scene = game.scene.getScene('park');
    const before = performance.now();
    scene.update(game.loop.now, 16);
    const ms = performance.now() - before;
    await new Promise((r) => setTimeout(r, 400));
    const keys = [...scene.scenery.trees.values()].map((img) => img.getData('rootTexture') ?? img.texture.key);
    const snowLayer = scene.seasons.snow;
    let snowTiles = 0;
    snowLayer.forEachTile((tile) => { if (tile.index >= 0) snowTiles++; });
    const result = {
      hours: sim.state.hours,
      clock: document.getElementById('hud-clock').textContent,
      seasonal: keys.filter((k) => k.includes('~')).length,
      looks: [...new Set(keys.map((k) => k.split('~')[1] ?? 'green'))].sort(),
      snowVisible: snowLayer.visible,
      snowTiles,
      dressMs: Math.round(ms),
    };
    if (t === null) sim.state.hours = start;
    return result;
  }, t);
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}season-${name}.png` });
  if (name === 'opening-day') {
    check('a new park opens without snow', !info.snowVisible && info.snowTiles === 0, info);
    check('the clock shows the season', /^🌸/.test(info.clock), info.clock);
  }
  if (name === 'summer') check('summer is full green', info.seasonal === 0 && !info.snowVisible, info);
  if (name === 'fall-colour') check('fall turns the leaves', info.looks.some((l) => l.startsWith('autumn')), info);
  if (name === 'winter') {
    check('winter is snowy', info.snowVisible && info.snowTiles > 100, info);
    check('winter trees are bare or snowy', info.looks.some((l) => l.startsWith('bare')) && info.looks.includes('evergreen-snow'), info);
  }
  if (name === 'spring-blossom') check('spring snow has melted and leaves sprout', !info.snowVisible && info.looks.some((l) => /^(blossom|fresh)/.test(l)), info);
}

// Turning the scenery off brings summer back at once.
const off = await page.evaluate(async () => {
  const { game } = window.__dino;
  const { updateSettings } = await import('/src/ui/settings.ts');
  updateSettings({ seasonScenery: false });
  const scene = game.scene.getScene('park');
  scene.update(game.loop.now, 16);
  const keys = [...scene.scenery.trees.values()].map((img) => img.getData('rootTexture') ?? img.texture.key);
  const result = { seasonal: keys.filter((k) => k.includes('~')).length, snow: scene.seasons.snow.visible };
  updateSettings({ seasonScenery: true });
  return result;
});
check('the Season scenery setting turns it off', off.seasonal === 0 && !off.snow, off);
await page.screenshot({ path: `${OUT}season-off.png` });
// Every plant in every look, enlarged, for reviewing the artwork.
const gallery = await page.evaluate(async () => {
  const art = await import('/src/render/sceneryArt.ts');
  const { paintSeasonalPlant } = await import('/src/render/seasonArt.ts');
  const plants = [['conifer', art.paintConifer], ['broadleaf', art.paintBroadleaf], ['cycad', art.paintCycad], ['treefern', art.paintTreeFern], ['giant', art.paintGiant], ['palm', art.paintPalm], ['bush', art.paintBush], ['reeds', art.paintReeds]];
  const looks = ['green', 'bare-gold-snow', 'buds-gold', 'blossom-gold', 'fresh-gold', 'turning-orange', 'autumn-gold', 'autumn-orange', 'autumn-red', 'falling-red', 'bare-gold', 'evergreen-snow', 'reeds-golden', 'reeds-golden-snow'];
  const S = 5, CW = 24 * S, CH = 42 * S;
  const c = document.createElement('canvas');
  c.width = looks.length * CW; c.height = plants.length * CH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#6fa64d'; ctx.fillRect(0, 0, c.width, c.height);
  plants.forEach(([, paint], r) => looks.forEach((look, col) => {
    const src = paint(7);
    const img = paintSeasonalPlant(src, look, 1, 11);
    ctx.drawImage(img, col * CW + (CW - img.width * S) / 2, r * CH + CH - img.height * S, img.width * S, img.height * S);
  }));
  return c.toDataURL();
});
const { writeFileSync } = await import('node:fs');
writeFileSync(`${OUT}season-gallery.png`, Buffer.from(gallery.split(',')[1], 'base64'));
finish(errors);
await browser.close();
