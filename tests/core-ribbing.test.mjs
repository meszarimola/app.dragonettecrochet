/*
 * Bordás szegély és perem relief szemekkel (PQW-909; 01 §2.2 [S25], §4.3, 03 §7.1):
 * a bordázat a sorépítőben szemenkénti beszúrási móddal készül, sík darab
 * szélén és körben horgolt darab peremén is, ismétlésként kiírva és
 * visszaolvashatóan.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { DEFAULT_RIBBING, MAX_RIBBING_ROWS, appendRibbing, ribbingProblem } from '../src/core/ribbing.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { legendInsertions } from '../src/ui/chart-svg.ts';

const errors = (pattern) =>
  validatePattern(pattern, libraryFor(pattern))
    .filter((finding) => finding.severity === 'error')
    .map((finding) => finding.rule);

const text = (pattern) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));

/** Sík téglalap bordás szegéllyel. */
function flat(options = DEFAULT_RIBBING) {
  const shape = generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 10, heightCm: 6, stitch: 'dc', border: null });
  assert.ok(shape.ok, shape.reason);
  const piece = appendRibbing(shape.pattern, shape.pattern.pieces[0], libraryFor(shape.pattern), options);
  assert.equal(typeof piece, 'object', String(piece));
  return { ...shape.pattern, pieces: [piece] };
}

/** Körben horgolt darab bordás peremmel; a szemszámot az ismétléshez igazítjuk. */
function roundPiece(options = DEFAULT_RIBBING) {
  const motif = generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'circle', stitch: 'dc', rounds: 3, closing: 'join-slip' });
  assert.ok(motif.ok, motif.reason);
  const piece = appendRibbing(motif.pattern, motif.pattern.pieces[0], libraryFor(motif.pattern), options);
  return { pattern: motif.pattern, piece };
}

describe('bordás szegély sík darabon', () => {
  test('a bordázat hibátlanul átmegy az ellenőrzőn', () => {
    assert.deepEqual(errors(flat()), []);
  });

  test('a bordázat nem változtatja meg a szemszámot', () => {
    const pattern = flat();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const layers = graph.layers.filter((layer) => layer.index > 0);
    const last = layers[layers.length - 1];
    const before = layers[layers.length - 1 - DEFAULT_RIBBING.rows];
    assert.equal(last.stitchCount, before.stitchCount);
  });

  test('a relief sor fordulólánca nem számít szemnek, és egy láncszemmel rövidebb', () => {
    const pattern = flat();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const ribbed = graph.layers[graph.layers.length - 1];
    assert.equal(ribbed.turningChainCounts, false);
    // Pálcánál 3 lsz helyett 2 lsz (01 §2.2 [S25]).
    assert.equal(ribbed.turningChain.length, 2);
  });

  test('a bordázat ismétlésként íródik ki, nem szemenként felsorolva', () => {
    const written = text(flat());
    assert.match(written, /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
    assert.match(written, /Eerp – első relief egyráhajtásos pálca/);
    assert.match(written, /Herp – hátsó relief egyráhajtásos pálca/);
  });

  test('az írott minta visszaolvasható', () => {
    const pattern = flat();
    const written = text(pattern);
    const back = readPattern(written, { library: libraryFor(pattern), locale: 'hu', conventions: pattern.conventions });
    assert.ok(back.ok, back.ok ? '' : back.reason);
  });

  test('a 2×2 bordázat is átmegy az ellenőrzőn', () => {
    assert.deepEqual(errors(flat({ rows: 2, width: 2 })), []);
  });
});

describe('bordás perem körben', () => {
  test('a bordás perem hibátlanul átmegy az ellenőrzőn', () => {
    const { pattern, piece } = roundPiece();
    assert.equal(typeof piece, 'object', String(piece));
    assert.deepEqual(errors({ ...pattern, pieces: [piece] }), []);
  });

  test('körben a nem záródó szemszámot pontos okkal utasítja el', () => {
    const { piece } = roundPiece({ rows: 1, width: 5 });
    assert.equal(typeof piece, 'string');
    assert.match(piece, /záródik/);
    assert.match(piece, /legközelebbi jó szám \d+/);
  });
});

describe('a bordázat elutasításai', () => {
  test('a sorok száma és a borda szélessége tartományon belül kell legyen', () => {
    assert.match(ribbingProblem({ rows: 0, width: 1 }), /sorainak száma/);
    assert.match(ribbingProblem({ rows: MAX_RIBBING_ROWS + 1, width: 1 }), /sorainak száma/);
    assert.match(ribbingProblem({ rows: 2, width: 0 }), /egysége/);
    assert.equal(ribbingProblem(DEFAULT_RIBBING), null);
  });

  test('láncalapra nem horgolható bordázat', () => {
    const pattern = emptyPattern();
    const piece = { id: 'p1', name: 'Darab', stitches: [], spaces: [], rings: [], groups: [], events: [], skipped: [] };
    const result = appendRibbing(pattern, piece, libraryFor(pattern), DEFAULT_RIBBING);
    assert.equal(typeof result, 'string');
    assert.match(result, /előbb horgolj legalább egy sort/);
  });
});

describe('a relief szem jelölése', () => {
  test('a rajz jelmagyarázata jelöli a relief szemeket (PQW-869 jelölésével)', () => {
    const pattern = flat();
    const marked = legendInsertions(pattern, libraryFor(pattern)).map(({ def, mode }) => `${def.id}/${mode}`);
    assert.ok(marked.includes('dc/front-post'), marked.join(', '));
    assert.ok(marked.includes('dc/back-post'), marked.join(', '));
  });

  test('a bordázat mindhárom jelölésben a szabvány szerint íródik ki', () => {
    const pattern = flat();
    const library = libraryFor(pattern);
    const written = (locale) => formatWrittenPattern(writePattern(pattern, library, locale));
    assert.match(written('hu'), /Eerp/);
    assert.match(written('hu'), /Herp/);
    assert.match(written('en-US'), /FPdc/);
    assert.match(written('en-US'), /BPdc/);
    // A brit jelölésben az egyráhajtásos pálca „tr”.
    assert.match(written('en-GB'), /FPtr/);
    assert.match(written('en-GB'), /BPtr/);
  });
});

describe('a Forma generátor bordás szegéllyel', () => {
  const shapeWith = (patch) => generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 10, heightCm: 6, stitch: 'dc', ...patch });

  test('hibátlan mintát ad, a bordázat ismétlésként kiírva', () => {
    const result = shapeWith({ border: null, ribbing: { rows: 2, width: 1 } });
    assert.ok(result.ok, result.reason);
    assert.deepEqual(errors(result.pattern), []);
    assert.match(text(result.pattern), /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
  });

  test('a bordás szegély és a körbefutó szegély együtt pontos okkal elutasított', () => {
    const result = shapeWith({ border: { stitch: 'sc', hdcRowEnd: 2 }, ribbing: { rows: 2, width: 1 } });
    assert.equal(result.ok, false);
    assert.match(result.reason, /együtt nem választható/);
  });
});
