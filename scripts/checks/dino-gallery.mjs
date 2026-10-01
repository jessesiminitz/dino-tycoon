import puppeteer from 'puppeteer-core';
import { HERE, finish } from './lib.mjs';
const OUT = HERE;
const tag = process.argv[2] ?? 'new';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setViewport({ width: 1500, height: 1300 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
await page.evaluate(async () => {
  const { paintDino } = await import('/src/render/dinoArt.ts');
  const { SPECIES, SPECIES_IDS } = await import('/src/sim/data/species.ts');
  document.body.innerHTML = '';
  document.body.style.cssText = 'background:#6fa84f;margin:0;display:flex;flex-wrap:wrap;gap:10px;padding:10px;font:12px sans-serif;overflow:auto';
  for (const id of SPECIES_IDS) {
    const box = document.createElement('div');
    box.style.cssText = 'background:#7fb85a;padding:6px;text-align:center';
    for (const f of [0, 1]) {
      const c = paintDino(SPECIES[id], f);
      const big = document.createElement('canvas');
      big.width = c.width * 4; big.height = c.height * 4;
      const g = big.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, big.width, big.height);
      box.appendChild(big);
    }
    box.appendChild(Object.assign(document.createElement('div'), { textContent: SPECIES[id].name }));
    document.body.appendChild(box);
  }
});
await page.screenshot({ path: `${OUT}dinos-${tag}.png`, fullPage: true });
finish(errors);
await browser.close();
