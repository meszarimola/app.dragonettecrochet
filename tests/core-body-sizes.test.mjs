/*
 * Testméretek és bőség (PQW-866): a CYC táblázatok ellenőrzése a tudásbázis
 * gyanúi szerint (05 §3.1–3.2), a fejkörfogat és a sapkaméretek, a
 * bőségfokozatok és a sapka bősége.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  BABY,
  BODY_TABLES,
  CHILD,
  FIT_EASE,
  HAT_SIZES,
  HEAD_CIRCUMFERENCE,
  MEN,
  WOMEN,
  bodySizeName,
  fitLevelOf,
  hatEase,
  inchToCm,
  mid,
  tableFlags,
} from '../src/core/body-sizes.ts';

const flagKeys = (table) => tableFlags(table).map((flag) => `${flag.size}:${flag.measure}:${flag.kind}`);

test('női táblázat: az 5X felkarbőség hüvelykje nem egyezik a cm-rel (18½" ≠ 49,5 cm)', () => {
  const inch = tableFlags(WOMEN).filter((flag) => flag.kind === 'inch-mismatch');
  assert.deepEqual(
    inch.map((flag) => `${flag.size}:${flag.measure}`),
    ['5X:upperArm'],
  );
  // A gyanú kódként és adatként megy a felületre; a mértéknevet és a számok alakját a szótár adja (PQW-904).
  assert.equal(inch[0].note.code, 'flag-inch-mismatch');
  assert.deepEqual(inch[0].note.data, { measure: 'upperArm', inch: [18.5, 18.5], converted: [47, 47], cm: [49.5, 49.5] });
});

test('női táblázat: a 2X–5X háthossz, keresztháti szélesség és karhossz sora azonos, másolási hibára utal', () => {
  const keys = flagKeys(WOMEN);
  for (const size of ['2X', '3X', '4X', '5X']) {
    for (const measure of ['backWaist', 'crossBack', 'armLength']) assert.ok(keys.includes(`${size}:${measure}:identical-rows`), `${size} ${measure}`);
  }
  // XS–L méretben nincs gyanú.
  assert.ok(keys.every((key) => !/^(XS|S|M|L):/.test(key)), keys.join(' '));
});

test('férfi táblázat: a 4X karhossz kisebb a 3X-nél és a hüvelykkel sem egyezik; a csípőhossz címkéje megjegyzésben', () => {
  assert.deepEqual(flagKeys(MEN).sort(), ['4X:armLength:inch-mismatch', '4X:armLength:not-monotonic']);
  assert.ok(MEN.notes.some((note) => /csípőig mért háthosszt/.test(note)));
  assert.equal(MEN.sizes[0].values.upperArm, undefined);
});

test('gyerektáblázatban nincs gyanús adat; a babáéban a 12–24 hónapos háthossz és karhossz azonos', () => {
  assert.deepEqual(flagKeys(CHILD), []);
  assert.deepEqual(flagKeys(BABY).sort(), [
    '12:armLength:identical-rows',
    '12:backWaist:identical-rows',
    '18:armLength:identical-rows',
    '18:backWaist:identical-rows',
    '24:armLength:identical-rows',
    '24:backWaist:identical-rows',
  ]);
});

test('minden táblázatnak forrása van, és a méretek sorrendje a mellbőség szerint növekszik', () => {
  for (const table of Object.values(BODY_TABLES)) {
    assert.match(table.source, /^https:\/\/www\.craftyarncouncil\.com\//);
    const chest = table.sizes.map((size) => mid(size.values.chest));
    assert.deepEqual([...chest].sort((a, b) => a - b), chest, table.id);
  }
  assert.equal(mid(WOMEN.sizes[2].values.chest), 94);
});

test('a fejkörfogat cm-e a hüvelykkel egyezik, és korcsoportonként nő', () => {
  let previous = [0, 0];
  for (const head of HEAD_CIRCUMFERENCE) {
    assert.ok(Math.abs(head.cm[0] - head.inch[0] * 2.54) <= 1.5 && Math.abs(head.cm[1] - head.inch[1] * 2.54) <= 1.5, head.id);
    assert.ok(head.cm[0] >= previous[0] && head.cm[1] >= previous[1], head.id);
    previous = head.cm;
  }
});

test('sapkaméretek: a korona átmérője kb. a sapka körmérete / π (05 §5.2)', () => {
  for (const size of HAT_SIZES) assert.ok(Math.abs(size.crownIn - size.hatIn / Math.PI) <= 0.3, size.id);
  assert.equal(inchToCm(22), 55.9);
});

test('sapka bősége: 46 cm alatti fejre −2,5 cm, fölötte −5 cm, de legfeljebb a fejkörfogat 10%-a', () => {
  assert.equal(hatEase(45.7), -2.5);
  assert.equal(hatEase(55.9), -5);
  // 48,3 cm-es fejen a −5 cm 10,4% lenne.
  assert.equal(hatEase(48.3), -4.8);
});

test('bőségfokozatok a CYC táblázat szerint', () => {
  assert.deepEqual([-6, 0, 8, 12, 20].map(fitLevelOf), ['very-close', 'close', 'classic', 'loose', 'oversized']);
  assert.deepEqual(FIT_EASE.classic, { name: 'klasszikus', min: 5, max: 10 });
});

test('a méret neve: gyereknél év, babánál hónap, angolul is', () => {
  assert.equal(bodySizeName('women', 'M', 'hu'), 'M');
  assert.equal(bodySizeName('child', '8', 'hu'), '8 év');
  assert.equal(bodySizeName('baby', '6', 'en-US'), '6 mo');
});
