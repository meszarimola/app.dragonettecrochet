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
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { chartGrid } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { rowCaptions } from '../src/ui/chart-labels.ts';
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
  const turned = ok(endRow(pattern));
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
    if (row > 1) pattern = ok(endRow(pattern));
    // A fordult sor első szeme a fordulólánc lesz (PQW-944), ezért ott eggyel többször horgolunk.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) pattern = stitch(pattern, 'hdc');
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

  test('a fordulás nem rak le láncszemet; a fordulóláncot az első szem hozza (PQW-944)', () => {
    const before = hdcRectangle(4, 1);
    const pattern = ok(endRow(before));
    const context = contextOf(pattern);
    assert.equal(pattern.pieces[0].stitches.length, before.pieces[0].stitches.length, 'a fordulás nem tesz le semmit');
    assert.equal(context.turningChain, 0);
    assert.equal(context.layer, 2);
    // A sor legelején állunk: az első szem helyére a magasságának megfelelő lánc kerül.
    assert.equal(defaultCursor(pattern, context, 'dc'), 0);
    for (const [tool, chains] of [['sc', 1], ['hdc', 2], ['dc', 3]]) {
      const first = ok(work(pattern, { def: tool, count: 1 }, 0));
      const layer = computeLayers(first, libraryFor(first))[2];
      assert.equal(layer.stitches.length, chains, `${tool}: ${chains} láncszem`);
      assert.ok(
        first.pieces[0].stitches.slice(-chains).every((node) => node.def === 'ch'),
        `${tool}: a szem helyett láncszem`,
      );
      // A lánc az első szem helyén ül: a következő szem a második célpontra megy.
      assert.equal(defaultCursor(first, contextOf(first), tool), 1);
    }
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
    let pattern = ok(endRow(full));
    // Az első szem a fordulólánc lesz (PQW-944), utána három félpálca.
    for (let i = 0; i < 4; i += 1) pattern = stitch(pattern, 'hdc');
    assert.ok(findings(pattern).some((finding) => finding.rule === 'unused-position'));
    // 11 célpont: a fordulólánc az elsőn ül, 3 szem utána, 7 van hátra.
    assert.deepEqual(liveCheck(pattern), { findings: [], remaining: 7 });
  });

  test('a félkész sor elején kihagyott szem viszont hiba marad', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1)));
    /*
     * Az első szem a fordulólánc lesz, és a sor elejére áll (PQW-944). Ha a
     * horgoló ezután kihagyja a sor elejét — például mert színt vált és
     * szándékosan később kezdi —, azt jelezzük, de nem pótoljuk.
     */
    pattern = stitch(pattern, 'hdc');
    pattern = stitch(pattern, 'hdc', 3);
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
  pattern = ok(endRow(pattern));
  /*
   * Itt a fordulólánc nem szem (a minta beállítása), ezért nem lép szem
   * helyére (PQW-944): a horgoló maga teszi le a láncot, és a szaporítás adja
   * mind a három pálcát.
   */
  pattern = chains(pattern, 3);
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

  pattern = ok(endRow(pattern));
  // A fordulólánc itt nem szem (a minta beállítása), ezért a horgoló maga teszi le (PQW-944).
  pattern = chains(pattern, 3);
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
  assert.equal(endRow(pattern).ok, false);
  pattern = ok(closeRound(pattern));

  assert.deepEqual(counts(pattern), [0, 12]);
  assert.deepEqual(findings(pattern), []);
  assert.equal(contextOf(pattern).shape, 'round');
});

describe('az utolsó lépés törlése', () => {
  test('egy lépés egy egység: fordulás a fordulólánccal lépésenként, csoport, láncív, körzárás', () => {
    const row = hdcRectangle(3, 1);
    // A fordulás magában nem tesz le semmit (PQW-944): egyetlen lépés, egyetlen törlés.
    const turned = ok(endRow(row));
    assert.deepEqual(ok(deleteLast(turned)), row);
    // A fordulólánc az első szemmel jön: félpálcánál két láncszem, és láncszemenként törlődik.
    const started = stitch(turned, 'hdc');
    assert.equal(started.pieces[0].stitches.length, turned.pieces[0].stitches.length + 2);
    assert.deepEqual(ok(deleteLast(ok(deleteLast(started)))), turned);

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
    endRow(empty),
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
    pattern = ok(endRow(pattern));
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
    const start = endRow(pattern);
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

    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def, count: 1 }));
    assert.equal(layerOf(pattern, 2).stitchCount, stitches);
    // A fordulólánc teteje célpont (PQW-944): a 2. sor utolsó szeme oda megy, a láncalap utolsó láncszemébe.
    assert.deepEqual(pattern.pieces[0].stitches.at(-1).anchors.map((anchor) => anchor.id), [pattern.pieces[0].stitches[total - 1].id]);
    assert.deepEqual(findings(pattern), []);
    return pattern;
  }

  test('sál: 40 lsz, fordítás, 2 láncszem kimarad, 39 rp a 3. láncszemtől; a 2. sor is 39 szem', () => {
    const pattern = twoRows('sc', 1, 40);
    // Az 1. sor első rövidpálcája a horogtól 3. láncszembe; a 2. sor utolsó szeme az 1. sor fordulóláncának tetejébe.
    assert.equal(pattern.pieces[0].stitches[40].anchors[0].id, 'n38');
    assert.equal(pattern.pieces[0].stitches.at(-1).anchors[0].id, 'n40');
  });

  test('félpálca a 3., pálca a 4. láncszemtől: a kihagyás után minden láncszembe egy szem (PQW-924)', () => {
    twoRows('hdc', 2, 20);
    twoRows('dc', 3, 20);
  });

  test('szem nélkül nincs fordulás: üres mintában és a varázskörnél sem', () => {
    const empty = emptyPattern();
    assert.equal(canEndRow(contextOf(empty)), false);
    assert.equal(endRow(empty).ok, false);
    const ring = ok(work(empty, { def: 'magic-ring', count: 1 }, 0));
    assert.equal(canEndRow(contextOf(ring)), false);
    const result = endRow(ring);
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
    const turned = ok(endRow(chains(emptyPattern(), 12)));
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
    const turned = ok(endRow(chains(emptyPattern(), 22)));
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
    let pattern = ok(endRow(chains(emptyPattern(), 22)));
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

/*
 * A sor szemszáma (PQW-940). A tulajdonos sora a v0.31.0-ban (13)-at mutatott,
 * pedig 22 szem van benne: a program sem a fordulóláncot, sem a láncszemeket
 * nem számolta.
 *
 * A tulajdonos szabálya (2026-09-18): a fordulólánc a sor első szeme, és a
 * láncszemek is szemek. A SZERKEZET száma külön él tovább: abba a fordulólánc
 * nem tartozik bele, mert a következő sor nem horgol beléje.
 */
describe('a sor kiírt szemszáma a fordulólánccal és a láncszemekkel (PQW-940)', () => {
  const put = (pattern, def, count = 1) => ok(work(pattern, { def, count }, defaultCursor(pattern, contextOf(pattern), def)));
  const cluster = (pattern, def, count) => {
    const at = defaultCursor(pattern, contextOf(pattern), def);
    let next = ok(work(pattern, { def, count: 1 }, at));
    for (let i = 1; i < count; i += 1) next = ok(workIntoSame(next, def, at));
    return next;
  };

  /** A tulajdonos 2. sora: 1 fordulólánc, 2 rp, 2 erp, 3-as csokor, 3 lsz, 3-as csokor, 3 lsz, 3-as csokor, 2 lsz. */
  const ownersRow = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 22 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'dc');
    pattern = put(pattern, 'dc');
    pattern = cluster(pattern, 'dc', 3);
    pattern = put(pattern, 'ch', 3);
    pattern = cluster(pattern, 'dc', 3);
    pattern = put(pattern, 'ch', 3);
    pattern = cluster(pattern, 'dc', 3);
    return put(pattern, 'ch', 2);
  };

  test('a tulajdonos sora 22 szem, nem 13', () => {
    const [, row] = computeLayers(ownersRow(), libraryFor(ownersRow()));
    assert.equal(row.writtenCount, 22, 'a kiírt szemszám');
    // A szerkezeté a belehorgolható szemeké: fordulólánc nélkül, és a láncszem csak akkor, ha valami beléje horgol.
    assert.equal(row.stitchCount, 13);
  });

  test('a fordulólánc a sor első szeme: két rövidpálca után 3 a kiírt szám', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'sc');
    const [, row] = computeLayers(pattern, libraryFor(pattern));
    assert.equal(row.writtenCount, 3);
    assert.equal(row.stitchCount, 2);
  });

  test('a láncszem is szem, akkor is, ha még nincs fölötte sor', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    const before = computeLayers(pattern, libraryFor(pattern))[1].writtenCount;
    const withChains = put(pattern, 'ch', 3);
    const after = computeLayers(withChains, libraryFor(withChains))[1].writtenCount;
    assert.equal(after - before, 3, 'a három láncszem hárommal emeli a szemszámot');
  });
});

/*
 * A láncalap szemszáma (PQW-942). A tulajdonos jelentése: „a kulcs/hiba akkor
 * van, amikor függőlegessé válik kettő vagy annál több szem.”
 *
 * Az 1. sor fordulólánca a láncalap SAJÁT láncszemeiből lesz: azok kikerülnek a
 * láncalapból, és függőlegesen állnak össze egy oszlopba. Az az oszlop a
 * láncalapé is, mert a fordulólánc talpa ott van — ezért a láncalap szemszáma a
 * megmaradt láncszemei plusz egy. A tulajdonos példája: „10 − 3 + 1 = 8”.
 */
describe('a láncalap szemszáma a fordulólánc oszlopával (PQW-942)', () => {
  /** A láncalap és a rá horgolt sor rétegei: `count` láncszem, egy erp a `cursor`. célpontba. */
  const rows = (chains, cursor) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: chains }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'dc', count: 1 }, cursor));
    const library = libraryFor(pattern);
    // A `computeLayers` a fordulóláncot nem adja vissza, ezért a teljes gráf kell.
    return { layers: buildPieceGraph(pattern, pattern.pieces[0], library).layers, pattern };
  };

  test('1. eset: 10 láncszem, a 3 láncszemes fordulólánc után a láncalap 8', () => {
    const { layers } = rows(10, 3);
    assert.equal(layers[1].turningChain.length, 3, 'három láncszem fordul függőlegesbe');
    assert.equal(layers[0].positionCount, 7, 'hét láncszem marad a láncalapban');
    assert.equal(layers[0].writtenCount, 8, '10 − 3 + 1');
  });

  test('2. eset: fordulólánc nélkül a láncalap a saját hosszát mondja', () => {
    const { layers } = rows(12, 0);
    assert.equal(layers[1].turningChain.length, 0, 'a sor a legutolsó láncszemben kezdődik');
    assert.equal(layers[0].writtenCount, 12);
  });

  test('3. eset: 12 láncszem, a 2 láncszemes fordulólánc után a láncalap 11', () => {
    const { layers } = rows(12, 2);
    assert.equal(layers[1].turningChain.length, 2);
    assert.equal(layers[0].writtenCount, 11, '12 − 2 + 1');
  });

  test('a fordulólánc egyetlen oszlopban áll, nem szétterítve', () => {
    const { pattern } = rows(10, 3);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const [, row] = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern)).layers;
    const columns = new Set(row.turningChain.map((id) => layout.nodes.get(id).top.x));
    assert.equal(columns.size, 1, 'a három láncszem egymás fölött');
  });
});

/*
 * A fordulás és a fordulólánc helye (PQW-944).
 *
 * A tulajdonos: „a program nyit egy új sort, aminek az elejére egy ilyen
 * lebegőként beletesz egy láncot. ez így nem jó, vedd ezt ki és a 3. sor
 * gridje jelenjen meg… a felhasználó első pálcatípusa fogja eldönteni, hogy mi
 * kerül a 3. sor első szemébe.”
 *
 * A döntése szerint a lánc az első szem HELYÉN áll, és a sor utolsó szeme az
 * előző sor fordulóláncának tetejébe megy — így az oszlopok fedik egymást, és
 * a szemszám sem fogy.
 */
describe('a fordulólánc az első szem helyén (PQW-944)', () => {
  const rows = (count) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 12 }, 0));
    for (let row = 1; row <= count; row += 1) {
      if (row > 1) pattern = ok(endRow(pattern));
      pattern = ok(fillRow(pattern, { def: 'sc', count: 1 }));
    }
    return pattern;
  };

  test('három sor után az oszlopok fedik egymást, és minden sor ugyanannyi szem', () => {
    const pattern = rows(3);
    const library = libraryFor(pattern);
    const layout = layoutPattern(pattern, library);
    const layers = buildPieceGraph(pattern, pattern.pieces[0], library).layers;
    const span = (layer) => {
      const xs = layer.stitches.map((id) => layout.nodes.get(id).top.x);
      return [Math.min(...xs), Math.max(...xs)];
    };
    assert.deepEqual(span(layers[2]), span(layers[1]), 'a 3. sor ugyanazokat az oszlopokat foglalja, mint a 2.');
    assert.deepEqual(span(layers[3]), span(layers[1]));
    assert.deepEqual(layers.map((layer) => layer.writtenCount), [11, 11, 11, 11]);
    assert.deepEqual(findings(pattern), []);
  });

  test('a sor utolsó szeme az előző sor fordulóláncának tetejébe megy, hiba nélkül', () => {
    const pattern = rows(3);
    const library = libraryFor(pattern);
    const layers = buildPieceGraph(pattern, pattern.pieces[0], library).layers;
    const top = layers[1].turningChain.at(-1);
    const last = pattern.pieces[0].stitches.find((node) => node.anchors.some((anchor) => anchor.id === top));
    assert.ok(last, 'van szem, ami a fordulólánc tetejébe horgol');
    assert.equal(layers[2].stitches.includes(last.id), true, 'a 3. sor szeme az');
    assert.deepEqual(findings(pattern), []);
  });

  test('a fordulás után a készülő sor rácsa teljes magasságú, lánc nélkül', () => {
    const two = rows(2);
    const turned = ok(endRow(two));
    assert.equal(turned.pieces[0].stitches.length, two.pieces[0].stitches.length, 'a fordulás nem tesz le láncszemet');
    const grid = chartGrid(turned, libraryFor(turned), 'rows', contextOf(turned), {});
    const working = grid.bands.find((band) => band.working);
    assert.ok(working, 'a készülő sornak van sávja');
    // A javítás előtt a lerakott lánc 11 képpontra nyomta össze ezt a sávot.
    assert.ok(working.area.y1 - working.area.y0 >= 24, `teljes magasságú sáv: ${working.area.y1 - working.area.y0}`);
    assert.equal(grid.cells.filter((cell) => cell.layer === working.layer).length, 11, 'mind a 11 cella megjelenik');
  });
});

/*
 * A frissen letett fordulólánc a helyén áll (PQW-946).
 *
 * A tulajdonos négy pontja a v0.35.0-ról: a lánc legalsó szeme rácsúszik az
 * alatta lévő sorra; a célpont pöttye ott marad a lánc celláján; a 3. sor
 * felirata csak a második szem után jelenik meg; és a lánc a rács elé csúszik,
 * amíg nincs mellette szem — így a cellája szabadnak látszik, pedig ott már van
 * egy öltés.
 */
describe('a fordulólánc a helyén áll, amint leteszik (PQW-946)', () => {
  /** 10 láncszem, kitöltött 2. sor pálcával, fordulás, majd az első szem. */
  const afterTurn = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def: 'dc', count: 1 }));
    return ok(endRow(pattern));
  };
  const place = (pattern) => ok(work(pattern, { def: 'dc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'dc')));

  test('a lánc rögtön a saját cellájába kerül, nem a rács elé', () => {
    const first = place(afterTurn());
    const library = libraryFor(first);
    const layout = layoutPattern(first, library);
    const grid = chartGrid(first, library, 'rows', contextOf(first), {});
    const chain = buildPieceGraph(first, first.pieces[0], library).layers[2].turningChain[0];
    const cell = grid.cells.filter((candidate) => candidate.layer === 2).find((candidate) => candidate.index === 0);
    const x = layout.nodes.get(chain).top.x;
    assert.ok(x > cell.area.x0 && x < cell.area.x1, `a lánc a sor első cellájában: ${x} ∉ (${cell.area.x0}, ${cell.area.x1})`);
  });

  /*
   * A JELÉVEL együtt kell beleférnie (PQW-947). A tulajdonos a v0.36.0-ról:
   * „nem annyira mint az előbb, de még mindig kilóg a 3. sor cellájából” — a
   * középpont a talpvonalon ült, a jel alsó fele pedig lelógott.
   */
  const fitsBand = (pattern, tool) => {
    const library = libraryFor(pattern);
    const layout = layoutPattern(pattern, library);
    const grid = chartGrid(pattern, library, 'rows', contextOf(pattern), {});
    const band = grid.bands.find((candidate) => candidate.layer === 2);
    for (const id of buildPieceGraph(pattern, pattern.pieces[0], library).layers[2].turningChain) {
      const node = layout.nodes.get(id);
      const bottom = node.top.y + node.size / 2;
      const top = node.top.y - node.size / 2;
      assert.ok(bottom <= band.area.y1, `${tool}: ${id} alja ${bottom.toFixed(1)} > a sáv alja ${band.area.y1.toFixed(1)}`);
      assert.ok(top >= band.area.y0, `${tool}: ${id} teteje ${top.toFixed(1)} < a sáv teteje ${band.area.y0.toFixed(1)}`);
    }
  };

  test('a lánc a jelével együtt a saját sávjában marad, mindhárom magasságnál', () => {
    for (const tool of ['sc', 'hdc', 'dc']) {
      let pattern = ok(work(emptyPattern(), { def: 'ch', count: 11 }, 0));
      pattern = ok(endRow(pattern));
      pattern = ok(fillRow(pattern, { def: tool, count: 1 }));
      pattern = ok(endRow(pattern));
      pattern = ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
      pattern = ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
      fitsBand(pattern, tool);
    }
  });

  test('a lánc cellája foglalt: nincs rajta szabad célpont', () => {
    const first = place(afterTurn());
    const context = contextOf(first);
    assert.equal(context.used[0], true, 'a fordulólánc helye foglalt');
    assert.equal(defaultCursor(first, context, 'dc'), 1, 'a kurzor a második célponton áll');
  });

  test('a sor felirata már a fordulólánctól látszik', () => {
    const first = place(afterTurn());
    const captions = rowCaptions(layoutPattern(first, libraryFor(first)), 'cyc').map((caption) => caption.text);
    assert.ok(captions.includes('3. sor (1)'), captions.join(' | '));
  });
});
