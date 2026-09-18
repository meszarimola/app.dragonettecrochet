/*
 * A tudásbázis kidolgozott példái szemgráfként.
 *
 * Mindegyik függvény a mintát és a szemek azonosítóit adja vissza, hogy a
 * tesztek célzottan elronthassák. A beállítások a szerkezetet változtató
 * hibákhoz kellenek; a célpontot vagy szemet cserélő hibák az `editNode`-dal
 * készülnek.
 */

import type { NodeId, Pattern, SpaceId } from '../../src/core/types.ts';
import { PieceBuilder, patternOf, type Target } from './builder.ts';

export interface Example {
  readonly pattern: Pattern;
  /** Soronként vagy körönként a szemek (fordulólánc nélkül) a fonal sorrendjében; a 0. elem a láncalap. */
  readonly rows: readonly (readonly NodeId[])[];
  /** Soronként a fordulólánc vagy kezdőlánc; a 0. elem üres. */
  readonly turningChains: readonly (readonly NodeId[])[];
}

/*
 * ---- 03 §3.1 A: félpálcás téglalap, 15 szem × 22 sor ----
 * A javított szabály szerint (PQW-891): a 2 láncszemes fordulólánc az 1. félpálca
 * helyett áll, egy alapláncszemen; az 1. sor a horogtól számított 4. láncszembe
 * kezd, a sorok utolsó szeme az előző fordulólánc tetejébe megy.
 */

export interface HdcRectangleOptions {
  readonly rows?: number;
  /** Hányadik láncszembe megy az 1. sor első szeme a horogtól; helyesen a 4. */
  readonly firstStitchFromHook?: number;
  /** Egy sor fordulóláncának hossza; helyesen 2. */
  readonly turningChain?: { readonly row: number; readonly chains: number };
  /** A 2. sor az első szemet kihagyja, és a következőbe két félpálcát horgol. */
  readonly row2SkipsFirst?: boolean;
  /** A 2. sor KÉT szemet hagy ki az elején: az egyiket a fordulólánc állja, a másik tényleg kimarad. */
  readonly row2SkipsTwo?: boolean;
  /** A 2. sor közepén egy szem kimarad, a sor végén szaporítás pótolja. */
  readonly row2SkipsOneInMiddle?: boolean;
  /** Ebben a sorban rákhurok készül félpálca helyett. */
  readonly crabRow?: number;
  /** Láncszemek az utolsó sor végén, a fonal elvágása előtt. */
  readonly trailingChains?: number;
}

export function hdcRectangle(options: HdcRectangleOptions = {}): Example {
  const stitches = 15;
  const rowCount = options.rows ?? 22;
  const b = new PieceBuilder('p1', 'Félpálcás téglalap');
  // Minden szem a láncalap egy-egy láncszemébe megy; a fordulólánc a sor első szeme (PQW-940).
  const worked = stitches;
  /** A kiírt szemszám: a belehorgolt szemek és a fordulólánc (PQW-940). */
  const stated = stitches + 1;
  const fromHook = options.firstStitchFromHook ?? 3;
  const foundation = b.chain(worked + fromHook - 1);
  const rows: NodeId[][] = [foundation.slice(0, worked)];
  const turningChains: NodeId[][] = [[]];

  let row: NodeId[] = [];
  for (let i = worked - 1; i >= 0; i -= 1) row.push(b.stitch('hdc', foundation[i]!));
  rows.push(row);
  turningChains.push(foundation.slice(worked));
  b.event('turn', stated);

  for (let r = 2; r <= rowCount; r += 1) {
    const def = r === options.crabRow ? 'rev-sc' : 'hdc';
    const chains = options.turningChain?.row === r ? options.turningChain.chains : def === 'rev-sc' ? 1 : 2;
    const turning = b.chain(chains);
    turningChains.push(turning);
    /*
     * A kidolgozott példa a PQW-944 ELŐTTI szerkezetet őrzi: a sor az alatta
     * lévő sor minden szemébe horgol, a fordulólánc pedig a szövet mellett
     * áll. A szerkesztő ma már a fordulóláncot az első szem helyére teszi; a
     * példák és a generátorok átállítása külön feladat (PQW-945).
     */
    const targets = [...row].reverse();
    if (r === 2 && options.row2SkipsTwo) {
      row = [
        ...b.inSame('inc-2hdc', ['hdc', 'hdc'], targets[2]!),
        ...targets.slice(3, -1).map((t) => b.stitch('hdc', t)),
        // A szemszám a szaporításokkal kijön; csak a kihagyott pozíció marad hiba.
        ...b.inSame('inc-2hdc', ['hdc', 'hdc'], targets.at(-1)!),
      ];
    } else if (r === 2 && options.row2SkipsFirst) {
      row = [...b.inSame('inc-2hdc', ['hdc', 'hdc'], targets[1]!), ...targets.slice(2).map((t) => b.stitch('hdc', t))];
    } else if (r === 2 && options.row2SkipsOneInMiddle) {
      row = [
        ...targets.slice(0, 7).map((t) => b.stitch('hdc', t)),
        ...targets.slice(8, -1).map((t) => b.stitch('hdc', t)),
        ...b.inSame('inc-2hdc', ['hdc', 'hdc'], targets.at(-1)!),
      ];
    } else {
      row = targets.map((t) => b.stitch(def, t));
    }
    rows.push(row);
    if (r === rowCount) {
      if (options.trailingChains) b.chain(options.trailingChains);
      // A lógó lánc is szem (PQW-940): a kiírt szemszám vele együtt értendő.
      b.event('fasten-off', stated + (options.trailingChains ?? 0));
    } else {
      b.event('turn', stated);
    }
  }
  return { pattern: patternOf('Félpálcás téglalap (03 §3.1 A)', [b.build()]), rows, turningChains };
}

/*
 * ---- 03 §3.1 B: pálcás téglalap, 16 szem × 16 sor ----
 * A pálcánál 3 láncszemet hagyunk ki (PQW-924): 19 láncszem, az 1. sor a
 * horogtól számított 4. láncszembe kezd, és onnantól minden láncszembe egy
 * pálca megy — így lesz 16 szem.
 */

export interface DcRectangleOptions {
  readonly rows?: number;
  /** A 2. sor kihagyja az előző sor első szemét: attól egy szem kimarad a sorból. */
  readonly row2SkipsFirst?: boolean;
}

export function dcRectangle(options: DcRectangleOptions = {}): Example {
  const stitches = 16;
  const rowCount = options.rows ?? 16;
  const b = new PieceBuilder('p1', 'Pálcás téglalap');
  /** A kiírt szemszám: a belehorgolt szemek és a fordulólánc (PQW-940). */
  const stated = stitches + 1;
  const foundation = b.chain(stitches + 3);
  const rows: NodeId[][] = [foundation.slice(0, stitches)];
  const turningChains: NodeId[][] = [[]];

  let row: NodeId[] = [];
  for (let i = stitches - 1; i >= 0; i -= 1) row.push(b.stitch('dc', foundation[i]!));
  rows.push(row);
  turningChains.push(foundation.slice(stitches));
  b.event('turn', stated);

  for (let r = 2; r <= rowCount; r += 1) {
    const chains = b.chain(3);
    turningChains.push(chains);
    // Az előző sor minden szemébe megy egy pálca; a fordulólánc nem célpont (PQW-924).
    const below = [...row].reverse();
    const targets = r === 2 && options.row2SkipsFirst ? below.slice(1) : below;
    row = targets.map((t) => b.stitch('dc', t));
    rows.push(row);
    // A bejelentett szemszám a sor tényleges hossza és a fordulólánc: kihagyásnál eggyel kevesebb.
    b.event(r === rowCount ? 'fasten-off' : 'turn', row.length + 1);
  }
  return { pattern: patternOf('Pálcás téglalap (03 §3.1 B)', [b.build()]), rows, turningChains };
}

/* ---- 03 §4.2 E: kagyló, 6 többszöröse + 1 (+1 fordulólánc) ---- */

export interface ShellOptions {
  readonly repeats?: number;
  /** Az első ismétlésben 3 láncszemet hagy ki 2 helyett. */
  readonly firstRepeatSkipsThree?: boolean;
  /** Az első kagyló csoportjának definíciója; helyesen `shell-5dc`. */
  readonly firstShellDef?: string;
}

export function shellStitch(options: ShellOptions = {}): Example {
  const n = options.repeats ?? 3;
  const worked = 6 * n + 1 + (options.firstRepeatSkipsThree ? 1 : 0);
  const b = new PieceBuilder('p1', 'Kagylóminta');
  const foundation = b.chain(worked + 1);
  const at = (j: number) => foundation[worked - 1 - j]!;

  const row1: NodeId[] = [b.stitch('sc', at(0))];
  let j = 0;
  for (let rep = 0; rep < n; rep += 1) {
    j += rep === 0 && options.firstRepeatSkipsThree ? 4 : 3;
    const shell = b.inSame('shell-5dc', ['dc', 'dc', 'dc', 'dc', 'dc'], at(j));
    row1.push(...shell);
    j += 3;
    row1.push(b.stitch('sc', at(j)));
  }
  // A fordulólánc egyik sorban sem szem (PQW-924): nincs soronkénti felülírás.
  b.event('turn', 6 * n + 1);

  const chains = b.chain(3);
  const q = [...row1].reverse();
  // A sort kezdő fordulólánc nem szem (PQW-924), ezért a szaporítás adja a három pálcát.
  const row2: NodeId[] = [...b.inSame('inc-3dc', ['dc', 'dc', 'dc'], q[0]!)];
  for (let rep = 0; rep < n - 1; rep += 1) {
    row2.push(b.stitch('sc', q[3 + 6 * rep]!));
    row2.push(...b.inSame('shell-5dc', ['dc', 'dc', 'dc', 'dc', 'dc'], q[6 + 6 * rep]!));
  }
  row2.push(b.stitch('sc', q[6 * n - 3]!));
  row2.push(...b.inSame('inc-3dc', ['dc', 'dc', 'dc'], q[6 * n]!));
  b.event('fasten-off', 6 * n + 1);

  let piece = b.build();
  if (options.firstShellDef) {
    piece = { ...piece, groups: piece.groups.map((g, i) => (i === 0 ? { ...g, def: options.firstShellDef! } : g)) };
  }
  return {
    pattern: patternOf('Kagylóminta (03 §4.2 E)', [piece], {
      turningChainCounts: false,
      repeat: { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false },
    }),
    rows: [foundation.slice(0, worked), row1, row2],
    turningChains: [[], foundation.slice(worked), chains],
  };
}

/* ---- 03 §4.2 F: V-szem, 3 többszöröse + 2, a fordulólánc nem számít ---- */

export interface VStitchOptions {
  readonly repeats?: number;
  /** Az első V-szem két pálcája nincs csoportként jelölve. */
  readonly firstVUngrouped?: boolean;
}

export function vStitchPattern(options: VStitchOptions = {}): Example {
  const n = options.repeats ?? 4;
  const worked = 3 * n + 2;
  const b = new PieceBuilder('p1', 'V-szem');
  const foundation = b.chain(worked + 3);
  const at = (j: number) => foundation[worked - 1 - j]!;

  const vs: SpaceId[] = [];
  const v = (target: Target, grouped: boolean) => {
    const first = b.stitch('dc', target);
    const middle = b.stitch('ch');
    const last = b.stitch('dc', target);
    if (grouped) b.group('v-st-dc', [first, middle, last]);
    vs.push(b.space([middle]));
    return [first, middle, last];
  };

  const row1: NodeId[] = [b.stitch('dc', at(0))];
  for (let rep = 0; rep < n; rep += 1) row1.push(...v(at(2 + 3 * rep), !(rep === 0 && options.firstVUngrouped)));
  row1.push(b.stitch('dc', at(3 * n + 1)));
  // Az 1. sor láncíveibe a 2. sor horgol, ezért a láncszemeik beleszámítanak (PQW-870).
  b.event('turn', 3 * n + 2);

  const chains = b.chain(3);
  const q = [...row1].reverse();
  const row2: NodeId[] = [b.stitch('dc', q[0]!)];
  for (const space of vs.slice(0, n).reverse()) row2.push(...v({ space }, true));
  row2.push(b.stitch('dc', q[3 * n + 1]!));
  // A 2. sor láncívei is szemek: a láncszem szem (PQW-940).
  b.event('fasten-off', 3 * n + 2);

  return {
    pattern: patternOf('V-szem (03 §4.2 F)', [b.build()], {
      turningChainCounts: false,
      repeat: { repeatWidth: 3, edgeStitches: 2, turningChainIncluded: false },
    }),
    rows: [foundation.slice(0, worked), row1, row2],
    turningChains: [[], foundation.slice(worked), chains],
  };
}

/* ---- 03 §4.2 G: cikcakk erp-vel, 4-es távolság, ismétlés 2·4 + 4 = 12, szélén fél völgy ---- */

export interface ChevronExample extends Example {
  /** A 2. sor első teljes völgye (3 pálca összehorgolva) és a három célpontja. */
  readonly valley: { readonly node: NodeId; readonly targets: readonly NodeId[]; readonly before: NodeId };
}

export function chevron(repeats = 2): ChevronExample {
  const spacing = 4;
  const width = (2 * spacing + 4) * repeats + 1;
  const b = new PieceBuilder('p1', 'Cikcakk');
  const foundation = b.chain(width + 3);

  let valley: ChevronExample['valley'] | undefined;
  const workRow = (targets: readonly NodeId[], rowIndex: number) => {
    const nodes: NodeId[] = [];
    let j = 0;
    const plain = () => {
      for (let i = 0; i < spacing; i += 1) nodes.push(b.stitch('dc', targets[j++]!));
    };
    nodes.push(b.stitch('dc2tog', targets[j]!, targets[j + 1]!));
    j += 2;
    for (let rep = 0; rep < repeats; rep += 1) {
      if (rep > 0) {
        const three = targets.slice(j, j + 3);
        const node = b.stitch('dc3tog', ...three);
        if (rowIndex === 2 && !valley) valley = { node, targets: three, before: nodes[nodes.length - 1]! };
        nodes.push(node);
        j += 3;
      }
      plain();
      nodes.push(...b.inSame('inc-3dc', ['dc', 'dc', 'dc'], targets[j++]!));
      plain();
    }
    nodes.push(b.stitch('dc2tog', targets[j]!, targets[j + 1]!));
    return nodes;
  };

  const worked = foundation.slice(0, width);
  const row1 = workRow([...worked].reverse(), 1);
  b.event('turn', width);
  const chains = b.chain(3);
  const row2 = workRow([...row1].reverse(), 2);
  b.event('fasten-off', width);

  return {
    pattern: patternOf('Cikcakk (03 §4.2 G)', [b.build()], {
      turningChainCounts: false,
      repeat: { repeatWidth: 2 * spacing + 4, edgeStitches: 1, turningChainIncluded: false },
    }),
    rows: [worked, row1, row2],
    turningChains: [[], foundation.slice(width), chains],
    valley: valley!,
  };
}

/* ---- 03 §2.3: hullám, 8 többszöröse + 2, három sor ---- */

export interface WaveOptions {
  readonly repeats?: number;
  /** A 3. sor is csupa rövidpálca, így nem egyenlíti ki az 1. sort. */
  readonly flatRow3?: boolean;
}

export function wave(options: WaveOptions = {}): Example {
  const n = options.repeats ?? 2;
  const width = 8 * n + 2;
  const repeat = (unit: readonly string[]) => Array.from({ length: n }, () => unit).flat();
  const heights1 = ['sc', 'sc', ...repeat(['hdc', 'dc', 'tr', 'tr', 'dc', 'hdc', 'sc', 'sc'])];
  const heights3 = ['tr', 'tr', ...repeat(['dc', 'hdc', 'sc', 'sc', 'hdc', 'dc', 'tr', 'tr'])];

  const b = new PieceBuilder('p1', 'Hullám');
  const foundation = b.chain(width + 1);
  const row1 = heights1.map((def, j) => b.stitch(def, foundation[width - 1 - j]!));
  b.event('turn', width);

  const chains2 = b.chain(1);
  const row2 = [...row1].reverse().map((t) => b.stitch('sc', t));
  // A fordulólánc egyik sorban sem szem (PQW-924): nincs soronkénti felülírás.
  b.event('turn', width);

  const q = [...row2].reverse();
  let chains3: NodeId[];
  let row3: NodeId[];
  if (options.flatRow3) {
    chains3 = b.chain(1);
    row3 = q.map((t) => b.stitch('sc', t));
  } else {
    chains3 = b.chain(4);
    // A fordulólánc nem szem (PQW-924): a 3. sor is az előző sor minden szemébe horgol.
    row3 = heights3.map((def, j) => b.stitch(def, q[j]!));
  }
  b.event('fasten-off', width);

  return {
    pattern: patternOf('Hullám (03 §2.3)', [b.build()], {
      turningChainCounts: false,
      repeat: { repeatWidth: 8, edgeStitches: 2, turningChainIncluded: false },
    }),
    rows: [foundation.slice(0, width), row1, row2, row3],
    turningChains: [[], foundation.slice(width), chains2, chains3],
  };
}

/* ---- 03 §8: nagymama-négyzet 1–3. köre, oldalt 1, a sarkokban 2 láncszemes ív ---- */

export interface GrannyOptions {
  /** A 2. kör megadott szemszáma; helyesen 36, mert a 3. kör minden ívébe horgol (PQW-870). */
  readonly round2StatedCount?: number;
  /** A 2. kör záró kúszószeme a kör első pálcájába megy a kezdőlánc teteje helyett. */
  readonly round2JoinsFirstDc?: boolean;
}

export function grannySquare(options: GrannyOptions = {}): Example {
  const b = new PieceBuilder('p1', 'Nagymama-négyzet');
  const ring = b.ring();

  const cluster = (target: Target, count = 3) => Array.from({ length: count }, () => b.stitch('dc', target));

  // 1. kör: 3 lsz (1 erp), 2 erp, 2 lsz, (3 erp, 2 lsz) ×3, kúszószem a kezdőlánc tetejébe.
  const tc1 = b.chain(3);
  const r1: NodeId[] = [...cluster({ ring }, 2)];
  const corners1: SpaceId[] = [b.chainSpace(2)];
  for (let i = 0; i < 3; i += 1) {
    r1.push(...cluster({ ring }));
    corners1.push(b.chainSpace(2));
  }
  r1.push(b.stitch('sl-st', tc1[2]!));
  // 12 pálca és a sarkok 8 láncszeme, mert a 2. kör a sarokívekbe horgol (PQW-870).
  b.event('join-slip', 20);

  // Egy kör 2. köre és a továbbiak: kúszószemmel a sarokívhez, 3 lsz, és minden ívbe a megfelelő csoport.
  const round = (firstDcs: readonly NodeId[], corners: readonly SpaceId[], sides: readonly SpaceId[]) => {
    const nodes = [b.stitch('sl-st', firstDcs[0]!), b.stitch('sl-st', firstDcs[1]!), b.stitch('sl-st', { space: corners[0]! })];
    const chains = b.chain(3);
    const newCorners: SpaceId[] = [];
    const newSides: SpaceId[] = [];
    const firstDc: NodeId[] = [];
    corners.forEach((corner, i) => {
      const before = i === 0 ? cluster({ space: corner }, 2) : cluster({ space: corner });
      if (i === 0) firstDc.push(...before);
      nodes.push(...before);
      newCorners.push(b.chainSpace(2));
      nodes.push(...cluster({ space: corner }));
      newSides.push(b.chainSpace(1));
      const side = sides[i];
      if (side) {
        nodes.push(...cluster({ space: side }));
        newSides.push(b.chainSpace(1));
      }
    });
    return { nodes, chains, corners: newCorners, sides: newSides, firstDc };
  };

  const r2 = round(r1.slice(0, 2), corners1, []);
  const join2 = b.stitch('sl-st', options.round2JoinsFirstDc ? r2.firstDc[0]! : r2.chains[2]!);
  b.event('join-slip', options.round2StatedCount ?? 36);

  // A 3. körben az oldalívek sorrendje: minden sarok után a hozzá tartozó oldalív.
  const r3 = round(r2.firstDc, r2.corners, r2.sides);
  const join3 = b.stitch('sl-st', r3.chains[2]!);
  // A láncszemek is szemek (PQW-940): 36 pálca és 16 láncszem.
  b.event('join-slip', 52);

  return {
    pattern: patternOf('Nagymama-négyzet (03 §8)', [b.build()]),
    rows: [[b.build().stitches[0]!.id], r1, [...r2.nodes, join2], [...r3.nodes, join3]],
    turningChains: [[], tc1, r2.chains, r3.chains],
  };
}

export const WORKED_EXAMPLES = {
  'félpálcás téglalap (03 §3.1 A)': hdcRectangle,
  'pálcás téglalap (03 §3.1 B)': dcRectangle,
  'kagyló 6+1 (03 §4.2 E)': shellStitch,
  'V-szem (03 §4.2 F)': vStitchPattern,
  'cikcakk (03 §4.2 G)': () => chevron(),
  'hullám (03 §2.3)': wave,
  'nagymama-négyzet 1–3. kör (03 §8)': grannySquare,
} as const satisfies Record<string, () => Example>;
