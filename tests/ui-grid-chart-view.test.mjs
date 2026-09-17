/*
 * A „Rácsminta” szakasz tartalma (PQW-864): ecsetek és cellanevek, a rács
 * átméretezése és a színek törlése, a cellaarány a mintasűrűségből, az
 * ismétlő egység állapota, a terv kiírása technikánként, a tükrözési
 * figyelmeztetés, a fonal színenként, a létrehozás és a visszatöltés, és az
 * ismétlő egység kerete a diagramon.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import {
  DEFAULT_COLORS,
  TECHNIQUE_CHOICES,
  brushesFor,
  cellAppearance,
  cellLabel,
  cellPixels,
  defaultState,
  editorCellSize,
  expandedCells,
  generateFromState,
  nextColor,
  planSummary,
  removeColor,
  resizeDraft,
  stateFromPattern,
  imageGridSize,
  imageToDraft,
  spikeNodes,
  unitFrames,
  unitState,
  withTechnique,
  yarnLines,
  colorLabel,
} from '../src/ui/grid-chart-view.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** Rács szövegből, felülről lefelé: `#` teli, `.` nyitott, `-` nincs cella, `?` meg nem adott; számjegy a szín indexe. */
const SYMBOLS = { '#': 1, '.': 0, '-': -1, '?': null };
const draft = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch in SYMBOLS ? SYMBOLS[ch] : Number(ch))));

const filet = (lines, patch = {}) => ({ ...defaultState('filet'), draft: draft(...lines), ...patch });

/** Minta profillal: mért mintasűrűség, próbadarab és fonal, hogy a fonal becsülhető legyen. */
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

describe('ecsetek, cellák, színek', () => {
  test('az öt technika választható, a mozaikkal együtt (PQW-894); filében teli, nyitott, nincs cella és törlés; színes rácsban színenként egy ecset', () => {
    assert.deepEqual(TECHNIQUE_CHOICES.map((choice) => choice.value), ['filet', 'c2c', 'tapestry', 'graphgan', 'mosaic']);
    assert.deepEqual(brushesFor(defaultState('filet')).map((brush) => brush.value), [1, 0, -1, null]);
    const c2c = defaultState('c2c');
    assert.deepEqual(brushesFor(c2c).map((brush) => [brush.value, brush.label, brush.swatch]), [
      [0, 'A: Natúr', '#f3ecdf'],
      [1, 'B: Bordó', '#8c2f4a'],
      [null, 'Törlés: az ismétlésből töltődik', null],
    ]);
  });

  test('a cella akadálymentes neve a sorral, a cellával és az értékkel', () => {
    const state = filet(['#?', '.-']);
    assert.equal(cellLabel(state, 0, 1), '3. sor, 1. cella: teli');
    assert.equal(cellLabel(state, 1, 1), '3. sor, 2. cella: nincs megadva');
    assert.equal(cellLabel(state, 1, 0), '2. sor, 2. cella: nincs cella');
    assert.equal(cellLabel({ ...defaultState('tapestry'), draft: [[1]] }, 0, 0), '2. sor, 1. cella: B szín, Bordó');
    assert.deepEqual(cellAppearance(state, 1), { className: 'grid-cell grid-cell--filled', color: null });
    assert.deepEqual(cellAppearance(defaultState('graphgan'), 1), { className: 'grid-cell grid-cell--color', color: '#8c2f4a' });
  });

  test('átméretezés: a meglévő cellák maradnak, az újak meg nem adottak; technikaváltáskor a filé cellái nem kerülnek színes rácsba', () => {
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

  test('szín hozzáadása legfeljebb 8-ig; törléskor a cellák az első megmaradó színt kapják', () => {
    let colors = DEFAULT_COLORS;
    while (nextColor(colors)) colors = [...colors, nextColor(colors)];
    assert.equal(colors.length, 8);
    const state = { ...defaultState('tapestry'), colors: [...DEFAULT_COLORS, { name: 'Kék', hex: '#2f5f9e' }], draft: [[0, 1, 2, null]] };
    const removed = removeColor(state, 1);
    assert.deepEqual(removed.draft, [[0, 0, 1, null]]);
    // A beépített szín azonosítót visz, a nevét a megjelenítés adja (PQW-905).
    assert.deepEqual(removed.colors.map((color) => colorLabel(color)), ['Natúr', 'Kék']);
    assert.equal(removeColor({ ...state, colors: [DEFAULT_COLORS[0]] }, 0).colors.length, 1);
  });

  test('a cella a mintasűrűség arányában: filében 3 szem széles és egy sor magas', () => {
    const size = editorCellSize(withProfile('dc'), 'filet');
    assert.equal(size.widthCm / size.heightCm, 3);
    assert.deepEqual(cellPixels(size, 24), { width: 24, height: 8 });
    assert.deepEqual(cellPixels({ widthCm: 1, heightCm: 2 }, 20), { width: 10, height: 20 });
  });
});

describe('ismétlő egység és terv', () => {
  test('felismert egység: az első sorok teljesen, a többi az ismétlésig; a kiterjesztett rács a terv alapja', () => {
    const state = filet(['#.??????', '.#??????', '#.#.#.#.', '.#.#.#.#']);
    const unit = unitState(state);
    assert.deepEqual(unit.unit, { x: 0, y: 0, width: 2, height: 2 });
    assert.match(unit.text, /^Ismétlő egység, felismerve: 2 × 2 cella\./);
    const expanded = expandedCells(state, unit);
    assert.ok(expanded.ok);
    assert.deepEqual(expanded.cells[3], [1, 0, 1, 0, 1, 0, 1, 0]);

    const summary = planSummary(emptyPattern(), state, false);
    assert.ok(summary.ok, summary.reason);
    assert.match(summary.view.size, /^Tényleges méret: ≈ \d+(,\d)? × \d+(,\d)? cm, 4 sor\.$/);
    assert.ok(summary.view.details.includes('Ismétlő egység: 2 × 2 cella, a teljes 8 × 4 cellás rácsra kiterjesztve.'));
    assert.ok(summary.view.details.includes('A legszélesebb sor 8 cella: 3 × 8 + 1 = 25 pozíció.'));
    assert.ok(summary.view.details.includes('Láncalap: 28 lsz; az első pálca a horogtól számított 5. láncszembe megy.'));
    assert.match(summary.view.source, /^A méret becslés a tűből/);
  });

  test('kézi egység hibája, eltérő cellái; meg nem adott cellánál egység nélkül nincs terv', () => {
    const state = filet(['####', '#.#.', '####']);
    const manual = unitState({ ...state, manualUnit: { x: 0, y: 1, width: 2, height: 1 } });
    assert.match(manual.text, /^Ismétlő egység, kézzel: 2 × 1 cella, a 2\. sor 1\. cellájától\. 4 megadott cella eltér tőle/);
    assert.match(unitState({ ...state, manualUnit: { x: 3, y: 0, width: 2, height: 1 } }).text, /rácson belül/);
    assert.match(unitState(state).text, /^Minden cella megadott\./);
    const gaps = planSummary(emptyPattern(), filet(['#?', '.#']), false);
    assert.equal(gaps.ok, false);
    assert.match(gaps.reason, /Nem találtam ismétlődést/);
  });

  test('filében a nyitott kezdésű sorok, az alakítás a sor két végén és a meghagyott cellák; teli új cellánál az ok', () => {
    const summary = planSummary(emptyPattern(), filet(['-###', '.###', '-###']), false);
    assert.ok(summary.ok, summary.reason);
    assert.ok(summary.view.details.includes('Nyitott cellával kezdődik a 2. sor: a fordulólánc után 2 lsz jön.'));
    assert.ok(summary.view.details.includes('Szaporítás a sor elején a 2. sor előtt: az előző sor végén láncos hosszabbítás.'));
    assert.ok(summary.view.details.includes('Meghagyott cellák a 3. sor végén.'));
    // A 2. sor végén új nyitott cella, a 3. sor elején fogyasztás ugyanazon az élen.
    const shaped = planSummary(emptyPattern(), filet(['###-', '###.', '###-']), false);
    assert.ok(shaped.ok, shaped.reason);
    assert.ok(shaped.view.details.includes('Szaporítás a sor végén a 2. sorban: 2 lsz és háromráhajtásos pálca 2 sorral lejjebb.'));
    assert.ok(shaped.view.details.includes('Fogyasztás a sor elején a 3. sorban: kúszószemek a cellák fölött.'));
    const refused = planSummary(emptyPattern(), filet(['####', '###-']), false);
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /csak nyitott lehet/);
  });

  test('C2C: átlós sorok, csempék, szakaszok és csempék színenként', () => {
    const state = { ...defaultState('c2c'), draft: [[0, 1, 1], [1, 1, 0]] };
    const summary = planSummary(emptyPattern(), state, false);
    assert.ok(summary.ok, summary.reason);
    assert.match(summary.view.size, /, 4 átlós sor, 6 csempe\.$/);
    assert.ok(summary.view.details.includes('Láncalap: 7 lsz; az első pálca a horogtól számított 5. láncszembe megy.'));
    assert.ok(summary.view.details.includes('Szaporítás az 1–2. sorig; utána az az oldal fogy, ahol a méret megvan, a másik még nő.'));
    assert.ok(summary.view.details.includes('Csempék színenként: A: 2, B: 4 csempe.'));
  });

  test('tapestry: szemek színenként, figyelmeztetés 3-nál több vitt színre; tükrözött nézetben a feliratos motívumra', () => {
    const colors = ['Fehér', 'Piros', 'Kék', 'Zöld'].map((name) => ({ name, hex: '#000000' }));
    const state = { ...defaultState('tapestry'), colors, draft: [[0, 1, 2, 3], [0, 0, 1, 1]], lettering: true };
    const summary = planSummary(emptyPattern(), state, true);
    assert.ok(summary.ok, summary.reason);
    assert.ok(summary.view.details.includes('Szemek színenként: A: 3, B: 3, C: 1, D: 1 szem.'));
    assert.deepEqual(summary.view.warnings, [
      'Tükrözött nézet: a feliratos motívumban a betűk fordítva állnak. Balkezes horgolásnál a rácsot tükrözd, hogy a felirat olvasható maradjon.',
      'Tapestryben 3-nál több színt kell vinni az 1. sorban: ez haladó szint, a szövet merevebb lesz.',
    ]);
    assert.equal(planSummary(emptyPattern(), state, false).view.warnings.length, 1);
  });
});

describe('létrehozás, fonal, visszatöltés, keret', () => {
  test('a létrehozott minta hibátlan, a rács visszatölthető a szerkesztőbe', () => {
    for (const technique of ['filet', 'c2c', 'tapestry', 'graphgan']) {
      const state = technique === 'filet' ? filet(['#.#.', '.#.#', '####']) : { ...defaultState(technique), draft: [[0, 1, 0], [1, 1, 0]] };
      const result = generateFromState(emptyPattern(), state);
      assert.ok(result.ok, `${technique}: ${result.reason}`);
      assert.match(result.message, /^.+: \d+ sor elkészült; visszavonással a korábbi minta visszajön\.$/);
      const errors = validatePattern(result.pattern, libraryFor(result.pattern)).filter((finding) => finding.severity === 'error');
      assert.deepEqual(errors, [], technique);
      assert.deepEqual(stateFromPattern(result.pattern).draft, state.draft, technique);
    }
    assert.equal(stateFromPattern(emptyPattern()), null);
    assert.equal(generateFromState(emptyPattern(), filet(['#?'])).ok, false);
  });

  test('fonal: profil nélkül a hiányzó adatok, profillal színenként a cellák arányában', () => {
    const plain = generateFromState(emptyPattern(), { ...defaultState('graphgan'), draft: [[0, 1], [1, 1]] });
    assert.match(yarnLines(plain.pattern)[0], /^Fonalbecsléshez add meg/);
    // 20 × 20 cella, az első oszlop B, a többi A: a fonal a cellák arányában.
    const cells = Array.from({ length: 20 }, () => Array.from({ length: 20 }, (_, x) => (x === 0 ? 1 : 0)));
    const measured = generateFromState(withProfile('sc'), { ...defaultState('graphgan'), draft: cells });
    assert.ok(measured.ok, measured.reason);
    const lines = yarnLines(measured.pattern);
    assert.equal(lines.length, 2);
    const [a, b] = lines.map((line) => /^[AB] \((Natúr|Bordó)\): ≈ (\d+) m \((\d+)–(\d+) m\)$/.exec(line));
    assert.ok(a && b, lines.join(' | '));
    assert.equal(a[1], 'Natúr');
    // A 380, B 20 cella; a kiírás egész méterre kerekít.
    assert.ok(Number(a[2]) > 5 * Math.max(1, Number(b[2])), 'A sokszor annyi fonal, mint B');
    assert.deepEqual(yarnLines(emptyPattern()), []);
  });

  test('az ismétlő egység kerete a diagramon az egység soraira és oszlopaira; C2C-ben csempénként (PQW-894)', () => {
    const state = { ...defaultState('graphgan'), draft: [[0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 1]], manualUnit: { x: 0, y: 0, width: 2, height: 1 } };
    const { pattern } = generateFromState(emptyPattern(), state);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const frames = unitFrames(pattern, layout, false);
    assert.equal(frames.length, 1);
    const [frame] = frames;
    const row1 = [...layout.nodes.values()].filter((node) => node.layer === 1);
    const xs = row1.map((node) => node.top.x);
    assert.ok(frame.x0 >= Math.min(...xs) - 24 && frame.x1 <= Math.max(...xs) + 24);
    assert.ok(frame.x1 - frame.x0 < (Math.max(...xs) - Math.min(...xs)) * 0.75, 'az egység a sor fele');
    assert.ok(frame.y0 < frame.y1);
    assert.equal(unitFrames(pattern, layout, false), frames);

    const c2c = generateFromState(emptyPattern(), { ...defaultState('c2c'), draft: [[0, 1, 0], [1, 0, 1]], manualUnit: { x: 0, y: 0, width: 2, height: 1 } });
    assert.ok(c2c.ok, c2c.reason);
    const tiles = unitFrames(c2c.pattern, layoutPattern(c2c.pattern, libraryFor(c2c.pattern)), false);
    assert.equal(tiles.length, 2);
    for (const tile of tiles) assert.ok(tile.x0 < tile.x1 && tile.y0 < tile.y1);
    assert.deepEqual(unitFrames(generateFromState(emptyPattern(), defaultState('filet')).pattern, layout, false), []);
  });

  test('mozaik: egy- és kétsoros változat, a lejjebb horgolt szemek; a cella kétsorosnál kétszer olyan magas (PQW-894)', () => {
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
    assert.match(one.view.size, /, 4 sor \(4 rácssor\)\.$/);
    assert.ok(one.view.details.includes('Egysoros mozaik: a lejjebb horgolt szem egyráhajtásos pálca 2 sorral lejjebb, összesen 1.'));
    const two = planSummary(emptyPattern(), { ...state, mosaicRows: 2 }, false);
    assert.ok(two.ok, two.reason);
    assert.match(two.view.size, /, 8 sor \(4 rácssor\)\.$/);
    const result = generateFromState(emptyPattern(), { ...state, mosaicRows: 2 });
    assert.ok(result.ok, result.reason);
    assert.equal(stateFromPattern(result.pattern).mosaicRows, 2);
    assert.equal(spikeNodes(result.pattern).size, 1);
    assert.equal(editorCellSize(withProfile('sc'), 'mosaic', 2).heightCm, 2 * editorCellSize(withProfile('sc'), 'mosaic', 1).heightCm);
    const fromTapestry = withTechnique({ ...defaultState('tapestry'), colors: [...DEFAULT_COLORS, { name: 'Kék', hex: '#2f5f9e' }] }, 'mosaic');
    assert.deepEqual(fromTapestry.colors, DEFAULT_COLORS);
    assert.equal(nextColor(DEFAULT_COLORS, 'mosaic'), null);
  });

  test('kép a rácsba: a méret a mintasűrűség arányából; filében a sötét cella teli, színes rácsban a legközelebbi szín (PQW-894)', () => {
    const pattern = withProfile('sc');
    // Négyzetes cella (20 szem és 20 sor 10 cm-en): a 2 : 1 arányú kép 10 cella széles rácsa 5 sor.
    assert.deepEqual(imageGridSize(200, 100, 10, pattern, defaultState('graphgan')), { width: 10, height: 5 });
    assert.deepEqual(imageGridSize(100, 100, 500, pattern, defaultState('graphgan')), { width: 80, height: 80 });
    // 2 × 2 képpont, felülről lefelé: fekete, fehér / fehér, átlátszó.
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
    // Mozaikban a betöltött rács horgolható: az 1. sor és a szélek a sor színei.
    const black = Array.from({ length: 6 }, () => [0, 0, 0, 255]).flat();
    assert.deepEqual(imageToDraft(black, 3, 2, { ...defaultState('mosaic'), colors }), [
      [0, 0, 0],
      [1, 1, 1],
    ]);
  });
});

describe('a magból jövő üzenetek szótára (PQW-904)', () => {
  /** Minden mezőnév, ami a terület kódjaiban előfordul: így minden szöveg kiírható. */
  const SAMPLE = { row: 2, cell: 3, color: 1, layer: 1, current: 3, shape: 'row', start: 'chain', width: 2, height: 3, max: 8, rule: 'nyitott-sor' };
  const render = (entry) => (typeof entry === 'string' ? entry : entry(SAMPLE));

  test('minden kódhoz van magyar és angol szöveg, azonos fajtával; az angol ágban nincs magyar ékezet', () => {
    const { hu, en } = GRID_CORE_TEXTS;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(hu).sort());
    assert.ok(Object.keys(hu).length >= 30, `túl kevés kód: ${Object.keys(hu).length}`);
    for (const [code, entry] of Object.entries(hu)) {
      assert.equal(typeof en[code], typeof entry, code);
      assert.ok(render(entry).length > 0 && render(en[code]).length > 0, code);
    }
    const accented = Object.entries(en).filter(([, entry]) => /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(render(entry)));
    assert.deepEqual(accented.map(([code]) => code), []);
  });

  test('a magyar mondat a mai szöveg: a névelőt, a ragozást és a szín szavát a szótár teszi hozzá', () => {
    const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
    assert.equal(hu({ code: 'filet-empty-row', data: { row: 1 } }), 'A 2. sorban nincs cella: a filé minden sora legalább egy cella.');
    assert.equal(hu({ code: 'mosaic-base-row', data: { color: 0 } }), 'Az 1. sor az alapsor: minden cellája az A szín legyen.');
    assert.equal(
      hu({ code: 'aim-other-layer', data: { layer: 0, current: 4, shape: 'round', start: 'ring' } }),
      'Ez a varázskör egyik helye. Most a 4. kör készül: csak a 3. kör szemeibe horgolhatsz. Nem került le szem.',
    );
    assert.equal(
      hu({ code: 'aim-other-layer', data: { layer: 2, current: 5, shape: 'row' } }),
      'Ez a 3. sor egyik helye. Most a 6. sor készül: csak az 5. sor szemeibe horgolhatsz. Nem került le szem.',
    );
    // Ismeretlen kódnál a felület nem dől el: a kód maga látszik (render.ts).
    assert.equal(hu({ code: 'nincs-ilyen' }), 'nincs-ilyen');
  });
});
