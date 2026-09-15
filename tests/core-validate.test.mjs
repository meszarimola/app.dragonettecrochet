/*
 * Az ellenőrző: a tudásbázis kidolgozott példái hibátlanok, és minden
 * szándékosan elrontott változatukra pontosan a várt szabály jelez.
 */

import { strict as assert } from 'node:assert';
import { after, describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { RULES } from '../src/core/rules.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { PieceBuilder, editNode, patternOf } from './fixtures/builder.ts';
import {
  WORKED_EXAMPLES,
  chevron,
  dcRectangle,
  grannySquare,
  hdcRectangle,
  shellStitch,
  vStitchPattern,
  wave,
} from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const tested = new Set();

/** A találatok szabályai; ha `nodes` meg van adva, a találatok érintett szemei is. */
function assertOnly(pattern, rule, nodes) {
  const findings = validatePattern(pattern, testLibrary);
  assert.deepEqual([...new Set(findings.map((finding) => finding.rule))], [rule], JSON.stringify(findings, null, 1));
  if (nodes) assert.deepEqual(findings.map((finding) => finding.nodes), nodes);
  for (const finding of findings) {
    assert.equal(finding.severity, RULES[rule].severity);
    assert.equal(finding.reference, RULES[rule].reference);
  }
  tested.add(rule);
  return findings;
}

describe('a kidolgozott példák gráfként hibátlanok', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    test(name, () => {
      assert.deepEqual(validatePattern(make().pattern, testLibrary), []);
    });
  }
});

describe('félpálcás téglalap, elrontva (03 §3.1 A)', () => {
  test('rossz láncalap: az első félpálca a 2. láncszembe megy a 3. helyett', () => {
    const example = hdcRectangle({ firstStitchFromHook: 2 });
    assertOnly(example.pattern, 'foundation-chain', [[...example.turningChains[1], example.rows[1][0]]]);
  });

  test('az 5. sor fordulólánca 1 láncszem 2 helyett: figyelmeztetés', () => {
    const example = hdcRectangle({ turningChain: { row: 5, chains: 1 } });
    assertOnly(example.pattern, 'turning-chain-height', [example.turningChains[5]]);
  });

  test('a 2. sor kihagyja az első szemet, és a következőbe szaporít', () => {
    const example = hdcRectangle({ row2SkipsFirst: true });
    assertOnly(example.pattern, 'unused-position', [[example.rows[1].at(-1)]]);
  });

  test('a 2. sor közepén egy szem kimarad: figyelmeztetés', () => {
    const example = hdcRectangle({ row2SkipsOneInMiddle: true });
    assertOnly(example.pattern, 'reach-single', [[example.rows[2][6], example.rows[2][7]]]);
  });

  test('a 3. sorban két szem célpontja fel van cserélve, jelölés nélkül', () => {
    const { pattern, rows } = hdcRectangle();
    const below = [...rows[2]].reverse();
    const swapped = editNode(editNode(pattern, rows[3][5], { anchors: [below[6]] }), rows[3][6], { anchors: [below[5]] });
    assertOnly(swapped, 'against-direction', [[rows[3][5], rows[3][6]]]);
  });

  test('ugyanez keresztezett szemként jelölve hibátlan (03 §10 C13)', () => {
    const { pattern, rows } = hdcRectangle();
    const below = [...rows[2]].reverse();
    let crossed = editNode(editNode(pattern, rows[3][5], { anchors: [below[6]] }), rows[3][6], { anchors: [below[5]] });
    crossed = {
      ...crossed,
      pieces: crossed.pieces.map((piece) => ({
        ...piece,
        stitches: piece.stitches.map((node) => (node.id === rows[3][6] ? { ...node, flags: ['crossed'] } : node)),
      })),
    };
    assert.deepEqual(validatePattern(crossed, testLibrary), []);
  });

  test('a 2. sor utolsó szeme a nem számító fordulóláncba megy', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const broken = editNode(pattern, rows[2].at(-1), { anchors: [turningChains[1][1]] });
    assertOnly(broken, 'turning-chain-placement', [[rows[2].at(-1), turningChains[1][1]]]);
  });

  test('lógó lánc: két láncszem az utolsó sor végén', () => {
    const example = hdcRectangle({ trailingChains: 2 });
    const stitches = example.pattern.pieces[0].stitches;
    assertOnly(example.pattern, 'floating-chain', [stitches.slice(-2).map((node) => node.id)]);
  });

  test('a rákhurok sora után még egy sor készül', () => {
    const example = hdcRectangle({ crabRow: 21 });
    const findings = assertOnly(example.pattern, 'unworkable-top');
    assert.deepEqual(
      findings.map((finding) => finding.nodes),
      example.rows[22].map((id) => [id]),
    );
  });
});

describe('pálcás téglalap, elrontva (03 §3.1 B)', () => {
  test('a 2. sor az alatta lévő szembe kezd, és kihagyja a fordulólánc tetejét', () => {
    const example = dcRectangle({ row2MissesTurningChain: true });
    assertOnly(example.pattern, 'turning-chain-placement', [[example.rows[2].at(-1), example.turningChains[1][2]]]);
  });

  test('a 2. sor egyik szeme a 3. sor szemébe van horgolva', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][3], { anchors: [rows[3][3]] }), 'future-anchor', [[rows[2][3]]]);
  });

  test('a 3. sor egyik szeme az 1. sorba megy, hosszú szemként jelölés nélkül', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[3][3], { anchors: [rows[1][3]] }), 'anchor-layer', [[rows[3][3]]]);
  });

  test('egy szem előző szeme nem a fonal útján előtte lévő', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { prev: rows[2][3] }), 'yarn-path', [[rows[2][5]]]);
  });

  test('nem létező szembe horgolás', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { anchors: ['nincs-ilyen'] }), 'dangling-reference', [[rows[2][5]]]);
  });

  test('a könyvtárban nem szereplő szem', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { def: 'hamispalca' }), 'unknown-stitch', [[rows[2][5]]]);
  });
});

describe('kagyló 6+1, elrontva (03 §4.2 E)', () => {
  test('az első ismétlés 3 láncszemet hagy ki 2 helyett', () => {
    assertOnly(shellStitch({ firstRepeatSkipsThree: true }).pattern, 'repeat-balance');
  });

  test('az első kagyló V-szemként van jelölve', () => {
    const example = shellStitch({ firstShellDef: 'v-st-dc' });
    assertOnly(example.pattern, 'group-mismatch', [example.rows[1].slice(1, 6)]);
  });
});

describe('V-szem, elrontva (03 §4.2 F)', () => {
  test('az első V két pálcája egy szemben, csoport nélkül', () => {
    const example = vStitchPattern({ firstVUngrouped: true });
    assertOnly(example.pattern, 'unmarked-increase', [[example.rows[1][1], example.rows[1][3]]]);
  });
});

describe('cikcakk, elrontva (03 §4.2 G)', () => {
  test('a völgyben összehorgolás helyett 2 kihagyott szem és egy pálca', () => {
    const { pattern, valley } = chevron();
    const broken = editNode(pattern, valley.node, { def: 'dc', anchors: [valley.targets[2]] });
    assertOnly(broken, 'reach', [[valley.before, valley.node]]);
  });

  test('a völgy három célpontja egy sima pálcán, fogyasztásként jelölés nélkül', () => {
    const { pattern, valley } = chevron();
    assertOnly(editNode(pattern, valley.node, { def: 'dc' }), 'unmarked-decrease', [[valley.node]]);
  });

  test('a völgy két pálca összehorgolása, de három célponttal', () => {
    const { pattern, valley } = chevron();
    assertOnly(editNode(pattern, valley.node, { def: 'dc2tog' }), 'anchor-count', [[valley.node]]);
  });
});

describe('hullám, elrontva (03 §2.3)', () => {
  test('a 3. sor is rövidpálca, az 1. sor hullámát semmi nem egyenlíti ki: figyelmeztetés', () => {
    const example = wave({ flatRow3: true });
    assertOnly(example.pattern, 'mixed-heights', [example.rows[1]]);
  });
});

describe('nagymama-négyzet, elrontva (03 §8)', () => {
  test('a 2. kör végén a láncívek nélkül számolt szemszám (24 a 36 helyett, PQW-870)', () => {
    const example = grannySquare({ round2StatedCount: 24 });
    assertOnly(example.pattern, 'stated-count', [[example.rows[2].at(-1)]]);
  });

  test('a 2. kör záró kúszószeme az első pálcába megy a kezdőlánc teteje helyett', () => {
    const example = grannySquare({ round2JoinsFirstDc: true });
    assertOnly(example.pattern, 'round-join', [[example.rows[2].at(-1)]]);
  });
});

/* ---- Körök (PQW-861) ---- */

/** Rövidpálcás kör varázskörből, zárt körökkel: az 1. kör 6 szem, utána körönként a megadott horgolás. */
function scRounds(...rounds) {
  const b = new PieceBuilder('p1', 'Kör');
  const ring = b.ring();
  b.chain(1);
  let below = Array.from({ length: 6 }, () => b.stitch('sc', { ring }));
  b.stitch('sl-st', below[0]);
  b.event('join-slip');
  for (const round of rounds) {
    b.chain(1);
    const next = round(b, below);
    b.stitch('sl-st', next[0]);
    b.event('join-slip');
    below = next;
  }
  return patternOf('Kör', [b.build()]);
}
const increaseEach = (b, below) => below.flatMap((target) => b.inSame('inc-2sc', ['sc', 'sc'], target));
const plainEach = (b, below) => below.map((target) => b.stitch('sc', target));
const byThree = (b, below) => Array.from({ length: below.length / 3 }, (_, i) => b.stitch('sc3tog', ...below.slice(3 * i, 3 * i + 3)));
const motif = (patch) => generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, ...patch }).pattern;

describe('körök, elrontva (04 §2, §3.2, §8, §9, PQW-861)', () => {
  test('a generált lapos kör eltolt szaporítással hibátlan', () => {
    assert.deepEqual(validatePattern(motif({ rounds: 8 }), testLibrary), []);
  });

  test('egy körben a felénél kevesebb szem marad: 12-ből 4', () => {
    assertOnly(scRounds(increaseEach, byThree), 'round-growth');
  });

  test('két körön át szaporítás nélkül: kunkorodik', () => {
    assertOnly(scRounds(increaseEach, plainEach, plainEach), 'round-cupping');
  });

  test('egy kör szaporítás nélkül még nem kunkorodás', () => {
    assert.deepEqual(validatePattern(scRounds(increaseEach, plainEach), testLibrary), []);
  });

  test('a lapos érték kétszerese egy körben: fodrosodik', () => {
    assertOnly(scRounds(increaseEach, increaseEach), 'round-ruffling');
  });

  test('eltolás nélkül a szaporítások a 3–5. körben egymás fölé kerülnek; a 4. körig még nem jelez', () => {
    assertOnly(motif({ rounds: 5, stagger: false }), 'stacked-increases');
    assert.deepEqual(validatePattern(motif({ rounds: 4, stagger: false }), testLibrary), []);
  });

  test('spirálban színváltás lépcsőjavítás nélkül; javítással nem jelez', () => {
    assertOnly(motif({ rounds: 4, closing: 'spiral', colorEvery: 2 }), 'spiral-color-jog');
    assert.deepEqual(validatePattern(motif({ rounds: 4, closing: 'spiral', colorEvery: 2, jogFix: 'back-loop' }), testLibrary), []);
  });

  test('sokszögben a sarkok szándékosan egymás fölött vannak: nem jelez', () => {
    for (const shape of ['square', 'hexagon', 'octagon', 'granny-square']) {
      const pattern = motif({ shape, rounds: 6 });
      assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), [], shape);
    }
  });
});

/* ---- Amigurumi (PQW-863) ---- */

/** Fej (6 cm-es gömb) és test (5 cm-es henger, nyitott tetővel) varrva, egyenletes elosztással: 28 szem a 30-ra. */
function headAndBody(under3 = false) {
  const head = createAmigurumi(emptyPattern(), { name: 'Fej', shape: { kind: 'sphere', diameterCm: 6, method: '6n' }, stagger: true, eyes: true }, under3);
  const body = { name: 'Test', shape: { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' }, stagger: true, eyes: false };
  return addAmigurumiPart(head.pattern, body, { method: 'sewn', distribute: true }, under3).pattern;
}

describe('amigurumi, elrontva (04 §5.4, §5.7, PQW-863)', () => {
  test('a generált fej-test figura elosztással hibátlan, 3 év alatti gyereknek is', () => {
    assert.deepEqual(validatePattern(headAndBody(), testLibrary), []);
    assert.deepEqual(validatePattern(headAndBody(true), testLibrary), []);
  });

  test('a két összevarrt szél szemszáma eltér, és nincs elosztás', () => {
    const pattern = headAndBody();
    const { distribution: _distribution, ...join } = pattern.joins[0];
    assertOnly({ ...pattern, joins: [join] }, 'join-count');
  });

  test('az összevarrás nem létező körre mutat', () => {
    const pattern = headAndBody();
    assertOnly({ ...pattern, joins: [{ ...pattern.joins[0], b: { piece: 'p1', layer: 40 } }] }, 'join-edge');
  });

  test('3 év alatti gyereknek szánt játékban biztonsági szem', () => {
    assertOnly({ ...headAndBody(), toy: { under3: true } }, 'toy-safety-eyes');
  });
});

describe('a megadott szemszám a láncszemek számolása szerint (03 §10 B10, PQW-870)', () => {
  const withChainCounts = (example, chainCounts) => ({ ...example.pattern, conventions: { ...example.pattern.conventions, chainCounts } });

  test('ha egyik láncszem sem számít, az 1. sor láncívekkel megadott szemszáma hibás', () => {
    const example = vStitchPattern();
    assertOnly(withChainCounts(example, false), 'stated-count', [[example.rows[1].at(-1)]]);
  });

  test('ha minden láncszem számít, az utolsó sor díszívek nélkül megadott szemszáma hibás', () => {
    const example = vStitchPattern();
    assertOnly(withChainCounts(example, true), 'stated-count', [[example.rows[2].at(-1)]]);
  });
});

describe('a szem által nem engedett beszúrási mód (01 §4.3, PQW-869)', () => {
  test('a befejező rákhurok-sor hátsó szálba', () => {
    const example = hdcRectangle({ rows: 3, crabRow: 3 });
    const id = example.rows[3][0];
    const node = example.pattern.pieces[0].stitches.find((candidate) => candidate.id === id);
    const pattern = editNode(example.pattern, id, { anchors: node.anchors.map((anchor) => ({ ...anchor, mode: 'back-loop' })) });
    assertOnly(pattern, 'insertion-mode', [[id]]);
  });
});

test('minden szabálynak van tudásbázis-hivatkozása', () => {
  for (const [rule, def] of Object.entries(RULES)) {
    assert.match(def.reference, /^0[1-6] §\d/, `${rule}: hiányzó vagy hibás hivatkozás`);
    assert.ok(def.summary.trim(), `${rule}: hiányzó leírás`);
  }
});

test('minden szabály felhasználói üzenete a „szem” szóval, belső fogalom és tudásbázis-kód nélkül (PQW-879)', () => {
  for (const [rule, def] of Object.entries(RULES)) {
    assert.ok(def.message.trim(), `${rule}: hiányzó felhasználói üzenet`);
    // A főszövegben nincs „réteg”, „darab”, sem tudásbázis-kód (§ vagy 0X-jelölés).
    assert.doesNotMatch(def.message, /réteg|darab|§|\b0[1-6] /i, `${rule}: az üzenet belső fogalmat vagy tudásbázis-kódot tartalmaz`);
  }
});

after(() => {
  // Minden szabályhoz van legalább egy elrontott példa.
  assert.deepEqual([...tested].sort(), Object.keys(RULES).sort());
});
