/*
 * Kendőformák (PQW-865): a tudásbázis „A” példája (05 §1.4), a páros
 * szimmetria és a tört arány elosztása, a szárnyak, az utolsó sor igazítása a
 * szegélyhez, a félkör, a kör és a Pi-kendő ütemezése (05 §1.2, §1.3), a
 * saját arány figyelmeztetése (README §4.7), a blokkolt és blokkolatlan méret,
 * és hogy minden generált kendő hibátlanul átmegy az ellenőrzőn, kiírható és
 * visszaolvasható.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import {
  DEFAULT_SHAWL,
  SHAWL_KINDS,
  SHAWL_STITCHES,
  generateShawl,
  piRounds,
  planShawl,
  shawlProblem,
  shawlSizes,
} from '../src/core/shawls.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';

/** Minta profillal, amelyben a szem adott szem és sor/kör 10 cm-en. */
function withGauge(stitch, stitchesPer10cm, rowsPer10cm, { blocked = false, form = 'rows', pattern = emptyPattern() } = {}) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked,
    gauges: [{ stitch, form, stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...pattern, gauge: { active: 'kendo', profiles: [profile] } };
}

const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });
const options = (patch) => ({ ...DEFAULT_SHAWL, ...patch });
const shawl = (pattern, patch) => {
  const result = generateShawl(pattern, options(patch));
  assert.ok(result.ok, result.reason);
  return result;
};
const plan = (pattern, patch) => {
  const result = planShawl(pattern, options(patch));
  assert.ok(result.ok, result.reason);
  return result.plan;
};
const changes = (counts) => counts.slice(1).map((count, i) => count - counts[i]);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const errors = (pattern) => findings(pattern).filter((finding) => finding.severity === 'error');
const near = (actual, expected, tolerance, name) => assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} ≉ ${expected}`);
const sameGraph = (a, b) => {
  const [x, y] = [canonicalPattern(a).pieces[0], canonicalPattern(b).pieces[0]];
  assert.deepEqual(x.stitches, y.stitches);
  assert.deepEqual(x.groups, y.groups);
  assert.deepEqual(x.events, y.events);
};

/** Az „A” példa: pálcás háromszög blokkolt 16 × 8 mintasűrűséggel, 160 cm fesztáv, 80 cm mélység. */
const exampleA = () => withGauge('dc', 16, 8, { blocked: true });

describe('fentről induló háromszög (05 §1.4)', () => {
  test('„A” példa: 45 sor, soronként 8 szaporítás, az n-edik sor 8n szem, az utolsó 360; hibátlan', () => {
    const { pattern, plan } = shawl(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.equal(plan.counts.length, 45);
    assert.deepEqual(plan.counts, Array.from({ length: 45 }, (_, i) => 8 * (i + 1)));
    assert.equal(plan.counts.at(-1), 360);
    assert.equal(plan.theoryRate, 8);
    assert.deepEqual([plan.edgeRate, plan.spineRate], [2, 2]);
    assert.deepEqual(plan.warnings, []);
    assert.deepEqual(findings(pattern), []);
  });

  test('„A” példa soronként: +2 mindkét élen, +4 a gerincen, a két középső szembe 3-3 pálca', () => {
    const { layout } = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.equal(layout.first, 8);
    const row2 = layout.rounds[0];
    assert.deepEqual(row2, [3, 1, 1, 3, 3, 1, 1, 3]);
    for (const into of layout.rounds) {
      const p = into.length;
      assert.deepEqual([into[0], into[p - 1], into[p / 2 - 1], into[p / 2]], [3, 3, 3, 3]);
      assert.equal(into.filter((n) => n === 3).length, 4);
    }
  });

  test('„A” példa mérete: blokkolva kb. 160 × 80 cm, egyenes nyakél (180°), derékszögű alsó csúcs', () => {
    const sizes = shawlSizes(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 }), DEFAULT_SHAWL.blocking);
    assert.equal(sizes.measured, 'blocked');
    near(sizes.blocked.widthCm, 160, 1.5, 'fesztáv');
    near(sizes.blocked.depthCm, 80, 1, 'mélység');
    near(sizes.blocked.neckAngleDeg, 180, 0.01, 'nyakél');
    near(sizes.blocked.tipAngleDeg, 90, 0.01, 'alsó csúcs');
    // A blokkolatlan méret a nyúlással kisebb.
    assert.ok(sizes.unblocked.widthCm < sizes.blocked.widthCm && sizes.unblocked.depthCm < sizes.blocked.depthCm);
  });

  test('„A” példa írott mintája: az 1. sor a hagyomány szerinti láncszembe, a 2. sor „3 lsz, 2 erp ugyanabba a szembe”', () => {
    const { pattern } = shawl(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    const dc = resolveStitch('dc');
    const tradition = traditionOf(pattern.conventions);
    const from = firstChainFromHook(dc.turningChain, turningChainCountsFor(pattern.conventions.turningChainCounts, dc, tradition), tradition);
    const hu = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(hu, new RegExp(`1\\. sor: a horogtól számított ${from}\\. láncszemtől kezdve .*\\(8 szem\\)\\. Fordítás\\.`));
    assert.match(hu, /2\. sor: 3 lsz \(1 erp-nek számít\), 2 erp ugyanabba a szembe, .* \(16 szem\)\. Fordítás\./);
    assert.match(hu, /45\. sor: .* \(360 szem\)\. A fonal elvágása\./);
  });

  test('rövidpálcával 20 × 22-nél 3,64 szaporítás: 124 sor, csak +4 és +2, a +2 felváltva a széleken és a gerincen', () => {
    const result = plan(withGauge('sc', 20, 22), { kind: 'triangle', stitch: 'sc', sizeCm: 80 });
    assert.equal(result.counts.length, 124);
    const steps = changes(result.counts);
    assert.ok(steps.every((step) => step === 2 || step === 4), steps.join(','));
    near(steps.reduce((sum, step) => sum + step, 0) / steps.length, (4 * 2) / 2.2, 0.02, 'átlag');
    // Minden +2-es sorban csak az éleken (1-1) vagy csak a gerincen (a két középső szemben) van szaporítás, felváltva.
    const twos = result.layout.rounds.filter((into) => into.reduce((sum, n) => sum + n, 0) - into.length === 2);
    const where = twos.map((into) => (into[0] === 2 ? 'élek' : 'gerinc'));
    assert.ok(where.length > 10);
    where.forEach((side, i) => i > 0 && assert.notEqual(side, where[i - 1], `${i}. +2-es sor`));
  });

  test('saját, kisebb arány: mélyebb és keskenyebb, a nyakél lefelé hajlik, figyelmeztetés, de a minta elkészül', () => {
    const { pattern, plan: custom } = shawl(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 6 });
    assert.deepEqual(custom.warnings.map((warning) => warning.kind), ['narrow']);
    near(custom.warnings[0].ratio, 0.75, 0.01, 'arány');
    assert.ok(changes(custom.counts).every((step) => step === 6));
    const sizes = shawlSizes(custom, DEFAULT_SHAWL.blocking);
    assert.ok(sizes.blocked.neckAngleDeg < 180);
    near(sizes.blocked.spineCm, 80, 1.5, 'a gerinc a megadott mélység');
    assert.deepEqual(errors(pattern), []);
    // Nagyobb arány: laposabb.
    assert.deepEqual(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 10 }).warnings.map((w) => w.kind), ['wide']);
    // 15%-on belül nincs figyelmeztetés.
    assert.deepEqual(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 7.2 }).warnings, []);
  });

  test('szárnyak: a második felében a széleken dupla szaporítás, a gerinc változatlan', () => {
    const winged = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, wings: true });
    assert.equal(winged.wingsFromRow, 23);
    const steps = changes(winged.counts);
    assert.ok(steps.slice(0, 21).every((step) => step === 8));
    assert.ok(steps.slice(21).every((step) => step === 12));
    const plain = shawlSizes(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 }), DEFAULT_SHAWL.blocking);
    assert.ok(shawlSizes(winged, DEFAULT_SHAWL.blocking).blocked.widthCm >= plain.blocked.widthCm - 1e-9);
  });

  test('az utolsó sor a szegélyhez: félenként 6 többszöröse + 3, az utolsó két sorban legfeljebb +2 félenként', () => {
    const adjusted = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, edging: { width: 6, edge: 3 } });
    const half = adjusted.counts.at(-1) / 2;
    assert.equal((half - 3) % 6, 0);
    assert.deepEqual(adjusted.edging, { repeats: (half - 3) / 6, change: 3 });
    const steps = changes(adjusted.counts);
    assert.ok(steps.slice(0, -2).every((step) => step === 8));
    assert.ok(steps.slice(-2).every((step) => step >= 8 && step <= 12));
    assert.ok(changes(adjusted.counts).every((step) => step % 2 === 0));
  });
});

describe('aszimmetrikus háromszög és félhold (05 §1.5, §1.6)', () => {
  test('aszimmetrikus: soronként h/w szaporítás mindig ugyanazon az élen, kb. 45°', () => {
    const result = plan(withGauge('sc', 20, 22), { kind: 'asymmetric-triangle', stitch: 'sc', sizeCm: 40 });
    near(result.theoryRate, 2 / 2.2, 1e-9, 'h/w');
    result.layout.rounds.forEach((into, i) => {
      const row = i + 2;
      const middle = row % 2 === 0 ? into.slice(2) : into.slice(0, -2);
      assert.ok(middle.every((n) => n === 1), `${row}. sor: csak a ferde élen`);
    });
    near(shawlSizes(result, DEFAULT_SHAWL.blocking).unblocked.tipAngleDeg, 45, 1.5, 'szög');
  });

  test('félhold: csak a széleken szaporít, a gerincen nem; a nyakél 180°-nál kisebb szögben hajlik', () => {
    const result = plan(withGauge('dc', 16, 8), { kind: 'crescent', stitch: 'dc', sizeCm: 30 });
    assert.equal(result.spineRate, 0);
    for (const into of result.layout.rounds) {
      const p = into.length;
      assert.deepEqual([into[p / 2 - 1], into[p / 2]], [1, 1]);
    }
    assert.ok(changes(result.counts).every((step) => step % 2 === 0));
    assert.ok(shawlSizes(result, DEFAULT_SHAWL.blocking).unblocked.neckAngleDeg < 180);
  });
});

describe('félkör, kör és Pi-kendő (05 §1.2, §1.3)', () => {
  test('félkör Omdahl szerint: pálcával soronként +9, az n-edik sor 9n szem; Inner Child: rövidpálcával +3', () => {
    const omdahl = plan(withGauge('dc', 16, 8), { kind: 'semicircle', stitch: 'dc', sizeCm: 20, rate: 'custom', customRate: 9 });
    assert.deepEqual(omdahl.counts, omdahl.counts.map((_, i) => 9 * (i + 1)));
    const inner = plan(withGauge('sc', 20, 20), { kind: 'semicircle', stitch: 'sc', sizeCm: 5, rate: 'custom', customRate: 3 });
    assert.deepEqual(inner.counts, inner.counts.map((_, i) => 3 * (i + 1)));
    // Rövidpálcánál 20 × 20-nál π · h/w = 3,14: a 3 még 15%-on belül.
    near(inner.theoryRate, Math.PI, 1e-9, 'π · h/w');
    assert.deepEqual(inner.warnings, []);
  });

  test('félkör: a szaporítás soronként egyenletesen elosztva; kevés szaporításnál kunkorodás, sok szaporításnál fodrosodás a figyelmeztetés', () => {
    const cupped = plan(withGauge('dc', 16, 8), { kind: 'semicircle', stitch: 'dc', sizeCm: 20, rate: 'custom', customRate: 4 });
    assert.deepEqual(cupped.warnings.map((warning) => warning.kind), ['cupping']);
    const ruffled = plan(withGauge('dc', 16, 8), { kind: 'semicircle', stitch: 'dc', sizeCm: 20, rate: 'custom', customRate: 9 });
    assert.deepEqual(ruffled.warnings.map((warning) => warning.kind), ['ruffling']);
    for (const into of cupped.layout.rounds.slice(4)) {
      const at = into.flatMap((n, i) => (n === 2 ? [i] : []));
      const gaps = at.slice(1).map((i, j) => i - at[j]);
      assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(','));
    }
  });

  test('kör körönként: a körös arányból a kerekített szaporítás, a k-adik kör k-szorosa', () => {
    const result = plan(emptyPattern(), { kind: 'circle', stitch: 'sc', sizeCm: 6 });
    assert.equal(result.worked, 'rounds');
    assert.equal(result.chosenRate, 6);
    assert.deepEqual(result.counts, result.counts.map((_, i) => 6 * (i + 1)));
  });

  test('Pi-kendő: duplázás a 2., 4., 8., 16. körben; a duplázás előtt kb. a fele az ideálisnak (05 §1.3 [DERIVED])', () => {
    assert.deepEqual([...piRounds(false, 40)], [2, 4, 8, 16, 32]);
    const pi = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 });
    assert.deepEqual(pi.counts.slice(0, 16), [6, 12, 12, 24, 24, 24, 24, 48, 48, 48, 48, 48, 48, 48, 48, 96]);
    assert.ok(pi.ratio.min < 0.55, String(pi.ratio.min));
    assert.deepEqual(pi.warnings.map((warning) => warning.kind), ['pi-blocking']);
  });

  test('eltolt Pi-kendő: duplázás a round(2^k · 0,75). körben, az eltérés kisebb, mint a tiszta Pi-nél', () => {
    assert.deepEqual([...piRounds(true, 40)], [2, 3, 6, 12, 24]);
    const pure = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 });
    const shifted = plan(emptyPattern(), { kind: 'shifted-pi', stitch: 'sc', sizeCm: 10 });
    assert.deepEqual(shifted.counts.slice(0, 6), [6, 12, 24, 24, 24, 48]);
    assert.ok(shifted.ratio.min > pure.ratio.min + 0.1);
    assert.ok(shifted.ratio.min > 0.65 && shifted.ratio.max < 1.35, JSON.stringify(shifted.ratio));
  });

  test('az utolsó kör a szegélyhez igazodik, legfeljebb duplázásig', () => {
    const result = plan(emptyPattern(), { kind: 'circle', stitch: 'sc', sizeCm: 6, edging: { width: 8, edge: 4 } });
    assert.equal((result.counts.at(-1) - 4) % 8, 0);
    assert.ok(Math.abs(result.edging.change) <= 4);
    const pi = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10, edging: { width: 5, edge: 1 } });
    assert.equal((pi.counts.at(-1) - 1) % 5, 0);
    assert.ok(pi.counts.at(-1) <= 2 * pi.counts.at(-2));
  });
});

describe('téglalap stóla és méret (05 §1.7, §1.8)', () => {
  test('a stóla a sík téglalap: soronként ugyanannyi szem, a szélesség a szegély ismétléséhez kerekítve', () => {
    const { pattern, plan: stole } = shawl(withGauge('dc', 16, 8), { kind: 'stole', stitch: 'dc', sizeCm: 37.5, lengthCm: 50, edging: { width: 6, edge: 2 } });
    assert.equal(stole.counts.length, 40);
    assert.ok(stole.counts.every((count) => count === stole.counts[0]));
    assert.ok(stole.edging.repeats > 0);
    assert.deepEqual(pattern.conventions.repeat, { repeatWidth: 6, edgeStitches: 2, turningChainIncluded: false });
    assert.equal(pattern.pieces[0].name, 'Téglalap stóla');
    assert.deepEqual(findings(pattern), []);
  });

  test('blokkolatlan profilnál a blokkolt méret a nyúlással nagyobb; blokkolt profilnál a blokkolatlan kisebb', () => {
    const unblocked = shawlSizes(plan(withGauge('dc', 16, 8), { kind: 'stole', stitch: 'dc', sizeCm: 40, lengthCm: 100 }), { widthPct: 10, heightPct: 5 });
    assert.equal(unblocked.measured, 'unblocked');
    near(unblocked.blocked.widthCm, unblocked.unblocked.widthCm * 1.1, 1e-9, 'szélesség');
    near(unblocked.blocked.depthCm, unblocked.unblocked.depthCm * 1.05, 1e-9, 'hossz');
    const blocked = shawlSizes(plan(withGauge('dc', 16, 8, { blocked: true }), { kind: 'stole', stitch: 'dc', sizeCm: 40, lengthCm: 100 }), { widthPct: 10, heightPct: 5 });
    assert.equal(blocked.measured, 'blocked');
    near(blocked.unblocked.widthCm, blocked.blocked.widthCm / 1.1, 1e-9, 'szélesség');
  });

  test('profil nélkül becslés; a cím az alapértelmezett és a generátor adta helyett a kendő neve, a saját cím marad', () => {
    assert.equal(plan(emptyPattern(), {}).gauge.source, 'estimated');
    assert.equal(shawl(emptyPattern(), { sizeCm: 10 }).pattern.title, 'Fentről induló háromszög');
    assert.equal(shawl(emptyPattern('Téglalap'), { kind: 'semicircle', sizeCm: 10 }).pattern.title, 'Félkör');
    assert.equal(shawl(emptyPattern('Nyári kendő'), { sizeCm: 10 }).pattern.title, 'Nyári kendő');
  });
});

describe('a választások ellenőrzése', () => {
  test('méret, arány, ismétlés és nyúlás tartományban; érthető ok', () => {
    assert.equal(shawlProblem(DEFAULT_SHAWL), null);
    assert.match(shawlProblem(options({ stitch: 'sc2tog' })), /alapszemet/);
    assert.match(shawlProblem(options({ sizeCm: Number.NaN })), /méret/);
    assert.match(shawlProblem(options({ kind: 'stole', lengthCm: 0 })), /hossz/);
    assert.match(shawlProblem(options({ rate: 'custom', customRate: 0 })), /szaporítás/);
    assert.match(shawlProblem(options({ edging: { width: 0, edge: 1 } })), /ismétlés/);
    assert.match(shawlProblem(options({ blocking: { widthPct: Number.NaN, heightPct: 5 } })), /nyúlás/);
    const refuse = (patch) => {
      const result = planShawl(emptyPattern(), options(patch));
      assert.equal(result.ok, false);
      return result.reason;
    };
    assert.match(refuse({ sizeCm: 0.5 }), /legalább 2 sor/);
    assert.match(refuse({ kind: 'semicircle', rate: 'custom', customRate: 20 }), /legfeljebb 12 szem fér/);
    assert.match(refuse({ kind: "pi", stitch: "sc", sizeCm: 300 }), /legfeljebb/i);
  });
});

describe('minden generált kendő hibátlan, kiírható és visszaolvasható', () => {
  // A számító fordulólánc minden szemnél, rövidpálcánál is: a láncalapos kezdés javítása (PQW-891) után ez a rövidpálca szabálya.
  const counting = () => ({ ...emptyPattern(), conventions: { ...emptyPattern().conventions, turningChainCounts: true } });
  for (const [tradition, base] of [
    ['CYC', emptyPattern],
    ['japán', japanese],
    ['számító fordulóláncú', counting],
  ]) {
    for (const kind of SHAWL_KINDS) {
      test(`${kind}, ${tradition} hagyomány: minden szemmel, elméleti és saját aránnyal, szegélyhez igazítva`, () => {
        for (const stitch of SHAWL_STITCHES) {
          for (const patch of [{ sizeCm: 12 }, { sizeCm: 6, rate: 'custom', customRate: 5, wings: true, edging: { width: 4, edge: 1 } }]) {
            const name = `${stitch} ${JSON.stringify(patch)}`;
            const result = generateShawl(base(), options({ kind, stitch, lengthCm: 8, ...patch }));
            if (!result.ok) {
              assert.match(result.reason, /legalább|legfeljebb/i, `${name}: ${result.reason}`);
              continue;
            }
            const { pattern, plan } = result;
            assert.deepEqual(errors(pattern), [], name);
            if (kind === 'triangle' || kind === 'crescent') assert.ok(changes(plan.counts).every((step) => step % 2 === 0), `${name}: páros változás`);
            const library = libraryFor(pattern);
            for (const locale of ['hu', 'en-US']) {
              const back = readPattern(formatWrittenPattern(writePattern(pattern, library, locale)), { library, locale, conventions: pattern.conventions });
              assert.ok(back.ok, `${name} ${locale}: ${JSON.stringify(back.error)}`);
              sameGraph(back.pattern, pattern);
            }
          }
        }
      });
    }
  }
});
