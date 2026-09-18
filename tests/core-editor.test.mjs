/*
 * A szerkesztő műveletei: a kidolgozott példák célpontba horgolással
 * megrajzolhatók, és az ellenőrző hibátlannak látja őket (PQW-857).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  canEndRow,
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRow,
  fillRow,
  liveCheck,
  setPinned,
  work,
  workIntoSame,
} from '../src/core/editor.ts';
import { computeLayers } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { EDITOR_CORE_TEXTS } from '../src/ui/i18n/core/editor.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** A mag kódot és adatot ad (PQW-904); a magyar mondat a felület szótárából jön. */
const huText = (reason) => renderCoreText(EDITOR_CORE_TEXTS.hu, reason);

function ok(result) {
  assert.ok(result.ok, result.ok ? '' : huText(result.reason));
  return result.pattern;
}

/** Egy szem a kurzor alapértelmezett helyére, vagy a megadott célpontba. */
function stitch(pattern, def, cursor) {
  const at = cursor ?? defaultCursor(pattern, contextOf(pattern), def);
  return ok(work(pattern, { def, count: 1 }, at));
}

const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));

test('csupasz láncalap után lehet fordulni (PQW-915)', () => {
  // A hiba: a gráf a be nem horgolt láncalap-véget az 1. sor fordulóláncának
  // számolja, ezért a fordulólánc hossza sosem 0, és a Fordulás gomb tiltott
  // maradt. A feltétel azon múljon, hogy az 1. rétegben még nincs szem.
  const pattern = chains(emptyPattern(), 12);
  const context = contextOf(pattern);

  assert.equal(context.started, false, 'a láncalap után még nincs belehorgolt szem');
  assert.equal(canEndRow(context), true, 'csupasz láncalap után fordulni kell tudni');

  // A fordulás után az 1. sor következik (PQW-891).
  const turned = ok(endRow(pattern, 'sc'));
  assert.equal(contextOf(turned).layer, 1);
});
const counts = (pattern) => computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));

/**
 * `width` szem széles félpálcás téglalap: `width + 2` láncszem, és mivel a
 * fordulólánc a sor első szeme, soronként `width − 1` félpálcát horgolunk (PQW-891).
 */
function hdcRectangle(width, rows) {
  // Félpálcánál 2 láncszemet hagyunk ki, és minden láncszembe egy szem megy (PQW-924).
  let pattern = chains(emptyPattern(), width + 2);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) pattern = ok(endRow(pattern, 'hdc'));
    for (let i = 0; i < width; i += 1) pattern = stitch(pattern, 'hdc');
  }
  return pattern;
}

describe('félpálcás téglalap csak alapértelmezett célpontokkal', () => {
  test('10 × 10: soronként 10 szem, hibátlan', () => {
    const pattern = hdcRectangle(10, 10);
    assert.deepEqual(counts(pattern), [0, ...Array(10).fill(10)]);
    assert.deepEqual(findings(pattern), []);
  });

  test('az 1. sor első szeme a kihagyás utáni láncszembe megy: rp és fp a 3., erp a 4. (PQW-924)', () => {
    // A célpont 0-tól számozott, a láncszem a horogtól 1-től: a kihagyás száma adja az indexet.
    const pattern = chains(emptyPattern(), 12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 2);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 3);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 2);
  });

  test('a fordulás a kiválasztott szem fordulóláncát is megcsinálja (01 §8.3 szabály 12)', () => {
    const pattern = ok(endRow(hdcRectangle(4, 1), 'dc'));
    const context = contextOf(pattern);
    assert.equal(context.turningChain, 3);
    assert.equal(context.layer, 2);
    // A fordulólánc nem foglal helyet (PQW-924): a sor az alatta lévő sor első szemébe kezd.
    assert.equal(defaultCursor(pattern, context, 'dc'), 0);
    assert.equal(defaultCursor(pattern, context, 'hdc'), 0);
  });

  test('a sor utolsó célpontja után nincs következő: nem horgol kétszer ugyanabba', () => {
    const pattern = hdcRectangle(4, 1);
    const context = contextOf(pattern);
    assert.equal(defaultCursor(pattern, context, 'hdc'), context.slots.length);
    const result = work(pattern, { def: 'hdc', count: 1 }, context.slots.length);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'row-end-reached');
    assert.match(huText(result.reason), /sor végére értél/);
  });

  test('a varázskörbe a kurzor ott marad: a kör minden szeme belemegy', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc');
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 0);
    pattern = stitch(pattern, 'sc');
    assert.deepEqual(counts(pattern), [0, 2]);
  });

  test('félkész sorban nincs hiba, csak a hátralévő célpontok száma', () => {
    const full = hdcRectangle(10, 2);
    let pattern = ok(endRow(full, 'hdc'));
    for (let i = 0; i < 4; i += 1) pattern = stitch(pattern, 'hdc');
    assert.ok(findings(pattern).some((finding) => finding.rule === 'unused-position'));
    // 10 célpont: a fordulólánc nem foglal helyet (PQW-924), 4 foglalt, 6 van hátra.
    assert.deepEqual(liveCheck(pattern), { findings: [], remaining: 6 });
  });

  test('a félkész sor elején kihagyott szem viszont hiba marad', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1), 'hdc'));
    // A 2. szemnél kezdünk: az alatta lévő sor első két szeme használatlan marad (PQW-924).
    pattern = stitch(pattern, 'hdc', 2);
    pattern = stitch(pattern, 'hdc');
    assert.deepEqual(
      liveCheck(pattern).findings.map((finding) => finding.rule),
      ['unused-position', 'unused-position'],
    );
  });
});

test('kagyló 6 × 2 + 1: szaporítás „még egy ugyanabba”, hibátlan (03 §4.2 E)', () => {
  // A fordulólánc egyik sorban sem szem (PQW-924): nincs soronkénti felülírás.
  const start = emptyPattern();
  let pattern = chains({ ...start, conventions: { ...start.conventions, turningChainCounts: false } }, 14);
  pattern = stitch(pattern, 'sc');
  for (const at of [4, 10]) {
    pattern = stitch(pattern, 'shell-5dc', at);
    pattern = stitch(pattern, 'sc', at + 3);
  }
  pattern = ok(endRow(pattern, 'dc'));
  // A sort kezdő fordulólánc nem szem (PQW-924), ezért a szaporítás adja mind a három pálcát.
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = stitch(pattern, 'sc', 3);
  pattern = stitch(pattern, 'shell-5dc', 6);
  pattern = stitch(pattern, 'sc', 9);
  pattern = stitch(pattern, 'dc', 12);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));

  const piece = pattern.pieces[0];
  assert.deepEqual(piece.groups.map((group) => group.def), ['shell-5dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'inc-3dc']);
  assert.deepEqual(counts(pattern), [0, 13, 13]);
  assert.deepEqual(findings(pattern), []);
});

test('V-szem: a láncszeméből láncív lesz, a következő sor abba horgol (03 §4.2 F)', () => {
  // A tudásbázis példája: 3 többszöröse + 2, a fordulólánc nem számít.
  const start = emptyPattern();
  let pattern = chains({ ...start, conventions: { ...start.conventions, turningChainCounts: false } }, 8);
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 5);
  pattern = stitch(pattern, 'dc', 7);
  assert.equal(pattern.pieces[0].spaces.length, 1);

  pattern = ok(endRow(pattern, 'dc'));
  const context = contextOf(pattern);
  assert.deepEqual(
    context.slots.map((slot) => slot.kind),
    ['stitch', 'stitch', 'space', 'stitch', 'stitch'],
  );
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 2);
  pattern = stitch(pattern, 'dc', 4);
  // Az 1. sor láncívébe a 2. sor horgol, ezért beleszámít; a 2. sor íve dísz (PQW-870).
  assert.deepEqual(counts(pattern), [0, 5, 4]);
  assert.deepEqual(findings(pattern), []);
});

test('fogyasztás két szomszédos célpontot használ, a kurzor kettőt lép', () => {
  let pattern = chains(emptyPattern(), 6);
  pattern = stitch(pattern, 'sc2tog');
  const node = pattern.pieces[0].stitches.at(-1);
  assert.equal(node.anchors.length, 2);
  assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 4);
  assert.equal(work(pattern, { def: 'sc3tog', count: 1 }, 4).ok, false);
});

test('nagymama-négyzet 1. köre varázskörbe, kúszószemes körzárással (03 §8)', () => {
  let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
  pattern = chains(pattern, 3);
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  for (let side = 0; side < 3; side += 1) {
    pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
    for (let i = 0; i < 3; i += 1) pattern = stitch(pattern, 'dc', 0);
  }
  pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
  assert.equal(endRow(pattern, 'dc').ok, false);
  pattern = ok(closeRound(pattern));

  assert.deepEqual(counts(pattern), [0, 12]);
  assert.deepEqual(findings(pattern), []);
  assert.equal(contextOf(pattern).shape, 'round');
});

describe('az utolsó lépés törlése', () => {
  test('egy lépés egy egység: fordulás a fordulólánccal lépésenként, csoport, láncív, körzárás', () => {
    const row = hdcRectangle(3, 1);
    const turned = ok(endRow(row, 'hdc'));
    // Előbb a fordulólánc két láncszeme, aztán maga a fordulás.
    assert.deepEqual(ok(deleteLast(ok(deleteLast(ok(deleteLast(turned)))))), row);

    const shell = stitch(chains(emptyPattern(), 8), 'shell-5dc', 3);
    assert.deepEqual(ok(deleteLast(shell)), chains(emptyPattern(), 8));

    const base = stitch(chains(emptyPattern(), 4), 'sc');
    // A láncív is oda kerül, ahová a kurzor mutat (PQW-935), ezért a munkaélen adjuk hozzá:
    // a sor elejére téve nem ő lenne az utolsó lépés, hanem a mögé került rövidpálca.
    const space = ok(work(base, { def: 'ch-sp', count: 3 }, defaultCursor(base, contextOf(base), 'ch-sp')));
    assert.deepEqual(ok(deleteLast(space)), base);
  });

  test('a körzárás a kúszószemmel együtt törlődik', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc', 0);
    const open = ok(workIntoSame(pattern, 'sc'));
    assert.deepEqual(ok(deleteLast(ok(closeRound(open)))), open);
  });

  test('üres mintában nincs mit törölni', () => {
    assert.equal(deleteLast(emptyPattern()).ok, false);
  });
});

test('hibás műveletre ok: false, kód a magból és magyar mondat a szótárból', () => {
  const empty = emptyPattern();
  for (const result of [
    work(empty, { def: 'sc', count: 1 }, 0),
    work(empty, { def: 'ch-sp', count: 3 }, 0),
    work(empty, { def: 'ch', count: 0 }, 0),
    work(chains(empty, 2), { def: 'magic-ring', count: 1 }, 0),
    work(chains(empty, 2), { def: 'nincs-ilyen', count: 1 }, 0),
    endRow(empty, 'sc'),
    // Két félpálca két láncszemben: sor, nem egy láncszembe horgolt kör.
    closeRound(hdcRectangle(3, 1)),
    workIntoSame(chains(empty, 3), 'sc'),
  ]) {
    assert.equal(result.ok, false);
    // A mag kódot ad, magyar mondatot nem; a szótár mindegyik kódhoz ad szöveget.
    assert.equal(typeof result.reason.code, 'string');
    assert.match(huText(result.reason), /\S/);
  }
});

test('kézi igazítás: a mentésben megmarad, a topológián nem változtat, törölhető', () => {
  const pattern = hdcRectangle(3, 1);
  const id = pattern.pieces[0].stitches.at(-1).id;
  const pinned = ok(setPinned(pattern, id, { x: 4.04, y: -2 }));
  assert.deepEqual(pinned.pieces[0].stitches.at(-1).pinned, { x: 4, y: -2, rotation: 0 });
  assert.deepEqual(counts(pinned), counts(pattern));

  const loaded = loadPattern(savePattern(pinned));
  assert.deepEqual(loaded.pattern, pinned);
  assert.deepEqual(ok(setPinned(pinned, id, null)), pattern);
});

test('az üres minta menthető és visszatölthető', () => {
  const pattern = emptyPattern('Próba');
  assert.deepEqual(loadPattern(savePattern(pattern)).pattern, pattern);
});

describe('sor kitöltése (PQW-879)', () => {
  test('a láncalapra a sor összes szabad célpontját kitölti, hibátlanul', () => {
    const base = chains(emptyPattern(), 12);
    const filled = ok(fillRow(base, { def: 'hdc', count: 1 }));
    // 12 láncszem, félpálca a 4. láncszemtől: 9 félpálca és a fordulólánc, 10 szem.
    assert.deepEqual(counts(filled), [0, 10]);
    assert.deepEqual(findings(filled), []);
  });

  test('a fordulás után a következő sort is kitölti, hibátlanul', () => {
    let pattern = ok(fillRow(chains(emptyPattern(), 12), { def: 'hdc', count: 1 }));
    pattern = ok(endRow(pattern, 'hdc'));
    pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    assert.deepEqual(counts(pattern), [0, 10, 10]);
    assert.deepEqual(findings(pattern), []);
  });

  test('ugyanazt adja, mint a célpontonkénti horgolás', () => {
    const base = chains(emptyPattern(), 12);
    const filled = ok(fillRow(base, { def: 'hdc', count: 1 }));
    let byHand = base;
    // 12 láncszem, 2 kihagyás: 10 szem fér a sorba (PQW-924).
    for (let i = 0; i < 10; i += 1) byHand = stitch(byHand, 'hdc');
    assert.deepEqual(counts(filled), counts(byHand));
  });

  test('a félkész sort a szabad célpontokkal fejezi be', () => {
    let pattern = chains(emptyPattern(), 12);
    pattern = stitch(pattern, 'hdc');
    pattern = stitch(pattern, 'hdc');
    pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    assert.deepEqual(counts(pattern), [0, 10]);
    assert.deepEqual(findings(pattern), []);
  });

  test('láncszemmel vagy üres sorban nem tölt', () => {
    assert.equal(fillRow(chains(emptyPattern(), 12), { def: 'ch', count: 3 }).ok, false);
    // Kitöltött sor után nincs több szabad célpont: nem tölt tovább.
    const filled = ok(fillRow(chains(emptyPattern(), 12), { def: 'hdc', count: 1 }));
    assert.equal(fillRow(filled, { def: 'hdc', count: 1 }).ok, false);
  });
});

describe('sor kezdése a láncalapon (PQW-891)', () => {
  /** A láncszemek fonalsorrendben n1, n2, …: a horogtól számított k. láncszem az (összes − k + 1). csomópont. */
  const chainFromHook = (pattern, total, k) => pattern.pieces[0].stitches[total - k].id;
  const layerOf = (pattern, n) => computeLayers(pattern, libraryFor(pattern))[n];

  /** Két sor a láncalapra a tulajdonos szabálya szerint, a fordulás a láncalap után is. */
  function twoRows(def, turningChain, total) {
    let pattern = chains(emptyPattern(), total);
    const start = endRow(pattern, def);
    assert.ok(start.ok, start.ok ? '' : huText(start.reason));
    assert.equal(start.pattern, pattern, 'a láncalap utáni fordulás nem változtat a mintán');
    assert.equal(canEndRow(contextOf(pattern)), true);
    // A kihagyás a tulajdonos táblázata szerint legalább kettő (PQW-924).
    const skipped = Math.max(2, turningChain);
    assert.equal(defaultCursor(pattern, contextOf(pattern), def), skipped, `${def}: a horogtól számított ${skipped + 1}. láncszem`);

    pattern = ok(fillRow(pattern, { def, count: 1 }));
    const stitches = total - skipped;
    assert.equal(layerOf(pattern, 1).stitchCount, stitches);
    // Az 1. sor fordulólánca a láncalap vége, nincs saját csomópontja: az első horgolt szem közvetlenül a láncszemek után jön.
    const first = pattern.pieces[0].stitches[total];
    assert.equal(first.def, def);
    assert.deepEqual(first.anchors.map((anchor) => anchor.id), [chainFromHook(pattern, total, skipped + 1)]);
    assert.deepEqual(findings(pattern), []);

    pattern = ok(endRow(pattern, def));
    pattern = ok(fillRow(pattern, { def, count: 1 }));
    assert.equal(layerOf(pattern, 2).stitchCount, stitches);
    // A fordulólánc teteje nem célpont (PQW-924): a 2. sor utolsó szeme az 1. sor első szemébe megy.
    assert.deepEqual(pattern.pieces[0].stitches.at(-1).anchors.map((anchor) => anchor.id), [first.id]);
    assert.deepEqual(findings(pattern), []);
    return pattern;
  }

  test('sál: 40 lsz, fordítás, 2 láncszem kimarad, 39 rp a 3. láncszemtől; a 2. sor is 39 szem', () => {
    const pattern = twoRows('sc', 1, 40);
    // Az 1. sor első rövidpálcája a horogtól 3. láncszembe; a 2. sor utolsó szeme ebbe a szembe.
    assert.equal(pattern.pieces[0].stitches[40].anchors[0].id, 'n38');
    assert.equal(pattern.pieces[0].stitches.at(-1).anchors[0].id, 'n41');
  });

  test('félpálca a 3., pálca a 4. láncszemtől: a kihagyás után minden láncszembe egy szem (PQW-924)', () => {
    twoRows('hdc', 2, 20);
    twoRows('dc', 3, 20);
  });

  test('szem nélkül nincs fordulás: üres mintában és a varázskörnél sem', () => {
    const empty = emptyPattern();
    assert.equal(canEndRow(contextOf(empty)), false);
    assert.equal(endRow(empty, 'sc').ok, false);
    const ring = ok(work(empty, { def: 'magic-ring', count: 1 }, 0));
    assert.equal(canEndRow(contextOf(ring)), false);
    const result = endRow(ring, 'sc');
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'row-empty');
    assert.match(huText(result.reason), /\S/);
  });
});

/*
 * A minta alkotása nem folytonos (PQW-933).
 *
 * A tulajdonos szava: „amikor valaki a mintát alkotja, akkor nincs
 * folytonosság. a sort úgy és olyan formában hozza létre, olyan sorrendben,
 * ahogy csak akarja”, és „abba szaporítson, amelyikbe kattintok, még ha az
 * visszafele haladást is jelentene — de ez mintakészítés, nem aktuális
 * horgolás”.
 *
 * Ezért az utólag hozzáadott szem a KELME sorrendjébe kerül, a célpontja mellé.
 * A fonal útja (a `prev` lánc és a tömb sorrendje) ezt követi, mert a rajz
 * oszlopait, az írott mintát és az ellenőrzőt is ez vezeti.
 */
describe('a sor tetszőleges sorrendben készül (PQW-933)', () => {
  /** 12 láncszem, fordulás, majd pálcák a megadott célpontokba. */
  const row = (slots) => {
    const turned = ok(endRow(chains(emptyPattern(), 12), 'dc'));
    return slots.reduce((pattern, slot) => ok(work(pattern, { def: 'dc', count: 1 }, slot)), turned);
  };

  /** A réteg szemei a fonal sorrendjében, mindegyik mellett a célpontja. */
  const path = (pattern) =>
    pattern.pieces[0].stitches.filter((node) => node.anchors.length > 0).map((node) => [node.id, node.anchors[0].id]);

  test('a kihagyott helyre tett szem a fonal útján is oda kerül, ahová a kelmén', () => {
    // A 3. és 4. célpontba pálca, az 5. kimarad, a 6.-ba megint pálca.
    const gap = row([3, 4, 6]);
    assert.deepEqual(path(gap), [['n13', 'n9'], ['n14', 'n8'], ['n15', 'n6']]);

    // A rés pótlása: a szem a 6. célpontba horgolt elé kerül, nem a sor végére.
    const filled = ok(work(gap, { def: 'dc', count: 1 }, 5));
    assert.deepEqual(path(filled), [['n13', 'n9'], ['n14', 'n8'], ['n16', 'n7'], ['n15', 'n6']]);
    assert.equal(filled.pieces[0].stitches.find((node) => node.id === 'n15').prev, 'n16');

    // A pótlás nem a haladási irány elleni szem: az ellenőrzőnek nincs mit jeleznie.
    assert.deepEqual(findings(filled).map((finding) => finding.rule), ['unused-position', 'unused-position', 'unused-position', 'unused-position', 'unused-position']);
  });

  test('a szaporítás abba a szembe megy, amelyikbe a horgoló kattintott', () => {
    const four = row([3, 4, 5, 6]);

    // A 4. célpont a sorban hátrébb van: régen az utolsó szem mellé került a szaporítás.
    const increased = ok(workIntoSame(four, 'dc', 4));
    assert.deepEqual(path(increased), [['n13', 'n9'], ['n14', 'n8'], ['n17', 'n8'], ['n15', 'n7'], ['n16', 'n6']]);
    assert.deepEqual(increased.pieces[0].groups, [{ id: 'g1', def: 'inc-2dc', members: ['n14', 'n17'] }]);

    // Utána a sor végén is a jó szembe szaporít, nem a legutóbb lerakottba.
    const both = ok(workIntoSame(increased, 'dc', 6));
    assert.deepEqual(both.pieces[0].groups.at(-1), { id: 'g2', def: 'inc-2dc', members: ['n16', 'n18'] });
    assert.deepEqual(findings(both).filter((finding) => finding.rule !== 'unused-position'), []);
  });

  test('előre haladva a szem a sor végére kerül, mint eddig', () => {
    const forward = row([3, 4, 5, 6]);
    assert.deepEqual(path(forward), [['n13', 'n9'], ['n14', 'n8'], ['n15', 'n7'], ['n16', 'n6']]);
    assert.deepEqual(forward.pieces[0].stitches.map((node) => node.prev), [null, ...forward.pieces[0].stitches.slice(0, -1).map((node) => node.id)]);
  });
});

/*
 * A láncszem helye (PQW-935): célpontja nincs, helye van.
 *
 * A tulajdonos jelentése szerint a láncszem a kurzortól függetlenül mindig a
 * sor végére került: „azt vártam volna, hogy ha a másodikba klikkelek… akkor
 * abba a cellába tegye a láncszemet.” A láncszem annyi oszlopot foglal el,
 * ahány készül, és az alattuk lévő szemeket áthidalja.
 */
describe('a láncszem a megmutatott oszlopba kerül (PQW-935)', () => {
  const row = () => {
    const turned = ok(endRow(chains(emptyPattern(), 22), 'sc'));
    const first = defaultCursor(turned, contextOf(turned), 'dc');
    return ok(work(turned, { def: 'dc', count: 1 }, first));
  };

  /** Az utolsó láncszem célpontjai szerinti helye: melyik célpontot hidalja át. */
  const bridged = (pattern) => pattern.pieces[0].skipped;

  test('a kurzoron álló szabad célpontot foglalja el, és áthidalja', () => {
    const base = row();
    const context = contextOf(base);
    const far = context.frontier + 3;

    const placed = ok(work(base, { def: 'ch', count: 1 }, far));
    assert.deepEqual(bridged(placed), [context.slots[far].id], 'a megmutatott célpontot hidalja át');

    // Máshová mutatva máshová kerül: a javítás előtt a kettő azonos volt.
    const nearer = ok(work(base, { def: 'ch', count: 1 }, context.frontier + 1));
    assert.notDeepEqual(bridged(nearer), bridged(placed));
  });

  test('több láncszem több oszlopot foglal el', () => {
    const base = row();
    const context = contextOf(base);
    const from = context.frontier + 2;
    const placed = ok(work(base, { def: 'ch', count: 3 }, from));
    assert.deepEqual(bridged(placed), [from, from + 1, from + 2].map((i) => context.slots[i].id));
  });

  test('amibe utóbb mégis szem kerül, az nem marad kihagyott', () => {
    const base = row();
    const context = contextOf(base);
    const at = context.frontier + 2;
    const withChain = ok(work(base, { def: 'ch', count: 1 }, at));
    assert.equal(bridged(withChain).length, 1);

    const worked = ok(work(withChain, { def: 'dc', count: 1 }, at));
    assert.deepEqual(bridged(worked), [], 'a beléje horgolt szem törli a kihagyást');
  });

  test('a munkaél mögé visszanyúlva a lánc nem hidal át semmit', () => {
    const base = row();
    const context = contextOf(base);
    const back = ok(work(base, { def: 'ch', count: 1 }, context.frontier));
    assert.deepEqual(bridged(back), []);
  });
});

/*
 * A korábbi verziókból örökölt, gazdátlan áthidalás-jelölések (PQW-939).
 *
 * A jelölés az alatta lévő SZEMRE mutat, ezért a fölötte lévő láncszem
 * törlésekor korábban ott maradt. A régi mentések ezt magukkal hozzák, és a
 * rajz az árva jelölést adta oda az új láncszemnek: a tulajdonos által
 * megmutatott oszlop helyett a lánc közvetlenül az előtte lévő szem mellé
 * került. Szó szerint: „a 2. sor utolsó láncszemét azt közvetlenül az erp után
 * teszi… pedig kihagytam cellákat.”
 *
 * A minta ezért minden szerkesztéssel tisztul, nem csak törléskor.
 */
describe('a minta kitisztul az árva áthidalásokból (PQW-939)', () => {
  const row = () => {
    let pattern = ok(endRow(chains(emptyPattern(), 22), 'sc'));
    for (const def of ['sc', 'sc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    const slot = defaultCursor(pattern, contextOf(pattern), 'dc');
    return { pattern: ok(work(pattern, { def: 'dc', count: 1 }, slot)), slot };
  };

  /** Ugyanaz a minta, de a megadott célpontokon gazdátlan jelöléssel. */
  const withOrphans = (pattern, slots) => {
    const piece = pattern.pieces[0];
    const orphans = slots.map((i) => contextOf(pattern).slots[i].id);
    return { ...pattern, pieces: [{ ...piece, skipped: [...piece.skipped, ...orphans] }, ...pattern.pieces.slice(1)] };
  };

  test('az új láncszem a megmutatott helyet foglalja el, nem az árvát', () => {
    const { pattern, slot } = row();
    const dirty = withOrphans(pattern, [slot + 1, slot + 2]);

    const placed = ok(work(dirty, { def: 'ch', count: 1 }, slot + 3));
    assert.deepEqual(placed.pieces[0].skipped, [contextOf(pattern).slots[slot + 3].id], 'csak a megmutatott hely marad');
  });

  test('a takarítás nem nyúl a jogos jelölésekhez', () => {
    const { pattern, slot } = row();
    const withChain = ok(work(pattern, { def: 'ch', count: 2 }, slot + 1));
    assert.equal(withChain.pieces[0].skipped.length, 2, 'két láncszem két helyet foglal');

    const again = ok(work(withChain, { def: 'ch', count: 1 }, slot + 4));
    assert.equal(again.pieces[0].skipped.length, 3, 'a korábbi kettő megmarad, az új mellé');
  });
});
