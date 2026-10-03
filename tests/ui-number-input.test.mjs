/*
 * The arrange panel's fields (PQW-1147): digits only, never a sign, a letter or
 * a space; an angle above 359 becomes 359; the dial reads 0 at the top and
 * grows clockwise, and wraps round past it.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { angleAt, angleText, arcPath, cappedText, digitsOnly, wrapAngle } from '../src/ui/number-input.ts';

test('a field keeps only the digits of what was typed or pasted', () => {
  assert.equal(digitsOnly('12'), '12');
  assert.equal(digitsOnly('-5'), '5');
  assert.equal(digitsOnly(' 1 2 '), '12');
  assert.equal(digitsOnly('1e3'), '13');
  assert.equal(digitsOnly('4,5'), '45');
  assert.equal(digitsOnly('abc'), '');
  assert.equal(digitsOnly('+%&'), '');
});

test('a capped field keeps digits only, and a number above the cap becomes the cap', () => {
  assert.equal(cappedText('11', 10), '10');
  assert.equal(cappedText('99', 10), '10');
  assert.equal(cappedText('10', 10), '10');
  assert.equal(cappedText('7', 10), '7');
  assert.equal(cappedText('0', 10), '0');
  assert.equal(cappedText('a5', 10), '5');
  assert.equal(cappedText('-3', 10), '3');
  assert.equal(cappedText('', 10), '');
});

test('a capped field drops leading zeros and holds its minimum as it is typed', () => {
  assert.equal(cappedText('05', 10), '5');
  assert.equal(cappedText('0', 10, 1), '1');
  assert.equal(cappedText('00', 10, 1), '1');
  assert.equal(cappedText('010', 10, 1), '10');
  assert.equal(cappedText('', 10, 1), '');
});

test('an angle above 359 becomes 359, and one within the range stays', () => {
  assert.equal(angleText('360'), '359');
  assert.equal(angleText('9999'), '359');
  assert.equal(angleText('359'), '359');
  assert.equal(angleText('0'), '0');
  assert.equal(angleText('-90'), '90');
  assert.equal(angleText(''), '');
});

test('the dial reads 0 at the top and grows clockwise', () => {
  assert.equal(angleAt(0, -10), 0);
  assert.equal(angleAt(10, 0), 90);
  assert.equal(angleAt(0, 10), 180);
  assert.equal(angleAt(-10, 0), 270);
  assert.equal(angleAt(-1, -100), 359);
});

test('turning past the top wraps round', () => {
  assert.equal(wrapAngle(360), 0);
  assert.equal(wrapAngle(-1), 359);
  assert.equal(wrapAngle(725), 5);
});

test('the arc is empty at 0 and takes the long way round past 180', () => {
  assert.equal(arcPath(0, 42), '');
  assert.match(arcPath(90, 42), / 0 0 1 92\.00 50\.00$/);
  assert.match(arcPath(270, 42), / 0 1 1 8\.00 50\.00$/);
});
