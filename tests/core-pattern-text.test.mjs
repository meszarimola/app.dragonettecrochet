/*
 * Az írott minta: a kidolgozott példák rögzített szövege magyarul és amerikai
 * jelöléssel, a visszaolvasás mindhárom jelöléssel, a terminológia, a
 * rövidítéslista és a jelmagyarázat, és a visszaolvasás hibaüzenetei.
 *
 * Az elvárt szövegek a tests/fixtures/written/ mappában vannak; a magyarokat a
 * tulajdonos hagyja jóvá (PQW-858).
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { dative, times } from '../src/core/hungarian.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { WrittenPatternError, foldRepeats, mergeSteps } from '../src/core/pattern-steps.ts';
import { formatWrittenPattern, ordinal, writePattern } from '../src/core/pattern-text.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import { WORKED_EXAMPLES, dcRectangle, grannySquare, hdcRectangle, vStitchPattern } from './fixtures/examples.ts';
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
const readBack = (text, pattern, locale) => readPattern(text, { library: testLibrary, locale, conventions: pattern.conventions });

/** A darabok sorai: a cím, a rövidítések és a jelmagyarázat nélkül. */
const instructions = (written) => written.pieces.flatMap((piece) => piece.lines).join('\n');

test('minden kidolgozott példának van rögzített szövege', () => {
  assert.deepEqual(Object.keys(FILES), Object.keys(WORKED_EXAMPLES));
});

for (const locale of ['hu', 'en-US']) {
  describe(`rögzített szöveg: ${locale}`, () => {
    for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
      test(name, () => {
        const expected = readFileSync(new URL(`./fixtures/written/${locale}/${FILES[name]}.txt`, import.meta.url), 'utf8');
        assert.equal(textOf(make().pattern, locale), expected);
      });
    }
  });
}

for (const locale of LOCALES) {
  describe(`visszaolvasás: a szövegből ugyanaz a gráf (${locale})`, () => {
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

/* ---- Terminológia ---- */

describe('egy mintán belül egy terminológia (01 §8.5 szabály 24–25)', () => {
  const all = (locale) => Object.values(WORKED_EXAMPLES).map((make) => textOf(make().pattern, locale));

  test('a „hamispálca” és az értelmezési alternatívák soha nem jelennek meg', () => {
    for (const locale of LOCALES) {
      for (const text of all(locale)) assert.doesNotMatch(text, /hamis|kispálca|nagypálca|légszem|crab stitch/i);
    }
  });

  test('a brit szövegben nincs amerikai szemnév (sc, hdc, sl st)', () => {
    for (const text of all('en-GB')) assert.doesNotMatch(text, /\b(sc|hdc|sl st|sk)\b/);
  });

  test('az amerikai szövegben nincs brit szemnév (htr, ss, miss)', () => {
    for (const text of all('en-US')) assert.doesNotMatch(text, /\b(htr|ss|trtr|miss)\b/);
  });

  test('angol szövegben mindkét címsor megnevezi a rendszert, magyarban nincs ilyen (PQW-868)', () => {
    for (const [locale, system, other] of [['en-US', 'US terms', 'UK terms'], ['en-GB', 'UK terms', 'US terms']]) {
      for (const text of all(locale)) {
        assert.match(text, new RegExp(`^Abbreviations \\(${system}\\)$`, 'm'));
        assert.match(text, new RegExp(`^Stitch key \\(${system}\\)$`, 'm'));
        assert.ok(!text.includes(other));
      }
    }
    for (const text of all('hu')) assert.doesNotMatch(text, /terms/);
  });

  test('a brit név az amerikai egy fokkal eltolva: az amerikai rp a brit dc', () => {
    const lines = instructions(writePattern(WORKED_EXAMPLES['hullám (03 §2.3)']().pattern, testLibrary, 'en-GB'));
    assert.match(lines, /Row 3: ch 1 \(does not count as a st\), 18 dc \(18 sts\)\. Turn\./);
    assert.match(lines, /Row 4: ch 4 \(counts as 1 dtr\), dtr, \[tr, htr, 2 dc, htr, tr, 2 dtr\] 2 times/);
  });
});

/* ---- Rövidítéslista és jelmagyarázat ---- */

describe('rövidítéslista és jelmagyarázat csak a használt szemekkel (01 §8.5 szabály 27)', () => {
  for (const locale of LOCALES) {
    test(`minden felsorolt rövidítés szerepel a sorokban, és minden használt szemrövidítés fel van sorolva (${locale})`, () => {
      for (const make of Object.values(WORKED_EXAMPLES)) {
        const written = writePattern(make().pattern, testLibrary, locale);
        const lines = instructions(written);
        const listed = new Set(written.abbreviations.map(({ abbr }) => abbr));
        for (const { abbr } of written.abbreviations) {
          const word = abbr === 'st(s)' ? 'st' : abbr;
          assert.ok(lines.includes(word), `${written.title}: „${abbr}” nem szerepel a sorokban`);
        }
        for (const def of testLibrary.values()) {
          const abbr = def.terms[locale].abbr;
          if (abbr && new RegExp(`(^|[\\s(\\[])${abbr.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([\\s,.)\\]]|$)`).test(lines)) {
            assert.ok(listed.has(abbr), `${written.title}: „${abbr}” hiányzik a rövidítések közül`);
          }
        }
      }
    });
  }

  test('a jelmagyarázat a könyvtár sorrendjében, a csoportokkal és a láncívvel', () => {
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

  test('a fogyasztás a jelmagyarázatban és a sorokban ugyanazzal a kifejezéssel szerepel', () => {
    const written = writePattern(WORKED_EXAMPLES['cikcakk (03 §4.2 G)']().pattern, testLibrary, 'hu');
    assert.ok(written.legend.some((entry) => entry.label === 'fogyasztás: 2 erp összehorgolása'));
    assert.match(instructions(written), /2 erp összehorgolása/);
  });
});

/* ---- Tömörítés ---- */

describe('összevonás és a legrövidebb ismétlődő egység (06 §5.3 pont 5)', () => {
  const sc = { kind: 'stitch', def: 'sc', count: 1, target: 'next', mode: 'both-loops', into: 'stitch' };
  const inc = { kind: 'group', def: 'inc-2sc', target: 'next', mode: 'both-loops', into: 'stitch' };

  test('az egymás utáni azonos szemek egy tételbe kerülnek: „5 rp”', () => {
    assert.deepEqual(mergeSteps([sc, sc, sc, sc, sc], testLibrary), [{ ...sc, count: 5 }]);
  });

  test('„(1 rp, szaporítás) ×6”: a hat ismétlés egy egységgé áll össze', () => {
    const steps = Array.from({ length: 6 }, () => [sc, inc]).flat();
    assert.deepEqual(foldRepeats(steps), [{ kind: 'repeat', steps: [sc, inc], times: 6 }]);
  });

  test('az ismétlés előtti és utáni rész megmarad', () => {
    const steps = mergeSteps([sc, sc, inc, sc, inc, sc, inc, sc], testLibrary);
    assert.deepEqual(foldRepeats(steps), [{ ...sc, count: 2 }, { kind: 'repeat', steps: [inc, sc], times: 3 }]);
  });

  test('a szaporítás és az ugyanabba a szembe horgolt szem kiírása', () => {
    const lines = instructions(writePattern(WORKED_EXAMPLES['kagyló 6+1 (03 §4.2 E)']().pattern, testLibrary, 'hu'));
    assert.match(lines, /3 lsz \(1 erp-nek számít\), 2 erp ugyanabba a szembe, 2 szem kihagyása/);
    assert.match(lines, /3 erp a következő szembe \(19 szem\)\. A fonal elvágása\.$/);
  });

  test('az azonos sorok egy sorba kerülnek, a befejező sor külön', () => {
    const { pieces } = writePattern(hdcRectangle({ rows: 4 }).pattern, testLibrary, 'hu');
    assert.deepEqual(pieces[0].lines.slice(2), [
      '3–4. sor: 2 lsz (1 fp-nek számít), 14 fp (15 szem). Fordítás.',
      '5. sor: 2 lsz (1 fp-nek számít), 14 fp (15 szem). A fonal elvágása.',
    ]);
  });
});

/* ---- Konvenciók ---- */

describe('a minta konvenciói a szövegben', () => {
  test('a soronként felülírt fordulólánc a szövegben látszik, és visszaolvasva felülírás marad', () => {
    // A 2. sor fordulólánca nem számít, ezért az alatta lévő szemet szándékosan kihagyja.
    const example = dcRectangle({ rows: 2 });
    const piece = example.pattern.pieces[0];
    const events = piece.events.map((event, i) =>
      i === 0 ? { ...event, conventions: { turningChainCounts: false } } : { ...event, statedCount: 15 },
    );
    const skipped = [example.rows[1].at(-1)];
    const pattern = { ...example.pattern, pieces: [{ ...piece, events, skipped }] };

    const text = textOf(pattern, 'hu');
    assert.match(text, /3\. sor: 3 lsz \(nem számít szemnek\), 1 szem kihagyása, 15 erp \(15 szem\)\. A fonal elvágása\./);
    const result = readBack(text, pattern, 'hu');
    assert.ok(result.ok, JSON.stringify(result.error));
    assert.deepEqual(result.pattern.pieces[0].events[0].conventions, { turningChainCounts: false });
  });

  test('a számító kúszószem a szemszámban (szókészlet D7), és visszaolvasható', () => {
    const example = grannySquare();
    const conventions = { ...example.pattern.conventions, joinSlipStitchCounts: true };
    const counts = [21, 40, 40];
    const piece = example.pattern.pieces[0];
    const pattern = {
      ...example.pattern,
      conventions,
      pieces: [{ ...piece, events: piece.events.map((event, i) => ({ ...event, statedCount: counts[i] })) }],
    };
    const text = textOf(pattern, 'en-US');
    // Körben a szemszám egység nélkül áll: „(21)” (04 §5.9, PQW-861).
    assert.match(text, /\(21\)\.[\s\S]*\(40\)\.[\s\S]*\(40\)\./);
    const result = readBack(text, pattern, 'en-US');
    assert.ok(result.ok, JSON.stringify(result.error));
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
  });

  test('ha egyik láncszem sem számít, a szöveg szemszáma láncívek nélküli, és visszaolvasható (PQW-870)', () => {
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

    // A használat szerinti szabállyal ugyanez a szöveg ellentmond a gráfnak.
    const strict = readBack(text, example.pattern, 'hu');
    assert.equal(strict.ok, false);
    assert.match(JSON.stringify(strict.error), /a szöveg 10 szemet ír, a visszaolvasott gráf szerint 14/);
  });
});

/* ---- Beszúrási mód ---- */

/**
 * Rövidpálcás csík soronként 5 szemmel: a fordulólánc az első szem (PQW-891), az
 * 1. sor a 3. láncszemtől, a többi sor kihagyja a fordulólánc alatti szemet, és
 * az utolsó szem is hátsó szálba megy az előző fordulólánc tetejébe.
 */
function backLoopRows() {
  const b = new PieceBuilder('p1', 'Hátsó szálas csík');
  const foundation = b.chain(6);
  let row = foundation.slice(0, 4).reverse().map((id) => b.stitch('sc', id));
  b.event('turn', 5);
  let top = foundation[5];
  for (let r = 2; r <= 3; r += 1) {
    const turning = b.chain(1);
    const targets = [...[...row].reverse().slice(1), top];
    row = targets.map((id) => b.stitch('sc', { into: 'stitch', id, mode: 'back-loop' }));
    top = turning[0];
    b.event(r === 3 ? 'fasten-off' : 'turn', 5);
  }
  return patternOf('Hátsó szálas csík', [b.build()]);
}

describe('beszúrási mód: visszai soron az első és a hátsó szál megfordul (03 §2.1)', () => {
  test('magyarul: a színoldali hátsó szál a visszai soron első szál', () => {
    const lines = writePattern(backLoopRows(), testLibrary, 'hu').pieces[0].lines;
    assert.equal(lines[2], '3. sor: 1 lsz (1 rp-nek számít), 4 rp (esz) (5 szem). Fordítás.');
    assert.equal(lines[3], '4. sor: 1 lsz (1 rp-nek számít), 4 rp (hsz) (5 szem). A fonal elvágása.');
  });

  test('angolul: FLO a visszai, BLO a színoldali soron', () => {
    const lines = writePattern(backLoopRows(), testLibrary, 'en-US').pieces[0].lines;
    assert.match(lines[2], /4 sc FLO \(5 sts\)/);
    assert.match(lines[3], /4 sc BLO \(5 sts\)/);
  });

  for (const locale of LOCALES) {
    test(`visszaolvasva a gráf a színoldali módot tárolja (${locale})`, () => {
      const pattern = backLoopRows();
      const result = readBack(textOf(pattern, locale), pattern, locale);
      assert.ok(result.ok, JSON.stringify(result.error));
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
    });
  }
});

/* ---- A láncalapra horgolt 2. sor (PQW-895) ---- */

describe('a láncalapra horgolt 2. sor: „hagyj ki N láncszemet, majd …” (PQW-895)', () => {
  const firstRow = (text) => text.split('\n').find((line) => /^(2\. sor|Row 2):/.test(line));

  test('ha nem minden láncszembe egy szem megy (kagyló, V-szem), a kihagyás után a lépések következnek', () => {
    const shell = WORKED_EXAMPLES['kagyló 6+1 (03 §4.2 E)']().pattern;
    assert.equal(
      firstRow(textOf(shell, 'hu')),
      '2. sor: hagyj ki 1 láncszemet, majd 1 rp, [2 láncszem kihagyása, kagyló, 2 láncszem kihagyása, 1 rp] 3-szor (19 szem). Fordítás.',
    );
    assert.equal(firstRow(textOf(shell, 'en-US')), 'Row 2: skip 1 ch, sc, [sk 2 ch, sh, sk 2 ch, sc] 3 times (19 sts). Turn.');
    assert.match(firstRow(textOf(shell, 'en-GB')), /^Row 2: miss 1 ch, dc, \[miss 2 ch, /);
    const v = vStitchPattern().pattern;
    assert.match(firstRow(textOf(v, 'hu')), /^2\. sor: hagyj ki 3 láncszemet, majd 1 erp, 1 láncszem kihagyása, V-szem, /);
    for (const pattern of [shell, v]) {
      for (const locale of LOCALES) {
        const result = readBack(textOf(pattern, locale), pattern, locale);
        assert.ok(result.ok, JSON.stringify(result.error));
        assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${pattern.title} ${locale}`);
      }
    }
  });

  test('a PQW-895 előtti mondattal mentett szöveg ugyanarra a gráfra olvasható vissza', () => {
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
        assert.ok(result.ok, `${pattern.title} ${locale}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${pattern.title} ${locale}`);
      }
    }
  });
});

/* ---- Hibák ---- */

describe('elvágott fonal után új szakasz ugyanazon sor fölött (PQW-901)', () => {
  /** Négy szemes 2. sor, fölötte a bal váll, majd új fonallal a jobb váll ugyanazon sor fölött. */
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
    const events = piece.events.map((event, i) => (i === 1 ? { ...event, resume: { layer: 1, name: 'Jobb váll' } } : event));
    return patternOf('Két váll', [{ ...piece, events }], { turningChainCounts: false });
  };

  test('a szakasz neve megmondja, melyik sor fölött folytatódik, és a sorszám újraindul', () => {
    const lines = instructions(writePattern(shoulders(), testLibrary, 'hu'));
    assert.match(lines, /Jobb váll \(a 2\. sor fölött\):/);
    // Mindkét váll a 2. sor: a szakasz neve különbözteti meg őket.
    assert.equal(lines.match(/^3\. sor: /gm).length, 2);
  });

  for (const locale of LOCALES) {
    test(`visszaolvasva ugyanaz a gráf (${locale})`, () => {
      const pattern = shoulders();
      const result = readBack(textOf(pattern, locale), pattern, locale);
      assert.ok(result.ok, result.ok ? '' : `${result.error.line}: ${result.error.message}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern));
    });
  }
});

describe('visszaolvasás: eltérés esetén pontos hibaüzenet', () => {
  const pattern = hdcRectangle({ rows: 2 }).pattern;
  const text = textOf(pattern, 'hu');
  const lineOf = (needle) => text.split('\n').findIndex((line) => line.includes(needle)) + 1;

  test('a hibátlan szöveg visszaolvasható', () => {
    assert.ok(readBack(text, pattern, 'hu').ok);
  });

  test('rossz szemszám: a sor és a két szám', () => {
    const wrong = text.replace('minden láncszembe 1 fp (15 szem). Fordítás.', 'minden láncszembe 1 fp (16 szem). Fordítás.');
    assert.notEqual(wrong, text);
    const result = readBack(wrong, pattern, 'hu');
    assert.deepEqual(result, {
      ok: false,
      error: { line: lineOf('2. sor:'), message: '2. sor: a szöveg 16 szemet ír, a visszaolvasott gráf szerint 15.' },
    });
  });

  test('több szem, mint amennyi az előző sorban van', () => {
    const result = readBack(text.replace('3. sor: 2 lsz (1 fp-nek számít), 14 fp', '3. sor: 2 lsz (1 fp-nek számít), 15 fp'), pattern, 'hu');
    assert.deepEqual(result.error, { line: lineOf('3. sor:'), message: 'Nincs több szem az előző sorban ehhez: „15 fp”.' });
  });

  test('ismeretlen tétel', () => {
    const result = readBack(text.replace('14 fp (15 szem). A fonal', '14 hamispálca (15 szem). A fonal'), pattern, 'hu');
    assert.deepEqual(result.error, { line: lineOf('3. sor:'), message: 'Nem értelmezhető tétel: „14 hamispálca”.' });
  });

  test('hiányzó sorvég egy közbülső sorban', () => {
    const result = readBack(text.replace('(15 szem). Fordítás.', '(15 szem).'), pattern, 'hu');
    assert.deepEqual(result.error, { line: lineOf('2. sor:'), message: 'A sor vége hiányzik: fordítás, a kör zárása vagy a fonal elvágása.' });
  });

  test('a sorszám nem folytatódik', () => {
    const result = readBack(text.replace('3. sor:', '4. sor:'), pattern, 'hu');
    assert.deepEqual(result.error, { line: lineOf('3. sor:'), message: 'A sorszám nem folytatódik: 3 helyett 4.' });
  });
});

describe('a gráf, amit a szöveg még nem tud kifejezni', () => {
  test('keresztezett szem: hibát ad az érintett szemmel', () => {
    const { pattern, rows } = hdcRectangle({ rows: 2 });
    const piece = pattern.pieces[0];
    const crossed = {
      ...pattern,
      pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)) }],
    };
    assert.throws(
      () => writePattern(crossed, testLibrary, 'hu'),
      (error) => error instanceof WrittenPatternError && error.nodes[0] === rows[2][3],
    );
  });
});

/* ---- Magyar ragozás és angol sorszám ---- */

test('„-szor, -szer, -ször” a szám kiejtése szerint', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000].map(times),
    [
      '1-szer', '2-szer', '3-szor', '4-szer', '5-ször', '6-szor', '7-szer', '8-szor', '9-szer', '10-szer',
      '12-szer', '15-ször', '20-szor', '30-szor', '40-szer', '50-szer', '60-szor', '70-szer', '80-szor',
      '90-szer', '100-szor', '1000-szer',
    ],
  );
});

test('részeshatározó: rövidítésnél kötőjellel, névnél hangrend szerint', () => {
  assert.equal(dative('erp', true), 'erp-nek');
  assert.equal(dative('háromráhajtásos pálca', false), 'háromráhajtásos pálcának');
  assert.equal(dative('rákhurok', false), 'rákhuroknak');
  assert.equal(dative('pikó', false), 'pikónak');
});

test('angol sorszám: 1st, 2nd, 3rd, 4th, 11th, 21st', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
});
