// Every building, blown up on a grass background.
import puppeteer from 'puppeteer-core';
import { HERE } from './lib.mjs';
const OUT = HERE;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 300 });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(async () => {
  const art = await import('/src/render/sceneryArt.ts');
  const sprites = [art.paintFriesStand(), art.paintPopcornStand(), art.paintPortaPotties(), art.paintBasketShop(), art.paintTrashCan(), art.paintStation(), art.paintTower(), art.paintPettingPen(), art.paintDigSite()];
  document.body.innerHTML = '';
  const c = document.createElement('canvas');
  c.width = 1500; c.height = 300;
  c.style.cssText = 'position:fixed;inset:0;z-index:99;image-rendering:pixelated';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#6fb84a'; g.fillRect(0, 0, 1500, 300);
  let x = 20; sprites.forEach((s) => { g.drawImage(s, x, 290 - s.height * 6, s.width * 6, s.height * 6); x += s.width * 6 + 12; });
  document.body.appendChild(c);
});
await page.screenshot({ path: `${OUT}shaped-buildings.png` });
await browser.close();
