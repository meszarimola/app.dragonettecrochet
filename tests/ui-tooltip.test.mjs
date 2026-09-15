/*
 * A menüsor tooltipjének igazítása (PQW-882): a gomb helye szerint balra,
 * középre vagy jobbra igazodik, hogy ne lógjon ki az ablakból.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { tipAlign } from '../src/ui/tooltip.ts';

test('a bal szél közelében balra igazodik', () => {
  assert.equal(tipAlign(38, 1440), 'start');
});

test('középen középre igazodik', () => {
  assert.equal(tipAlign(600, 1440), 'center');
});

test('a jobb szél közelében jobbra igazodik', () => {
  assert.equal(tipAlign(980, 1000), 'end');
});

test('keskeny ablakban, ha egyik oldalon sem fér el, balra igazodik', () => {
  assert.equal(tipAlign(150, 300), 'start');
});
