/*
 * Az ikonok előállítása a D6 szitakötő-jelből (PQW-922).
 *
 * Forrás: public/favicon.svg (a jóváhagyott jel, szoros kivágással).
 * Kimenet:
 *   - public/favicon.ico — 32 px, átlátszó háttér, PNG a ICO-tárolóban;
 *   - public/apple-touch-icon.png — 180 px, #FDFBF8 háttérrel (az iOS a
 *     kerekítést maga teszi rá, átlátszó háttérre feketét rakna).
 *
 * Új függőség nélkül: a Playwright Chromiumja rajzolja ki az SVG-t.
 * Futtatás: `node scripts/generate-icons.mjs` (a Chromium legyen telepítve:
 * `npx playwright install chromium`).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const url = (path) => new URL(`../${path}`, import.meta.url);
const svg = readFileSync(url('public/favicon.svg'), 'utf8');

/** Az SVG kirajzolása `size` × `size` PNG-be; `background` nélkül átlátszó. */
async function render(page, size, background) {
  const bg = background ? `background:${background};` : 'background:transparent;';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;${bg}"><div style="width:${size}px;height:${size}px;display:flex">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  );
  return page.screenshot({ omitBackground: !background, clip: { x: 0, y: 0, width: size, height: size } });
}

/** Egyetlen PNG képet tartalmazó ICO-fájl (a Vista óta minden böngésző olvassa). */
function icoFromPng(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // fenntartott
  header.writeUInt16LE(1, 2); // típus: ikon
  header.writeUInt16LE(1, 4); // képek száma
  header.writeUInt8(size >= 256 ? 0 : size, 6); // szélesség
  header.writeUInt8(size >= 256 ? 0 : size, 7); // magasság
  header.writeUInt8(0, 8); // palettaszínek
  header.writeUInt8(0, 9); // fenntartott
  header.writeUInt16LE(1, 10); // színsíkok
  header.writeUInt16LE(32, 12); // bitmélység
  header.writeUInt32LE(png.length, 14); // a kép mérete
  header.writeUInt32LE(header.length, 18); // a kép kezdete
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
console.log('Kész: public/favicon.ico (32 px), public/apple-touch-icon.png (180 px).');
