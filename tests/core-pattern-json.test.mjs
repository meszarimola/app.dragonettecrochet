import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { FORMAT_VERSION, loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { validatePattern } from '../src/core/validate.ts';
import { editNode } from './fixtures/builder.ts';
import { WORKED_EXAMPLES, dcRectangle } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/stitch-defs.ts';

describe('mentés után betöltve ugyanazt a gráfot kapjuk', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    test(name, () => {
      const { pattern } = make();
      const saved = savePattern(pattern);
      const loaded = loadPattern(saved);

      assert.equal(loaded.ok, true);
      assert.deepEqual(loaded.pattern, pattern);
      assert.equal(savePattern(loaded.pattern), saved);
      assert.deepEqual(validatePattern(loaded.pattern, testLibrary), []);
    });
  }
});

test('a nem kötelező mezők is megmaradnak', () => {
  const { pattern, rows } = dcRectangle({ rows: 3 });
  const piece = pattern.pieces[0];
  const withExtras = {
    ...pattern,
    conventions: { ...pattern.conventions, repeat: { repeatWidth: 1, edgeStitches: 0, turningChainIncluded: false } },
    pieces: [
      {
        ...piece,
        stitches: piece.stitches.map((node) =>
          node.id === rows[2][0] ? { ...node, flags: ['crossed'], pinned: { x: 1.5, y: -2, rotation: 90 } } : node,
        ),
        events: piece.events.map((event, i) => (i === 0 ? { ...event, conventions: { turningChainCounts: false } } : event)),
        skipped: [rows[1][0]],
      },
    ],
  };
  assert.deepEqual(loadPattern(savePattern(withExtras)).pattern, withExtras);
});

test('a mentés verziózott, a formátum verziója az első mező', () => {
  const saved = savePattern(dcRectangle({ rows: 1 }).pattern);
  assert.equal(FORMAT_VERSION, 1);
  assert.match(saved, /^\{\n {2}"formatVersion": 1,/);
});

test('újabb formátumú mintát nem tölt be', () => {
  const saved = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  const result = loadPattern(JSON.stringify({ ...saved, formatVersion: 2 }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'unsupported-version');
});

test('érvénytelen JSON-ra hibát ad', () => {
  const result = loadPattern('{"formatVersion": 1,');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'invalid-json');
});

describe('a formátum hibáit mezőútvonallal jelzi', () => {
  const saved = () => JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  const cases = [
    ['hiányzó cím', (raw) => delete raw.title, '$.title'],
    ['ismeretlen mező egy öltésen', (raw) => (raw.pieces[0].stitches[0].color = 'piros'), '$.pieces[0].stitches[0].color'],
    ['ismeretlen beszúrási mód', (raw) => (raw.pieces[0].stitches[20].anchors[0].mode = 'third-loop'), '$.pieces[0].stitches[20].anchors[0].mode'],
    ['rossz eseményfajta', (raw) => (raw.pieces[0].events[0].kind = 'forditas'), '$.pieces[0].events[0].kind'],
    ['negatív öltésszám', (raw) => (raw.pieces[0].events[0].statedCount = -1), '$.pieces[0].events[0].statedCount'],
    ['régebbi, nem létező verzió', (raw) => (raw.formatVersion = 0), '$.formatVersion'],
  ];
  for (const [name, mutate, path] of cases) {
    test(name, () => {
      const raw = saved();
      mutate(raw);
      const result = loadPattern(JSON.stringify(raw));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'invalid-format');
      assert.equal(result.error.path, path);
    });
  }
});

test('hibás gráfot is betölt; a gráfot az ellenőrző nézi, nem a betöltés', () => {
  const { pattern, rows } = dcRectangle({ rows: 2 });
  const broken = editNode(pattern, rows[2][3], { anchors: ['nincs-ilyen'] });
  const loaded = loadPattern(savePattern(broken));
  assert.equal(loaded.ok, true);
  assert.deepEqual(
    validatePattern(loaded.pattern, testLibrary).map((finding) => finding.rule),
    ['dangling-reference'],
  );
});

test('formátumon kívüli mintát nem ment el', () => {
  const pattern = { ...dcRectangle({ rows: 1 }).pattern, formatVersion: 3 };
  assert.throws(() => savePattern(pattern), /Megengedett értékek: 1/);
});
