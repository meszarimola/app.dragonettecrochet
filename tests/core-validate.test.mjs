/*
 * Az ellenőrző: a tudásbázis kidolgozott példái hibátlanok, és minden
 * szándékosan elrontott változatukra pontosan a várt szabály jelez.
 */

import { strict as assert } from 'node:assert';
import { after, describe, test } from 'node:test';

import { RULES } from '../src/core/rules.ts';
import { validatePattern } from '../src/core/validate.ts';
import { editNode } from './fixtures/builder.ts';
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
