// Regenerates the Home Screen / PWA icons from src/render/iconArt.ts, painted in a
// headless Chrome so it can reuse the game's own sprite code.
// Needs the dev server running (npm run dev) and puppeteer-core:
//   npx -y -p puppeteer-core node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEV = process.env.DEV_URL ?? 'http://localhost:5173/';
const { default: puppeteer } = await import('puppeteer-core');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto(DEV, { waitUntil: 'networkidle0' });
const icons = await page.evaluate(async () => {
  const { paintIcon } = await import('/src/render/iconArt.ts');
  return {
    'apple-touch-icon.png': paintIcon(180).toDataURL(),
    'icon-192.png': paintIcon(192).toDataURL(),
    'icon-512.png': paintIcon(512).toDataURL(),
    // Android crops maskable icons to a circle: keep the scene inside the safe zone.
    'icon-maskable-512.png': paintIcon(512, 0.1).toDataURL(),
  };
});
await browser.close();
for (const [name, url] of Object.entries(icons)) {
  const file = fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url));
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
