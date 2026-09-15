/*
 * A diagram feliratai hagyományonként (PQW-876): CYC-ben zárójeles szemszám,
 * japánban „目” egységgel, az ismétlés „目1模様” alakban.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chartLabels } from '../src/ui/chart-labels.ts';
import { chartSvg } from '../src/ui/chart-svg.ts';
import { hdcRectangle } from './fixtures/examples.ts';

const SHELL = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };

test('CYC: sorszám, zárójeles szemszám, ismétlés nincs a diagramon', () => {
  const labels = chartLabels('cyc');
  assert.equal(labels.layer(3), '3');
  assert.equal(labels.count(18), '(18)');
  assert.equal(labels.repeat(SHELL), null);
});

test('japán: a szemszám és az ismétlés számokkal, „目” egységgel (01 §6.2)', () => {
  const labels = chartLabels('japanese');
  assert.equal(labels.layer(3), '3');
  assert.equal(labels.count(18), '18目');
  assert.equal(labels.repeat({ repeatWidth: 11, edgeStitches: 0, turningChainIncluded: false }), '11目1模様');
  assert.equal(labels.repeat(undefined), null);
  assert.match(labels.note, /18目 = 18 szem/);
  assert.match(labels.note, /11目1模様/);
});

test('japán hagyománnyal az export feliratai: „目” szemszám, japán megjegyzés és ismétlés', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const repeated = { ...pattern, conventions: { ...pattern.conventions, repeat: SHELL } };
  const library = libraryFor(repeated);
  const svg = chartSvg(repeated, layoutPattern(repeated, library, {}), library, {
    colors: { right: '#000', wrong: '#00f', text: '#111', background: '#fff' },
    tradition: 'japanese',
  });
  assert.ok(svg.includes('>15目</text>'));
  assert.ok(!svg.includes('>(15)</text>'));
  assert.ok(svg.includes(chartLabels('japanese').note));
  assert.ok(svg.includes('Ismétlés: 6目1模様.'));
});

test('a CYC feliratai egyeznek a korábbi diagraméval', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const library = libraryFor(pattern);
  const svg = chartSvg(pattern, layoutPattern(pattern, library, {}), library, {
    colors: { right: '#000', wrong: '#00f', text: '#111', background: '#fff' },
  });
  const labels = chartLabels('cyc');
  assert.ok(svg.includes(`>${labels.count(15)}</text>`));
  assert.ok(svg.includes(`>${labels.layer(2)}</text>`));
  assert.ok(svg.includes(labels.note));
});
