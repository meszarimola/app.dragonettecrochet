/*
 * Contents of the „Rácsminta” section (PQW-864): brushes and cell names,
 * resizing the grid and removing colours, the cell ratio taken from the gauge,
 * the state of the repeat unit, the plan printout per technique, the mirroring
 * warning, yarn per colour, creation and reload, and the frame of the repeat
 * unit on the chart.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import {
  brushesFor,
  cellAppearance,
  cellLabel,
  cellPixels,
  colorLabel,
  DEFAULT_COLORS,
  defaultState,
  editorCellSize,
  expandedCells,
  generateFromState,
  imageGridSize,
  imageToDraft,
  nextColor,
  planSummary,
  removeColor,
  resizeDraft,
  spikeNodes,
  stateFromPattern,
  TECHNIQUE_CHOICES,
  unitFrames,
  unitState,
  withTechnique,
  yarnLines,
} from '../src/ui/grid-chart-view.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** Grid from text, top to bottom: `#` filled, `.` open, `-` no cell, `?` not set; a digit is a colour index. */
const SYMBOLS = { '#': 1, '.': 0, '-': -1, '?': null };
const draft = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch in SYMBOLS ? SYMBOLS[ch] : Number(ch))));

const filet = (lines, patch = {}) => ({ ...defaultState('filet'), draft: draft(...lines), ...patch });

/** Pattern with a profile: measured gauge, swatch and yarn, so that the yarn can be estimated. */
function withProfile(stitch) {
  const profile = {
    id: 'p',
    yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: 200, ballMassG: 50 },
    hookMm: 4,
    blocked: false,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm: 20, rowsPer10cm: 20, source: 'measured' }],
    swatch: { widthCm: 10, heightCm: 10, massG: 5 },
  };
  return { ...emptyPattern(), gauge: { active: 'p', profiles: [profile] } };
}

describe('brushes, cells, colours', () => {
  test('all five techniques are selectable, mosaic included (PQW-894); filet offers filled, open, no cell and erase; a colour grid offers one brush per colour', () => {
    assert.deepEqual(
      TECHNIQUE_CHOICES.map((choice) => choice.value),
      ['filet', 'c2c', 'tapestry', 'graphgan', 'mosaic'],
    );
    assert.deepEqual(
      brushesFor(defaultState('filet')).map((brush) => brush.value),
      [1, 0, -1, null],
    );
    const c2c = defaultState('c2c');
    assert.deepEqual(
      brushesFor(c2c).map((brush) => [brush.value, brush.label, brush.swatch]),
      [
        [0, 'A: Natural', '#f3ecdf'],
        [1, 'B: Burgundy', '#8c2f4a'],
        [null, 'Erase: filled from the repeat', null],
      ],
    );
  });

  test('the accessible name of a cell gives the row, the cell and the value', () => {
    const state = filet(['#?', '.-']);
    assert.equal(cellLabel(state, 0, 1), 'row 3, cell 1: filled');
    assert.equal(cellLabel(state, 1, 1), 'row 3, cell 2: not set');
    assert.equal(cellLabel(state, 1, 0), 'row 2, cell 2: no cell');
    assert.equal(cellLabel({ ...defaultState('tapestry'), draft: [[1]] }, 0, 0), 'row 2, cell 1: colour B, Burgundy');
    assert.deepEqual(cellAppearance(state, 1), { className: 'grid-cell grid-cell--filled', color: null });
    assert.deepEqual(cellAppearance(defaultState('graphgan'), 1), {
      className: 'grid-cell grid-cell--color',
      color: '#8c2f4a',
    });
  });

  test('resizing keeps the existing cells and leaves the new ones unset; switching technique does not carry filet cells into a colour grid', () => {
    assert.deepEqual(resizeDraft(draft('#.', '.#'), 3, 3), [
      [0, 1, null],
      [1, 0, null],
      [null, null, null],
    ]);
    const colored = withTechnique(filet(['##']), 'tapestry');
    assert.deepEqual(colored.draft, [[0, 0]]);
    const kept = withTechnique({ ...defaultState('c2c'), draft: [[1, 0]] }, 'graphgan');
    assert.deepEqual(kept.draft, [[1, 0]]);
  });

  test('colours can be added up to eight, and removing one moves its cells to the first remaining colour', () => {
    let colors = DEFAULT_COLORS;
    while (nextColor(colors)) colors = [...colors, nextColor(colors)];
    assert.equal(colors.length, 8);
    const state = {
      ...defaultState('tapestry'),
      colors: [...DEFAULT_COLORS, { name: 'Kék', hex: '#2f5f9e' }],
      draft: [[0, 1, 2, null]],
    };
    const removed = removeColor(state, 1);
    assert.deepEqual(removed.draft, [[0, 0, 1, null]]);
    // A built-in colour carries an id and the display supplies its name (PQW-905).
    assert.deepEqual(
      removed.colors.map((color) => colorLabel(color)),
      ['Natural', 'Kék'],
    );
    assert.equal(removeColor({ ...state, colors: [DEFAULT_COLORS[0]] }, 0).colors.length, 1);
  });

  test('cell proportions follow the gauge: in filet a cell is three stitches wide and one row tall', () => {
    const size = editorCellSize(withProfile('dc'), 'filet');
    assert.equal(size.widthCm / size.heightCm, 3);
    assert.deepEqual(cellPixels(size, 24), { width: 24, height: 8 });
    assert.deepEqual(cellPixels({ widthCm: 1, heightCm: 2 }, 20), { width: 10, height: 20 });
  });
});

describe('repeat unit and plan', () => {
  test('a detected unit: the first rows in full, the rest up to the repeat, and the expanded grid is what the plan is built from', () => {
    const state = filet(['#.??????', '.#??????', '#.#.#.#.', '.#.#.#.#']);
    const unit = unitState(state);
    assert.deepEqual(unit.unit, { x: 0, y: 0, width: 2, height: 2 });
    assert.match(unit.text, /^Repeating unit, recognised: 2 × 2 cells\./);
    const expanded = expandedCells(state, unit);
    assert.ok(expanded.ok);
    assert.deepEqual(expanded.cells[3], [1, 0, 1, 0, 1, 0, 1, 0]);

    const summary = planSummary(emptyPattern(), state, false);
    assert.ok(summary.ok, summary.reason);
    assert.match(summary.view.size, /^Finished size: ≈ \d+(\.\d)? × \d+(\.\d)? cm, 4 rows\.$/);
    assert.ok(summary.view.details.includes('Repeating unit: 2 × 2 cells, extended over the whole 8 × 4 cell grid.'));
    assert.ok(summary.view.details.includes('The widest row is 8 cells: 3 × 8 + 1 = 25 positions.'));
    assert.ok(
      summary.view.details.includes(
        'Foundation chain: 28 ch; the first double crochet goes into chain 4 from the hook.',
      ),
    );
    assert.match(summary.view.source, /^The size is an estimate from the hook/);
  });

  test('a manual unit reports its errors and its differing cells; with unset cells and no unit there is no plan', () => {
    const state = filet(['####', '#.#.', '####']);
    const manual = unitState({ ...state, manualUnit: { x: 0, y: 1, width: 2, height: 1 } });
    assert.match(
      manual.text,
      /^Repeating unit, by hand: 2 × 1 cells, from row 2, cell 1\. 4 cells you set differ from it/,
    );
    assert.match(unitState({ ...state, manualUnit: { x: 3, y: 0, width: 2, height: 1 } }).text, /inside the grid/);
    assert.match(unitState(state).text, /^Every cell is set\./);
    const gaps = planSummary(emptyPattern(), filet(['#?', '.#']), false);
    assert.equal(gaps.ok, false);
    assert.match(gaps.reason, /No repeat found/);
  });

  test('filet: rows starting with an open cell, shaping at both ends of the row and cells left unworked, and a reason when a new cell would be filled', () => {
    const summary = planSummary(emptyPattern(), filet(['-###', '.###', '-###']), false);
    assert.ok(summary.ok, summary.reason);
    assert.ok(summary.view.details.includes('Starts with an open cell in row 2: 2 ch after the turning chain.'));
    assert.ok(
      summary.view.details.includes(
        'Increase at the start of row 2: a chain extension at the end of the previous row.',
      ),
    );
    assert.ok(summary.view.details.includes('Cells left unworked at the end of row 3.'));
    // A new open cell at the end of row 2 and a decrease at the start of row 3, on the same edge.
    const shaped = planSummary(emptyPattern(), filet(['###-', '###.', '###-']), false);
    assert.ok(shaped.ok, shaped.reason);
    assert.ok(shaped.view.details.includes('Increase at the end of row 2: 2 ch and a treble 2 rows below.'));
    assert.ok(shaped.view.details.includes('Decrease at the start of row 3: slip stitches over the cells.'));
    const refused = planSummary(emptyPattern(), filet(['####', '###-']), false);
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /can only be open/);
  });

  test('C2C: diagonal rows, tiles, sections, and tiles per colour', () => {
    const state = {
      ...defaultState('c2c'),
      draft: [
        [0, 1, 1],
        [1, 1, 0],
      ],
    };
    const summary = planSummary(emptyPattern(), state, false);
    assert.ok(summary.ok, summary.reason);
    assert.match(summary.view.size, /, 4 diagonal rows, 6 tiles\.$/);
    // The three opening chains of a tile form a chain space (03 §5.5): 3 + 3 chains, and the first double crochet goes into the 4th.
    assert.ok(
      summary.view.details.includes(
        'Foundation chain: 6 ch; the first double crochet goes into chain 4 from the hook.',
      ),
    );
    assert.ok(
      summary.view.details.includes(
        'Increases up to row 2; after that the side that has reached its size decreases while the other still grows.',
      ),
    );
    assert.ok(summary.view.details.includes('Tiles per colour: A: 2, B: 4 tiles.'));
  });

  test('tapestry: stitches per colour, a warning above three carried colours, and one for lettering in mirrored view', () => {
    const colors = ['Fehér', 'Piros', 'Kék', 'Zöld'].map((name) => ({ name, hex: '#000000' }));
    const state = {
      ...defaultState('tapestry'),
      colors,
      draft: [
        [0, 1, 2, 3],
        [0, 0, 1, 1],
      ],
      lettering: true,
    };
    const summary = planSummary(emptyPattern(), state, true);
    assert.ok(summary.ok, summary.reason);
    assert.ok(summary.view.details.includes('Stitches per colour: A: 3, B: 3, C: 1, D: 1 stitches.'));
    assert.deepEqual(summary.view.warnings, [
      'Mirrored view: in a motif with lettering the letters are reversed. For left-handed crochet mirror the grid so that the lettering stays readable.',
      'Tapestry carries more than 3 colours in row 1: this is an advanced level, and the fabric gets stiffer.',
    ]);
    assert.equal(planSummary(emptyPattern(), state, false).view.warnings.length, 1);
  });
});

describe('creation, yarn, reload, frame', () => {
  test('the generated pattern validates clean and the grid can be loaded back into the editor', () => {
    for (const technique of ['filet', 'c2c', 'tapestry', 'graphgan']) {
      // In C2C only the 1 × 1 and the 2 × 1 shape build today (PQW-926).
      const state =
        technique === 'filet'
          ? filet(['#.#.', '.#.#', '####'])
          : {
              ...defaultState(technique),
              draft:
                technique === 'c2c'
                  ? [[0, 1]]
                  : [
                      [0, 1, 0],
                      [1, 1, 0],
                    ],
            };
      const result = generateFromState(emptyPattern(), state);
      assert.ok(result.ok, `${technique}: ${result.reason}`);
      assert.match(result.message, /^.+: \d+ rows done; undo brings the previous one back\.$/);
      const errors = validatePattern(result.pattern, libraryFor(result.pattern)).filter(
        (finding) => finding.severity === 'error',
      );
      assert.deepEqual(errors, [], technique);
      assert.deepEqual(stateFromPattern(result.pattern).draft, state.draft, technique);
    }
    assert.equal(stateFromPattern(emptyPattern()), null);
    assert.equal(generateFromState(emptyPattern(), filet(['#?'])).ok, false);
  });

  test('yarn: without a profile it lists the missing data, with one it gives the amount per colour in proportion to the cells', () => {
    const plain = generateFromState(emptyPattern(), {
      ...defaultState('graphgan'),
      draft: [
        [0, 1],
        [1, 1],
      ],
    });
    assert.match(yarnLines(plain.pattern)[0], /^For a yarn estimate, give/);
    // 20 × 20 cells, the first column B and the rest A: the yarn follows the proportion of the cells.
    const cells = Array.from({ length: 20 }, () => Array.from({ length: 20 }, (_, x) => (x === 0 ? 1 : 0)));
    const measured = generateFromState(withProfile('sc'), { ...defaultState('graphgan'), draft: cells });
    assert.ok(measured.ok, measured.reason);
    const lines = yarnLines(measured.pattern);
    assert.equal(lines.length, 2);
    const [a, b] = lines.map((line) => /^[AB] \((Natural|Burgundy)\): ≈ (\d+) m \((\d+)–(\d+) m\)$/.exec(line));
    assert.ok(a && b, lines.join(' | '));
    assert.equal(a[1], 'Natural');
    // A has 380 cells, B has 20; the printout rounds to whole metres.
    assert.ok(Number(a[2]) > 5 * Math.max(1, Number(b[2])), 'A takes many times as much yarn as B');
    assert.deepEqual(yarnLines(emptyPattern()), []);
  });

  test('the repeat unit frame on the chart spans the rows and columns of the unit, and in C2C there is one per tile (PQW-894)', () => {
    const state = {
      ...defaultState('graphgan'),
      draft: [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ],
      manualUnit: { x: 0, y: 0, width: 2, height: 1 },
    };
    const { pattern } = generateFromState(emptyPattern(), state);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const frames = unitFrames(pattern, layout, false);
    assert.equal(frames.length, 1);
    const [frame] = frames;
    const row1 = [...layout.nodes.values()].filter((node) => node.layer === 1);
    const xs = row1.map((node) => node.top.x);
    assert.ok(frame.x0 >= Math.min(...xs) - 24 && frame.x1 <= Math.max(...xs) + 24);
    assert.ok(frame.x1 - frame.x0 < (Math.max(...xs) - Math.min(...xs)) * 0.75, 'the unit is half of the row');
    assert.ok(frame.y0 < frame.y1);
    assert.equal(unitFrames(pattern, layout, false), frames);

    // In C2C only the 1 × 1 and the 2 × 1 shape build today (PQW-926).
    const c2c = generateFromState(emptyPattern(), {
      ...defaultState('c2c'),
      draft: [[0, 1]],
      manualUnit: { x: 0, y: 0, width: 2, height: 1 },
    });
    assert.ok(c2c.ok, c2c.reason);
    const tiles = unitFrames(c2c.pattern, layoutPattern(c2c.pattern, libraryFor(c2c.pattern)), false);
    assert.equal(tiles.length, 2);
    for (const tile of tiles) assert.ok(tile.x0 < tile.x1 && tile.y0 < tile.y1);
    assert.deepEqual(unitFrames(generateFromState(emptyPattern(), defaultState('filet')).pattern, layout, false), []);
  });

  test('mosaic: the one-row and two-row variants with their spike stitches, and a cell twice as tall in the two-row variant (PQW-894)', () => {
    const state = {
      ...defaultState('mosaic', 5, 4),
      draft: [
        [0, 0, 0, 0, 0],
        [1, 1, 0, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
      ],
    };
    const one = planSummary(emptyPattern(), state, false);
    assert.ok(one.ok, one.reason);
    assert.match(one.view.size, /, 4 rows \(4 grid rows\)\.$/);
    assert.ok(
      one.view.details.includes('Single row mosaic: the dropped stitch is a double crochet 2 rows below, 1 in total.'),
    );
    const two = planSummary(emptyPattern(), { ...state, mosaicRows: 2 }, false);
    assert.ok(two.ok, two.reason);
    assert.match(two.view.size, /, 8 rows \(4 grid rows\)\.$/);
    const result = generateFromState(emptyPattern(), { ...state, mosaicRows: 2 });
    assert.ok(result.ok, result.reason);
    assert.equal(stateFromPattern(result.pattern).mosaicRows, 2);
    assert.equal(spikeNodes(result.pattern).size, 1);
    assert.equal(
      editorCellSize(withProfile('sc'), 'mosaic', 2).heightCm,
      2 * editorCellSize(withProfile('sc'), 'mosaic', 1).heightCm,
    );
    const fromTapestry = withTechnique(
      { ...defaultState('tapestry'), colors: [...DEFAULT_COLORS, { name: 'Kék', hex: '#2f5f9e' }] },
      'mosaic',
    );
    assert.deepEqual(fromTapestry.colors, DEFAULT_COLORS);
    assert.equal(nextColor(DEFAULT_COLORS, 'mosaic'), null);
  });

  test('image into the grid: the size follows the gauge ratio; in filet a dark cell comes out filled, in a colour grid it takes the nearest colour (PQW-894)', () => {
    const pattern = withProfile('sc');
    // Square cells (20 stitches and 20 rows per 10 cm): a 2 : 1 image in a grid 10 cells wide is 5 rows tall.
    assert.deepEqual(imageGridSize(200, 100, 10, pattern, defaultState('graphgan')), { width: 10, height: 5 });
    assert.deepEqual(imageGridSize(100, 100, 500, pattern, defaultState('graphgan')), { width: 80, height: 80 });
    // 2 × 2 pixels, top to bottom: black, white / white, transparent.
    const pixels = [0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0];
    assert.deepEqual(imageToDraft(pixels, 2, 2, defaultState('filet')), [
      [0, 0],
      [1, 0],
    ]);
    const colors = [
      { name: 'Fehér', hex: '#ffffff' },
      { name: 'Fekete', hex: '#000000' },
    ];
    assert.deepEqual(imageToDraft(pixels, 2, 2, { ...defaultState('graphgan'), colors }), [
      [0, 0],
      [1, 0],
    ]);
    // In mosaic the loaded grid stays workable: row 1 and the edges take the colours of the row.
    const black = Array.from({ length: 6 }, () => [0, 0, 0, 255]).flat();
    assert.deepEqual(imageToDraft(black, 3, 2, { ...defaultState('mosaic'), colors }), [
      [0, 0, 0],
      [1, 1, 1],
    ]);
  });
});

describe('dictionary of the messages coming from the core (PQW-904)', () => {
  /** Every field name that occurs in the codes of this area, so that every text can be rendered. */
  const SAMPLE = {
    row: 2,
    cell: 3,
    color: 1,
    layer: 1,
    current: 3,
    shape: 'row',
    start: 'chain',
    width: 2,
    height: 3,
    max: 8,
    rule: 'nyitott-sor',
  };
  const render = (entry) => (typeof entry === 'string' ? entry : entry(SAMPLE));

  test('every code has a Hungarian and an English text of the same kind, and the English branch carries no Hungarian accents', () => {
    const { hu, en } = GRID_CORE_TEXTS;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(hu).sort());
    assert.ok(Object.keys(hu).length >= 30, `too few codes: ${Object.keys(hu).length}`);
    for (const [code, entry] of Object.entries(hu)) {
      assert.equal(typeof en[code], typeof entry, code);
      assert.ok(render(entry).length > 0 && render(en[code]).length > 0, code);
    }
    const accented = Object.entries(en).filter(([, entry]) => /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(render(entry)));
    assert.deepEqual(
      accented.map(([code]) => code),
      [],
    );
  });

  test('the Hungarian sentence is the text as it stands today: the article, the inflection and the word for the colour are added by the dictionary', () => {
    const hu = (message) => renderCoreText(GRID_CORE_TEXTS, 'hu', message);
    assert.equal(
      hu({ code: 'filet-empty-row', data: { row: 1 } }),
      'A 2. sorban nincs cella: a filé minden sora legalább egy cella.',
    );
    assert.equal(
      hu({ code: 'mosaic-base-row', data: { color: 0 } }),
      'Az 1. sor az alapsor: minden cellája az A szín legyen.',
    );
    assert.equal(
      hu({ code: 'aim-other-layer', data: { layer: 0, current: 4, shape: 'round', start: 'ring' } }),
      'Ez a varázskör egyik helye. Most a 4. kör készül: csak a 3. kör szemeibe horgolhatsz. Nem került le szem.',
    );
    assert.equal(
      hu({ code: 'aim-other-layer', data: { layer: 2, current: 5, shape: 'row' } }),
      'Ez a 3. sor egyik helye. Most a 6. sor készül: csak az 5. sor szemeibe horgolhatsz. Nem került le szem.',
    );
    // An unknown code does not topple the interface: the code itself is shown (render.ts).
    assert.equal(hu({ code: 'nincs-ilyen' }), 'nincs-ilyen');
  });
});
