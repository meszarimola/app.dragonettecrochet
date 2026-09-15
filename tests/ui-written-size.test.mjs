/*
 * Az írott minta panel magassága (PQW-885): a fejléctől a teljes
 * munkaterületig, billentyűvel 5 %-os lépésekben, húzással, és az állapotsor
 * helye a panel fölött.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { clampSize, dragCollapses, dragSize, isFull, keySize, percentOf, statusPlace } from '../src/ui/written-size.ts';

const range = { min: 80, max: 400 };

test('a magasság a fejléc és a munkaterület közé szorul', () => {
  assert.equal(clampSize(20, range), 80);
  assert.equal(clampSize(500, range), 400);
  assert.equal(clampSize(250, range), 250);
});

test('ha a fejléc magasabb a munkaterületnél, a munkaterület a határ', () => {
  assert.equal(clampSize(100, { min: 120, max: 90 }), 90);
});

test('a nyilak 5 %-os osztásra lépnek, fel és jobbra nő, le és balra csökken', () => {
  assert.equal(keySize('ArrowUp', 200, range), 220);
  assert.equal(keySize('ArrowRight', 200, range), 220);
  assert.equal(keySize('ArrowDown', 200, range), 180);
  assert.equal(keySize('ArrowLeft', 200, range), 180);
  // Két osztás közül a következő kerek értékre.
  assert.equal(keySize('ArrowUp', 205, range), 220);
  assert.equal(keySize('ArrowDown', 205, range), 200);
});

test('a böngésző kerekítette magasság is a következő osztásra lép', () => {
  // 1000×506-ban a 75 % 257,546875 px a 343,40625 px-es munkaterületen, nem pontosan 257,5546875.
  const small = { min: 93, max: 343.40625 };
  assert.ok(Math.abs(keySize('ArrowUp', 257.546875, small) - 0.8 * small.max) < 1e-9);
  assert.equal(keySize('PageUp', 257.546875, small), small.max);
  assert.ok(Math.abs(keySize('ArrowDown', 257.5625, small) - 0.7 * small.max) < 1e-9);
});

test('a PageUp és a PageDown negyedet lép', () => {
  assert.equal(keySize('PageUp', 120, range), 200);
  assert.equal(keySize('PageDown', 300, range), 200);
});

test('a Home a fejlécig, az End a teljes munkaterületig állít, a lépés nem lóg ki', () => {
  assert.equal(keySize('Home', 250, range), 80);
  assert.equal(keySize('End', 250, range), 400);
  assert.equal(keySize('ArrowUp', 400, range), 400);
  assert.equal(keySize('ArrowDown', 90, range), 80);
});

test('más billentyű nem állít', () => {
  assert.equal(keySize('Enter', 200, range), null);
  assert.equal(keySize('a', 200, range), null);
  assert.equal(keySize('ArrowUp', 0, { min: 0, max: 0 }), null);
});

test('a felolvasott érték a munkaterület százaléka', () => {
  assert.equal(percentOf(200, range), 50);
  assert.equal(percentOf(400, range), 100);
  assert.equal(percentOf(80, range), 20);
  assert.equal(percentOf(10, { min: 0, max: 0 }), 0);
});

test('teljes nézet: a munkaterület magassága, képpontnyi tűréssel', () => {
  assert.equal(isFull(400, range), true);
  assert.equal(isFull(399.4, range), true);
  assert.equal(isFull(390, range), false);
});

test('húzáskor az elválasztó felfelé mozdulása növeli a panelt', () => {
  assert.equal(dragSize(200, 50, range), 250);
  assert.equal(dragSize(200, -150, range), 80);
  assert.equal(dragSize(200, 400, range), 400);
});

test('a panel csak akkor csukódik le, ha a húzás jóval a fejléc alá ér', () => {
  assert.equal(dragCollapses(200, -130, range), false);
  assert.equal(dragCollapses(200, -161, range), true);
});

test('az állapotsor a panel fölött áll, ha ott elfér', () => {
  assert.deepEqual(statusPlace(200, 30, 400), { block: 200, lift: 0 });
  assert.deepEqual(statusPlace(0, 30, 400), { block: 0, lift: 0 });
});

test('majdnem teljes panelnél a panel teteje ad helyet az állapotsornak', () => {
  assert.deepEqual(statusPlace(390, 30, 400), { block: 370, lift: 20 });
  assert.deepEqual(statusPlace(400, 30, 400), { block: 370, lift: 30 });
  // Üres állapotsornál nincs mit helyet adni.
  assert.deepEqual(statusPlace(400, 0, 400), { block: 400, lift: 0 });
});
