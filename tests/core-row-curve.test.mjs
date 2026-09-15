/*
 * Íves és megtört sorok (PQW-893): a félkör és a félhold sorai íven, a
 * nyakszöget átfogva; a fentről induló háromszög két fele a gerincnél a terv
 * szögében; a talpak a célpontjukon; új sor nem mozdítja a korábbiakat;
 * tükrözés, arányhelyes nézet, a rács sávjai és a célzás; a mentés. A többi
 * rajz (sík formák, kézzel horgolt sorok, körök, filé) lenyomata a PQW-893
 * előtti develop (`5fd2292`) lenyomatával egyezik.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { generateFilet } from '../src/core/filet.ts';
import { chartBounds, chartGrid, gridHit } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { rowCurve } from '../src/core/row-curve.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { DEFAULT_SHAWL, generateShawl } from '../src/core/shawls.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { gridPaths } from '../src/ui/grid-paths.ts';
import { chevron, dcRectangle, grannySquare, hdcRectangle, shellStitch, vStitchPattern, wave } from './fixtures/examples.ts';

const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};
const degrees = (radians) => (radians * 180) / Math.PI;
const near = (actual, expected, tolerance, name) => assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} ≉ ${expected}`);

/** Minta profillal, amelyben a szem síkban mérve adott szem és sor 10 cm-en. */
function withGauge(stitch, stitchesPer10cm, rowsPer10cm) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked: true,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'kendo', profiles: [profile] } };
}

const shawl = (patch, pattern = emptyPattern()) => ok(generateShawl(pattern, { ...DEFAULT_SHAWL, ...patch }));
const nodesOf = (layout, layer) => [...layout.nodes.values()].filter((node) => node.layer === layer);
const rowsOf = (pattern) => pattern.pieces[0].events.length;
/** A leképezés középpontja: az egyenes elrendezésből, mint a layout.ts-ben. */
const centerOf = (pattern, options = {}) => rowCurve(layoutPattern(pattern, libraryFor(pattern), { ...options, straight: true }), pattern.pieces[0].rowShape).center;
/** A pont szöge a kupola középpontjától, a függőlegestől mérve. */
const angleOf = (p, center) => degrees(Math.atan2(p.x - center, -p.y));

describe('a többi rajz nem változik (regresszió)', () => {
  const expected = JSON.parse(readFileSync(new URL('./fixtures/layout-digests.json', import.meta.url), 'utf8'));
  const patterns = {
    hdcRectangle: [hdcRectangle().pattern, 'rows'],
    dcRectangle: [dcRectangle().pattern, 'rows'],
    shell: [shellStitch().pattern, 'rows'],
    vStitch: [vStitchPattern().pattern, 'rows'],
    chevron: [chevron().pattern, 'rows'],
    wave: [wave().pattern, 'rows'],
    granny: [grannySquare().pattern, 'rounds'],
    ...Object.fromEntries(
      ['rectangle', 'right-triangle', 'isosceles-triangle', 'trapezoid', 'diamond'].map((shape) => [
        `shape-${shape}`,
        [ok(generateShape(emptyPattern(), { ...DEFAULT_SHAPE, shape, stitch: 'dc', widthCm: 15, heightCm: 12, topWidthCm: 5 })), 'rows'],
      ]),
    ),
    ...Object.fromEntries(
      ['circle', 'hexagon', 'granny-square'].map((shape) => [`motif-${shape}`, [ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape, rounds: 5 })), 'rounds']]),
    ),
    filet: [ok(generateFilet(emptyPattern(), { cells: [[1, 0, 1], [0, 1, 0], [1, 1, 1]], unit: null, lettering: false })), 'cells'],
    ...Object.fromEntries(
      ['stole', 'asymmetric-triangle', 'circle', 'pi'].map((kind) => [
        `shawl-${kind}`,
        [shawl({ kind, stitch: 'sc', sizeCm: 6, lengthCm: 6 }), kind === 'circle' || kind === 'pi' ? 'rounds' : 'rows'],
      ]),
    ),
  };
  const views = { plain: {}, mirror: { mirror: true }, aspect: { stemLength: (chainHeight) => 6 + 12 * chainHeight, columnWidth: 30 } };
  const clean = (value) => {
    if (typeof value === 'number') {
      const rounded = Math.round(value * 1e4) / 1e4;
      return Object.is(rounded, -0) ? 0 : rounded;
    }
    if (typeof value === 'function') return undefined;
    if (value instanceof Map) return [...value.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => [key, clean(item)]);
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, clean(value[key])]));
    return value;
  };
  const digest = (value) => createHash('sha256').update(JSON.stringify(clean(value))).digest('hex').slice(0, 16);

  for (const [name, [pattern, kind]] of Object.entries(patterns)) {
    test(`${name}: az elrendezés és a rács a PQW-893 előtti szerint, sima, tükrözött és arányhelyes nézetben`, () => {
      const library = libraryFor(pattern);
      assert.equal(pattern.pieces[0].rowShape, undefined);
      for (const [view, options] of Object.entries(views)) {
        assert.equal(digest(layoutPattern(pattern, library, options)), expected[`${name}/${view}/layout`], `${view} elrendezés`);
        const grid = chartGrid(pattern, library, kind, contextOf(pattern), options);
        assert.equal(digest({ bands: grid.bands, cells: grid.cells, bounds: grid.bounds, shape: grid.shape }), expected[`${name}/${view}/grid`], `${view} rács`);
      }
    });
  }
});

describe('félkör és félhold íven (05 §1.2, §1.6)', () => {
  test('félkör: az utolsó sor egy sugáron, és 180°-ot fog át', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 15 });
    assert.deepEqual(pattern.pieces[0].rowShape, { kind: 'arc', neckAngle: 180 });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const last = nodesOf(layout, rowsOf(pattern));
    const radii = last.filter((node) => node.role === 'stitch').map((node) => Math.hypot(node.top.x - center, node.top.y));
    assert.ok(Math.max(...radii) / Math.min(...radii) < 1.03, `${Math.min(...radii)}–${Math.max(...radii)}`);
    // A szemek teteje; a fordulólánc a sor tetővonala alatt, kisebb sugáron áll.
    const angles = last.filter((node) => node.role === 'stitch').map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), 180, 3, 'átfogott szög');
    // A kupola a nyak pontja fölött: a szemek a vízszintes fölött; a sor a fordulólánc felé tolódik, ezért a vége néhány fokkal alatta lehet.
    const radius = Math.max(...radii);
    assert.ok(last.filter((node) => node.role === 'stitch').every((node) => node.top.y < 0.1 * radius));
  });

  test('félhold: az ív a terv nyakszögét fogja át, kisebbet a félkörénél', () => {
    const pattern = shawl({ kind: 'crescent', stitch: 'sc', sizeCm: 8 });
    const { kind, neckAngle } = pattern.pieces[0].rowShape;
    assert.equal(kind, 'arc');
    assert.ok(neckAngle > 90 && neckAngle < 180, String(neckAngle));
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const angles = nodesOf(layout, rowsOf(pattern))
      .filter((node) => node.role === 'stitch')
      .map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), neckAngle, 4, 'átfogott szög');
  });

  // A középpont közelében, az első sorokban a sor végi szár kis sugáron ferdén fut: ott nem mérjük. Beljebb a
  // sor végén a szár legfeljebb háromnegyed oszlopnyit dől (a fordulólánc tetejébe horgolt szemnél a legtöbbet).
  test('a talpak a célpontjuk tetején a 4. sortól: a hézag legfeljebb háromnegyed oszlopnyival nagyobb az egyenes rajzénál', () => {
    for (const pattern of [shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 15 }), shawl({ kind: 'triangle', stitch: 'hdc', sizeCm: 12 })]) {
      const library = libraryFor(pattern);
      const [curved, straight] = [layoutPattern(pattern, library), layoutPattern(pattern, library, { straight: true })];
      const gap = (layout, stitch, anchor, i) => {
        const [foot, target] = [layout.nodes.get(stitch.id).feet[i], layout.nodes.get(anchor.id).top];
        return Math.hypot(foot.x - target.x, foot.y - target.y);
      };
      for (const stitch of pattern.pieces[0].stitches) {
        if (curved.nodes.get(stitch.id).role !== 'stitch' || curved.nodes.get(stitch.id).layer < 4) continue;
        stitch.anchors.forEach((anchor, i) => {
          if (anchor.into !== 'stitch' || curved.nodes.get(anchor.id).layer === 0) return;
          const [bent, flat] = [gap(curved, stitch, anchor, i), gap(straight, stitch, anchor, i)];
          assert.ok(bent <= flat + 18, `${stitch.id} talpa ${bent.toFixed(1)} egységre a célpontjától (egyenesen ${flat.toFixed(1)})`);
        });
      }
    }
  });

  test('új sor nem mozdítja a korábbi sorokat (06 §5.3)', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'sc', sizeCm: 6 });
    const piece = pattern.pieces[0];
    // Az utolsó sor nélkül: a szemek az utolsó fordulásig, az események a fordulással együtt.
    const turn = piece.events.findLast((event) => event.kind === 'turn');
    const cut = piece.stitches.findIndex((node) => node.id === turn.after) + 1;
    const shorter = { ...pattern, pieces: [{ ...piece, stitches: piece.stitches.slice(0, cut), groups: piece.groups.filter((group) => group.members.every((id) => piece.stitches.slice(0, cut).some((node) => node.id === id))), events: piece.events.slice(0, piece.events.indexOf(turn) + 1) }] };
    const [full, partial] = [layoutPattern(pattern, libraryFor(pattern)), layoutPattern(shorter, libraryFor(shorter))];
    for (const [id, node] of partial.nodes) {
      const before = full.nodes.get(id);
      near(node.top.x, before.top.x, 1e-6, `${id} x`);
      near(node.top.y, before.top.y, 1e-6, `${id} y`);
    }
  });

  test('tükrözött nézetben a rajz vízszintesen tükröződik; arányhelyes nézetben is félkör', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 12 });
    const library = libraryFor(pattern);
    const [plain, mirrored] = [layoutPattern(pattern, library), layoutPattern(pattern, library, { mirror: true })];
    for (const [id, node] of plain.nodes) {
      near(mirrored.nodes.get(id).top.x, -node.top.x, 1e-6, `${id} x`);
      near(mirrored.nodes.get(id).top.y, node.top.y, 1e-6, `${id} y`);
    }
    const aspect = { stemLength: (chainHeight) => 4 + 20 * chainHeight };
    const layout = layoutPattern(pattern, library, aspect);
    const center = centerOf(pattern, aspect);
    const angles = nodesOf(layout, rowsOf(pattern))
      .filter((node) => node.role === 'stitch')
      .map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), 180, 3, 'átfogott szög arányhelyes nézetben');
  });
});

describe('fentről induló háromszög a gerincnél megtörve (05 §1.4)', () => {
  test('az „A” példa mintasűrűségével a két fél a gerincnél derékszöget zár be, a nyakél vízszintes', () => {
    const pattern = shawl({ kind: 'triangle', stitch: 'dc', sizeCm: 20 }, withGauge('dc', 16, 8));
    assert.deepEqual(pattern.pieces[0].rowShape, { kind: 'chevron', neckAngle: 180, tipAngle: 90 });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const last = nodesOf(layout, rowsOf(pattern)).filter((node) => node.role === 'stitch');
    const spine = last.reduce((best, node) => (Math.abs(node.top.x - center) < Math.abs(best.top.x - center) ? node : best));
    const [left, right] = [last.reduce((a, b) => (b.top.x < a.top.x ? b : a)), last.reduce((a, b) => (b.top.x > a.top.x ? b : a))];
    const toward = (node) => [node.top.x - spine.top.x, node.top.y - spine.top.y];
    const [a, b] = [toward(left), toward(right)];
    const angle = degrees(Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))));
    near(angle, 90, 3, 'a két fél szöge');
    // A gerinc felfelé áll, a sor két vége lent, egy magasságban.
    assert.ok(spine.top.y < left.top.y && spine.top.y < right.top.y);
    near(left.top.y, right.top.y, 0.1 * Math.abs(spine.top.y - left.top.y), 'a két vég magassága');
  });

  test('a stóla, az aszimmetrikus háromszög és a körben horgolt kendők egyenesek, illetve körök maradnak', () => {
    for (const kind of ['stole', 'asymmetric-triangle', 'circle', 'pi']) {
      assert.equal(shawl({ kind, stitch: 'sc', sizeCm: 6, lengthCm: 6 }).pieces[0].rowShape, undefined, kind);
    }
  });
});

describe('a rács az íves rajzon', () => {
  for (const kind of ['semicircle', 'crescent', 'triangle']) {
    test(`${kind}: a sávok és a cellák íves sávok; minden cella közepe a saját cellája; a határ a rajzot és a rácsot is befoglalja`, () => {
      const pattern = shawl({ kind, stitch: 'sc', sizeCm: 8 });
      const library = libraryFor(pattern);
      const context = contextOf(pattern);
      const grid = chartGrid(pattern, library, 'rows', context);
      assert.ok(grid.bands.length > 2);
      assert.ok(grid.bands.every((band) => band.area.kind === 'strip'));
      for (const cell of grid.cells) {
        const hit = gridHit(grid, cell.center);
        assert.ok(hit && hit.kind === 'cell' && hit.cell === cell, `${cell.layer}. sor ${cell.index}. cellája`);
      }
      const layout = layoutPattern(pattern, library);
      const bounds = chartBounds(layout, grid);
      for (const node of layout.nodes.values()) assert.ok(node.top.x >= bounds.minX && node.top.x <= bounds.maxX && node.top.y >= bounds.minY && node.top.y <= bounds.maxY);
      // A rajz útvonalai: zárt sávok és vonalak.
      const paths = gridPaths(grid);
      assert.equal(paths.bands.length, grid.bands.length);
      assert.ok(paths.bands.every((band) => /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+)+Z$/.test(band.d)));
      assert.ok(paths.lines.length > grid.bands.length * 3);
    });
  }
});

describe('mentés', () => {
  test('az alak a JSON-mentéssel megmarad; hibás alak nem töltődik be; a régi mentés alak nélkül egyenes', () => {
    const pattern = shawl({ kind: 'triangle', stitch: 'dc', sizeCm: 10 }, withGauge('dc', 16, 8));
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern.pieces[0].rowShape, { kind: 'chevron', neckAngle: 180, tipAngle: 90 });
    for (const rowShape of [{ kind: 'spiral', neckAngle: 180 }, { kind: 'arc', neckAngle: 400 }, { kind: 'chevron', neckAngle: 180 }]) {
      const wrong = JSON.parse(savePattern(pattern));
      wrong.pieces[0].rowShape = rowShape;
      assert.equal(loadPattern(JSON.stringify(wrong)).ok, false, JSON.stringify(rowShape));
    }
    const old = JSON.parse(savePattern(pattern));
    delete old.pieces[0].rowShape;
    assert.equal(loadPattern(JSON.stringify(old)).pattern.pieces[0].rowShape, undefined);
  });
});
