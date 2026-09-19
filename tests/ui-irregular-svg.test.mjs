/*
 * The SVG of the free-form chart: layers as named groups, hidden work left out
 * of the file rather than hidden in it, and text that stays text.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { findStitch } from '../src/core/irregular-key.ts';
import { EXPORT_MARGIN } from '../src/core/irregular-types.ts';
import { irregularBox, irregularSvg } from '../src/ui/irregular-svg.ts';
import { DEFAULT_SYMBOL_OPTIONS, symbolShapes } from '../src/ui/symbols.ts';

/* ---- A hand-rolled XML reader, because node has no DOMParser ---- */

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  for (const piece of text.split('&').slice(1)) {
    const end = piece.indexOf(';');
    const name = end === -1 ? '' : piece.slice(0, end);
    assert.ok(
      name in ENTITY || /^#\d+$/.test(name) || /^#x[0-9A-Fa-f]+$/.test(name),
      `"&${name}" is not an entity, so the file is not XML`,
    );
  }
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_whole, name) => ENTITY[name]);
}

/** The index of the `>` that ends the tag, skipping any inside a quoted value. */
function tagEnd(source, start) {
  let quote = null;
  for (let at = start + 1; at < source.length; at += 1) {
    const char = source[at];
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return at;
  }
  return -1;
}

function attributesOf(body) {
  const attributes = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let rest = body;
  for (const match of body.matchAll(pattern)) {
    attributes[match[1]] = decode(match[3] ?? match[4]);
    rest = rest.replace(match[0], '');
  }
  assert.match(rest, /^\s*$/, `unquoted or malformed attribute in "${body.trim()}"`);
  return attributes;
}

/** Parses the document and fails on anything that is not well-formed XML. */
function parseXml(source) {
  const root = { name: '#document', attributes: {}, children: [], text: '' };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let at = 0;
  while (at < source.length) {
    const open = source.indexOf('<', at);
    const text = source.slice(at, open === -1 ? source.length : open);
    if (text !== '') top().text += decode(text);
    if (open === -1) break;
    const close = tagEnd(source, open);
    assert.notEqual(close, -1, `a tag is never closed from offset ${open}`);
    const raw = source.slice(open + 1, close);
    at = close + 1;
    if (raw.startsWith('?') || raw.startsWith('!')) continue;
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const node = top();
      assert.equal(node.name, name, `</${name}> closes <${node.name}>`);
      stack.pop();
      continue;
    }
    const empty = raw.endsWith('/');
    const body = empty ? raw.slice(0, -1) : raw;
    const name = body.split(/\s/, 1)[0];
    assert.match(name, /^[A-Za-z_:][\w:.-]*$/, `"${name}" is not an element name`);
    const node = { name, attributes: attributesOf(body.slice(name.length)), children: [], text: '' };
    top().children.push(node);
    if (!empty) stack.push(node);
  }
  assert.equal(stack.length, 1, 'every element is closed');
  assert.equal(root.children.length, 1, 'the document has exactly one root element');
  return root.children[0];
}

function descendants(node) {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

const named = (node, name) => descendants(node).filter((child) => child.name === name);
const layerNames = (doc) =>
  doc.children.filter((g) => 'data-layer' in g.attributes).map((g) => g.attributes['data-layer']);

/* ---- The pattern under test ---- */

const row = (over = {}) => ({
  id: 'r1',
  kind: 'row',
  direction: 'ltr',
  color: null,
  visible: true,
  locked: false,
  ...over,
});
const layer = (over = {}) => ({ id: 'l1', name: 'Rajz', visible: true, locked: false, ...over });
const stitch = (over = {}) => ({
  id: 'i1',
  kind: 'stitch',
  keyEntryId: 'sc',
  insertion: 'both-loops',
  rowId: 'r1',
  layerId: 'l1',
  color: null,
  x: 0,
  y: 0,
  width: 20,
  height: 20,
  rotation: 0,
  flipX: false,
  flipY: false,
  ...over,
});
const noGuides = {
  grid: { visible: false, size: 20 },
  polar: { visible: false, center: { x: 0, y: 0 }, rings: 8, spacing: 40, spokes: 12, startAngle: 0 },
  snap: false,
};

const chart = (over = {}) => ({
  formatVersion: 1,
  type: 'irregular',
  title: 'Szabad rajz',
  rows: [row()],
  layers: [layer()],
  items: [stitch()],
  activeRowId: 'r1',
  activeLayerId: 'l1',
  guides: noGuides,
  ...over,
});

const INK = '#241f2b';

const options = (over = {}) => ({
  symbols: DEFAULT_SYMBOL_OPTIONS,
  glyphOf: () => null,
  legend: null,
  guides: false,
  background: null,
  paper: null,
  ink: INK,
  ...over,
});

const SC_SHAPES = symbolShapes(findStitch('sc'), DEFAULT_SYMBOL_OPTIONS);

const legendOf = (lines, over = {}) => ({
  block: { visible: true, position: { x: 0, y: 200 }, columns: 1, showCounts: false, ...over },
  lines,
});

const photo = (over = {}) => ({
  placement: {
    id: 'b1',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    rotation: 30,
    opacity: 0.4,
    visible: true,
    locked: false,
    inExport: true,
    ...over,
  },
  href: 'data:image/png;base64,iVBORw0KGgo=',
});

/* ---- The document ---- */

test('the document is one SVG element whose viewBox holds four finite numbers', () => {
  const svg = irregularSvg(chart(), options());

  assert.ok(svg.startsWith('<svg'), 'the file starts with the SVG element');
  const doc = parseXml(svg);
  assert.equal(doc.name, 'svg');
  assert.equal(doc.attributes.xmlns, 'http://www.w3.org/2000/svg');
  const viewBox = doc.attributes.viewBox.split(' ').map(Number);
  assert.equal(viewBox.length, 4);
  assert.ok(
    viewBox.every((value) => Number.isFinite(value)),
    `the viewBox is not finite: ${doc.attributes.viewBox}`,
  );
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
});

test('the pattern title stays text in a title element', () => {
  const doc = parseXml(irregularSvg(chart({ title: 'Kör & ág' }), options()));

  assert.equal(named(doc, 'title')[0].text, 'Kör & ág');
});

describe('what is hidden is left out of the file', () => {
  test('a hidden row leaves no stitch of its own behind', () => {
    const pattern = chart({
      rows: [row(), row({ id: 'r2', visible: false })],
      items: [stitch(), stitch({ id: 'i2', rowId: 'r2', x: 4321 })],
    });

    const svg = irregularSvg(pattern, options());

    assert.ok(!svg.includes('4321'), 'the hidden row is still in the file');
    assert.equal(named(parseXml(svg), 'line').length, SC_SHAPES.length, 'only the visible row is drawn');
  });

  test('a hidden layer leaves neither its group nor its stitches behind', () => {
    const pattern = chart({
      layers: [layer(), layer({ id: 'l2', name: 'Titkos', visible: false })],
      items: [stitch(), stitch({ id: 'i2', layerId: 'l2', x: 4321 })],
    });

    const svg = irregularSvg(pattern, options());

    assert.ok(!svg.includes('Titkos'), 'the hidden layer is named in the file');
    assert.ok(!svg.includes('4321'), 'the hidden layer still holds a stitch');
    assert.deepEqual(layerNames(parseXml(svg)), ['Rajz']);
  });
});

test('the layers stand in z-order, bottom first, each group carrying its name', () => {
  const pattern = chart({
    layers: [
      layer({ id: 'l1', name: 'Alul' }),
      layer({ id: 'l2', name: 'Középen' }),
      layer({ id: 'l3', name: 'Fölül' }),
    ],
    items: [
      stitch({ id: 'i3', layerId: 'l3' }),
      stitch({ id: 'i1', layerId: 'l1' }),
      stitch({ id: 'i2', layerId: 'l2' }),
    ],
  });

  assert.deepEqual(layerNames(parseXml(irregularSvg(pattern, options()))), ['Alul', 'Középen', 'Fölül']);
});

test('a layer name and a legend line of XML characters come out escaped and still parse', () => {
  const pattern = chart({ layers: [layer({ name: 'A & B' })], title: '<zárójel>' });
  const text = 'rp <"x"> & \'y\' — kör';

  const svg = irregularSvg(pattern, options({ legend: legendOf([{ shapes: SC_SHAPES, text }]) }));

  assert.ok(!/<g data-layer="A & B"/.test(svg), 'the ampersand went in raw');
  const doc = parseXml(svg);
  assert.deepEqual(layerNames(doc), ['A & B']);
  assert.equal(named(doc, 'title')[0].text, '<zárójel>');
  assert.equal(named(doc, 'text')[0].text, text);
});

test('a stitch takes its own colour, then its row colour, then the fallback ink', () => {
  const pattern = chart({
    rows: [row(), row({ id: 'r2', color: '#00ff00' })],
    items: [
      stitch({ id: 'i1', color: '#ff0000' }),
      stitch({ id: 'i2', rowId: 'r2', x: 40 }),
      stitch({ id: 'i3', x: 80 }),
    ],
  });

  const doc = parseXml(irregularSvg(pattern, options()));

  const inks = named(doc, 'g')
    .filter((g) => g.attributes.class === 'ink')
    .map((g) => g.attributes.stroke);
  assert.deepEqual(inks, ['#ff0000', '#00ff00', INK]);
});

describe('the legend', () => {
  test('every line is a text with its symbol beside it', () => {
    const lines = [
      { shapes: SC_SHAPES, text: 'rp — rövidpálca' },
      { shapes: SC_SHAPES, text: 'lsz — láncszem' },
    ];

    const doc = parseXml(irregularSvg(chart(), options({ legend: legendOf(lines) })));

    const block = doc.children.find((child) => 'data-legend' in child.attributes);
    assert.ok(block !== undefined, 'the legend has no group');
    assert.deepEqual(
      named(block, 'text').map((node) => node.text),
      ['rp — rövidpálca', 'lsz — láncszem'],
    );
    assert.equal(named(block, 'g').filter((g) => g.attributes.class === 'ink').length, 2, 'both symbols are drawn');
    const rows = named(block, 'text').map((node) => Number(node.attributes.y));
    assert.ok(rows[1] > rows[0], 'one column stacks the lines downwards');
  });

  test('no legend means no legend group and no text at all', () => {
    const svg = irregularSvg(chart(), options());

    assert.ok(!svg.includes('data-legend'));
    assert.equal(named(parseXml(svg), 'text').length, 0);
  });
});

describe('the guides', () => {
  const guided = chart({
    guides: {
      grid: { visible: true, size: 20 },
      polar: { visible: true, center: { x: 0, y: 0 }, rings: 2, spacing: 30, spokes: 4, startAngle: 0 },
      snap: false,
    },
  });

  test('they are drawn only when asked for, and before the layers', () => {
    const doc = parseXml(irregularSvg(guided, options({ guides: true })));

    const guides = doc.children.findIndex((child) => 'data-guides' in child.attributes);
    const layers = doc.children.findIndex((child) => 'data-layer' in child.attributes);
    assert.ok(guides !== -1, 'the guides are missing');
    assert.ok(guides < layers, 'the guides stand over the layers');
    assert.equal(named(doc.children[guides], 'circle').length, 2, 'both rings of the circle guide');
  });

  test('without the flag neither the square nor the circle guide is in the file', () => {
    const svg = irregularSvg(guided, options({ guides: false }));

    assert.ok(!svg.includes('data-guides'));
    assert.equal(named(parseXml(svg), 'circle').length, 0);
  });
});

describe('the tracing photo', () => {
  test('it is one image with its own opacity, placed and turned like on the canvas', () => {
    const doc = parseXml(irregularSvg(chart(), options({ background: photo() })));

    const images = named(doc, 'image');
    assert.equal(images.length, 1);
    assert.equal(images[0].attributes.opacity, '0.4');
    assert.equal(images[0].attributes.href, 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(images[0].attributes.transform, 'translate(0 0) rotate(30)');
    assert.equal(images[0].attributes.width, '100');
  });

  test('it stands under every layer', () => {
    const doc = parseXml(irregularSvg(chart(), options({ background: photo() })));

    const image = doc.children.findIndex((child) => child.name === 'image');
    const layers = doc.children.findIndex((child) => 'data-layer' in child.attributes);
    assert.ok(image !== -1 && image < layers);
  });

  test('without a photo there is no image element', () => {
    assert.equal(named(parseXml(irregularSvg(chart(), options())), 'image').length, 0);
  });
});

test('paper draws a rectangle only when a colour is given', () => {
  const white = parseXml(irregularSvg(chart(), options({ paper: '#ffffff' })));
  const none = parseXml(irregularSvg(chart(), options({ paper: null })));

  const rects = named(white, 'rect');
  assert.equal(rects.length, 1);
  assert.equal(rects[0].attributes.fill, '#ffffff');
  assert.equal(rects[0].attributes.viewBox, undefined);
  assert.equal(named(none, 'rect').length, 0);
});

/* ---- Degradation ---- */

describe('a document that cannot be drawn is still a document', () => {
  test('an empty pattern gives a valid file and a box of the bare margin', () => {
    const empty = chart({ items: [] });

    const doc = parseXml(irregularSvg(empty, options()));

    assert.equal(doc.name, 'svg');
    assert.deepEqual(irregularBox(empty, options()), {
      minX: -EXPORT_MARGIN,
      minY: -EXPORT_MARGIN,
      maxX: EXPORT_MARGIN,
      maxY: EXPORT_MARGIN,
    });
  });

  test('every layer hidden gives a file with no group and no stitch', () => {
    const pattern = chart({ layers: [layer({ visible: false })] });

    const doc = parseXml(irregularSvg(pattern, options()));

    assert.deepEqual(layerNames(doc), []);
    assert.equal(named(doc, 'line').length, 0);
  });

  test('a stitch with coordinates that are not numbers puts no NaN into an attribute', () => {
    const pattern = chart({ items: [stitch({ x: Number.NaN }), stitch({ id: 'i2', y: Number.POSITIVE_INFINITY })] });

    const svg = irregularSvg(pattern, options());

    assert.doesNotMatch(svg, /NaN|Infinity/);
    const viewBox = parseXml(svg).attributes.viewBox.split(' ').map(Number);
    assert.ok(viewBox.every((value) => Number.isFinite(value)));
  });

  test('an unknown symbol drops the stitch instead of breaking the file', () => {
    const pattern = chart({ items: [stitch({ keyEntryId: 'nincs-ilyen' })] });

    const doc = parseXml(irregularSvg(pattern, options()));

    assert.equal(named(doc, 'line').length, 0);
    assert.deepEqual(layerNames(doc), ['Rajz']);
  });
});

test('the same pattern always gives the very same string', () => {
  const pattern = chart({
    layers: [layer(), layer({ id: 'l2', name: 'Fölül' })],
    items: [stitch(), stitch({ id: 'i2', layerId: 'l2', x: 40, color: '#ff0000' })],
    guides: { grid: { visible: true, size: 20 }, polar: { ...noGuides.polar, visible: true }, snap: false },
  });
  const chosen = options({
    guides: true,
    paper: '#ffffff',
    background: photo(),
    legend: legendOf([{ shapes: SC_SHAPES, text: 'rp' }]),
  });

  assert.equal(irregularSvg(pattern, chosen), irregularSvg(pattern, chosen));
});

/* ---- The box ---- */

describe('irregularBox', () => {
  const box = (pattern, over = {}) => irregularBox(pattern, options(over));

  test('it is the visible stitches with the export margin around them', () => {
    assert.deepEqual(box(chart()), { minX: -30, minY: -30, maxX: 30, maxY: 30 });
  });

  test('a hidden row does not stretch it', () => {
    const pattern = chart({
      rows: [row(), row({ id: 'r2', visible: false })],
      items: [stitch(), stitch({ id: 'i2', rowId: 'r2', x: 4321 })],
    });

    assert.deepEqual(box(pattern), { minX: -30, minY: -30, maxX: 30, maxY: 30 });
  });

  test('the legend, the photo and the circle guide each stretch it', () => {
    const pattern = chart({
      guides: {
        ...noGuides,
        polar: { visible: true, center: { x: 0, y: 0 }, rings: 2, spacing: 100, spokes: 4, startAngle: 0 },
      },
    });

    assert.ok(box(pattern, { legend: legendOf([{ shapes: SC_SHAPES, text: 'rp' }]) }).maxY > 200);
    assert.ok(box(pattern, { background: photo({ width: 400, height: 400, rotation: 0 }) }).maxX >= 200);
    assert.equal(box(pattern, { guides: true }).maxX, 200 + EXPORT_MARGIN);
    assert.equal(box(pattern, { guides: false }).maxX, 30, 'the circle guide is left out when it is not exported');
  });
});
