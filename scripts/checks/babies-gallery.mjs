// All 12 species: grown-up, baby and egg side by side, at 4x.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1500, height: 1300 });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(async () => {
  const { paintDino, paintEgg } = await import('/src/render/dinoArt.ts');
  const { SPECIES, SPECIES_IDS } = await import('/src/sim/data/species.ts');
  document.body.innerHTML = '';
  document.body.style.cssText = 'background:#6fa84f;margin:0;display:flex;flex-wrap:wrap;gap:10px;padding:10px;font:12px sans-serif';
  const big = (c) => { const b = document.createElement('canvas'); b.width = c.width * 4; b.height = c.height * 4; const g = b.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, b.width, b.height); return b; };
  for (const id of SPECIES_IDS) {
    const box = document.createElement('div');
    box.style.cssText = 'background:#7fb85a;padding:6px;display:flex;align-items:flex-end;gap:8px';
    box.append(big(paintDino(SPECIES[id], 0)), big(paintDino(SPECIES[id], 0, true)), big(paintDino(SPECIES[id], 1, true)), big(paintEgg(SPECIES[id])));
    document.body.appendChild(box);
  }
});
await page.screenshot({ path: `${OUT}babies-gallery.png`, fullPage: true });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
