/*
 * Guides and snapping (PQW-966). The circle guide's angles are degrees clockwise
 * from straight up, so a spoke angle and a stitch's rotation are the same number.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  addStitch,
  emptyIrregularPattern,
  setGrid,
  setGridSize,
  setPolar,
  setSnap,
} from '../src/core/irregular-document.ts';
import {
  angleFromCenter,
  directionOf,
  itemAnchors,
  polarPoint,
  radialRotation,
  ringRadii,
  snapPoint,
  spokeAngles,
} from '../src/core/irregular-snap.ts';
import { DEFAULT_POLAR, GRID_SIZE_RANGE, POLAR_RANGE } from '../src/core/irregular-types.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec }).pattern;

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message) => {
  near(actual.x, expected.x, `${message} (x)`);
  near(actual.y, expected.y, `${message} (y)`);
};

describe('angles around the circle guide', () => {
  test('zero degrees points straight up, and the numbers grow clockwise', () => {
    const center = { x: 0, y: 0 };
    near(angleFromCenter(center, { x: 0, y: -10 }), 0, 'straight up');
    near(angleFromCenter(center, { x: 10, y: 0 }), 90, 'to the right');
    near(angleFromCenter(center, { x: 0, y: 10 }), 180, 'straight down');
    near(angleFromCenter(center, { x: -10, y: 0 }), 270, 'to the left');
  });

  test('a spoke direction is the unit vector of its angle', () => {
    nearPoint(directionOf(0), { x: 0, y: -1 }, 'up');
    nearPoint(directionOf(90), { x: 1, y: 0 }, 'right');
    nearPoint(directionOf(180), { x: 0, y: 1 }, 'down');
  });

  test('the rings and the spokes are evenly spread from the start angle', () => {
    const polar = { ...DEFAULT_POLAR, rings: 3, spacing: 25, spokes: 4, startAngle: 45 };
    assert.deepEqual(ringRadii(polar), [25, 50, 75], 'three rings, 25 apart');
    assert.deepEqual(spokeAngles(polar), [45, 135, 225, 315], 'four spokes from 45°');
  });
});

describe('a point on the circle guide', () => {
  const polar = {
    ...DEFAULT_POLAR,
    visible: true,
    center: { x: 100, y: 100 },
    rings: 4,
    spacing: 50,
    spokes: 4,
    startAngle: 0,
  };

  test('lands on the nearest ring crossed with the nearest spoke', () => {
    nearPoint(polarPoint(polar, { x: 145, y: 60 }), { x: 150, y: 100 }, 'the first ring to the right');
  });

  test('never goes past the outermost ring', () => {
    nearPoint(polarPoint(polar, { x: 100, y: 1000 }), { x: 100, y: 300 }, 'the fourth ring, below');
  });

  test('inside the innermost half-ring it is the middle itself', () => {
    nearPoint(polarPoint(polar, { x: 104, y: 97 }), { x: 100, y: 100 }, 'the middle');
  });
});

describe('what a stitch offers to snap to', () => {
  test('its middle and the two ends of its own upright axis', () => {
    const anchors = itemAnchors({ x: 10, y: 20, width: 12, height: 30, rotation: 0 });
    nearPoint(anchors[0], { x: 10, y: 20 }, 'the middle');
    nearPoint(anchors[1], { x: 10, y: 5 }, 'the top');
    nearPoint(anchors[2], { x: 10, y: 35 }, 'the bottom');
  });

  test('a turned stitch offers turned ends, so stitches stack along their own axis', () => {
    const anchors = itemAnchors({ x: 0, y: 0, width: 12, height: 20, rotation: 90 });
    nearPoint(anchors[1], { x: 10, y: 0 }, 'the top now points right');
    nearPoint(anchors[2], { x: -10, y: 0 }, 'the bottom points left');
  });
});

describe('snapping', () => {
  test('switched off, the point is left where it is', () => {
    const pattern = setGrid(base(), true);
    nearPoint(snapPoint(pattern, { x: 13, y: 7 }, { tolerance: 10 }), { x: 13, y: 7 }, 'untouched');
  });

  test('a visible grid takes the point to the nearest crossing', () => {
    const pattern = setSnap(setGridSize(setGrid(base(), true), 20), true);
    nearPoint(snapPoint(pattern, { x: 23, y: 37 }, { tolerance: 10 }), { x: 20, y: 40 }, 'the nearest crossing');
  });

  test('a hidden grid offers nothing, however close the crossing is', () => {
    const pattern = setSnap(setGridSize(base(), 20), true);
    nearPoint(snapPoint(pattern, { x: 23, y: 37 }, { tolerance: 10 }), { x: 23, y: 37 }, 'untouched');
  });

  test('a wide grid still takes the point: a guide has a crossing everywhere', () => {
    const pattern = setSnap(setGridSize(setGrid(base(), true), 100), true);
    nearPoint(
      snapPoint(pattern, { x: 40, y: 60 }, { tolerance: 10 }),
      { x: 0, y: 100 },
      'the nearest crossing, far as it is',
    );
  });

  test('with no guide showing, a stitch too far away leaves the point alone', () => {
    const placed = stitch(setSnap(base(), true), { x: 100, y: 100 });
    nearPoint(snapPoint(placed, { x: 40, y: 60 }, { tolerance: 10 }), { x: 40, y: 60 }, 'out of reach');
  });

  test('a nearer stitch beats the grid, a farther one does not', () => {
    const grid = setSnap(setGridSize(setGrid(base(), true), 20), true);
    const near = stitch(grid, { x: 26, y: 40, height: 20 });
    nearPoint(snapPoint(near, { x: 25, y: 40 }, { tolerance: 10 }), { x: 26, y: 40 }, 'the stitch, one unit away');
    const far = stitch(grid, { x: 33, y: 40, height: 20 });
    nearPoint(snapPoint(far, { x: 25, y: 40 }, { tolerance: 10 }), { x: 20, y: 40 }, 'the crossing, five units away');
  });

  test('the stitches being dragged do not snap to themselves', () => {
    const grid = setSnap(base(), true);
    const pattern = stitch(grid, { x: 26, y: 40, height: 20 });
    const id = pattern.items[0].id;
    nearPoint(
      snapPoint(pattern, { x: 25, y: 40 }, { tolerance: 10, skip: new Set([id]) }),
      { x: 25, y: 40 },
      'untouched',
    );
  });

  test('a hidden row offers nothing to snap to', () => {
    const grid = setSnap(base(), true);
    const placed = stitch(grid, { x: 26, y: 40, height: 20 });
    const pattern = { ...placed, rows: placed.rows.map((row) => ({ ...row, visible: false })) };
    nearPoint(snapPoint(pattern, { x: 25, y: 40 }, { tolerance: 10 }), { x: 25, y: 40 }, 'untouched');
  });

  test('the circle guide offers its crossings too', () => {
    const pattern = setSnap(
      setPolar(base(), { visible: true, center: { x: 0, y: 0 }, rings: 3, spacing: 50, spokes: 4, startAngle: 0 }),
      true,
    );
    nearPoint(snapPoint(pattern, { x: 48, y: 4 }, { tolerance: 10 }), { x: 50, y: 0 }, 'the first ring, to the right');
  });
});

describe('turning a stitch outwards', () => {
  test('the turn is the angle from the middle, so the top faces away', () => {
    const polar = { ...DEFAULT_POLAR, center: { x: 0, y: 0 } };
    near(radialRotation(polar, { x: 0, y: -10 }), 0, 'above the middle it stays upright');
    near(radialRotation(polar, { x: 0, y: 10 }), 180, 'below the middle it is upside down');
    near(radialRotation(polar, { x: 10, y: 0 }), 90, 'to the right it lies on its side');
  });
});

describe('the guide settings keep themselves sane', () => {
  test('the grid size stays inside its range and is a whole number', () => {
    assert.equal(setGridSize(base(), 0).guides.grid.size, GRID_SIZE_RANGE.min, 'zero is refused');
    assert.equal(setGridSize(base(), 10_000).guides.grid.size, GRID_SIZE_RANGE.max, 'huge is capped');
    assert.equal(setGridSize(base(), 12.4).guides.grid.size, 12, 'rounded');
  });

  test('the ring and spoke counts stay inside their range', () => {
    assert.equal(setPolar(base(), { rings: 0 }).guides.polar.rings, POLAR_RANGE.rings.min, 'at least one ring');
    assert.equal(setPolar(base(), { spokes: 1000 }).guides.polar.spokes, POLAR_RANGE.spokes.max, 'spokes capped');
  });

  test('the start angle is folded into a single turn', () => {
    assert.equal(setPolar(base(), { startAngle: 380 }).guides.polar.startAngle, 20, 'folded');
    assert.equal(setPolar(base(), { startAngle: -90 }).guides.polar.startAngle, 270, 'folded from below zero');
  });

  test('a setting that changes nothing gives back the very same pattern', () => {
    const pattern = base();
    assert.equal(setGridSize(pattern, pattern.guides.grid.size), pattern, 'the same grid size');
    assert.equal(setSnap(pattern, pattern.guides.snap), pattern, 'the same snapping');
    assert.equal(setPolar(pattern, { visible: false }), pattern, 'the same circle guide');
  });
});

describe('a grid too fine to draw is too fine to snap to (PQW-966)', () => {
  test('with the grid not drawn, the point is left alone', () => {
    const pattern = setSnap(setGridSize(setGrid(base(), true), 4), true);
    nearPoint(snapPoint(pattern, { x: 13, y: 7 }, { tolerance: 10, gridDrawn: false }), { x: 13, y: 7 }, 'untouched');
    nearPoint(snapPoint(pattern, { x: 13, y: 7 }, { tolerance: 10, gridDrawn: true }), { x: 12, y: 8 }, 'snapped');
  });
});

describe('a broken setting cannot poison the guide (PQW-966)', () => {
  test('a start angle that is not a number falls back to zero', () => {
    assert.equal(setPolar(base(), { startAngle: Number.NaN }).guides.polar.startAngle, 0, 'not NaN');
  });
});
