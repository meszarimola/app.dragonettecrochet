import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  HOOK_SIZES,
  hookByMm,
  isSteelHook,
  mmFromOldUk,
  mmFromUs,
  mmFromUsSteel,
  nearestHookSize,
} from '../src/core/hook-sizes.ts';

test('a kulcs a mm: minden méret egyszer szerepel, növekvő sorrendben (02 §2.1)', () => {
  for (let i = 1; i < HOOK_SIZES.length; i++) {
    assert.ok(HOOK_SIZES[i].mm > HOOK_SIZES[i - 1].mm, `${HOOK_SIZES[i].mm} mm`);
  }
});

test('a régi brit szám a mérettel csökken, az amerikai nő', () => {
  const ukValue = (label) => (/^0+$/.test(label) ? 1 - label.length : Number(label));
  const uk = HOOK_SIZES.filter((size) => size.oldUk !== null).map((size) => ukValue(size.oldUk));
  for (let i = 1; i < uk.length; i++) assert.ok(uk[i] < uk[i - 1], `${uk[i]} a ${uk[i - 1]} után`);

  const usNumber = (label) => Number(/(\d+(?:½)?)$/.exec(label)?.[1]?.replace('½', '.5') ?? Number.NaN);
  const us = HOOK_SIZES.filter((size) => size.us !== null && /\d$|½$/.test(size.us)).map((size) => usNumber(size.us));
  for (let i = 1; i < us.length; i++) assert.ok(us[i] > us[i - 1], `${us[i]} a ${us[i - 1]} után`);
});

test('mm-ből az amerikai és a régi brit jelölés', () => {
  assert.deepEqual(hookByMm(5), { mm: 5, us: 'H-8', oldUk: '6' });
  assert.deepEqual(hookByMm(4), { mm: 4, us: 'G-6', oldUk: '8' });
  assert.equal(hookByMm(12).us, null);
  assert.equal(hookByMm(4.1), null);
  assert.equal(nearestHookSize(4.1).mm, 4);
  assert.equal(nearestHookSize(5.6).mm, 5.5);
});

test('amerikai jelölésből mm, kis- és nagybetűtől, kötőjeltől és ½ írásmódtól függetlenül', () => {
  for (const label of ['H-8', 'h8', 'H', '8', 'H/8']) assert.deepEqual(mmFromUs(label), [5], label);
  for (const label of ['K-10½', 'K-10.5', 'K 10 1/2', '10½']) assert.deepEqual(mmFromUs(label), [6.5], label);
  assert.deepEqual(mmFromUs('I-9'), [5.5]);
  assert.deepEqual(mmFromUs('M-13'), [9]);
  assert.deepEqual(mmFromUs('7'), [4.5]);
});

test('a több tűre illő amerikai jelölés minden jelöltet visszaad', () => {
  assert.deepEqual(mmFromUs('G'), [4, 4.25]);
  assert.deepEqual(mmFromUs('Q'), [15, 15.75, 16]);
  assert.deepEqual(mmFromUs('Z'), []);
  assert.deepEqual(mmFromUs(''), []);
});

test('régi brit számból mm; a 0, 00 és 000 három különböző tű', () => {
  assert.equal(mmFromOldUk('8'), 4);
  assert.equal(mmFromOldUk('0'), 8);
  assert.equal(mmFromOldUk('00'), 9);
  assert.equal(mmFromOldUk('000'), 10);
  assert.equal(mmFromOldUk('1'), null);
});

test('acéltű 2 mm alatt; a száma gyártónként más mm, ezért becslés tartománnyal (02 §2.2)', () => {
  assert.equal(isSteelHook(1.75), true);
  assert.equal(isSteelHook(2), false);

  assert.deepEqual(mmFromUsSteel('7'), { value: 1.65, source: 'estimated', range: [1.1, 1.65] });
  // Susan Bates #0 = 3,25 mm, Clover #0 = 1,75 mm.
  assert.deepEqual(mmFromUsSteel('0'), { value: 3.25, source: 'estimated', range: [1.75, 3.25] });
  assert.deepEqual(mmFromUsSteel('14').range, [0.6, 0.9]);
  assert.equal(mmFromUsSteel('99'), null);
  assert.equal(mmFromUsSteel('constructor'), null);
});
