/*
 * Chart labels per tradition (PQW-876): a bracketed stitch count in CYC, the
 * „目” unit in Japanese, and the repeat written as „目1模様”.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chartLabels } from '../src/ui/chart-labels.ts';
import { setUiLanguage } from '../src/ui/i18n.ts';
import { chartSvg } from '../src/ui/chart-svg.ts';
import { hdcRectangle } from './fixtures/examples.ts';

const SHELL = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };

test('CYC: row number, bracketed stitch count, and no repeat on the chart', () => {
  const labels = chartLabels('cyc');
  assert.equal(labels.layer(3), '3');
  assert.equal(labels.count(18), '(18)');
  assert.equal(labels.repeat(SHELL), null);
});

test('Japanese: stitch count and repeat as numbers with the „目” unit (01 §6.2)', () => {
  const labels = chartLabels('japanese');
  assert.equal(labels.layer(3), '3');
  assert.equal(labels.count(18), '18目');
  assert.equal(labels.repeat({ repeatWidth: 11, edgeStitches: 0, turningChainIncluded: false }), '11目1模様');
  assert.equal(labels.repeat(undefined), null);
  assert.match(labels.note, /18目 = 18 szem/);
  assert.match(labels.note, /11目1模様/);
});

test('export labels in the Japanese tradition: a „目” stitch count, the Japanese note and the repeat', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const repeated = { ...pattern, conventions: { ...pattern.conventions, repeat: SHELL } };
  const library = libraryFor(repeated);
  const svg = chartSvg(repeated, layoutPattern(repeated, library, {}), library, {
    colors: { right: '#000', wrong: '#00f', text: '#111', background: '#fff' },
    tradition: 'japanese',
  });
  // The stitch count belongs to the row label, not to a separate text on the chart (PQW-923); the turning chain is the first stitch of the row (PQW-940).
  assert.ok(svg.includes('>3. sor 16目</text>'));
  assert.ok(!svg.includes('>16目</text>'));
  assert.ok(!svg.includes('>(16)</text>'));
  assert.ok(svg.includes(chartLabels('japanese').note));
  assert.ok(svg.includes('Ismétlés: 6目1模様.'));
});

test('the CYC labels match those of the earlier chart', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const library = libraryFor(pattern);
  const svg = chartSvg(pattern, layoutPattern(pattern, library, {}), library, {
    colors: { right: '#000', wrong: '#00f', text: '#111', background: '#fff' },
  });
  const labels = chartLabels('cyc');
  // Row number and stitch count on a single label, just like on the designer canvas (PQW-923).
  assert.ok(svg.includes('>3. sor (16)</text>'));
  assert.ok(!svg.includes(`>${labels.count(16)}</text>`));
  assert.ok(svg.includes(labels.note));
});

/*
 * The row label beside the chart (PQW-916): the layer name comes from the
 * interface language, the shape of the stitch count from the tradition.
 *
 * Since PQW-923 the foundation chain is row 1 itself (an owner decision), so
 * the row worked into it is row 2 — the printed number is one greater than the
 * layer index. In the round the numbering is unchanged: the magic ring appears
 * under its name, so round numbers in finished amigurumi patterns do not
 * shift.
 */
test('the row label carries the layer name and the stitch count, in Hungarian and in English', () => {
  const labels = chartLabels('cyc');
  assert.equal(labels.rowLabel(1, false, 12), '2. sor (12)');
  assert.equal(labels.rowLabel(0, false, 12), '1. sor – alapsor (12)');
  assert.equal(labels.rowLabel(3, true, 18), '3. kör (18)');

  setUiLanguage('en');
  try {
    const en = chartLabels('cyc');
    assert.equal(en.rowLabel(1, false, 12), 'Row 2 (12)');
    assert.equal(en.rowLabel(0, false, 12), 'Row 1 – foundation (12)');
    assert.equal(en.rowLabel(0, true, 6), 'Magic ring (6)');
  } finally {
    setUiLanguage('hu');
  }
});

test('in the Japanese tradition the row label stitch count also uses the „目” unit', () => {
  assert.equal(chartLabels('japanese').rowLabel(2, false, 15), '3. sor 15目');
});

test('the magic ring label stands without a stitch count, having no meaningful one (PQW-916)', () => {
  const labels = chartLabels('cyc');
  assert.equal(labels.rowLabel(0, true, null), 'Varázskör');
  assert.equal(chartLabels('japanese').rowLabel(0, true, null), 'Varázskör');

  setUiLanguage('en');
  try {
    assert.equal(chartLabels('cyc').rowLabel(0, true, null), 'Magic ring');
  } finally {
    setUiLanguage('hu');
  }
});
