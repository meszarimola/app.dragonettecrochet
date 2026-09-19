/*
 * The vector PDF export: a hand-written PDF 1.4 file, so the cross-reference
 * table is checked by walking the bytes back rather than by matching text.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { pageCount, writePdf } from '../src/ui/pdf.ts';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const BOX = { minX: 0, minY: 0, maxX: 20, maxY: 20 };

const LINE = { kind: 'line', role: 'stem', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } };
const CURVE = { kind: 'curve', role: 'stem', from: { x: 0, y: 0 }, control: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
const ELLIPSE = { kind: 'ellipse', role: 'chain', center: { x: 5, y: 5 }, rx: 9, ry: 5, rotation: 0.4 };
const DOT = { kind: 'dot', role: 'dot', center: { x: 2, y: 2 }, r: 3.5 };

const options = (extra = {}) => ({
  title: 'Terito',
  size: 'a4',
  orientation: 'portrait',
  across: 1,
  down: 1,
  ...extra,
});
const sheet = (shapes) => ({ shapes, lineWidth: 2 });

/** Walks the trailer, the cross-reference table and the object headers of a PDF. */
function parsePdf(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  const tail = /startxref\n(\d+)\n%%EOF\n$/.exec(text);
  assert.ok(tail, 'the file has no startxref pointing at the cross-reference table');
  const start = Number(tail[1]);

  const head = /^xref\n(\d+) (\d+)\n/.exec(text.slice(start));
  assert.ok(head, `no cross-reference table at byte ${start}`);
  assert.equal(head[1], '0', 'the table does not start at object zero');
  const count = Number(head[2]);
  const first = start + head[0].length;

  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const entry = text.slice(first + i * 20, first + i * 20 + 20);
    assert.equal(entry.length, 20, `entry ${i} is not twenty bytes long`);
    entries.push({ offset: Number(entry.slice(0, 10)), kind: entry[17] });
  }

  const objects = new Map();
  entries.forEach((entry, number) => {
    if (entry.kind !== 'n') return;
    const header = `${number} 0 obj\n`;
    assert.equal(
      text.slice(entry.offset, entry.offset + header.length),
      header,
      `the offset of object ${number} does not point at it`,
    );
    const from = entry.offset + header.length;
    const to = text.indexOf('\nendobj\n', from);
    assert.ok(to > from, `object ${number} is never closed`);
    objects.set(number, text.slice(from, to));
  });

  return { text, entries, objects, trailer: text.slice(first + count * 20, start + tail.index) };
}

function pagesOf(doc) {
  return [...doc.objects.entries()]
    .filter(([, body]) => body.startsWith('<< /Type /Page '))
    .map(([number, body]) => ({ number, body }));
}

function streamOf(doc, page) {
  const reference = /\/Contents (\d+) 0 R/.exec(page.body);
  assert.ok(reference, 'the page names no content stream');
  const body = doc.objects.get(Number(reference[1]));
  assert.ok(body, 'the content stream object is missing');
  const declared = /<< \/Length (\d+) >>/.exec(body);
  assert.ok(declared, 'the content stream declares no length');
  const from = body.indexOf('stream\n') + 'stream\n'.length;
  const to = body.lastIndexOf('\nendstream');
  const content = body.slice(from, to);
  assert.equal(content.length, Number(declared[1]), 'the declared stream length is wrong');
  return content;
}

const contentsOf = (bytes) => {
  const doc = parsePdf(bytes);
  return pagesOf(doc).map((page) => streamOf(doc, page));
};

const firstContent = (bytes) => contentsOf(bytes)[0];
const tokens = (content) => content.split(/\s+/).filter((token) => token.length > 0);
const count = (content, operator) => tokens(content).filter((token) => token === operator).length;

const matrixOf = (content) => {
  const found = /(-?[\d.]+) 0 0 (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/.exec(content);
  assert.ok(found, 'the page has no transform');
  return { a: Number(found[1]), d: Number(found[2]), e: Number(found[3]), f: Number(found[4]) };
};

const movesOf = (content) =>
  [...content.matchAll(/(-?[\d.]+) (-?[\d.]+) m\b/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));

test('the bytes begin with the PDF 1.4 header and end with the end-of-file marker', () => {
  const bytes = writePdf(sheet([LINE]), BOX, options());
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.endsWith('%%EOF\n'));
});

test('every cross-reference offset lands on the object it names', () => {
  const bytes = writePdf(sheet([LINE, CURVE, ELLIPSE, DOT]), BOX, options({ across: 2, down: 2 }));
  const doc = parsePdf(bytes);
  assert.equal(doc.entries[0].kind, 'f', 'object zero is not the free head of the list');
  assert.equal(doc.objects.size, doc.entries.length - 1);
  assert.match(doc.trailer, new RegExp(`/Size ${doc.entries.length}\\b`));
  assert.match(doc.trailer, /\/Root 1 0 R/);
  assert.match(doc.objects.get(1), /\/Type \/Catalog/);
  assert.match(doc.objects.get(2), /\/Type \/Pages/);
  assert.match(doc.objects.get(3), /\/BaseFont \/Helvetica/);
});

test('the file contains as many page objects as pageCount reports', () => {
  for (const [across, down] of [
    [1, 1],
    [1, 4],
    [3, 2],
  ]) {
    const bytes = writePdf(sheet([LINE]), BOX, options({ across, down }));
    assert.equal(pagesOf(parsePdf(bytes)).length, pageCount(options({ across, down })));
  }
});

test('a two by three grid really produces six pages, each marked with its place in the grid', () => {
  const grid = options({ across: 2, down: 3 });
  assert.equal(pageCount(grid), 6);
  const doc = parsePdf(writePdf(sheet([LINE]), BOX, grid));
  const pages = pagesOf(doc);
  assert.equal(pages.length, 6);
  assert.match(doc.objects.get(2), /\/Count 6\b/);
  assert.equal(doc.objects.get(2).match(/\d+ 0 R/g).length, 6);
  const markers = pages.map((page) => /\((\d\.\d)\) Tj/.exec(streamOf(doc, page))[1]);
  assert.deepEqual(markers, ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2']);
});

test('a single page carries the title but no grid marker', () => {
  const content = firstContent(writePdf(sheet([LINE]), BOX, options()));
  assert.equal(count(content, 'Tj'), 1);
  assert.match(content, /\(Terito\) Tj/);
});

test('a Hungarian title reaches the information dictionary as UTF-16BE and the page as a WinAnsi code', () => {
  const bytes = writePdf(sheet([LINE]), BOX, options({ title: 'Kőris ütő' }));
  const doc = parsePdf(bytes);
  const info = doc.objects.get(4);
  // The byte order mark, then U+0151 as the two bytes 001 and 121 in octal.
  assert.ok(info.startsWith('<< /Title (\\376\\377'));
  assert.ok(info.includes('\\001\\121'), 'ő is missing from the UTF-16BE title');
  // On the page ő is code 129, an undefined WinAnsi slot filled by /Differences.
  assert.match(firstContent(bytes), /\(K\\201ris \\374t\\201\) Tj/);
  assert.match(doc.objects.get(3), /\/Differences \[129 \/ohungarumlaut/);
  assert.equal(pagesOf(doc).length, 1);
});

test('a title containing brackets and a backslash leaves the file parseable', () => {
  const bytes = writePdf(sheet([LINE]), BOX, options({ title: 'a (b) \\ c' }));
  assert.match(firstContent(bytes), /\(a \\\(b\\\) \\\\ c\) Tj/);
  assert.equal(pagesOf(parsePdf(bytes)).length, 1);
});

test('every shape kind produces content-stream operators', () => {
  const each = {
    line: LINE,
    curve: CURVE,
    ellipse: ELLIPSE,
    dot: DOT,
  };
  for (const [kind, shape] of Object.entries(each)) {
    const content = firstContent(writePdf(sheet([shape]), BOX, options()));
    assert.equal(count(content, 'm'), 1, `${kind}: no starting point`);
    assert.ok(count(content, 'S') + count(content, 'f') > 0, `${kind}: nothing is painted`);
  }
  const line = firstContent(writePdf(sheet([LINE]), BOX, options()));
  assert.equal(count(line, 'l'), 1);
  assert.equal(count(firstContent(writePdf(sheet([CURVE]), BOX, options())), 'c'), 1);
  assert.equal(count(firstContent(writePdf(sheet([DOT]), BOX, options())), 'f'), 1);
});

test('an ellipse is drawn as four curve operators and honours its rotation', () => {
  const upright = firstContent(writePdf(sheet([{ ...ELLIPSE, rotation: 0 }]), BOX, options()));
  const turned = firstContent(writePdf(sheet([ELLIPSE]), BOX, options()));
  assert.equal(count(upright, 'c'), 4);
  assert.equal(count(turned, 'c'), 4);
  assert.equal(count(upright, 'S'), 1);
  assert.notEqual(movesOf(upright)[0].y, movesOf(turned)[0].y, 'the rotation changed nothing');
});

test('the page transform flips the chart, so a shape at its top is drawn near the top of the page', () => {
  const top = { ...LINE, from: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const bottom = { ...LINE, from: { x: 0, y: 20 }, to: { x: 20, y: 20 } };
  const content = firstContent(writePdf(sheet([top, bottom]), BOX, options()));
  const { a, d, f } = matrixOf(content);
  assert.ok(a > 0, 'the chart is not scaled up');
  assert.ok(d < 0, 'the y axis is not flipped');
  const [onTop, onBottom] = movesOf(content).map((point) => d * point.y + f);
  assert.ok(onTop > onBottom, 'the top of the chart is below its bottom on the page');
  assert.ok(onTop > A4_HEIGHT / 2, 'the top of the chart is not in the upper half of the page');
});

test('neighbouring pages overlap, so a taped chart has no gap', () => {
  const doc = parsePdf(writePdf(sheet([LINE]), BOX, options({ across: 2, down: 1 })));
  const [left, right] = pagesOf(doc).map((page) => matrixOf(streamOf(doc, page)).e);
  const step = left - right;
  assert.ok(step > 0, 'the second page does not move on');
  assert.ok(step < A4_WIDTH - 2 * 28, 'the pages meet edge to edge instead of overlapping');
});

test('the page size and orientation follow the options', () => {
  const media = (extra) =>
    /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(
      pagesOf(parsePdf(writePdf(sheet([LINE]), BOX, options(extra))))[0].body,
    );

  assert.deepEqual(media({ size: 'a4' }).slice(1), [String(A4_WIDTH), String(A4_HEIGHT)]);
  assert.deepEqual(media({ size: 'letter' }).slice(1), ['612', '792']);
  assert.deepEqual(media({ size: 'letter', orientation: 'landscape' }).slice(1), ['792', '612']);
});

test('auto orientation turns the page for a wide chart and leaves it upright for a tall one', () => {
  const wide = { minX: 0, minY: 0, maxX: 400, maxY: 50 };
  const tall = { minX: 0, minY: 0, maxX: 50, maxY: 400 };
  const media = (box) =>
    /\/MediaBox \[0 0 ([\d.]+) /.exec(
      pagesOf(parsePdf(writePdf(sheet([LINE]), box, options({ orientation: 'auto' }))))[0].body,
    )[1];

  assert.equal(media(wide), String(A4_HEIGHT));
  assert.equal(media(tall), String(A4_WIDTH));
});

test('pageCount clamps a grid below one or absurdly large', () => {
  assert.equal(pageCount(options({ across: 0, down: 1 })), 1);
  assert.equal(pageCount(options({ across: 1, down: -5 })), 1);
  assert.equal(pageCount(options({ across: Number.NaN, down: 3 })), 3);
  assert.equal(pageCount(options({ across: 2.9, down: 1 })), 2);
  assert.equal(pageCount(options({ across: 1e9, down: 1e9 })), 100);
});

test('degenerate input gives a parseable document instead of throwing', () => {
  const nonFinite = {
    kind: 'line',
    role: 'stem',
    from: { x: Number.NaN, y: 0 },
    to: { x: 0, y: Number.POSITIVE_INFINITY },
  };
  const cases = [
    [sheet([]), BOX, options()],
    [sheet([LINE]), { minX: 5, minY: 5, maxX: 5, maxY: 5 }, options()],
    [sheet([LINE]), { minX: 20, minY: 20, maxX: 0, maxY: 0 }, options()],
    [sheet([LINE]), { minX: Number.NaN, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: 1 }, options()],
    [sheet([nonFinite, { ...ELLIPSE, rx: Number.NaN }, { ...DOT, r: 0 }]), BOX, options()],
    [{ shapes: [LINE], lineWidth: Number.NaN }, BOX, options()],
    [sheet([LINE]), BOX, options({ across: 0, down: 0 })],
    [sheet([LINE]), BOX, options({ across: 1e9, down: 1 })],
    [sheet([LINE]), BOX, options({ title: '', size: 'foo', orientation: 'bar' })],
  ];

  for (const [page, box, given] of cases) {
    const bytes = writePdf(page, box, given);
    const doc = parsePdf(bytes);
    assert.equal(pagesOf(doc).length, pageCount(given));
    for (const content of contentsOf(bytes)) {
      assert.doesNotMatch(content, /NaN|Infinity|undefined|e[+-]\d/);
    }
  }
});

test('writing the same input twice gives identical bytes', () => {
  const draw = () =>
    writePdf(sheet([LINE, CURVE, ELLIPSE, DOT]), BOX, options({ across: 2, down: 2, title: 'Őszi ág' }));
  assert.deepEqual(draw(), draw());
});
