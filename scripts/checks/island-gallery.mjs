// A sheet of generated islands: every shape, several seeds each. Usage: node island-gallery.mjs [seeds=5] [big]
import puppeteer from 'puppeteer-core';
import { HERE } from './lib.mjs';
const OUT = HERE;
const seeds = Number(process.argv[2] ?? 5);
const big = process.argv[3] === 'big';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1200 });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
const stats = await page.evaluate(async (seeds, big) => {
  const { newGame } = await import('/src/sim/GameState.ts');
  const { ISLAND_SHAPE_IDS, ISLAND_SHAPES } = await import('/src/sim/island.ts');
  const { paintMinimap } = await import('/src/render/minimap.ts');
  const { Terrain } = await import('/src/sim/terrain.ts');
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#222;color:#fff;font:14px sans-serif';
  const out = [];
  for (const shape of ISLAND_SHAPE_IDS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:6px';
    row.innerHTML = `<b style="width:110px">${ISLAND_SHAPES[shape].name}</b>`;
    for (let k = 0; k < seeds; k++) {
      const t0 = performance.now();
      const s = newGame(1000 + k * 7919, { shape, big });
      const ms = performance.now() - t0;
      const c = paintMinimap(s.map, s.entrance);
      c.style.cssText = `width:${big ? 240 : 256}px;image-rendering:pixelated`;
      row.appendChild(c);
      const count = (t) => s.map.tiles.filter((x) => x === t).length;
      out.push(`${shape} ${k}: ${Math.round(ms)}ms river ${count(Terrain.River)} falls ${count(Terrain.Waterfall)} cliff ${count(Terrain.Cliff)} marsh ${count(Terrain.Marsh)} lava ${count(Terrain.LavaRock)} spring ${count(Terrain.HotSpring)} lake ${count(Terrain.Pond)}`);
    }
    document.body.appendChild(row);
  }
  return out;
}, seeds, big);
console.log(stats.join('\n'));
await page.screenshot({ path: `${OUT}island-gallery${big ? '-big' : ''}.png`, fullPage: true });
await browser.close();
