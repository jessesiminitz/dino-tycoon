// Shared bits for the browser checks.
import { fileURLToPath } from 'node:url';

/** This folder, as a real path (works when the repo path has spaces). Screenshots go here. */
export const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Run the same existing UI checks against either development art set. */
export function gameUrl(path = '/') {
  const url = new URL(path, process.env.BASE_URL ?? 'http://localhost:5173');
  if (process.env.ART_STYLE) url.searchParams.set('art', process.env.ART_STYLE);
  return url.href;
}

/** Waits until a ?quickstart park is running (on a slow machine that can take a while after "load"). */
export async function ready(page) {
  await page.waitForFunction(() => window.__dino?.sim, { timeout: 60000 });
}

const failures = [];

/** Records an expectation; a false one is printed and fails the check at the end. */
export function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === '' ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  if (!ok) failures.push(label);
}

/** Prints page errors and failed expectations; either one makes the script exit non-zero. */
export function finish(errors) {
  console.log('errors:', errors.length ? errors : 'none');
  if (failures.length) console.log(`${failures.length} failed: ${failures.join('; ')}`);
  if (errors.length || failures.length) process.exitCode = 1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Opens a tool's picture shop and picks an item, as a player would (tapping an active tool goes back to Look first). */
export async function shopPick(page, mode, id) {
  const tool = await openTool(page, mode);
  await tool.tap();
  const buy = await page.waitForSelector(`.modal:not(.hidden) .shop-card[data-id="${id}"] button`, { visible: true });
  await buy.tap();
  await sleep(250);
}

/**
 * Opens the Buy sheet and returns a tool's button in it, e.g. 'fence', or
 * 'catalog' for the dinosaurs. Tap the result to use the tool.
 */
export function openTool(page, mode) {
  return reach(page, mode === 'catalog' ? '#btn-catalog' : `.tool-btn[data-mode="${mode}"]`);
}

/**
 * A button that may sit inside the Buy sheet (tools, dinosaurs) or the ☰ menu
 * (People, Dino book): opens that first, then returns the visible button.
 */
export async function reach(page, sel) {
  const holder = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const box = el?.closest('#buy, #pause');
    return box && box.classList.contains('hidden') ? (box.id === 'buy' ? '#btn-buy' : '#btn-menu') : null;
  }, sel);
  if (holder) {
    await (await page.waitForSelector(holder, { visible: true })).tap();
    await sleep(250);
  }
  return page.waitForSelector(sel, { visible: true });
}

/** Where a map point (in tiles) is on screen, through the park camera. */
export function toScreen(page, vx, vy) {
  return page.evaluate(
    (vx, vy) => {
      const c = window.__dino.game.scene.getScene('park').cameras.main;
      const cx = c.width / 2;
      const cy = c.height / 2;
      return { x: (vx * 16 - c.scrollX - cx) * c.zoom + cx, y: (vy * 16 - c.scrollY - cy) * c.zoom + cy };
    },
    vx,
    vy,
  );
}
