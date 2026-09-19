import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import { isIrregularJson, loadIrregular, saveIrregular } from '../src/core/irregular-json.ts';
import { DEFAULT_POLAR, IRREGULAR_FORMAT_VERSION } from '../src/core/irregular-types.ts';
import { savePattern } from '../src/core/pattern-json.ts';
import { dcRectangle } from './fixtures/examples.ts';

/** Three rows, three layers and stitches spread over them. */
function sample() {
  const start = emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });
  let pattern = {
    ...start,
    titleGenerated: true,
    notation: { terms: 'en-GB', chartStyle: 'jis', singleCrochet: 'cross' },
    rows: [
      ...start.rows,
      { id: 'r2', kind: 'round', direction: 'ccw', color: '#ff00aa', visible: true, locked: false },
      { id: 'r3', kind: 'row', direction: 'rtl', color: null, visible: false, locked: true },
    ],
    layers: [...start.layers, { id: 'l3', name: 'Notes', visible: true, locked: false }],
  };

  const places = [
    ['r1', 'l1', { keyEntryId: 'dc', x: 0, y: 0, width: 20, height: 40, insertion: 'both-loops' }],
    ['r2', 'l2', { keyEntryId: 'sc', x: 12.5, y: -8, width: 18, height: 18, insertion: 'front-post' }],
    ['r3', 'l3', { keyEntryId: 'custom-1', x: -40, y: 33.25, width: 30, height: 12, insertion: 'back-loop' }],
  ];
  for (const [rowId, layerId, spec] of places) {
    pattern = addStitch({ ...pattern, activeRowId: rowId, activeLayerId: layerId }, spec).pattern;
  }
  return {
    ...pattern,
    activeRowId: 'r2',
    activeLayerId: 'l1',
    items: pattern.items.map((item, index) => (index === 1 ? { ...item, color: '#123456', rotation: 45 } : item)),
    guides: {
      grid: { visible: true, size: 25 },
      polar: { visible: true, center: { x: -12.5, y: 40 }, rings: 6, spacing: 32.5, spokes: 18, startAngle: 15 },
      snap: true,
    },
  };
}

test('a saved free-form chart loads back unchanged', () => {
  const pattern = sample();
  const saved = saveIrregular(pattern);
  const loaded = loadIrregular(saved);

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.pattern, pattern);
  assert.equal(saveIrregular(loaded.pattern), saved);
  assert.match(saved, /^\{\n {2}"formatVersion": 1,\n {2}"type": "irregular",/);
  assert.equal(IRREGULAR_FORMAT_VERSION, 1);
});

test('a chart in a newer format is not loaded', () => {
  const raw = JSON.parse(saveIrregular(sample()));
  raw.formatVersion = IRREGULAR_FORMAT_VERSION + 1;
  const loaded = loadIrregular(JSON.stringify(raw));

  assert.equal(loaded.ok, false);
  assert.equal(loaded.error.code, 'unsupported-version');
  assert.equal(loaded.error.path, '$.formatVersion');
  assert.deepEqual(loaded.error.message.data, { found: IRREGULAR_FORMAT_VERSION + 1, known: IRREGULAR_FORMAT_VERSION });
});

describe('a broken chart fails with its field path', () => {
  const cases = [
    ['an unknown top-level field', (raw) => (raw.canvas = { width: 800 }), '$.canvas', 'unknown-field'],
    ['a missing required field', (raw) => delete raw.guides, '$.guides', 'missing-field'],
    ['a stitch on a row that does not exist', (raw) => (raw.items[0].rowId = 'r9'), '$.items[0].rowId', 'unknown-row'],
    [
      'a stitch on a layer that does not exist',
      (raw) => (raw.items[0].layerId = 'l9'),
      '$.items[0].layerId',
      'unknown-layer',
    ],
    ['the same stitch id twice', (raw) => (raw.items[1].id = raw.items[0].id), '$.items[1].id', 'duplicate-item-id'],
    ['the same row id twice', (raw) => (raw.rows[1].id = raw.rows[0].id), '$.rows[1].id', 'duplicate-row-id'],
    ['an active row that does not exist', (raw) => (raw.activeRowId = 'r9'), '$.activeRowId', 'unknown-row'],
    ['no rows at all', (raw) => (raw.rows = []), '$.rows', 'expected-nonempty-array'],
    ['a regular pattern in disguise', (raw) => (raw.type = 'pattern'), '$.type', 'expected-one-of'],
    ['a colour that is not a hex code', (raw) => (raw.rows[1].color = 'pink'), '$.rows[1].color', 'expected-hex-color'],
    ['a stitch of no width', (raw) => (raw.items[0].width = 0), '$.items[0].width', 'expected-positive'],
    ['an unknown insertion', (raw) => (raw.items[0].insertion = 'side'), '$.items[0].insertion', 'expected-one-of'],
  ];
  for (const [name, spoil, path, code] of cases) {
    test(name, () => {
      const raw = JSON.parse(saveIrregular(sample()));
      spoil(raw);
      const loaded = loadIrregular(JSON.stringify(raw));

      assert.equal(loaded.ok, false);
      assert.equal(loaded.error.code, 'invalid-format');
      assert.equal(loaded.error.path, path);
      assert.equal(loaded.error.message.code, code);
    });
  }
});

test('malformed text is refused as broken JSON, not as a broken chart', () => {
  const loaded = loadIrregular('{ "type": "irregular", ');

  assert.equal(loaded.ok, false);
  assert.equal(loaded.error.code, 'invalid-json');
  assert.equal(loaded.error.path, '$');
  assert.equal(loaded.error.message.code, 'invalid-json');
  assert.equal(typeof loaded.error.message.data.detail, 'string');
});

test('the file menu tells the two file kinds apart', () => {
  assert.equal(isIrregularJson(saveIrregular(sample())), true);
  assert.equal(isIrregularJson(savePattern(dcRectangle({ rows: 1 }).pattern)), false);
  assert.equal(isIrregularJson('{ "type": "irregular", '), false);
  assert.equal(isIrregularJson(''), false);
  assert.equal(isIrregularJson('[]'), false);
});

describe('the circle guide in the file (PQW-966)', () => {
  test('a file written before the circle guide still loads, with the preset guide', () => {
    const raw = JSON.parse(saveIrregular(sample()));
    delete raw.guides.polar;
    const result = loadIrregular(JSON.stringify(raw));
    assert.ok(result.ok, 'the older file is accepted');
    assert.deepEqual(result.pattern.guides.polar, DEFAULT_POLAR, 'the preset circle guide fills the gap');
  });

  test('a broken circle guide is refused, it is not quietly replaced', () => {
    const raw = JSON.parse(saveIrregular(sample()));
    raw.guides.polar.spokes = 2.5;
    const result = loadIrregular(JSON.stringify(raw));
    assert.equal(result.ok, false, 'refused');
    assert.equal(result.error.path, '$.guides.polar.spokes', 'and it says where');
  });
});
