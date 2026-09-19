/*
 * Table-driven tests for the stitch library, following the PQW-867 acceptance
 * criteria: chain height, consumes → produces, UK name = US name shifted one
 * step up, and no output anywhere using the word „hamispálca”. The slanted
 * symbol lines are checked by tests/ui-symbols.test.mjs, because the symbol
 * belongs to the interface.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { roundEndFor } from '../src/core/rounds.ts';
import { cluster, decrease, increase, STITCH_SECTIONS, STITCHES, shell, stitchById } from '../src/core/stitches.ts';
import { stitchLabel, stitchName, stitchStructure } from '../src/core/stitchText.ts';

const LOCALES = ['hu', 'en-US', 'en-GB'];

/* ---- The library table ---- */

// prettier-ignore
const TABLE = [
  // id               kind       yarn ov.  ch hght.  turning ch   consumes  produces  spaces
  ['ch', 'chain', 0, 1, 0, 0, 1, 0],
  ['sl-st', 'slip', 0, 0, 0, 1, 1, 0],
  ['sc', 'basic', 0, 1, 1, 1, 1, 0],
  ['hdc', 'basic', 1, 2, 2, 1, 1, 0],
  ['dc', 'basic', 1, 3, 3, 1, 1, 0],
  ['tr', 'basic', 2, 4, 4, 1, 1, 0],
  ['dtr', 'basic', 3, 5, 5, 1, 1, 0],
  ['inc-2sc', 'group', 0, 1, 1, 1, 2, 0],
  ['inc-2dc', 'group', 1, 3, 3, 1, 2, 0],
  ['sc2tog', 'joined', 0, 1, 1, 2, 1, 0],
  ['sc3tog', 'joined', 0, 1, 1, 3, 1, 0],
  ['dc2tog', 'joined', 1, 3, 3, 2, 1, 0],
  ['dc3tog', 'joined', 1, 3, 3, 3, 1, 0],
  ['invdec', 'joined', 0, 1, 1, 2, 1, 0],
  ['shell-5dc', 'group', 1, 3, 3, 1, 5, 0],
  ['v-st-dc', 'group', 1, 3, 3, 1, 2, 1],
  ['cl-3dc', 'joined', 1, 3, 3, 1, 1, 0],
  ['cl-3dc-spread', 'joined', 1, 3, 3, 3, 1, 0],
  ['puff-3', 'joined', 1, 2, 2, 1, 1, 0],
  ['bobble-5dc', 'joined', 1, 3, 3, 1, 1, 0],
  ['popcorn-5dc', 'joined', 1, 3, 3, 1, 1, 0],
  ['picot', 'picot', 0, 0, 0, 0, 0, 0],
  ['rev-sc', 'basic', 0, 1, 1, 1, 1, 0],
  ['ch-sp', 'space', 0, 0, 0, 0, 0, 1],
  ['magic-ring', 'ring', 0, 0, 0, 0, 0, 0],
];

test('the table lists exactly the stitches of the library, in order', () => {
  assert.deepEqual(
    TABLE.map(([id]) => id),
    STITCHES.map((stitch) => stitch.id),
  );
});

for (const [id, kind, yarnOvers, chainHeight, turningChain, consumes, produces, spaces] of TABLE) {
  test(`${id}: kind, yarn overs, chain height, turning chain, consumes → produces`, () => {
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

test('the ids are unique, and every section holds at least one stitch', () => {
  const ids = STITCHES.map((stitch) => stitch.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const section of STITCH_SECTIONS) assert.ok(section.stitches.length > 0, section.id);
});

test('an unknown id throws', () => {
  assert.throws(() => stitchById('nincs-ilyen'), /Ismeretlen szem: nincs-ilyen/);
});

test('every stitch of the documented set is present', () => {
  const names = new Set(STITCHES.map((stitch) => stitch.terms.hu.name));
  for (const name of [
    'láncszem',
    'kúszószem',
    'rövidpálca',
    'félpálca',
    'egyráhajtásos pálca',
    'kétráhajtásos pálca',
    'háromráhajtásos pálca',
    'szaporítás',
    'fogyasztás',
    'láthatatlan fogyasztás',
    'kagyló',
    'V-szem',
    'fürt',
    'puff',
    'bogyó',
    'popcorn',
    'pikó',
    'rákhurok',
    'láncív',
    'varázskör',
  ]) {
    assert.ok(names.has(name), `missing: ${name}`);
  }
});

/* ---- Vocabulary ---- */

// prettier-ignore
const VOCABULARY = [
  // id         hungarian                  hu abbr  US name                  abbr       UK name                  abbr
  ['ch', 'láncszem', 'lsz', 'chain', 'ch', 'chain', 'ch'],
  ['sl-st', 'kúszószem', 'ksz', 'slip stitch', 'sl st', 'slip stitch', 'ss'],
  ['sc', 'rövidpálca', 'rp', 'single crochet', 'sc', 'double crochet', 'dc'],
  ['hdc', 'félpálca', 'fp', 'half double crochet', 'hdc', 'half treble', 'htr'],
  ['dc', 'egyráhajtásos pálca', 'erp', 'double crochet', 'dc', 'treble', 'tr'],
  ['tr', 'kétráhajtásos pálca', 'krp', 'treble', 'tr', 'double treble', 'dtr'],
  ['dtr', 'háromráhajtásos pálca', null, 'double treble', 'dtr', 'triple treble', 'trtr'],
];

for (const [id, hu, huAbbr, us, usAbbr, gb, gbAbbr] of VOCABULARY) {
  test(`${id}: the approved name and abbreviation in all three notations`, () => {
    const { terms } = stitchById(id);
    assert.deepEqual(
      [
        terms.hu.name,
        terms.hu.abbr,
        terms['en-US'].name,
        terms['en-US'].abbr,
        terms['en-GB'].name,
        terms['en-GB'].abbr,
      ],
      [hu, huAbbr, us, usAbbr, gb, gbAbbr],
    );
  });
}

test('the UK name is the US name shifted one step up: sc → dc → tr → dtr', () => {
  const ladder = ['sc', 'dc', 'tr', 'dtr'].map(stitchById);
  for (let i = 0; i < ladder.length - 1; i++) {
    assert.deepEqual(ladder[i].terms['en-GB'], {
      ...ladder[i + 1].terms['en-US'],
      aliases: ladder[i].terms['en-GB'].aliases,
    });
  }
});

test('the UK name of hdc is "half" in front of the UK name of dc', () => {
  const hdc = stitchById('hdc').terms['en-GB'];
  const dc = stitchById('dc').terms['en-GB'];
  assert.equal(hdc.name, `half ${dc.name}`);
  assert.equal(hdc.abbr, `h${dc.abbr}`);
});

test('the UK structure of a compound stitch is the US one with its parts shifted one step up', () => {
  const shift = { sc: 'dc', hdc: 'htr', dc: 'tr', tr: 'dtr', dtr: 'trtr' };
  for (const def of STITCHES) {
    const us = stitchStructure(def, 'en-US');
    const expected = us?.replace(/\b(dtr|hdc|sc|dc|tr)(?=\d|\b)/g, (abbr) => shift[abbr]) ?? null;
    assert.equal(stitchStructure(def, 'en-GB'), expected, def.id);
  }
});

test('UK output never contains sc, hdc or sl st', () => {
  for (const def of STITCHES) {
    assert.doesNotMatch(stitchLabel(def, 'en-GB'), /\b(sc|hdc)(?=\d|\b)|sl st/, def.id);
  }
});

test('no output and no accepted alias uses the word „hamispálca”', () => {
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

test('sc also answers to kispálca and dc to nagypálca (D2, D3)', () => {
  assert.deepEqual(stitchById('sc').terms.hu.aliases, ['kispálca']);
  assert.deepEqual(stitchById('dc').terms.hu.aliases, ['nagypálca']);
});

// prettier-ignore
const TEXTS = [
  // id              hungarian                                US                                     UK
  ['sc', 'rövidpálca (rp)', 'single crochet (sc)', 'double crochet (dc)'],
  ['dtr', 'háromráhajtásos pálca', 'double treble (dtr)', 'triple treble (trtr)'],
  ['inc-2sc', 'szaporítás: 2 rp egy szembe', 'increase (inc): 2 sc in same st', 'increase (inc): 2 dc in same st'],
  ['sc2tog', 'fogyasztás: 2 rp 2 szemen át', 'decrease (dec): sc2tog', 'decrease (dec): dc2tog'],
  ['shell-5dc', 'kagyló: 5 erp egy szembe', 'shell (sh): 5 dc in same st', 'shell: 5 tr in same st'],
  [
    'v-st-dc',
    'V-szem: (erp, 1 lsz, erp) egy szembe',
    'V-stitch (V-st): (dc, ch 1, dc) in same st',
    'V-stitch: (tr, ch 1, tr) in same st',
  ],
  ['cl-3dc', 'fürt: 3 erp egy szembe', 'cluster (CL): 3 dc in same st', 'cluster (CL): 3 tr in same st'],
  ['cl-3dc-spread', 'fürt: 3 erp 3 szemen át', 'cluster (CL): dc3tog', 'cluster (CL): tr3tog'],
  ['puff-3', 'puff', 'puff stitch (ps)', 'puff stitch'],
  ['rev-sc', 'rákhurok', 'reverse single crochet (rev sc)', 'reverse double crochet'],
];

for (const [id, hu, us, gb] of TEXTS) {
  test(`${id}: written-out name and structure`, () => {
    const def = stitchById(id);
    assert.deepEqual(
      LOCALES.map((locale) => stitchLabel(def, locale)),
      [hu, us, gb],
    );
  });
}

test('a part stitch with no abbreviation is spelled out in the structure', () => {
  const dtr = stitchById('dtr');
  assert.equal(stitchStructure(decrease(dtr, 2), 'hu'), '2 háromráhajtásos pálca 2 szemen át');
  assert.equal(stitchName(increase(dtr, 2), 'en-GB'), 'increase (inc)');
});

/* ---- Conventions ---- */

// Round end: every stitch in the library joins the round; the spiral comes from the amigurumi pattern kind (PQW-892).
// prettier-ignore
const CONVENTIONS = [
  // id         ch counts (round)       round end
  ['sc', false, 'join-slip'],
  ['hdc', false, 'join-slip'],
  ['dc', true, 'join-slip'],
  ['tr', true, 'join-slip'],
  ['dtr', true, 'join-slip'],
  ['inc-2sc', false, 'join-slip'],
  ['dc2tog', true, 'join-slip'],
];

for (const [id, counts, roundEnd] of CONVENTIONS) {
  test(`${id}: defaults for the round starting chain and the round end (K1, K2)`, () => {
    const def = stitchById(id);
    assert.deepEqual([def.turningChainCounts, def.roundEnd], [counts, roundEnd]);
  });
}

test('the round end default comes from the pattern kind: spiral in amigurumi, joined elsewhere; an explicit round end is kept (PQW-892)', () => {
  assert.equal(roundEndFor('stitch-default', false), 'join-slip');
  assert.equal(roundEndFor('stitch-default', true), 'spiral');
  for (const amigurumi of [false, true]) {
    assert.equal(roundEndFor('join-slip', amigurumi), 'join-slip');
    assert.equal(roundEndFor('spiral', amigurumi), 'spiral');
  }
  // Stitch height does not decide it: by the library a single crochet round is a joined round too.
  assert.equal(stitchById('sc').roundEnd, stitchById('dc').roundEnd);
});

test('a compound stitch inherits the height, turning chain and round end of its part', () => {
  for (const def of STITCHES) {
    const partId = def.kind === 'joined' ? def.part : def.kind === 'group' ? def.members[0] : null;
    if (!partId) continue;
    const part = stitchById(partId);
    for (const field of [
      'yarnOvers',
      'chainHeight',
      'turningChain',
      'turningChainCounts',
      'roundEnd',
      'heightFactor',
    ]) {
      assert.deepEqual(def[field], part[field], `${def.id}.${field}`);
    }
  }
});

test('the real height factor is estimated, grows with chain height, and dc is 2–2.6 sc tall', () => {
  const ladder = ['sl-st', 'sc', 'hdc', 'dc', 'tr', 'dtr'].map(stitchById);
  for (const def of ladder) assert.equal(def.heightFactor.source, 'estimated', def.id);
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i].heightFactor.value > ladder[i - 1].heightFactor.value, ladder[i].id);
  }
  const ratio = stitchById('dc').heightFactor.value / stitchById('sc').heightFactor.value;
  assert.ok(ratio >= 2 && ratio <= 2.6, `dc/sc = ${ratio}`);
});

/* ---- Clusters, insertion, workable top ---- */

test('every joined stitch declares its base, and the base sets what it consumes (D6)', () => {
  for (const def of STITCHES.filter((stitch) => stitch.kind === 'joined')) {
    assert.ok(def.base === 'same' || def.base === 'spread', def.id);
    assert.equal(def.consumes, def.base === 'same' ? 1 : def.parts, def.id);
    assert.equal(def.produces, 1, def.id);
  }
});

test('a cluster in one stitch is 1 → 1, a cluster across n stitches is n → 1', () => {
  const dc = stitchById('dc');
  assert.deepEqual([cluster(dc, 4, 'same').consumes, cluster(dc, 4, 'same').produces], [1, 1]);
  assert.deepEqual([cluster(dc, 4, 'spread').consumes, cluster(dc, 4, 'spread').produces], [4, 1]);
});

test('bobble, popcorn and puff each close differently', () => {
  assert.deepEqual(
    ['bobble-5dc', 'popcorn-5dc', 'puff-3'].map((id) => stitchById(id).closure),
    ['partial', 'complete', 'loops'],
  );
});

test('only reverse sc, chain space and magic ring have a top that cannot be worked into', () => {
  assert.deepEqual(
    STITCHES.filter((stitch) => !stitch.workableTop).map((stitch) => stitch.id),
    ['rev-sc', 'ch-sp', 'magic-ring'],
  );
});

test('insertion modes: post stitches only on basic stitches, invisible decrease goes into the front loop', () => {
  const valid = new Set(['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post', 'space', 'ring']);
  for (const def of STITCHES) {
    for (const mode of def.insertionModes) assert.ok(valid.has(mode), `${def.id}: ${mode}`);
    const post = def.insertionModes.some((mode) => mode.endsWith('-post'));
    assert.equal(post, def.kind === 'basic' && def.workableTop, `${def.id}: post`);
  }
  assert.deepEqual(stitchById('invdec').insertionModes, ['front-loop']);
  for (const id of ['ch', 'picot', 'ch-sp', 'magic-ring']) assert.deepEqual(stitchById(id).insertionModes, [], id);
});

/* ---- Builder functions ---- */

test('the builder functions give the right consumes → produces ratio for any n', () => {
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

test('a builder function throws on an invalid count or part stitch', () => {
  const sc = stitchById('sc');
  assert.throws(() => increase(sc, 1), RangeError);
  assert.throws(() => decrease(sc, 2.5), RangeError);
  assert.throws(() => shell(stitchById('ch'), 3), TypeError);
  assert.throws(() => cluster(stitchById('rev-sc'), 3, 'same'), TypeError);
});
