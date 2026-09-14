/*
 * Az öltéskönyvtár táblázatos tesztjei a PQW-867 elfogadási feltételei szerint:
 * láncszem-magasság, fogyaszt → ad, brit név = amerikai név egy fokkal
 * eltolva, és nincs kimenet „hamispálca” szóval. A ferde vonalakat a
 * tests/ui-symbols.test.mjs nézi, mert a jel a felülethez tartozik.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  STITCHES,
  STITCH_SECTIONS,
  cluster,
  decrease,
  increase,
  shell,
  stitchById,
} from '../src/core/stitches.ts';
import { stitchLabel, stitchName, stitchStructure } from '../src/core/stitchText.ts';

const LOCALES = ['hu', 'en-US', 'en-GB'];

/* ---- A könyvtár táblázata ---- */

// prettier-ignore
const TABLE = [
  // azonosító        fajta      ráhajtás  lsz-mag.  fordulólánc  fogyaszt  ad  láncív
  ['ch',              'chain',   0,        1,        0,           0,        1,  0],
  ['sl-st',           'slip',    0,        0,        0,           1,        1,  0],
  ['sc',              'basic',   0,        1,        1,           1,        1,  0],
  ['hdc',             'basic',   1,        2,        2,           1,        1,  0],
  ['dc',              'basic',   1,        3,        3,           1,        1,  0],
  ['tr',              'basic',   2,        4,        4,           1,        1,  0],
  ['dtr',             'basic',   3,        5,        5,           1,        1,  0],
  ['inc-2sc',         'group',   0,        1,        1,           1,        2,  0],
  ['inc-2dc',         'group',   1,        3,        3,           1,        2,  0],
  ['sc2tog',          'joined',  0,        1,        1,           2,        1,  0],
  ['sc3tog',          'joined',  0,        1,        1,           3,        1,  0],
  ['dc2tog',          'joined',  1,        3,        3,           2,        1,  0],
  ['dc3tog',          'joined',  1,        3,        3,           3,        1,  0],
  ['invdec',          'joined',  0,        1,        1,           2,        1,  0],
  ['shell-5dc',       'group',   1,        3,        3,           1,        5,  0],
  ['v-st-dc',         'group',   1,        3,        3,           1,        2,  1],
  ['cl-3dc',          'joined',  1,        3,        3,           1,        1,  0],
  ['cl-3dc-spread',   'joined',  1,        3,        3,           3,        1,  0],
  ['puff-3',          'joined',  1,        2,        2,           1,        1,  0],
  ['bobble-5dc',      'joined',  1,        3,        3,           1,        1,  0],
  ['popcorn-5dc',     'joined',  1,        3,        3,           1,        1,  0],
  ['picot',           'picot',   0,        0,        0,           0,        0,  0],
  ['rev-sc',          'basic',   0,        1,        1,           1,        1,  0],
  ['ch-sp',           'space',   0,        0,        0,           0,        0,  1],
  ['magic-ring',      'ring',    0,        0,        0,           0,        0,  0],
];

test('a táblázat pontosan a könyvtár öltéseit sorolja fel, sorrendben', () => {
  assert.deepEqual(
    TABLE.map(([id]) => id),
    STITCHES.map((stitch) => stitch.id),
  );
});

for (const [id, kind, yarnOvers, chainHeight, turningChain, consumes, produces, spaces] of TABLE) {
  test(`${id}: fajta, ráhajtás, láncszem-magasság, fordulólánc, fogyaszt → ad`, () => {
    const def = stitchById(id);
    assert.deepEqual(
      {
        kind: def.kind,
        yarnOvers: def.yarnOvers,
        chainHeight: def.chainHeight,
        turningChain: def.turningChain,
        consumes: def.consumes,
        produces: def.produces,
        producesSpaces: def.producesSpaces,
      },
      { kind, yarnOvers, chainHeight, turningChain, consumes, produces, producesSpaces: spaces },
    );
  });
}

test('az azonosítók egyediek, és minden csoportban van öltés', () => {
  const ids = STITCHES.map((stitch) => stitch.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const section of STITCH_SECTIONS) assert.ok(section.stitches.length > 0, section.id);
});

test('ismeretlen azonosítóra hibát dob', () => {
  assert.throws(() => stitchById('nincs-ilyen'), /Ismeretlen öltés: nincs-ilyen/);
});

test('a jegy teljes öltéskészlete megvan', () => {
  const names = new Set(STITCHES.map((stitch) => stitch.terms.hu.name));
  for (const name of [
    'láncszem', 'kúszószem', 'rövidpálca', 'félpálca', 'egyráhajtásos pálca',
    'kétráhajtásos pálca', 'háromráhajtásos pálca', 'szaporítás', 'fogyasztás',
    'láthatatlan fogyasztás', 'kagyló', 'V-öltés', 'fürt', 'puff', 'bogyó',
    'popcorn', 'pikó', 'rákhurok', 'láncív', 'varázskör',
  ]) {
    assert.ok(names.has(name), `hiányzik: ${name}`);
  }
});

/* ---- Szókészlet ---- */

// prettier-ignore
const VOCABULARY = [
  // azonosító  magyar                     rp       amerikai                 rövidítés  brit                     rövidítés
  ['ch',        'láncszem',                'lsz',   'chain',                 'ch',      'chain',                 'ch'],
  ['sl-st',     'kúszószem',               'ksz',   'slip stitch',           'sl st',   'slip stitch',           'ss'],
  ['sc',        'rövidpálca',              'rp',    'single crochet',        'sc',      'double crochet',        'dc'],
  ['hdc',       'félpálca',                'fp',    'half double crochet',   'hdc',     'half treble',           'htr'],
  ['dc',        'egyráhajtásos pálca',     'erp',   'double crochet',        'dc',      'treble',                'tr'],
  ['tr',        'kétráhajtásos pálca',     'krp',   'treble',                'tr',      'double treble',         'dtr'],
  ['dtr',       'háromráhajtásos pálca',   null,    'double treble',         'dtr',     'triple treble',         'trtr'],
];

for (const [id, hu, huAbbr, us, usAbbr, gb, gbAbbr] of VOCABULARY) {
  test(`${id}: a jóváhagyott név és rövidítés mindhárom jelölésben`, () => {
    const { terms } = stitchById(id);
    assert.deepEqual(
      [terms.hu.name, terms.hu.abbr, terms['en-US'].name, terms['en-US'].abbr, terms['en-GB'].name, terms['en-GB'].abbr],
      [hu, huAbbr, us, usAbbr, gb, gbAbbr],
    );
  });
}

test('a brit név az amerikai egy fokkal eltolva: rp → erp → krp → háromráhajtásos', () => {
  const ladder = ['sc', 'dc', 'tr', 'dtr'].map(stitchById);
  for (let i = 0; i < ladder.length - 1; i++) {
    assert.deepEqual(ladder[i].terms['en-GB'], { ...ladder[i + 1].terms['en-US'], aliases: ladder[i].terms['en-GB'].aliases });
  }
});

test('a félpálca brit neve a brit egyráhajtásos pálca „fél” változata', () => {
  const hdc = stitchById('hdc').terms['en-GB'];
  const dc = stitchById('dc').terms['en-GB'];
  assert.equal(hdc.name, `half ${dc.name}`);
  assert.equal(hdc.abbr, `h${dc.abbr}`);
});

test('az összetett öltések brit szerkezete az amerikai, egy fokkal eltolt részöltésekkel', () => {
  const shift = { sc: 'dc', hdc: 'htr', dc: 'tr', tr: 'dtr', dtr: 'trtr' };
  for (const def of STITCHES) {
    const us = stitchStructure(def, 'en-US');
    const expected = us?.replace(/\b(dtr|hdc|sc|dc|tr)(?=\d|\b)/g, (abbr) => shift[abbr]) ?? null;
    assert.equal(stitchStructure(def, 'en-GB'), expected, def.id);
  }
});

test('brit kimenetben nincs sc, hdc és sl st', () => {
  for (const def of STITCHES) {
    assert.doesNotMatch(stitchLabel(def, 'en-GB'), /\b(sc|hdc)(?=\d|\b)|sl st/, def.id);
  }
});

test('nincs kimenet és értelmezett alternatíva „hamispálca” szóval', () => {
  const parts = ['sc', 'hdc', 'dc', 'tr', 'dtr'].map(stitchById);
  const built = parts.flatMap((part) => [
    increase(part, 3),
    decrease(part, 2),
    shell(part, 4),
    cluster(part, 2, 'same'),
    cluster(part, 2, 'spread'),
  ]);

  for (const def of [...STITCHES, ...built]) {
    for (const locale of LOCALES) {
      const { name, abbr, aliases } = def.terms[locale];
      const texts = [name, abbr ?? '', ...aliases, stitchLabel(def, locale)];
      for (const text of texts) assert.doesNotMatch(text, /hamis|\bhp\b/i, `${def.id} ${locale}: ${text}`);
    }
  }
});

test('a rövidpálca alternatívája a kispálca, az egyráhajtásos pálcáé a nagypálca (D2, D3)', () => {
  assert.deepEqual(stitchById('sc').terms.hu.aliases, ['kispálca']);
  assert.deepEqual(stitchById('dc').terms.hu.aliases, ['nagypálca']);
});

// prettier-ignore
const TEXTS = [
  // azonosító       magyar                                   amerikai                                brit
  ['sc',             'rövidpálca (rp)',                       'single crochet (sc)',                  'double crochet (dc)'],
  ['dtr',            'háromráhajtásos pálca',                 'double treble (dtr)',                  'triple treble (trtr)'],
  ['inc-2sc',        'szaporítás: 2 rp egy öltésbe',          'increase (inc): 2 sc in same st',      'increase (inc): 2 dc in same st'],
  ['sc2tog',         'fogyasztás: 2 rp 2 öltésen át',         'decrease (dec): sc2tog',               'decrease (dec): dc2tog'],
  ['shell-5dc',      'kagyló: 5 erp egy öltésbe',             'shell (sh): 5 dc in same st',          'shell: 5 tr in same st'],
  ['v-st-dc',        'V-öltés: (erp, 1 lsz, erp) egy öltésbe', 'V-stitch (V-st): (dc, ch 1, dc) in same st', 'V-stitch: (tr, ch 1, tr) in same st'],
  ['cl-3dc',         'fürt: 3 erp egy öltésbe',               'cluster (CL): 3 dc in same st',        'cluster (CL): 3 tr in same st'],
  ['cl-3dc-spread',  'fürt: 3 erp 3 öltésen át',              'cluster (CL): dc3tog',                 'cluster (CL): tr3tog'],
  ['puff-3',         'puff',                                  'puff stitch (ps)',                     'puff stitch'],
  ['rev-sc',         'rákhurok',                              'reverse single crochet (rev sc)',      'reverse double crochet'],
];

for (const [id, hu, us, gb] of TEXTS) {
  test(`${id}: kiírt név és szerkezet`, () => {
    const def = stitchById(id);
    assert.deepEqual(
      LOCALES.map((locale) => stitchLabel(def, locale)),
      [hu, us, gb],
    );
  });
}

test('rövidítés nélküli részöltésnél a név kiírva szerepel a szerkezetben', () => {
  const dtr = stitchById('dtr');
  assert.equal(stitchStructure(decrease(dtr, 2), 'hu'), '2 háromráhajtásos pálca 2 öltésen át');
  assert.equal(stitchName(increase(dtr, 2), 'en-GB'), 'increase (inc)');
});

/* ---- Konvenciók ---- */

// prettier-ignore
const CONVENTIONS = [
  // azonosító  fordulólánc számít  körzárás
  ['sc',        false,              'spiral'],
  ['hdc',       false,              'join-slip'],
  ['dc',        true,               'join-slip'],
  ['tr',        true,               'join-slip'],
  ['dtr',       true,               'join-slip'],
  ['inc-2sc',   false,              'spiral'],
  ['dc2tog',    true,               'join-slip'],
];

for (const [id, counts, roundEnd] of CONVENTIONS) {
  test(`${id}: a fordulólánc és a körzárás alapértelmezése (K1, K2)`, () => {
    const def = stitchById(id);
    assert.deepEqual([def.turningChainCounts, def.roundEnd], [counts, roundEnd]);
  });
}

test('az összetett öltés a részöltés magasságát, fordulóláncát és körzárását örökli', () => {
  for (const def of STITCHES) {
    const partId = def.kind === 'joined' ? def.part : def.kind === 'group' ? def.members[0] : null;
    if (!partId) continue;
    const part = stitchById(partId);
    for (const field of ['yarnOvers', 'chainHeight', 'turningChain', 'turningChainCounts', 'roundEnd', 'heightFactor']) {
      assert.deepEqual(def[field], part[field], `${def.id}.${field}`);
    }
  }
});

test('a valós magasságarány becsült, nő a láncszem-magassággal, a pálca 2–2,6 rövidpálca', () => {
  const ladder = ['sl-st', 'sc', 'hdc', 'dc', 'tr', 'dtr'].map(stitchById);
  for (const def of ladder) assert.equal(def.heightFactor.source, 'estimated', def.id);
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i].heightFactor.value > ladder[i - 1].heightFactor.value, ladder[i].id);
  }
  const ratio = stitchById('dc').heightFactor.value / stitchById('sc').heightFactor.value;
  assert.ok(ratio >= 2 && ratio <= 2.6, `erp/rp = ${ratio}`);
});

/* ---- Fürt, beszúrás, tető ---- */

test('minden összehorgolt öltésnek megadott alapja van, és ez szabja a fogyasztást (D6)', () => {
  for (const def of STITCHES.filter((stitch) => stitch.kind === 'joined')) {
    assert.ok(def.base === 'same' || def.base === 'spread', def.id);
    assert.equal(def.consumes, def.base === 'same' ? 1 : def.parts, def.id);
    assert.equal(def.produces, 1, def.id);
  }
});

test('a fürt egy öltésbe 1 → 1, több öltésen át n → 1', () => {
  const dc = stitchById('dc');
  assert.deepEqual([cluster(dc, 4, 'same').consumes, cluster(dc, 4, 'same').produces], [1, 1]);
  assert.deepEqual([cluster(dc, 4, 'spread').consumes, cluster(dc, 4, 'spread').produces], [4, 1]);
});

test('a bogyó, a popcorn és a puff zárása különbözik', () => {
  assert.deepEqual(
    ['bobble-5dc', 'popcorn-5dc', 'puff-3'].map((id) => stitchById(id).closure),
    ['partial', 'complete', 'loops'],
  );
});

test('csak a rákhurok, a láncív és a varázskör teteje nem horgolható tovább', () => {
  assert.deepEqual(
    STITCHES.filter((stitch) => !stitch.workableTop).map((stitch) => stitch.id),
    ['rev-sc', 'ch-sp', 'magic-ring'],
  );
});

test('beszúrási módok: relief csak alapöltésen, a láthatatlan fogyasztás első szálba megy', () => {
  const valid = new Set(['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post', 'space', 'ring']);
  for (const def of STITCHES) {
    for (const mode of def.insertionModes) assert.ok(valid.has(mode), `${def.id}: ${mode}`);
    const post = def.insertionModes.some((mode) => mode.endsWith('-post'));
    assert.equal(post, def.kind === 'basic' && def.workableTop, `${def.id}: relief`);
  }
  assert.deepEqual(stitchById('invdec').insertionModes, ['front-loop']);
  for (const id of ['ch', 'picot', 'ch-sp', 'magic-ring']) assert.deepEqual(stitchById(id).insertionModes, [], id);
});

/* ---- Építőfüggvények ---- */

test('az építőfüggvények bármilyen n-re a helyes fogyaszt → ad arányt adják', () => {
  const sc = stitchById('sc');
  const tr = stitchById('tr');
  const cases = [
    [increase(sc, 3), 'inc-3sc', 1, 3],
    [decrease(tr, 4), 'tr4tog', 4, 1],
    [shell(tr, 7), 'shell-7tr', 1, 7],
    [cluster(sc, 2, 'spread'), 'cl-2sc-spread', 2, 1],
  ];
  for (const [def, id, consumes, produces] of cases) {
    assert.deepEqual([def.id, def.consumes, def.produces], [id, consumes, produces]);
  }
  assert.deepEqual(increase(sc, 3).members, ['sc', 'sc', 'sc']);
});

test('az építőfüggvény hibát dob érvénytelen darabszámra vagy részöltésre', () => {
  const sc = stitchById('sc');
  assert.throws(() => increase(sc, 1), RangeError);
  assert.throws(() => decrease(sc, 2.5), RangeError);
  assert.throws(() => shell(stitchById('ch'), 3), TypeError);
  assert.throws(() => cluster(stitchById('rev-sc'), 3, 'same'), TypeError);
});
