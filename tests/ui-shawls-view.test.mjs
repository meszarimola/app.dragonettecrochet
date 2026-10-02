/*
 * Contents of the „Kendő” section (PQW-865): the choices, the fields per
 * shawl, the plan printout with its angle and its blocked and unblocked size,
 * the wording of the warnings, and the preview outlines.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_SHAWL, planShawl, shawlSizes } from '../src/core/shawls.ts';
import { setUiLanguage } from '../src/ui/i18n.ts';
import {
  edgingLabel,
  generatedMessage,
  KIND_CHOICES,
  normalizeShawl,
  RATE_CHOICES,
  rateLabel,
  shawlFieldState,
  shawlOutline,
  shawlReason,
  shawlView,
  sizeLabel,
} from '../src/ui/shawls-view.ts';

/** Runs `run` with the interface in `language`, then restores the default. KB: interface.md §4 */
function inLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('en');
  }
}

const options = (patch = {}) => ({ ...DEFAULT_SHAWL, ...patch });

function withGauge(stitch, stitchesPer10cm, rowsPer10cm, blocked) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'kendo', profiles: [profile] } };
}

const viewOf = (pattern, patch, hasProfile = true) => {
  const chosen = options(patch);
  const planned = planShawl(pattern, chosen);
  assert.ok(planned.ok, planned.reason);
  const sizes = shawlSizes(planned.plan, chosen.blocking);
  return { view: shawlView(planned.plan, chosen, sizes, hasProfile), plan: planned.plan, sizes };
};

describe('choices and fields', () => {
  test('shawl kinds appear with their names in knowledge-base order, with a theoretical or a custom rate', () => {
    assert.deepEqual(
      KIND_CHOICES.map((choice) => choice.label),
      ['Top-down triangle', 'Asymmetric triangle', 'Crescent', 'Semicircle', 'Circle', 'Pi shawl'],
    );
    assert.deepEqual(
      RATE_CHOICES.map((choice) => choice.value),
      ['theory', 'custom'],
    );
  });

  test('fields per shawl: wings only on a triangle, the custom rate only once it is selected', () => {
    assert.deepEqual(shawlFieldState(options()), { length: false, rate: true, custom: false, wings: true });
    assert.deepEqual(shawlFieldState(options({ kind: 'semicircle', rate: 'custom' })), {
      length: false,
      rate: true,
      custom: true,
      wings: false,
    });
    assert.equal(normalizeShawl(options({ kind: 'crescent', wings: true })).wings, false);
  });

  test('labels per shawl: depth, edge, radius; what the rate applies to; edging counted per half on a symmetric shawl', () => {
    assert.deepEqual(['triangle', 'asymmetric-triangle', 'semicircle', 'pi'].map(sizeLabel), [
      'Depth at the spine, cm',
      'The straight edge, cm',
      'Radius, cm',
      'Radius, cm',
    ]);
    assert.equal(rateLabel('triangle'), 'Increases per row, across the whole row');
    assert.equal(rateLabel('pi'), 'Stitches in round 1');
    assert.equal(edgingLabel('triangle'), 'The last row to fit the edging repeat: “a multiple of X plus Y”, per half');
    assert.equal(edgingLabel('circle'), 'The last round to fit the edging repeat: “a multiple of X plus Y”');
  });
});

describe('the plan printout', () => {
  test('example „A”: the blocked size is measured and the unblocked one estimated, with the rate, the angle and the rows', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.match(view.size, /^Blocked 159 × 80 cm, unblocked ≈ \d+ × \d+ cm; 45 rows\.$/);
    assert.ok(view.details.includes('The first row has 8 stitches, the last 360.'), view.details.join('\n'));
    assert.ok(
      view.details.some((line) =>
        line.startsWith('Increases per row: 8 in theory (4 · h/w), 8 chosen; 2 per edge on average, 4 at the spine'),
      ),
    );
    assert.ok(
      view.details.includes('The neck edge is about 180° (180° for a straight neck edge), the bottom tip about 90°.'),
    );
    assert.deepEqual(view.warnings, []);
    assert.match(
      view.source,
      /^From the gauge measured flat gauge of double crochet\. The profile was measured blocked/,
    );
  });

  test('a custom rate gives a warning with the percentage, not an error', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), {
      kind: 'triangle',
      stitch: 'dc',
      sizeCm: 80,
      rate: 'custom',
      customRate: 6,
    });
    assert.equal(view.warnings.length, 1);
    assert.match(
      view.warnings[0],
      /^The chosen increase rate is about 75% of the theoretical: the shawl will be deeper and narrower.*This is a warning, not an error\./,
    );
  });

  test('Pi shawl: the doubling rounds, the range against the ideal, and the blocking warning; estimated without a profile', () => {
    const { view } = viewOf(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 }, false);
    assert.ok(
      view.details.includes('Doubling in rounds 2, 4, 8, 16, with plain rounds between.'),
      view.details.join('\n'),
    );
    assert.ok(view.details.some((line) => /^The round stitch counts are \d+–\d+% of the ideal\.$/.test(line)));
    assert.match(
      view.warnings[0],
      /^In the round before a doubling the stitch count is only about \d+% of the ideal: it cups in a solid stitch/,
    );
    assert.match(view.size, /^Unblocked ≈ \d+ cm across, blocked ≈ \d+ cm across; \d+ rounds\.$/);
    assert.match(view.source, /^No profile: the size is an estimate from a 4 mm hook\./);
  });

  test('fitting to the edging: the adjustment is counted per half', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), {
      kind: 'triangle',
      stitch: 'dc',
      sizeCm: 80,
      edging: { width: 6, edge: 3 },
    });
    assert.ok(
      view.details.includes('For the edging: a multiple of 6 plus 3 per half, 30 repeats (+3 stitches per half).'),
      view.details.join('\n'),
    );
  });
});

describe('turning a core reason into a sentence (PQW-904)', () => {
  test('the words for row and round come from the dictionary: the core only supplies `shape`', () => {
    const sentences = (language) =>
      inLanguage(language, () => [
        shawlReason({ code: 'shawl-min-rows', data: { rows: 2, shape: 'row' } }),
        shawlReason({ code: 'shawl-min-rows', data: { rows: 2, shape: 'round' } }),
        shawlReason({ code: 'shawl-max-stitches', data: { max: 1200, shape: 'round' } }),
        shawlReason({ code: 'shawl-max-stitches', data: { max: 1200, shape: 'row' } }),
      ]);
    assert.deepEqual(sentences('en'), [
      'This shawl needs at least 2 rows: give a larger size.',
      'This shawl needs at least 2 rounds: give a larger size.',
      'A round can have at most 1200 stitches: give a smaller size.',
      'A row can have at most 1200 stitches: give a smaller size.',
    ]);
    assert.deepEqual(sentences('hu'), [
      'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb méretet.',
      'Ehhez a kendőhöz legalább 2 kör kell: adj meg nagyobb méretet.',
      'Egy körben legfeljebb 1200 szem lehet: adj meg kisebb méretet.',
      'Egy sorban legfeljebb 1200 szem lehet: adj meg kisebb méretet.',
    ]);
  });

  test('the Hungarian article and ordinal are put into the sentence by the UI, and the shape codes are reused too', () => {
    inLanguage('hu', () => {
      assert.equal(
        shawlReason({ code: 'shawl-too-many-into-one', data: { row: 3, count: 14 } }),
        'A(z) 3. sorban egy szembe 14 szem kerülne: válassz kisebb szaporítást, vagy nagyobb méretet.',
      );
      assert.equal(
        shawlReason({ code: 'shape-too-steep' }),
        'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.',
      );
    });
  });

  test('a rejection from the planner renders as the sentence used today', () => {
    const planned = planShawl(emptyPattern(), options({ sizeCm: 0.5 }));
    assert.equal(planned.ok, false);
    assert.equal(shawlReason(planned.reason), 'This shawl needs at least 2 rows: give a larger depth.');
  });
});

describe('preview and message', () => {
  test('the blocked and the unblocked outline share one frame, aligned to the middle of the top edge', () => {
    const { sizes, plan } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    const outline = shawlOutline(sizes);
    assert.equal(outline.blocked.split(' ').length, 4);
    assert.equal(outline.unblocked.split(' ').length, 4);
    assert.ok(outline.width >= sizes.unblocked.widthCm && outline.height >= sizes.unblocked.depthCm);
    // The neck point sits in the middle on both outlines.
    const neck = (points) => Number(points.split(' ')[0].split(',')[0]);
    assert.ok(Math.abs(neck(outline.blocked) - outline.width / 2) < 0.01);
    assert.ok(Math.abs(neck(outline.unblocked) - outline.width / 2) < 0.01);
    assert.equal(generatedMessage(plan), 'Top-down triangle: 45 rows done; undo brings the previous one back.');
  });
});
