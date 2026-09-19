/*
 * Annotations as geometry (PQW-973): a label, a marker, a bracket, free text or
 * an arrow turns into shapes and placed text, in chart units, around the item's
 * centre. The module takes its text as data, so nothing here checks wording.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { noteDrawing, noteSize } from '../src/ui/irregular-note.ts';
import { shapesBounds } from '../src/ui/symbols.ts';

const TOLERANCE = 1e-9;
const near = (a, b, tolerance = TOLERANCE) => Math.abs(a - b) <= tolerance;
const nearPoint = (a, b, tolerance = TOLERANCE) => near(a.x, b.x, tolerance) && near(a.y, b.y, tolerance);

const KINDS = ['label', 'marker', 'bracket', 'text', 'arrow'];

function annotation(overrides = {}) {
  return {
    id: 'note-1',
    kind: 'annotation',
    note: 'text',
    rowId: 'row-1',
    layerId: 'layer-1',
    color: null,
    text: 'R2',
    fontSize: 16,
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    rotation: 0,
    flipX: false,
    flipY: false,
    ...overrides,
  };
}

const length = (shape) => Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
const centre = (box) => ({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 });

function everyNumber(drawing) {
  const found = [];
  for (const shape of drawing.shapes) {
    for (const key of ['from', 'control', 'to', 'center']) {
      if (shape[key] !== undefined) found.push(shape[key].x, shape[key].y);
    }
    for (const key of ['rx', 'ry', 'r', 'rotation']) {
      if (shape[key] !== undefined) found.push(shape[key]);
    }
  }
  for (const text of drawing.texts) found.push(text.at.x, text.at.y, text.size, text.rotation);
  return found;
}

test('a free text note is one piece of text and nothing else', () => {
  const drawing = noteDrawing(annotation({ note: 'text', text: 'repeat here' }));
  assert.equal(drawing.shapes.length, 0);
  assert.equal(drawing.texts.length, 1);
  const [only] = drawing.texts;
  assert.equal(only.text, 'repeat here');
  assert.equal(only.size, 16);
  assert.equal(only.anchor, 'middle');
});

test('a label draws the text it is handed, composed by the caller', () => {
  const drawing = noteDrawing(annotation({ note: 'label', text: '2 →' }));
  assert.equal(drawing.shapes.length, 0);
  assert.deepEqual(
    drawing.texts.map((text) => text.text),
    ['2 →'],
  );
});

test('a label with an empty text draws nothing at all', () => {
  const drawing = noteDrawing(annotation({ note: 'label', text: '   ' }));
  assert.equal(drawing.shapes.length, 0);
  assert.equal(drawing.texts.length, 0);
});

test('a marker is a line as long as the item and carries no text', () => {
  const drawing = noteDrawing(annotation({ note: 'marker', height: 40 }));
  assert.equal(drawing.texts.length, 0);
  assert.equal(drawing.shapes.length, 1);
  const [line] = drawing.shapes;
  assert.equal(line.kind, 'line');
  assert.ok(near(length(line), 40));
});

test('a dotted marker is drawn in more pieces than a solid one, and no longer', () => {
  const solid = noteDrawing(annotation({ note: 'marker', height: 40 }));
  const dotted = noteDrawing(annotation({ note: 'marker', height: 40, dotted: true }));
  assert.ok(dotted.shapes.length > solid.shapes.length);
  const drawn = dotted.shapes.reduce((sum, shape) => sum + length(shape), 0);
  assert.ok(drawn < 40, 'the gaps take room out of the line');
  assert.ok(near(shapesBounds(dotted.shapes).maxY - shapesBounds(dotted.shapes).minY, 40));
});

test('a bracket has both the brace and its text', () => {
  const drawing = noteDrawing(annotation({ note: 'bracket', text: '3x', width: 120, height: 24 }));
  assert.equal(drawing.shapes.length, 4);
  assert.ok(
    drawing.shapes.every((shape) => shape.kind === 'curve'),
    'a brace is drawn from curves',
  );
  assert.equal(drawing.texts.length, 1);
  const [label] = drawing.texts;
  assert.equal(label.text, '3x');
  const box = shapesBounds(drawing.shapes);
  assert.ok(near(box.maxX - box.minX, 120), 'the brace spans the width');
  assert.ok(near(box.maxY - box.minY, 24), 'and is as deep as the height');
  assert.ok(label.at.y < box.minY, 'the text stands beyond the tip, outside the brace');
});

test('an arrow is a shaft and two head lines, with no text', () => {
  const drawing = noteDrawing(annotation({ note: 'arrow', text: 'ignored', width: 60 }));
  assert.equal(drawing.texts.length, 0);
  assert.equal(drawing.shapes.length, 3);
  const [shaft, ...head] = drawing.shapes;
  assert.ok(near(length(shaft), 60), 'the shaft runs the whole width');
  assert.equal(head.length, 2);
  for (const barb of head) assert.ok(length(barb) < length(shaft) / 2);
});

test('the arrow head sits at the far end of the shaft', () => {
  const [shaft, ...head] = noteDrawing(annotation({ note: 'arrow', width: 60, x: 10, y: -4 })).shapes;
  assert.ok(nearPoint(shaft.to, { x: 40, y: -4 }), 'the shaft ends half a width along the item axis');
  for (const barb of head) assert.ok(nearPoint(barb.from, shaft.to), 'both barbs start at the tip');
  const [left, right] = head.map((barb) => barb.to);
  assert.ok(left.x < shaft.to.x && right.x < shaft.to.x, 'the barbs point back down the shaft');
  assert.ok(near((left.y + right.y) / 2, shaft.to.y), 'and lie either side of it');
});

test('a very long arrow does not grow a proportionally huge head', () => {
  const short = noteDrawing(annotation({ note: 'arrow', width: 40 })).shapes.slice(1);
  const long = noteDrawing(annotation({ note: 'arrow', width: 4000 })).shapes.slice(1);
  const barb = (shapes) => length(shapes[0]);
  assert.ok(barb(long) >= barb(short), 'a longer arrow never gets a smaller head');
  assert.ok(barb(long) < 4000 / 5, 'but stops following the shaft');
  assert.ok(barb(long) < 4 * barb(short), 'a hundred times the shaft is nowhere near a hundred times the head');
});

test('a marker at rotation 90 runs across instead of up and down', () => {
  const [line] = noteDrawing(annotation({ note: 'marker', height: 40, rotation: 90, x: 5, y: 7 })).shapes;
  assert.ok(nearPoint(line.from, { x: 25, y: 7 }));
  assert.ok(nearPoint(line.to, { x: -15, y: 7 }));
});

test('a marker at rotation 180 runs up and down again, the other way round', () => {
  const upright = noteDrawing(annotation({ note: 'marker', height: 40 })).shapes[0];
  const turned = noteDrawing(annotation({ note: 'marker', height: 40, rotation: 180 })).shapes[0];
  assert.ok(nearPoint(turned.from, upright.to, 1e-6));
  assert.ok(nearPoint(turned.to, upright.from, 1e-6));
});

test('the text of a turned note carries the item rotation as it stands', () => {
  const [label] = noteDrawing(annotation({ note: 'text', rotation: 33, x: 12, y: 9 })).texts;
  assert.equal(label.rotation, 33);
  assert.ok(nearPoint(label.at, { x: 12, y: 9 }), 'and stays on the item centre');
});

test('flipX mirrors the arrow, so its head lands at the near end', () => {
  const plain = noteDrawing(annotation({ note: 'arrow', width: 60 })).shapes[0];
  const flipped = noteDrawing(annotation({ note: 'arrow', width: 60, flipX: true })).shapes[0];
  assert.ok(nearPoint(flipped.to, plain.from));
  assert.ok(nearPoint(flipped.from, plain.to));
});

for (const note of ['marker', 'bracket', 'arrow']) {
  test(`the ${note} drawing is centred on the item`, () => {
    const drawing = noteDrawing(annotation({ note, x: 37, y: -12, width: 80, height: 24 }));
    assert.ok(nearPoint(centre(shapesBounds(drawing.shapes)), { x: 37, y: -12 }, 1e-6));
  });
}

for (const note of ['text', 'label']) {
  test(`the ${note} drawing is centred on the item`, () => {
    const [only] = noteDrawing(annotation({ note, x: 37, y: -12 })).texts;
    assert.ok(nearPoint(only.at, { x: 37, y: -12 }, 1e-6));
  });
}

test('noteSize grows with the text length where the text decides the box', () => {
  for (const note of ['text', 'label']) {
    const short = noteSize(note, 'R2', 16);
    const long = noteSize(note, 'a much longer caption', 16);
    assert.ok(long.width > short.width, note);
    assert.equal(long.height, short.height, `${note}: one line stays one line`);
  }
});

test('noteSize grows with the font size, whatever the kind', () => {
  for (const note of KINDS) {
    const small = noteSize(note, 'R2', 10);
    const large = noteSize(note, 'R2', 20);
    assert.ok(large.width > small.width, `${note}: width`);
    assert.ok(large.height > small.height, `${note}: height`);
  }
});

test('noteSize stays a finite, usable box for an empty text', () => {
  for (const note of KINDS) {
    const { width, height } = noteSize(note, '', 16);
    assert.ok(Number.isFinite(width) && width > 0, `${note}: width`);
    assert.ok(Number.isFinite(height) && height > 0, `${note}: height`);
  }
});

const BROKEN = [
  ['a position that is not a number', { x: Number.NaN, y: Number.NaN }],
  ['an infinite position', { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY }],
  ['a size that is not a number', { width: Number.NaN, height: Number.NaN }],
  ['an infinite size', { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }],
  ['a box of no size', { width: 0, height: 0 }],
  ['a negative box', { width: -80, height: -24 }],
  ['a rotation that is not a number', { rotation: Number.NaN }],
  ['an infinite rotation', { rotation: Number.POSITIVE_INFINITY }],
  ['a font size that is not a number', { fontSize: Number.NaN }],
  ['a negative font size', { fontSize: -12 }],
  ['an absurd font size', { fontSize: 1e9 }],
  ['an empty text', { text: '' }],
  ['a missing text', { text: null }],
  ['a kind no one knows', { note: 'sticker' }],
];

for (const [name, broken] of BROKEN) {
  test(`${name} still draws a finite annotation of every kind`, () => {
    for (const note of [...KINDS, 'sticker']) {
      const item = annotation({ note, ...broken });
      const drawing = noteDrawing(item);
      assert.ok(Array.isArray(drawing.shapes) && Array.isArray(drawing.texts), `${note}: not a drawing`);
      for (const value of everyNumber(drawing)) {
        assert.ok(Number.isFinite(value), `${note}: ${value} in the drawing`);
      }
      for (const text of drawing.texts) {
        assert.equal(typeof text.text, 'string', `${note}: the text is not a string`);
        assert.ok(text.size > 0, `${note}: an unusable font size`);
      }
    }
  });
}

test('noteSize survives the same broken numbers', () => {
  const sizes = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -40, 1e9];
  for (const note of [...KINDS, 'sticker']) {
    for (const fontSize of sizes) {
      const { width, height } = noteSize(note, 'R2', fontSize);
      assert.ok(Number.isFinite(width) && width > 0, `${note}/${fontSize}: width`);
      assert.ok(Number.isFinite(height) && height > 0, `${note}/${fontSize}: height`);
    }
  }
});
