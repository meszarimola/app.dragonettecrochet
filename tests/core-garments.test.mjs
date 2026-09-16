/*
 * Ruhadarabok (PQW-866): a szabásrajz számolásának alapjai (05 §4.2–4.5), a
 * tudásbázis „B” példája (ledobott vállú pulóver) és „D” példája (sapka), a
 * méretsorozat ellenőrzései minden méretre, a generált minta hibátlansága, a
 * varrások, a méretsorozat szövege, a mentés és a fonal méretenként.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { WOMEN } from '../src/core/body-sizes.ts';
import { emptyPattern } from '../src/core/editor.ts';
import {
  evenIncreases,
  eventRows,
  mirrorShaping,
  reversedEventRows,
  roundEven,
  roundToRepeat,
  shapingRuns,
  slopeSchedule,
} from '../src/core/garment-math.ts';
import {
  DEFAULT_GARMENT,
  DEFAULT_HAT,
  dropShoulderMeasures,
  dropShoulderPlan,
  generateGarment,
  garmentSizes,
  hatPlan,
  neckSplitRow,
  planGarment,
  sleeveRowsOf,
} from '../src/core/garments.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

const gauge = { stitchCm: 1 / 1.5, rowCm: 1 / 0.8 };
const dc = { turningChain: 3, counting: true, tradition: 'cyc' };
const options = (patch) => ({ ...DEFAULT_GARMENT, ...patch });
const hat = (patch) => ({ ...DEFAULT_HAT, ...patch });
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const generated = (opts, pattern = emptyPattern()) => {
  const result = generateGarment(pattern, opts);
  assert.ok(result.ok, result.ok ? '' : result.reason.code);
  return result;
};
const planned = (opts, pattern = emptyPattern()) => {
  const result = planGarment(pattern, opts);
  assert.ok(result.ok, result.ok ? '' : result.reason.code);
  return result.plan;
};
/** A mag terve, nem elutasítás: az elutasítás kódot és adatot ad (PQW-904). */
const made = (plan) => {
  assert.ok(!('code' in plan), 'code' in plan ? plan.code : '');
  return plan;
};

/** A „B” példa bemenete (05 §4, „Worked example B”). */
const B = {
  bustCm: 96,
  easeCm: 10,
  neckToWristCm: 71.75,
  upperArmCm: 28,
  armholeDepthCm: 21,
  bodyLengthCm: 58,
  hemCm: 5,
  neckWidthCm: 18.5,
  frontNeckDepthCm: 8,
  backNeckDepthCm: 2,
  cuffWidthCm: 26,
  crossBackCm: 41,
};

describe('a szabásrajz számolásának alapjai', () => {
  test('kerekítés a mintaismétlésre a bőség irányába: 79,5 szem 4 + 2-re felfelé 82, lefelé 78', () => {
    assert.equal(roundToRepeat(79.5, { width: 4, edge: 2 }, 'up'), 82);
    assert.equal(roundToRepeat(79.5, { width: 4, edge: 2 }, 'down'), 78);
    assert.equal(roundToRepeat(1, { width: 4, edge: 2 }, 'down'), 6);
  });

  test('páros sorszám: 42,4 → 42, 16,8 → 16, 1,6 → 2; felfelé 63 → 64', () => {
    assert.deepEqual([42.4, 16.8, 1.6, 32.2].map((x) => roundEven(x)), [42, 16, 2, 32]);
    assert.equal(roundEven(63, 'up'), 64);
    assert.equal(roundEven(62, 'up'), 62);
  });

  test('mágikus képlet (Midnight Purl): 142 kör, 16 változás → 2-szer 8 körönként, 14-szer 9 körönként', () => {
    const schedule = slopeSchedule(142, 16, false);
    assert.deepEqual(schedule.intervals, [...Array(2).fill(8), ...Array(14).fill(9)]);
    assert.equal(schedule.tail, 0);
  });

  test('egyenes véggel (KCG): 90 sor, 15 pár → 6-szor 5 soronként, 9-szer 6 soronként, a végén 6 sor egyenes', () => {
    const schedule = slopeSchedule(90, 15, true);
    assert.deepEqual(schedule.intervals, [...Array(6).fill(5), ...Array(9).fill(6)]);
    assert.equal(schedule.tail, 6);
    assert.equal(eventRows(schedule).at(-1), 84);
  });

  test('túl sok változás kevés sorban: nincs terv', () => {
    assert.equal(slopeSchedule(5, 10, true), null);
    assert.equal(reversedEventRows(slopeSchedule(3, 1, true), 3), null);
  });

  test('a szaporító sorok alulról, és a közök csoportjai', () => {
    const rows = reversedEventRows(slopeSchedule(32, 12, true), 32);
    assert.deepEqual(rows, [5, 8, 11, 14, 17, 20, 22, 24, 26, 28, 30, 32]);
    assert.deepEqual(shapingRuns(rows), {
      first: 5,
      runs: [
        { every: 3, times: 5 },
        { every: 2, times: 6 },
      ],
    });
  });

  test('egyenletes szaporítás körben, legfeljebb duplázás', () => {
    assert.deepEqual(evenIncreases(8, 2), [1, 1, 2, 1, 1, 1, 2, 1]);
    assert.equal(evenIncreases(4, 5), null);
  });

  test('tükrözés: a sor eleje és vége felcserélődik, kétszer tükrözve az eredeti', () => {
    const shaping = [{ start: 1, end: 0 }, { start: 0, end: -2 }];
    assert.deepEqual(mirrorShaping(shaping), [{ start: 0, end: 1 }, { start: -2, end: 0 }]);
    assert.deepEqual(mirrorShaping(mirrorShaping(shaping)), shaping);
  });
});

describe('„B” példa: ledobott vállú pulóver, mellbőség 96 cm, +10 cm bőség', () => {
  const plan = dropShoulderPlan(B, gauge, dc, null);

  test('hátrész és elejerész: 80 szem, 42 sor a szegély fölött, 4 + 2 ismétléssel 82 szem', () => {
    made(plan);
    assert.equal(plan.panel.exact, 79.5);
    assert.equal(plan.panel.stitches, 80);
    assert.equal(plan.panel.bodyRows, 42);
    assert.equal(plan.panel.hemRows, 4);
    // A PQW-891 óta N szemhez N + T láncszem: 83 (a tudásbázis régi, 82-es láncalapja előtte készült).
    assert.equal(plan.panel.foundation, 83);
    const repeated = dropShoulderPlan(B, gauge, dc, { width: 4, edge: 2 });
    assert.equal(repeated.panel.stitches, 82);
    assert.equal(repeated.panel.repeats, 20);
    // A kész bőség: 53,3 cm-es darabok, +10,7 cm.
    assert.ok(Math.abs(plan.finished.easeCm - 10.67) < 0.01);
  });

  test('nyak: 28 szem, vállanként 26; formázott nyak: középen 14, 2 majd 5-ször 1 fogyasztás 6 sorban; hátul 24, 2 sor', () => {
    assert.equal(plan.neck.stitches, 28);
    assert.equal(plan.neck.shoulder, 26);
    assert.deepEqual(plan.neck.front, { center: 14, perSide: 7, first: 2, later: 5, rows: 6 });
    assert.deepEqual(plan.neck.back, { center: 24, rows: 2, perRow: 1 });
  });

  test('ujj: 64 szem fent, 40 a mandzsettánál, 32 sor, 12 pár szaporítás', () => {
    assert.equal(plan.sleeve.top, 64);
    assert.equal(plan.sleeve.cuff, 40);
    assert.equal(plan.sleeve.shapedRows, 32);
    assert.equal(plan.sleeve.increases, 12);
    assert.equal(plan.sleeve.lengthCm, 45.25);
    assert.ok(Math.abs(plan.finished.upperArmEaseCm - 14.67) < 0.01);
  });

  test('ujj fentről: 2. soronként 7-szer, 3. soronként 5-ször, a végén 3 sor egyenes (32 ÷ 13 = 2 maradék 6)', () => {
    const { schedule } = plan.sleeve;
    assert.equal(schedule.every, 2);
    assert.equal(schedule.remainder, 6);
    assert.deepEqual(schedule.intervals, [...Array(7).fill(2), ...Array(5).fill(3)]);
    assert.equal(schedule.tail, 3);
    assert.equal(7 * 2 + 5 * 3 + 3, 32);
    assert.equal(64 - 2 * 12, 40);
  });

  test('mandzsettától felfelé a 4 sor szegély után: az első szaporítás a 9. sorban, a felső él 64 szem', () => {
    assert.equal(plan.sleeve.first, 9);
    assert.equal(plan.sleeve.increaseRows.length, 12);
    const { counts } = sleeveRowsOf(plan);
    assert.equal(counts.length, 36);
    assert.equal(counts[0], 40);
    assert.equal(counts.at(-1), 64);
  });

  test('minden ellenőrzés igaz', () => {
    assert.deepEqual(
      plan.checks.filter((check) => !check.ok).map((check) => check.id),
      [],
    );
    assert.ok(plan.checks.length >= 8);
  });
});

describe('„D” példa: felnőtt női sapka félpálcával', () => {
  const plan = hatPlan({ headCm: 56, easeCm: -5, heightCm: 19, brimCm: 3 }, { stitchCm: 1 / 1.5, rowCm: 1 / 1.1 });

  test('51 cm, 76 szem; a korona 9 kör; az oldal 12 kör', () => {
    made(plan);
    assert.equal(plan.hatCm, 51);
    assert.equal(plan.stitches, 76);
    assert.ok(Math.abs(plan.exactIncreases - 8.57) < 0.01);
    // A jelöltek (8, 9, 10) közül a 9-nél a korona köreinek száma áll a sugárhoz legközelebb (05 „D” 4. lépés).
    assert.equal(plan.increases, 9);
    assert.deepEqual(plan.counts.slice(0, 9), [9, 18, 27, 36, 45, 54, 63, 72, 76]);
    assert.equal(plan.crownRounds, 9);
    assert.equal(plan.sideRounds, 12);
    assert.equal(plan.brimRounds, 3);
    assert.deepEqual(plan.checks.filter((check) => !check.ok), []);
  });

  test('15% fölötti negatív bőséget nem tervez; 10% fölött figyelmeztet', () => {
    // A mag kódot és adatot ad, a mondat a felületé (PQW-904).
    const refused = hatPlan({ headCm: 50, easeCm: -8, heightCm: 19, brimCm: 3 }, gauge);
    assert.equal(refused.code, 'negative-ease-head');
    assert.deepEqual(refused.data, { limit: 15, actual: 16 });
    const tight = hatPlan({ headCm: 50, easeCm: -6, heightCm: 19, brimCm: 3 }, gauge);
    assert.equal(tight.checks.find((check) => check.id === 'negative-ease').ok, false);
    assert.deepEqual(
      tight.warnings.map((warning) => warning.code),
      ['negative-ease-warning'],
    );
  });
});

describe('méretsorozat', () => {
  test('női XS–5X: minden méretre minden ellenőrzés igaz, a szemszámok nem csökkennek', () => {
    const plan = planned(options({ from: 'XS', to: '5X' }));
    assert.equal(plan.sizes.length, 9);
    assert.equal(plan.checksPassed, plan.checksTotal);
    assert.deepEqual(plan.monotonic, []);
    const neck = plan.values.neck;
    assert.ok(neck.every((n, i) => i === 0 || n >= neck[i - 1]), neck.join(' '));
  });

  test('férfi, gyerek és baba táblázat: minden méret tervezhető és minden ellenőrzés igaz', () => {
    for (const table of ['men', 'child', 'baby']) {
      const ids = garmentSizes('drop-shoulder', table);
      const plan = planned(options({ table, size: ids[0], from: ids[0], to: ids.at(-1), belowWaistCm: table === 'men' ? 0 : 6 }));
      assert.equal(plan.checksPassed, plan.checksTotal, table);
      assert.deepEqual(plan.monotonic, [], table);
    }
  });

  test('a férfi táblázatból hiányzó karöltő és mandzsetta becsült', () => {
    const plan = planned(options({ table: 'men', size: 'M', from: 'M', to: 'M', belowWaistCm: 0 }));
    assert.deepEqual(
      plan.sizes[0].estimated.map((item) => item.code),
      ['estimated-armhole-depth', 'estimated-cuff'],
    );
  });

  test('sapka minden méretben: minden ellenőrzés igaz', () => {
    const plan = planned(hat({ from: 'preemie', to: 'adult-l' }));
    assert.equal(plan.sizes.length, 10);
    assert.equal(plan.checksPassed, plan.checksTotal);
    assert.deepEqual(plan.monotonic, []);
  });

  test('növedék: a hosszakat a felakasztott próbadarab nyúlásával csökkenti (05 §7.2, PQW-901)', () => {
    const plain = planned(options({ from: 'M', to: 'M' }));
    const grown = planned(options({ from: 'M', to: 'M', growthPct: 10 }));
    assert.ok(grown.sizes[0].plan.panel.rows < plain.sizes[0].plan.panel.rows, 'a pulóver rövidebb lesz');
    const hatPlain = planned(hat({ from: 'adult-m', to: 'adult-m' }));
    const hatGrown = planned(hat({ from: 'adult-m', to: 'adult-m', growthPct: 10 }));
    assert.ok(hatGrown.sizes[0].plan.counts.length < hatPlain.sizes[0].plan.counts.length, 'a sapka alacsonyabb lesz');
    assert.equal(planGarment(emptyPattern(), options({ growthPct: 80 })).reason.code, 'growth-range');
  });

  test('hamis ellenőrzéshez javítási javaslat jár (05 §9.6, PQW-901)', () => {
    // A mellbőség 10%-át meghaladó negatív bőség: a terv elkészül, de az ellenőrzés hamis.
    const plan = planned(options({ easeCm: -10, from: 'M', to: 'M' }));
    const failing = plan.sizes[0].plan.checks.filter((check) => !check.ok);
    assert.deepEqual(failing.map((check) => check.id), ['negative-ease']);
    assert.equal(failing[0].label.code, 'check-negative-ease');
    assert.equal(failing[0].suggestion.code, 'suggest-negative-ease-bust');
    assert.equal(failing[0].suggestion.data.cm, 9);
  });

  test('a táblázat gyanús adata a méretnél megjelenik', () => {
    const plan = planned(options({ size: '2X', from: 'XL', to: '2X' }));
    assert.ok(plan.sizes[1].flags.some((flag) => flag.kind === 'identical-rows'));
  });

  test('a méret a táblázat tartományának közepe', () => {
    const graded = dropShoulderMeasures(WOMEN, 'M', { easeCm: 10, hemCm: 5, belowWaistCm: 14.5 });
    assert.equal(graded.measures.bustCm, 94);
    assert.equal(graded.measures.bodyLengthCm, 58);
    assert.equal(graded.measures.neckToWristCm, 71.75);
  });

  test('rossz választás: a sorozat nem tartalmazza a rajz méretét, túl nagy negatív bőség', () => {
    assert.equal(planGarment(emptyPattern(), options({ from: 'L', to: 'XL' })).reason.code, 'series-range');
    // Sorozatban a méret azonosítója és az ok kódja megy a felületre; a méret nevét a felület teszi bele.
    const tight = planGarment(emptyPattern(), options({ easeCm: -20 })).reason;
    assert.equal(tight.code, 'size-problem');
    assert.equal(tight.data.size, 'S');
    assert.equal(tight.data.table, 'women');
    assert.equal(tight.data.inner, 'negative-ease-bust');
  });
});

describe('generált minta', () => {
  test('pulóver M méretben: négy darab, tíz varrás, hibátlan', () => {
    const { pattern, plan } = generated(DEFAULT_GARMENT);
    assert.deepEqual(
      pattern.pieces.map((piece) => piece.name),
      ['Hátrész', 'Elejerész', 'Bal ujj', 'Jobb ujj'],
    );
    assert.equal(pattern.joins.length, 10);
    assert.equal(pattern.title, 'Ledobott vállú pulóver');
    assert.deepEqual(pattern.garment.sizes, ['S', 'M', 'L']);
    assert.equal(pattern.garment.base, 1);
    assert.deepEqual(findings(pattern).filter((finding) => finding.severity === 'error'), []);
    const base = plan.sizes[1].plan;
    // Az ujj varrása a karöltőbe egyenletes elosztással, a két fele a hátrészre és az elejerészre. Formázott
    // nyaknál a karöltő a törzs tetejéig tart, a vállak a megosztás fölött készülnek (PQW-901).
    const sleeveJoin = pattern.joins.find((join) => join.a.piece === 'p3' && join.b.piece === 'p1');
    const split = neckSplitRow(base, 'back');
    assert.deepEqual(sleeveJoin.a.stitches, { from: 0, count: base.sleeve.top / 2 });
    assert.deepEqual(sleeveJoin.b.rows, { to: split, side: 'left' });
    assert.equal(sleeveJoin.distribution.reduce((sum, n) => sum + n, 0), Math.max(base.sleeve.top / 2, split - (base.panel.rows - base.panel.armholeRows)));
  });

  test('a jobb ujj a bal tükörképe: a sorok szemszáma azonos', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    const block = (name) => text.split('\n\n').find((part) => part.startsWith(`${name}\n`));
    const counts = (name) => [...block(name).matchAll(/\((\d+) szem\)/g)].map((match) => match[1]);
    assert.ok(counts('Bal ujj').length > 0);
    assert.deepEqual(counts('Jobb ujj'), counts('Bal ujj'));
  });

  test('formázott nyakkivágás: a két váll egy darabon belül, a szöveg visszaolvasható (PQW-901)', () => {
    const { pattern, plan } = generated(DEFAULT_GARMENT);
    const base = plan.sizes[1].plan;
    const { joins: _joins, garment: _garment, ...rest } = pattern;
    // A darab önmagában: a „Méretek” és az „Összeállítás” blokk nem a sorok szövege.
    const front = { ...rest, pieces: [pattern.pieces[1]] };
    const library = libraryFor(front);
    const text = formatWrittenPattern(writePattern(front, library, 'hu'));
    const split = neckSplitRow(base, 'front');
    // A megosztás fölött a két váll ugyanazokkal a sorszámokkal, a szakasz neve különbözteti meg őket.
    assert.match(text, new RegExp(`A másik váll \\(a ${split}\\. sor fölött\\):`));
    assert.equal(text.match(new RegExp(`^${split + 1}\\. sor: `, 'gm')).length, 2);
    const result = readPattern(text, { library, locale: 'hu', conventions: front.conventions });
    assert.ok(result.ok, result.ok ? '' : `${result.error.line}: ${result.error.message}`);
    // A darab azonosítóját a beolvasó maga osztja ki: a gráf attól még ugyanaz.
    const sameId = (piece) => ({ ...piece, id: 'p1' });
    assert.deepEqual(canonicalPattern(result.pattern).pieces.map(sameId), canonicalPattern(front).pieces.map(sameId));
    assert.deepEqual(validatePattern(result.pattern, library).filter((finding) => finding.severity === 'error'), []);
  });

  test('sapka: hibátlan, és az egyenes oldal nem jelez kunkorodást', () => {
    const { pattern } = generated(DEFAULT_HAT);
    assert.deepEqual(findings(pattern), []);
    assert.equal(pattern.garment.kind, 'hat');
  });

  test('a varrás rossz szélre mutat: hiba', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const broken = { ...pattern, joins: [{ ...pattern.joins[0], a: { ...pattern.joins[0].a, stitches: { from: 1000, count: 5 } } }] };
    assert.ok(findings(broken).some((finding) => finding.rule === 'join-edge'));
    const rows = { ...pattern, joins: [{ a: { piece: 'p1', layer: 1, rows: { to: 999, side: 'left' } }, b: pattern.joins[2].b }] };
    assert.ok(findings(rows).some((finding) => finding.rule === 'join-edge'));
  });

  test('írott minta: „Méretek” a cím után, „S (M, L)”, a varrások soronként és szakaszonként', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(text, /^Ledobott vállú pulóver\n\nMéretek\nS \(M, L\)\nA sorok és a rajz az M méretre készültek;/);
    assert.match(text, /Hátrész és elejerész \(2 db\): láncalap \d+ \(\d+, \d+\) lsz; \d+ \(\d+, \d+\) szem/);
    assert.match(text, /Szaporíts mindkét szélen 1-1 szemet a \d+\. \(\d+\., \d+\.\) sorban/);
    // Formázott nyaknál a váll egy-egy teljes sor, és a szakasz neve különbözteti meg az azonos sorszámokat (PQW-901).
    assert.match(text, /Varrás: Hátrész, \d+\. sor 1–\d+\. szeme \(\d+\) → Elejerész, A másik váll, \d+\. sor 1–\d+\. szeme \(\d+\)\./);
    assert.match(text, /Varrás: Hátrész, 1–\d+\. sor bal széle \(\d+ sorvég\) → Elejerész, 1–\d+\. sor jobb széle \(\d+ sorvég\)\./);
    assert.match(text, /Varrás: Bal ujj, \d+\. sor 1–\d+\. szeme \(\d+\) → Hátrész, \d+–\d+\. sor bal széle \(\d+ sorvég\), a szemeket egyenletesen elosztva\./);
    const english = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'en-US'));
    assert.match(english, /\n\nSizes\nS \(M, L\)\nThe rows and chart are for size M;/);
    assert.match(english, /Sew: Back|Sew: Hátrész, Rows 1–\d+, left edge \(\d+ row ends\) to Elejerész/);
  });

  test('sapka írott mintája: korona és oldal a méretsorozattal', () => {
    const { pattern } = generated(DEFAULT_HAT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(text, /Méretek\nFelnőtt S \(Felnőtt M, Felnőtt L\)\nA sorok és a rajz a Felnőtt M méretre készültek;/);
    assert.match(text, /Korona: \d+ \(\d+, \d+\) kör, körönként \d+ \(\d+, \d+\) szaporítással/);
    assert.match(text, /ebből az utolsó \d+ \(\d+, \d+\) kör a perem/);
  });

  test('mentés és betöltés: a méretsorozat és a varrások megmaradnak', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok, loaded.ok ? '' : loaded.error.message);
    assert.deepStrictEqual(loaded.pattern, pattern);
  });

  test('betöltés: a méretenkénti számok hossza és a szél két fajtája együtt hiba', () => {
    const { pattern } = generated(DEFAULT_HAT);
    const raw = JSON.parse(savePattern(pattern));
    raw.garment.values.hatStitches = [1];
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
    const sweater = JSON.parse(savePattern(generated(DEFAULT_GARMENT).pattern));
    sweater.joins[0].a.rows = { to: 3, side: 'left' };
    assert.equal(loadPattern(JSON.stringify(sweater)).ok, false);
  });

  test('fonal méretenként a próbadarabból; nagyobb méretnél több', () => {
    const profile = {
      id: 'pulover',
      yarn: { name: 'Merinó', cycWeight: 4, metersPer100g: 200, ballMassG: 100 },
      hookMm: 5,
      blocked: true,
      gauges: [{ stitch: 'dc', form: 'rows', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' }],
      swatch: { widthCm: 10, heightCm: 10, massG: 6 },
    };
    const pattern = { ...emptyPattern(), gauge: { active: 'pulover', profiles: [profile] } };
    const plan = planned(DEFAULT_GARMENT, pattern);
    assert.equal(plan.yarnMissing, null);
    const yarn = plan.values.yarnM;
    assert.ok(yarn[0] < yarn[1] && yarn[1] < yarn[2], yarn.join(' '));
    const { pattern: made } = generated(DEFAULT_GARMENT, pattern);
    assert.match(formatWrittenPattern(writePattern(made, libraryFor(made), 'hu')), /Fonal tartalékkal: kb\. \d+ \(\d+, \d+\) m, \d+ \(\d+, \d+\) gombolyag\./);
    // A „B” példa mintasűrűségével az M méret (94 + 10 cm, a darab 52 cm) pontosan 78 szem.
    assert.equal(plan.sizes[1].plan.panel.stitches, 78);
  });
});

describe('a ruhadarab írott mintája visszaolvasható (PQW-913)', () => {
  /** Mért mintasűrűség körben és síkban: a raglán és a sapka körös mintasűrűséget kíván. */
  const measured = () => {
    const profile = {
      id: 'meres',
      yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
      hookMm: 5,
      blocked: false,
      gauges: [
        { stitch: 'dc', form: 'rounds', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' },
        { stitch: 'dc', form: 'rows', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' },
        { stitch: 'hdc', form: 'rounds', stitchesPer10cm: 18, rowsPer10cm: 14, source: 'measured' },
      ],
      swatch: { widthCm: null, heightCm: null, massG: null },
    };
    return { ...emptyPattern(), gauge: { active: 'meres', profiles: [profile] } };
  };

  /** A minta kiírva, majd visszaolvasva; a darabnevek egyeznek. */
  const roundTrip = (garmentOptions) => {
    const result = generateGarment(measured(), garmentOptions);
    assert.ok(result.ok, JSON.stringify(result.reason));
    const { pattern } = result;
    const library = libraryFor(pattern);
    const written = formatWrittenPattern(writePattern(pattern, library, 'hu'));
    // A méretsorozat blokkja leíró szöveg, nem darab: enélkül a visszaolvasó a „S (M, L)” fejlécen elhasalt.
    assert.match(written, /\nMéretek\n/);
    const back = readPattern(written, { library, locale: 'hu', conventions: pattern.conventions });
    assert.ok(back.ok, back.ok ? '' : JSON.stringify(back.error));
    assert.deepEqual(
      back.pattern.pieces.map((piece) => piece.name),
      pattern.pieces.map((piece) => piece.name),
    );
    return back.pattern;
  };

  test('a felülről horgolt raglán visszaolvasható', () => {
    assert.equal(roundTrip(options({ kind: 'raglan' })).pieces.length, 1);
  });

  test('a ledobott vállú pulóver négy darabja visszaolvasható', () => {
    assert.equal(roundTrip(options({})).pieces.length, 4);
  });

  test('a sapka visszaolvasható', () => {
    assert.equal(roundTrip(hat({})).pieces.length, 1);
  });
});

describe('bordás szegély és mandzsetta a ledobott vállú pulóveren (PQW-913)', () => {
  const made = (patch) => {
    const result = generateGarment(emptyPattern(), options(patch));
    assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.reason));
    return result.pattern;
  };
  const written = (pattern) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
  const rowLines = (text) => text.split('\n').filter((line) => /^\d+([–-]\d+)?\. sor:/.test(line));

  /** Darabonként a rétegek szemszáma: a bordázat ezen nem változtathat. */
  const counts = (pattern) =>
    pattern.pieces.map((piece) => buildPieceGraph(pattern, piece, libraryFor(pattern)).layers.map((layer) => layer.stitchCount));

  for (const neckline of ['boat', 'shaped']) {
    test(`${neckline === 'boat' ? 'csónaknyaknál' : 'formázott nyaknál'} a bordázat hibátlan, és a szemszámok nem változnak`, () => {
      const plain = made({ neckline, ribbing: null });
      const ribbed = made({ neckline, ribbing: { rows: 2, width: 1 } });
      assert.deepEqual(validatePattern(ribbed, libraryFor(ribbed)), []);
      // A relief szem a pálca köré megy, a tetejét nem használja fel: rétegenként ugyanannyi szem.
      assert.deepEqual(counts(ribbed), counts(plain));
      assert.doesNotMatch(written(plain), /Eerp|Herp/);
    });
  }

  test('a szegély és a mandzsetta sorai relief szemmel, rövidebb fordulólánccal, ismétlésként', () => {
    const text = written(made({ neckline: 'shaped', ribbing: { rows: 2, width: 1 } }));
    const ribbed = rowLines(text).filter((line) => /Eerp|Herp/.test(line));
    // Két panel és két ujj, soronként: a darab alján mindenhol van bordázat.
    assert.ok(ribbed.length >= 4, ribbed.join('\n'));
    // A bordás sor fordulólánca nem számít szemnek (01 §2.2 [S25]), és a bordázat ismétlésként áll.
    assert.ok(ribbed.every((line) => line.includes('nem számít szemnek')), ribbed.join('\n'));
    assert.ok(ribbed.some((line) => /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/.test(line)), ribbed.join('\n'));
    // Az 1. sor sima marad: a láncalap köré nem lehet relief szemet horgolni.
    assert.ok(!/^1\. sor:.*(Eerp|Herp)/m.test(text), 'az 1. sor nem lehet bordás');
  });
});
