import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import { addChainArc, updateChainArc } from '../src/core/irregular-groups.ts';
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
});

describe('the circle guide keeps its limits on the way in (PQW-966)', () => {
  const broken = (change, path, code) => {
    const raw = JSON.parse(saveIrregular(sample()));
    change(raw);
    const result = loadIrregular(JSON.stringify(raw));
    assert.equal(result.ok, false, 'refused');
    assert.equal(result.error.path, path, 'and it says where');
    assert.equal(result.error.message.code, code, 'and what was wrong');
  };

  test('a ring count nothing could draw is refused, not clamped', () => {
    broken((raw) => (raw.guides.polar.rings = 1_000_000), '$.guides.polar.rings', 'expected-in-range');
  });

  test('a fractional spoke count is called what it is', () => {
    broken((raw) => (raw.guides.polar.spokes = 2.5), '$.guides.polar.spokes', 'expected-whole-number');
  });

  test('a ring spacing beyond the range is refused', () => {
    broken((raw) => (raw.guides.polar.spacing = 5000), '$.guides.polar.spacing', 'expected-in-range');
  });

  test('a start angle outside a single turn is refused', () => {
    broken((raw) => (raw.guides.polar.startAngle = 900), '$.guides.polar.startAngle', 'expected-in-range');
  });
});

describe('a chain arc survives the file, still editable (PQW-967, FR-FILE-3)', () => {
  const glyph = { width: 24, height: 12 };
  const arced = () => {
    const start = emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });
    return addChainArc(
      start,
      {
        rowId: start.activeRowId,
        layerId: start.activeLayerId,
        keyEntryId: 'ch',
        shape: 'arc',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        bulge: 25,
        count: 5,
      },
      glyph,
    );
  };

  test('the round trip keeps the recipe, so the arc can still be re-laid out', () => {
    const { pattern, id } = arced();
    const result = loadIrregular(saveIrregular(pattern));
    assert.ok(result.ok, 'it loads');
    assert.deepEqual(result.pattern.groups, pattern.groups, 'the group came back whole');
    const wider = updateChainArc(result.pattern, id, { count: 8 }, glyph);
    assert.equal(wider.items.length, 8, 'and it lays out again from the file');
  });

  test('a pattern with no group writes no empty list', () => {
    const plain = emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });
    assert.equal(Object.hasOwn(JSON.parse(saveIrregular(plain)), 'groups'), false, 'no groups field');
  });

  const broken = (change, path, code) => {
    const raw = JSON.parse(saveIrregular(arced().pattern));
    change(raw);
    const result = loadIrregular(JSON.stringify(raw));
    assert.equal(result.ok, false, 'refused');
    assert.equal(result.error.path, path, 'and it says where');
    assert.equal(result.error.message.code, code, 'and what was wrong');
  };

  test('a group pointing at a stitch that is not in the file is refused', () => {
    broken((raw) => (raw.groups[0].memberIds[2] = 'ghost'), '$.groups[0].memberIds[2]', 'unknown-item');
  });

  test('a count that disagrees with the listed stitches is refused', () => {
    broken((raw) => (raw.groups[0].count = 4), '$.groups[0].count', 'group-count-mismatch');
  });

  test('a group on a row that is not in the file is refused', () => {
    broken((raw) => (raw.groups[0].rowId = 'ghost'), '$.groups[0].rowId', 'unknown-row');
  });

  test('two groups claiming the same stitch are refused', () => {
    const raw = JSON.parse(saveIrregular(arced().pattern));
    raw.groups.push({ ...raw.groups[0], id: 'g2' });
    const result = loadIrregular(JSON.stringify(raw));
    assert.equal(result.ok, false, 'refused');
    assert.equal(result.error.message.code, 'shared-group-member', 'the same stitch twice');
  });
});
