// The shaped buildings (fries, popcorn, porta-potties, basket), blown up on a grass background.
import puppeteer from 'puppeteer-core';
const OUT = new URL('.', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 300 });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(async () => {
  const art = await import('/src/render/sceneryArt.ts');
  const sprites = [art.paintFriesStand(), art.paintPopcornStand(), art.paintPortaPotties(), art.paintBasketShop()];
  document.body.innerHTML = '';
  const c = document.createElement('canvas');
  c.width = 900; c.height = 300;
  c.style.cssText = 'position:fixed;inset:0;z-index:99;image-rendering:pixelated';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#6fb84a'; g.fillRect(0, 0, 900, 300);
  sprites.forEach((s, i) => g.drawImage(s, 30 + i * 220, 280 - s.height * 8, s.width * 7, s.height * 8));
  document.body.appendChild(c);
});
await page.screenshot({ path: `${OUT}shaped-buildings.png` });
await browser.close();
