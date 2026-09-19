/*
 * The written pattern: the fixed text of the worked examples in Hungarian and in
 * US terms, reading back in all three notations, the terminology, the
 * abbreviation list and the stitch key, and the read-back error messages.
 *
 * The expected texts live in tests/fixtures/written/; the Hungarian ones are
 * approved by the owner (PQW-858).
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRow, work, workIntoSame } from '../src/core/editor.ts';
import { dative, times } from '../src/core/hungarian.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { foldRepeats, mergeSteps, WrittenPatternError } from '../src/core/pattern-steps.ts';
import { formatWrittenPattern, ordinal, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import { dcRectangle, grannySquare, hdcRectangle, vStitchPattern, WORKED_EXAMPLES } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const LOCALES = ['hu', 'en-US', 'en-GB'];

const FILES = {
  'félpálcás téglalap (03 §3.1 A)': 'felpalcas-teglalap',
  'pálcás téglalap (03 §3.1 B)': 'palcas-teglalap',
  'kagyló 6+1 (03 §4.2 E)': 'kagylo',
  'V-szem (03 §4.2 F)': 'v-szem',
  'cikcakk (03 §4.2 G)': 'cikcakk',
  'hullám (03 §2.3)': 'hullam',
  'nagymama-négyzet 1–3. kör (03 §8)': 'nagymama-negyzet',
};

const textOf = (pattern, locale) => formatWrittenPattern(writePattern(pattern, testLibrary, locale));
const readBack = (text, pattern, locale) =>
  readPattern(text, { library: testLibrary, locale, conventions: pattern.conventions });

/** The lines of the pieces, without the title, the abbreviations and the stitch key. */
const instructions = (written) => written.pieces.flatMap((piece) => piece.lines).join('\n');

test('every worked example has a fixed text', () => {
  assert.deepEqual(Object.keys(FILES), Object.keys(WORKED_EXAMPLES));
});

for (const locale of ['hu', 'en-US']) {
  describe(`fixed text: ${locale}`, () => {
    for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
      test(name, () => {
        const expected = readFileSync(
          new URL(`./fixtures/written/${locale}/${FILES[name]}.txt`, import.meta.url),
          'utf8',
        );
        assert.equal(textOf(make().pattern, locale), expected);
      });
    }
  });
}

for (const locale of LOCALES) {
  describe(`read back: the text yields the same graph (${locale})`, () => {
    for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
      test(name, () => {
        const { pattern } = make();
        const result = readBack(textOf(pattern, locale), pattern, locale);
        assert.ok(result.ok, JSON.stringify(result.error));
        assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
      });
    }
  });
}

/* ---- Terminology ---- */

describe('one terminology within one pattern (01 §8.5 szabály 24–25)', () => {
  const all = (locale) => Object.values(WORKED_EXAMPLES).map((make) => textOf(make().pattern, locale));

  test('„hamispálca” and the ambiguous alternatives never appear', () => {
    for (const locale of LOCALES) {
      for (const text of all(locale)) assert.doesNotMatch(text, /hamis|kispálca|nagypálca|légszem|crab stitch/i);
    }
  });

  test('British text carries no US stitch names (sc, hdc, sl st)', () => {
    for (const text of all('en-GB')) assert.doesNotMatch(text, /\b(sc|hdc|sl st|sk)\b/);
  });

  test('US text carries no British stitch names (htr, ss, miss)', () => {
    for (const text of all('en-US')) assert.doesNotMatch(text, /\b(htr|ss|trtr|miss)\b/);
  });

  test('in English both headings name the term system, in Hungarian neither does (PQW-868)', () => {
    for (const [locale, system, other] of [
      ['en-US', 'US terms', 'UK terms'],
      ['en-GB', 'UK terms', 'US terms'],
    ]) {
      for (const text of all(locale)) {
        assert.match(text, new RegExp(`^Abbreviations \\(${system}\\)$`, 'm'));
        assert.match(text, new RegExp(`^Stitch key \\(${system}\\)$`, 'm'));
        assert.ok(!text.includes(other));
      }
    }
    for (const text of all('hu')) assert.doesNotMatch(text, /terms/);
  });

  test('the British name is the US one shifted by one step: US rp is British dc', () => {
    const lines = instructions(writePattern(WORKED_EXAMPLES['hullám (03 §2.3)']().pattern, testLibrary, 'en-GB'));
    assert.match(lines, /Row 3: ch 1 \(turning chain\), 18 dc \(18 sts\)\. Turn\./);
    assert.match(lines, /Row 4: ch 4 \(turning chain\), 2 dtr, \[tr, htr, 2 dc, htr, tr, 2 dtr\] 2 times/);
  });
});

/* ---- Abbreviation list and stitch key ---- */

describe('abbreviation list and stitch key hold only the stitches used (01 §8.5 szabály 27)', () => {
  for (const locale of LOCALES) {
    test(`every listed abbreviation appears in the lines, and every used stitch abbreviation is listed (${locale})`, () => {
      for (const make of Object.values(WORKED_EXAMPLES)) {
        const written = writePattern(make().pattern, testLibrary, locale);
        const lines = instructions(written);
        const listed = new Set(written.abbreviations.map(({ abbr }) => abbr));
        for (const { abbr } of written.abbreviations) {
          const word = abbr === 'st(s)' ? 'st' : abbr;
          assert.ok(lines.includes(word), `${written.title}: "${abbr}" does not appear in the lines`);
        }
        for (const def of testLibrary.values()) {
          const abbr = def.terms[locale].abbr;
          if (
            abbr &&
            new RegExp(`(^|[\\s(\\[])${abbr.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([\\s,.)\\]]|$)`).test(lines)
          ) {
            assert.ok(listed.has(abbr), `${written.title}: "${abbr}" is missing from the abbreviations`);
          }
        }
      }
    });
  }

  test('the stitch key follows library order, with the groups and the chain space', () => {
    const written = writePattern(WORKED_EXAMPLES['V-szem (03 §4.2 F)']().pattern, testLibrary, 'hu');
    assert.deepEqual(
      written.legend.map((entry) => entry.def),
      ['ch', 'dc', 'v-st-dc', 'ch-sp'],
    );
    assert.deepEqual(written.abbreviations, [
      { abbr: 'erp', meaning: 'egyráhajtásos pálca' },
      { abbr: 'lsz', meaning: 'láncszem' },
    ]);
  });

  test('the decrease is worded the same way in the stitch key and in the lines', () => {
    const written = writePattern(WORKED_EXAMPLES['cikcakk (03 §4.2 G)']().pattern, testLibrary, 'hu');
    assert.ok(written.legend.some((entry) => entry.label === 'fogyasztás: 2 erp összehorgolása'));
    assert.match(instructions(written), /2 erp összehorgolása/);
  });
});

/* ---- Compaction ---- */

describe('merging and the shortest repeating unit (06 §5.3 pont 5)', () => {
  const sc = { kind: 'stitch', def: 'sc', count: 1, target: 'next', mode: 'both-loops', into: 'stitch' };
  const inc = { kind: 'group', def: 'inc-2sc', target: 'next', mode: 'both-loops', into: 'stitch' };

  test('consecutive identical stitches merge into one item: „5 rp”', () => {
    assert.deepEqual(mergeSteps([sc, sc, sc, sc, sc], testLibrary), [{ ...sc, count: 5 }]);
  });

  test('„(1 rp, szaporítás) ×6”: the six repeats fold into a single unit', () => {
    const steps = Array.from({ length: 6 }, () => [sc, inc]).flat();
    assert.deepEqual(foldRepeats(steps), [{ kind: 'repeat', steps: [sc, inc], times: 6 }]);
  });

  test('the parts before and after the repeat are kept', () => {
    const steps = mergeSteps([sc, sc, inc, sc, inc, sc, inc, sc], testLibrary);
    assert.deepEqual(foldRepeats(steps), [
      { ...sc, count: 2 },
      { kind: 'repeat', steps: [inc, sc], times: 3 },
    ]);
  });

  test('writing out an increase and a stitch worked into the same stitch', () => {
    const lines = instructions(writePattern(WORKED_EXAMPLES['kagyló 6+1 (03 §4.2 E)']().pattern, testLibrary, 'hu'));
    assert.match(lines, /3 lsz \(fordulólánc\), 3 erp a következő szembe, 2 szem kihagyása/);
    assert.match(lines, /3 erp a következő szembe \(19 szem\)\. A fonal elvágása\.$/);
  });

  test('identical rows collapse into one line, the finishing row stays separate', () => {
    const { pieces } = writePattern(hdcRectangle({ rows: 4 }).pattern, testLibrary, 'hu');
    assert.deepEqual(pieces[0].lines.slice(2), [
      '3–4. sor: 2 lsz (1 fp-nek számít), 15 fp (16 szem). Fordítás.',
      '5. sor: 2 lsz (1 fp-nek számít), 15 fp (16 szem). A fonal elvágása.',
    ]);
  });
});

/* ---- Conventions ---- */

describe('the pattern conventions in the text', () => {
  /*
   * In rows too the turning chain is the first stitch of the row (PQW-940), so
   * the text spells it out: „3 lsz (1 erp-nek számít)”. Where the row's own
   * setting says otherwise — a ribbing row (ribbing.ts) — the text writes
   * „fordulólánc”, and the reader puts the override back on the event that
   * opens the row.
   */
  test('the turning chain is a stitch in rows too, and a per-row override survives the text round trip', () => {
    const example = dcRectangle({ rows: 2 });
    const piece = example.pattern.pieces[0];
    const text = textOf(example.pattern, 'hu');
    assert.match(text, /3\. sor: 3 lsz \(1 erp-nek számít\), 16 erp \(17 szem\)\. A fonal elvágása\./);
    const result = readBack(text, example.pattern, 'hu');
    assert.ok(result.ok, JSON.stringify(result.error));
    assert.equal(result.pattern.pieces[0].events[0].conventions, undefined, 'no redundant override');

    // Per-row override: here the turning chain is not a stitch, and the text carries that across.
    const events = piece.events.map((event, i) =>
      i === 0 ? { ...event, conventions: { turningChainCounts: false }, statedCount: 16 } : event,
    );
    const override = { ...example.pattern, pieces: [{ ...piece, events }] };
    const overridden = textOf(override, 'hu');
    assert.match(overridden, /3\. sor: 3 lsz \(fordulólánc\), 16 erp \(16 szem\)\./);
    const back = readBack(overridden, override, 'hu');
    assert.ok(back.ok, JSON.stringify(back.error));
    assert.deepEqual(back.pattern.pieces[0].events[0].conventions, { turningChainCounts: false });
  });

  test('a counting slip stitch shows up in the stitch count (szókészlet D7) and reads back', () => {
    const example = grannySquare();
    const conventions = { ...example.pattern.conventions, joinSlipStitchCounts: true };
    const counts = [21, 40, 56];
    const piece = example.pattern.pieces[0];
    const pattern = {
      ...example.pattern,
      conventions,
      pieces: [{ ...piece, events: piece.events.map((event, i) => ({ ...event, statedCount: counts[i] })) }],
    };
    const text = textOf(pattern, 'en-US');
    // In rounds the stitch count stands without a unit: „(21)” (04 §5.9, PQW-861).
    assert.match(text, /\(21\)\.[\s\S]*\(40\)\.[\s\S]*\(56\)\./);
    const result = readBack(text, pattern, 'en-US');
    assert.ok(result.ok, JSON.stringify(result.error));
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
  });

  test('when no chain counts, the stitch count in the text leaves out the chain spaces and still reads back (PQW-870)', () => {
    const example = vStitchPattern();
    const piece = example.pattern.pieces[0];
    const pattern = {
      ...example.pattern,
      conventions: { ...example.pattern.conventions, chainCounts: false },
      pieces: [{ ...piece, events: piece.events.map((event) => ({ ...event, statedCount: 10 })) }],
    };
    const text = textOf(pattern, 'hu');
    assert.match(text, /2\. sor: .*\(10 szem\)\. Fordítás\./);
    const result = readBack(text, pattern, 'hu');
    assert.ok(result.ok, JSON.stringify(result.error));
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));

    // Under the pattern's own convention the same text contradicts the graph.
    const strict = readBack(text, example.pattern, 'hu');
    assert.equal(strict.ok, false);
    assert.match(JSON.stringify(strict.error), /a szöveg 10 szemet ír, a visszaolvasott gráf szerint 14/);
  });
});

/* ---- Insertion mode ---- */

/**
 * A single crochet strip with 5 stitches per row: the turning chain is the first
 * stitch (PQW-891), row 1 starts at the 3rd chain, every further row skips the
 * stitch under the turning chain, and the last stitch also goes into the back
 * loop of the previous turning chain's top.
 */
function backLoopRows() {
  // 6 chains, 2 skipped for single crochet: 4 single crochets per row, 5 stitches counting the turning chain (PQW-940).
  const b = new PieceBuilder('p1', 'Hátsó szálas csík');
  const foundation = b.chain(6);
  let row = foundation
    .slice(0, 4)
    .reverse()
    .map((id) => b.stitch('sc', id));
  b.event('turn', 5);
  for (let r = 2; r <= 3; r += 1) {
    b.chain(1);
    const targets = [...row].reverse();
    row = targets.map((id) => b.stitch('sc', { into: 'stitch', id, mode: 'back-loop' }));
    b.event(r === 3 ? 'fasten-off' : 'turn', 5);
  }
  return patternOf('Hátsó szálas csík', [b.build()]);
}

describe('insertion mode: front and back loop swap on a wrong-side row (03 §2.1)', () => {
  test('in Hungarian: a right-side back loop becomes a front loop on the wrong-side row', () => {
    const lines = writePattern(backLoopRows(), testLibrary, 'hu').pieces[0].lines;
    assert.equal(lines[2], '3. sor: 1 lsz (1 rp-nek számít), 4 rp (esz) (5 szem). Fordítás.');
    assert.equal(lines[3], '4. sor: 1 lsz (1 rp-nek számít), 4 rp (hsz) (5 szem). A fonal elvágása.');
  });

  test('in English: FLO on the wrong-side row, BLO on the right-side row', () => {
    const lines = writePattern(backLoopRows(), testLibrary, 'en-US').pieces[0].lines;
    assert.match(lines[2], /4 sc FLO \(5 sts\)/);
    assert.match(lines[3], /4 sc BLO \(5 sts\)/);
  });

  for (const locale of LOCALES) {
    test(`read back, the graph stores the right-side mode (${locale})`, () => {
      const pattern = backLoopRows();
      const result = readBack(textOf(pattern, locale), pattern, locale);
      assert.ok(result.ok, JSON.stringify(result.error));
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
    });
  }
});

/* ---- Row 2 worked into the foundation chain (PQW-895) ---- */

describe('row 2 worked into the foundation chain: „hagyj ki N láncszemet, majd …” (PQW-895)', () => {
  const firstRow = (text) => text.split('\n').find((line) => /^(2\. sor|Row 2):/.test(line));

  test('when not every chain takes exactly one stitch (shell, V-stitch), the steps follow the skip', () => {
    const shell = WORKED_EXAMPLES['kagyló 6+1 (03 §4.2 E)']().pattern;
    assert.equal(
      firstRow(textOf(shell, 'hu')),
      '2. sor: hagyj ki 1 láncszemet, majd 1 rp, [2 láncszem kihagyása, kagyló, 2 láncszem kihagyása, 1 rp] 3-szor (19 szem). Fordítás.',
    );
    assert.equal(
      firstRow(textOf(shell, 'en-US')),
      'Row 2: skip 1 ch, sc, [sk 2 ch, sh, sk 2 ch, sc] 3 times (19 sts). Turn.',
    );
    assert.match(firstRow(textOf(shell, 'en-GB')), /^Row 2: miss 1 ch, dc, \[miss 2 ch, /);
    const v = vStitchPattern().pattern;
    assert.match(
      firstRow(textOf(v, 'hu')),
      /^2\. sor: hagyj ki 3 láncszemet, majd 1 erp, 1 láncszem kihagyása, V-szem, /,
    );
    for (const pattern of [shell, v]) {
      for (const locale of LOCALES) {
        const result = readBack(textOf(pattern, locale), pattern, locale);
        assert.ok(result.ok, JSON.stringify(result.error));
        assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${pattern.title} ${locale}`);
      }
    }
  });

  test('text saved with the pre-PQW-895 sentence is rejected by the reader, which names the reason (PQW-924)', () => {
    const cases = [
      [
        hdcRectangle().pattern,
        {
          hu: '2. sor: a horogtól számított 4. láncszemtől kezdve (a kihagyott láncszemek 1 fp-nek számítanak) 14 fp (15 szem). Fordítás.',
          'en-US': 'Row 2: Starting in 4th ch from hook (skipped ch count as 1 hdc), 14 hdc (15 sts). Turn.',
          'en-GB': 'Row 2: Starting in 4th ch from hook (skipped ch count as 1 htr), 14 htr (15 sts). Turn.',
        },
      ],
      [
        WORKED_EXAMPLES['kagyló 6+1 (03 §4.2 E)']().pattern,
        {
          hu: '2. sor: a horogtól számított 2. láncszemtől kezdve 1 rp, [2 láncszem kihagyása, kagyló, 2 láncszem kihagyása, 1 rp] 3-szor (19 szem). Fordítás.',
          'en-US': 'Row 2: Starting in 2nd ch from hook, sc, [sk 2 ch, sh, sk 2 ch, sc] 3 times (19 sts). Turn.',
        },
      ],
    ];
    for (const [pattern, oldLines] of cases) {
      for (const [locale, oldLine] of Object.entries(oldLines)) {
        const text = textOf(pattern, locale);
        const old = text.replace(firstRow(text), oldLine);
        assert.notEqual(old, text);
        const result = readBack(old, pattern, locale);
        // Text written under the earlier rule is not silently reinterpreted (PQW-924).
        assert.equal(result.ok, false, `${pattern.title} ${locale}`);
        assert.match(
          result.error.message,
          locale === 'hu' ? /korábbi szabály szerint készült/ : /earlier rule/,
          `${pattern.title} ${locale}`,
        );
      }
    }
  });
});

/* ---- Errors ---- */

describe('a new section above the same row after the yarn is cut (PQW-901)', () => {
  /** A four-stitch row 2, the left shoulder above it, then the right shoulder with new yarn above the same row. */
  const shoulders = () => {
    const builder = new PieceBuilder('p1', 'Elejerész');
    const chains = builder.chain(5);
    const row1 = [...chains.slice(0, 4)].reverse().map((chain) => builder.stitch('sc', chain));
    builder.event('turn', 4);
    builder.chain(1);
    for (const target of [row1[3], row1[2]]) builder.stitch('sc', target);
    builder.event('fasten-off', 2);
    builder.chain(1);
    for (const target of [row1[1], row1[0]]) builder.stitch('sc', target);
    builder.event('fasten-off', 2);
    const piece = builder.build();
    const events = piece.events.map((event, i) =>
      i === 1 ? { ...event, resume: { layer: 1, name: 'Jobb váll' } } : event,
    );
    return patternOf('Két váll', [{ ...piece, events }], { turningChainCounts: false });
  };

  test('the section name says which row it continues above, and the row numbering restarts', () => {
    const lines = instructions(writePattern(shoulders(), testLibrary, 'hu'));
    assert.match(lines, /Jobb váll \(a 2\. sor fölött\):/);
    // Both shoulders sit above row 2: the section name is what tells them apart.
    assert.equal(lines.match(/^3\. sor: /gm).length, 2);
  });

  for (const locale of LOCALES) {
    test(`read back to the very same graph (${locale})`, () => {
      const pattern = shoulders();
      const result = readBack(textOf(pattern, locale), pattern, locale);
      assert.ok(result.ok, result.ok ? '' : `${result.error.line}: ${result.error.message}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
    });
  }
});

describe('read back: a precise error message on a mismatch', () => {
  const pattern = hdcRectangle({ rows: 2 }).pattern;
  const text = textOf(pattern, 'hu');
  const lineOf = (needle) => text.split('\n').findIndex((line) => line.includes(needle)) + 1;

  test('a correct text reads back', () => {
    assert.ok(readBack(text, pattern, 'hu').ok);
  });

  test('wrong stitch count: the line and both numbers', () => {
    const wrong = text.replace(
      'minden láncszembe 1 fp (16 szem). Fordítás.',
      'minden láncszembe 1 fp (17 szem). Fordítás.',
    );
    assert.notEqual(wrong, text);
    const result = readBack(wrong, pattern, 'hu');
    assert.deepEqual(result, {
      ok: false,
      error: { line: lineOf('2. sor:'), message: '2. sor: a szöveg 17 szemet ír, a visszaolvasott gráf szerint 16.' },
    });
  });

  test('more stitches than the previous row can hold', () => {
    const result = readBack(
      text.replace('3. sor: 2 lsz (1 fp-nek számít), 15 fp', '3. sor: 2 lsz (1 fp-nek számít), 16 fp'),
      pattern,
      'hu',
    );
    // The top of the turning chain is a target too (PQW-944), so the 16th stitch still fits; the stitch count does not add up.
    assert.deepEqual(result.error, {
      line: lineOf('3. sor:'),
      message: '3. sor: a szöveg 16 szemet ír, a visszaolvasott gráf szerint 17.',
    });
  });

  test('unknown item', () => {
    const result = readBack(
      text.replace('15 fp (16 szem). A fonal', '15 hamispálca (16 szem). A fonal'),
      pattern,
      'hu',
    );
    assert.deepEqual(result.error, { line: lineOf('3. sor:'), message: 'Nem értelmezhető tétel: „15 hamispálca”.' });
  });

  test('a missing row ending in an intermediate row', () => {
    const result = readBack(text.replace('(16 szem). Fordítás.', '(16 szem).'), pattern, 'hu');
    assert.deepEqual(result.error, {
      line: lineOf('2. sor:'),
      message: 'A sor vége hiányzik: fordítás, a kör zárása vagy a fonal elvágása.',
    });
  });

  test('the row numbering does not continue', () => {
    const result = readBack(text.replace('3. sor:', '4. sor:'), pattern, 'hu');
    assert.deepEqual(result.error, { line: lineOf('3. sor:'), message: 'A sorszám nem folytatódik: 3 helyett 4.' });
  });
});

describe('a graph the text cannot express yet', () => {
  test('crossed stitch: throws an error naming the stitch involved', () => {
    const { pattern, rows } = hdcRectangle({ rows: 2 });
    const piece = pattern.pieces[0];
    const crossed = {
      ...pattern,
      pieces: [
        {
          ...piece,
          stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)),
        },
      ],
    };
    assert.throws(
      () => writePattern(crossed, testLibrary, 'hu'),
      (error) => error instanceof WrittenPatternError && error.nodes[0] === rows[2][3],
    );
  });
});

/* ---- Hungarian inflection and English ordinals ---- */

test('„-szor, -szer, -ször” follows how the number is pronounced', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000].map(times), [
    '1-szer',
    '2-szer',
    '3-szor',
    '4-szer',
    '5-ször',
    '6-szor',
    '7-szer',
    '8-szor',
    '9-szer',
    '10-szer',
    '12-szer',
    '15-ször',
    '20-szor',
    '30-szor',
    '40-szer',
    '50-szer',
    '60-szor',
    '70-szer',
    '80-szor',
    '90-szer',
    '100-szor',
    '1000-szer',
  ]);
});

test('dative: hyphenated after an abbreviation, by vowel harmony after a full name', () => {
  assert.equal(dative('erp', true), 'erp-nek');
  assert.equal(dative('háromráhajtásos pálca', false), 'háromráhajtásos pálcának');
  assert.equal(dative('rákhurok', false), 'rákhuroknak');
  assert.equal(dative('pikó', false), 'pikónak');
});

test('English ordinals: 1st, 2nd, 3rd, 4th, 11th, 21st', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
  ]);
});

/*
 * Bare chain stitches placed in the middle of a row (PQW-937).
 *
 * This is how the owner works the wave pattern: increase cluster, skip, chains,
 * skip. The chart showed it correctly, but the written pattern stopped with a
 * cannot-express-this-yet error — because it only accepted a run of chains that
 * was also a chain space.
 */
describe('the written pattern for chain stitches standing mid-row (PQW-937)', () => {
  const ok = (result) => {
    assert.ok(result.ok, JSON.stringify(result.reason));
    return result.pattern;
  };
  const cluster = (pattern, slot) => {
    const first = ok(work(pattern, { def: 'dc', count: 1 }, slot));
    return ok(workIntoSame(ok(workIntoSame(first, 'dc', slot)), 'dc', slot));
  };

  /** The owner's repeating motif: 3 erp into one stitch, skip, 3 chains, skip. */
  const wavePattern = () => {
    let pattern = ok(endRow(ok(work(emptyPattern(), { def: 'ch', count: 22 }, 0))));
    for (const def of ['sc', 'sc', 'dc', 'dc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    for (const slot of [6, 12]) {
      pattern = cluster(pattern, slot);
      pattern = ok(work(pattern, { def: 'ch', count: 3 }, slot + 2));
    }
    return cluster(pattern, 18);
  };

  test('the chains and the skips are spelled out, even without a chain space', () => {
    const pattern = wavePattern();
    const row = instructions(writePattern(pattern, libraryFor(pattern), 'hu'))
      .split('\n')
      .find((line) => line.startsWith('2. sor'));

    assert.ok(row, 'row 2 does get written out instead of failing as inexpressible');
    assert.match(row, /3 lsz/, 'the chains are spelled out');
    assert.match(row, /kihagyás/, 'the skipped stitches are spelled out');
    assert.match(row, /3 erp a következő láncszembe/, 'the increase cluster is spelled out');
  });
});
