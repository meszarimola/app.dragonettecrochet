/*
 * Az ellenőrző: a tudásbázis kidolgozott példái hibátlanok, és minden
 * szándékosan elrontott változatukra pontosan a várt szabály jelez.
 */

import { strict as assert } from 'node:assert';
import { after, describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { borderLayerIndex } from '../src/core/border.ts';
import { generateColorwork } from '../src/core/colorwork.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { RULES } from '../src/core/rules.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
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
function assertOnly(pattern, rule, nodes, library = testLibrary) {
  const findings = validatePattern(pattern, library);
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

/** A következő sor célpontjai sorrendben: a fordulólánc alatti szem kimarad, az utolsó a fordulólánc teteje (PQW-891). */
const targetsOf = (row, turningChain) => [...[...row].reverse().slice(1), turningChain.at(-1)];

describe('félpálcás téglalap, elrontva (03 §3.1 A)', () => {
  test('rossz láncalap: az első félpálca a 3. láncszembe megy a 4. helyett', () => {
    // A számító fordulólánc alapláncszemen áll (PQW-891): a 3. láncszemnél 1 láncszem marad fordulóláncnak.
    const example = hdcRectangle({ firstStitchFromHook: 3 });
    assertOnly(example.pattern, 'foundation-chain', [[...example.turningChains[1], example.rows[1][0]]]);
  });

  test('az 5. sor fordulólánca 1 láncszem 2 helyett: figyelmeztetés', () => {
    const example = hdcRectangle({ turningChain: { row: 5, chains: 1 } });
    assertOnly(example.pattern, 'turning-chain-height', [example.turningChains[5]]);
  });

  test('a 2. sor kihagyja az első szemet, és a következőbe szaporít', () => {
    const example = hdcRectangle({ row2SkipsFirst: true });
    // Az 1. sor utolsó szeme a 2. sor fordulólánca alatt kimaradhat; az első horgolandó az utolsó előtti.
    assertOnly(example.pattern, 'unused-position', [[example.rows[1].at(-2)]]);
  });

  test('a 2. sor közepén egy szem kimarad: figyelmeztetés', () => {
    const example = hdcRectangle({ row2SkipsOneInMiddle: true });
    assertOnly(example.pattern, 'reach-single', [[example.rows[2][6], example.rows[2][7]]]);
  });

  test('a 3. sorban két szem célpontja fel van cserélve, jelölés nélkül', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const below = targetsOf(rows[2], turningChains[2]);
    const swapped = editNode(editNode(pattern, rows[3][5], { anchors: [below[6]] }), rows[3][6], { anchors: [below[5]] });
    assertOnly(swapped, 'against-direction', [[rows[3][5], rows[3][6]]]);
  });

  test('ugyanez keresztezett szemként jelölve hibátlan (03 §10 C13)', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const below = targetsOf(rows[2], turningChains[2]);
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

  test('a 2. sor utolsó szeme a fordulólánc alsó láncszemébe megy a teteje helyett', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const broken = editNode(pattern, rows[2].at(-1), { anchors: [turningChains[1][0]] });
    assertOnly(broken, 'turning-chain-placement', [[rows[2].at(-1), turningChains[1][0]]]);
  });

  test('lógó lánc: két láncszem az utolsó sor végén', () => {
    const example = hdcRectangle({ trailingChains: 2 });
    const stitches = example.pattern.pieces[0].stitches;
    assertOnly(example.pattern, 'floating-chain', [stitches.slice(-2).map((node) => node.id)]);
  });

  test('a rákhurok sora után még egy sor készül', () => {
    const example = hdcRectangle({ crabRow: 21 });
    const findings = assertOnly(example.pattern, 'unworkable-top');
    // A 22. sor utolsó szeme a 21. sor fordulóláncának tetejébe megy, abba lehet horgolni (PQW-891).
    assert.deepEqual(
      findings.map((finding) => finding.nodes),
      example.rows[22].slice(0, -1).map((id) => [id]),
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

describe('rácsos technikák (PQW-864)', () => {
  test('tapestryben egy sorban 4 szín: figyelmeztetés a vitt színekre (03 §10 G36)', () => {
    const colors = ['Fehér', 'Piros', 'Kék', 'Zöld'].map((name) => ({ name, hex: '#000000' }));
    const cells = [
      [0, 1, 2, 3],
      [0, 0, 1, 1],
    ];
    const result = generateColorwork(emptyPattern(), { technique: 'tapestry', cells, colors, unit: null, lettering: false });
    assert.ok(result.ok, result.reason);
    assertOnly(result.pattern, 'carried-colors');
  });
});

describe('szegély a darab körül (03 §7.1, §10 H38, PQW-889)', () => {
  const bordered = () => {
    const result = generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 5, heightCm: 4, border: { stitch: 'sc', hdcRowEnd: 2 } });
    assert.ok(result.ok, result.reason);
    return result.pattern;
  };

  /** Egy szegélyszem elhagyva: a fonal útja, a csoportja és a kör megadott szemszáma igazodik, így csak a szegély szabálya jelez. */
  const without = (pattern, id) => {
    const piece = pattern.pieces[0];
    const removed = piece.stitches.find((node) => node.id === id);
    const stitches = piece.stitches.filter((node) => node !== removed).map((node) => (node.prev === id ? { ...node, prev: removed.prev } : node));
    const groups = piece.groups.flatMap((group) => {
      if (!group.members.includes(id)) return [group];
      const members = group.members.filter((member) => member !== id);
      return members.length < 2 ? [] : [{ ...group, def: group.def.replace(/^inc-\d+/, `inc-${members.length}`), members }];
    });
    const events = piece.events.map((event, i) => (i === piece.events.length - 1 ? { ...event, statedCount: event.statedCount - 1 } : event));
    return { ...pattern, pieces: [{ ...piece, stitches, groups, events }] };
  };
  const borderLayer = (pattern) => {
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    return { graph, layer: graph.layers[borderLayerIndex(graph)] };
  };

  test('a generált szegélyes téglalap hibátlan', () => {
    const pattern = bordered();
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
  });

  test('egy félpálcás sorvégbe 2 helyett 1 rp: figyelmeztetés a sorvégi arányra', () => {
    const pattern = bordered();
    const { graph, layer } = borderLayer(pattern);
    const sides = layer.stitches.filter((id) => graph.nodes.get(id).anchors[0]?.into === 'row-end');
    const broken = without(pattern, sides[1]);
    assertOnly(broken, 'border-row-end', [[sides[0]]], libraryFor(broken));
  });

  test('egy sarokba 3 helyett 2 rp: figyelmeztetés a sarokra', () => {
    const pattern = bordered();
    const { layer } = borderLayer(pattern);
    const corner = pattern.pieces[0].groups.find((group) => group.members.every((id) => layer.stitches.includes(id)));
    const broken = without(pattern, corner.members[2]);
    assertOnly(broken, 'border-corner', [corner.members.slice(0, 2)], libraryFor(broken));
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
