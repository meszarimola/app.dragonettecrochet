/*
 * Icons generated from the D6 dragonfly mark.
 *
 * Source: public/favicon.svg, the approved mark with a tight crop.
 * Kimenet:
 *   - public/favicon.ico — 32 px, transparent, a PNG inside an ICO container;
 *   - public/apple-touch-icon.png — 180 px on #FDFBF8, because iOS rounds the
 *     corners itself and would put black behind a transparent one.
 *
 * No new dependency: Playwright's Chromium renders the SVG.
 * Run: `node scripts/generate-icons.mjs` (Chromium must be installed:
 * `npx playwright install chromium`).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const url = (path) => new URL(`../${path}`, import.meta.url);
const svg = readFileSync(url('public/favicon.svg'), 'utf8');

/** Render the SVG into a `size` x `size` PNG; transparent without `background`. */
async function render(page, size, background) {
  const bg = background ? `background:${background};` : 'background:transparent;';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;${bg}"><div style="width:${size}px;height:${size}px;display:flex">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  );
  return page.screenshot({ omitBackground: !background, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An ICO holding a single PNG image; every browser since Vista reads it. */
function icoFromPng(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // fenntartott
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size >= 256 ? 0 : size, 6); // width
  header.writeUInt8(size >= 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette colours
  header.writeUInt8(0, 9); // fenntartott
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bit depth
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  writeFileSync(url('public/favicon.ico'), icoFromPng(await render(page, 32), 32));
  writeFileSync(url('public/apple-touch-icon.png'), await render(page, 180, '#FDFBF8'));
} finally {
  await browser.close();
}
console.log('Done: public/favicon.ico (32 px), public/apple-touch-icon.png (180 px).');
