/*
 * The worked examples of the knowledge base as stitch graphs.
 *
 * Every function returns the pattern and the ids of the stitches, so the tests
 * can break them deliberately. The options are there for the errors that change
 * the structure; errors that swap a target or a stitch are made with
 * `editNode`.
 */

import type { NodeId, Pattern, SpaceId } from '../../src/core/types.ts';
import { PieceBuilder, patternOf, type Target } from './builder.ts';

export interface Example {
  readonly pattern: Pattern;
  /** The stitches of each row or round (without the turning chain) in yarn order; element 0 is the foundation chain. */
  readonly rows: readonly (readonly NodeId[])[];
  /** The turning chain or beginning chain of each row; element 0 is empty. */
  readonly turningChains: readonly (readonly NodeId[])[];
}

/*
 * ---- 03 §3.1 A: half double crochet rectangle, 15 stitches × 22 rows ----
 * Under the corrected rule (PQW-891): the 2-chain turning chain stands in place
 * of the 1st half double crochet, on one foundation chain stitch; row 1 starts
 * in the 3rd chain from the hook, and the last stitch of a row goes into the top
 * of the previous turning chain.
 */

export interface HdcRectangleOptions {
  readonly rows?: number;
  /** Which chain from the hook the first stitch of row 1 goes into; correctly the 3rd. */
  readonly firstStitchFromHook?: number;
  /** The length of one row's turning chain; correctly 2. */
  readonly turningChain?: { readonly row: number; readonly chains: number };
  /** Row 2 skips the first stitch and works two half double crochets into the next one. */
  readonly row2SkipsFirst?: boolean;
  /** Row 2 skips TWO stitches at the start: the turning chain covers one of them, the other really is left out. */
  readonly row2SkipsTwo?: boolean;
  /** One stitch is left out in the middle of row 2, and an increase at the end of the row makes up for it. */
  readonly row2SkipsOneInMiddle?: boolean;
  /** This row is worked in crab stitch instead of half double crochet. */
  readonly crabRow?: number;
  /** Chain stitches at the end of the last row, before the yarn is cut off. */
  readonly trailingChains?: number;
}

export function hdcRectangle(options: HdcRectangleOptions = {}): Example {
  const stitches = 15;
  const rowCount = options.rows ?? 22;
  const b = new PieceBuilder('p1', 'Félpálcás téglalap');
  // Every stitch goes into a chain of the foundation chain; the turning chain is the first stitch of the row (PQW-940).
  const worked = stitches;
  /** The stated stitch count: the stitches worked plus the turning chain (PQW-940). */
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
     * The worked example keeps the structure from BEFORE PQW-944: the row works
     * into every stitch of the row below it, and the turning chain stands beside
     * the fabric. The editor today already puts the turning chain in the place
     * of the first stitch; moving the examples and the generators over is a task
     * of its own (PQW-945).
     */
    const targets = [...row].reverse();
    if (r === 2 && options.row2SkipsTwo) {
      row = [
        ...b.inSame('inc-2hdc', ['hdc', 'hdc'], targets[2]!),
        ...targets.slice(3, -1).map((t) => b.stitch('hdc', t)),
        // The increases make the stitch count come out right; only the skipped position stays an error.
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
      // The trailing chain is a stitch too (PQW-940): the stated stitch count is meant to include it.
      b.event('fasten-off', stated + (options.trailingChains ?? 0));
    } else {
      b.event('turn', stated);
    }
  }
  return { pattern: patternOf('Félpálcás téglalap (03 §3.1 A)', [b.build()]), rows, turningChains };
}

/*
 * ---- 03 §3.1 B: double crochet rectangle, 16 stitches × 16 rows ----
 * For double crochet we skip 3 chains (PQW-924): 19 chains, row 1 starts in the
 * 4th chain from the hook, and from there one double crochet goes into every
 * chain — which makes 16 stitches.
 */

export interface DcRectangleOptions {
  readonly rows?: number;
  /** Row 2 skips the first stitch of the previous row: that leaves the row one stitch short. */
  readonly row2SkipsFirst?: boolean;
}

export function dcRectangle(options: DcRectangleOptions = {}): Example {
  const stitches = 16;
  const rowCount = options.rows ?? 16;
  const b = new PieceBuilder('p1', 'Pálcás téglalap');
  /** The stated stitch count: the stitches worked plus the turning chain (PQW-940). */
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
    // One double crochet goes into every stitch of the previous row; the turning chain is not a target (PQW-924).
    const below = [...row].reverse();
    const targets = r === 2 && options.row2SkipsFirst ? below.slice(1) : below;
    row = targets.map((t) => b.stitch('dc', t));
    rows.push(row);
    // The stated stitch count is the row's actual length plus the turning chain: one less when a stitch is skipped.
    b.event(r === rowCount ? 'fasten-off' : 'turn', row.length + 1);
  }
  return { pattern: patternOf('Pálcás téglalap (03 §3.1 B)', [b.build()]), rows, turningChains };
}

/* ---- 03 §4.2 E: shell, multiple of 6 + 1 (+1 turning chain) ---- */

export interface ShellOptions {
  readonly repeats?: number;
  /** The first repeat skips 3 chains instead of 2. */
  readonly firstRepeatSkipsThree?: boolean;
  /** The definition of the first shell's group; correctly `shell-5dc`. */
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
  // The turning chain is not a stitch in any of the rows (PQW-924): there is no per-row override.
  b.event('turn', 6 * n + 1);

  const chains = b.chain(3);
  const q = [...row1].reverse();
  // The turning chain starting the row is not a stitch (PQW-924), so the increase supplies the three double crochets.
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

/* ---- 03 §4.2 F: V-stitch, multiple of 3 + 2, the turning chain does not count ---- */

export interface VStitchOptions {
  readonly repeats?: number;
  /** The two double crochets of the first V-stitch are not marked as a group. */
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
  // Row 2 works into row 1's chain spaces, so their chains count (PQW-870).
  b.event('turn', 3 * n + 2);

  const chains = b.chain(3);
  const q = [...row1].reverse();
  const row2: NodeId[] = [b.stitch('dc', q[0]!)];
  for (const space of vs.slice(0, n).reverse()) row2.push(...v({ space }, true));
  row2.push(b.stitch('dc', q[3 * n + 1]!));
  // Row 2's chain spaces are stitches too: a chain is a stitch (PQW-940).
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

/* ---- 03 §4.2 G: chevron in double crochet, spacing 4, repeat 2·4 + 4 = 12, half valley at the edge ---- */

export interface ChevronExample extends Example {
  /** The first full valley of row 2 (3 double crochets worked together) and its three targets. */
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

/* ---- 03 §2.3: wave, multiple of 8 + 2, three rows ---- */

export interface WaveOptions {
  readonly repeats?: number;
  /** Row 3 is all single crochet too, so it does not even out row 1. */
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
  // The turning chain is not a stitch in any of the rows (PQW-924): there is no per-row override.
  b.event('turn', width);

  const q = [...row2].reverse();
  let chains3: NodeId[];
  let row3: NodeId[];
  if (options.flatRow3) {
    chains3 = b.chain(1);
    row3 = q.map((t) => b.stitch('sc', t));
  } else {
    chains3 = b.chain(4);
    // The turning chain is not a stitch (PQW-924): row 3 too works into every stitch of the previous row.
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

/* ---- 03 §8: granny square, rounds 1–3, a 1-chain space on the sides and a 2-chain space in the corners ---- */

export interface GrannyOptions {
  /** The stated stitch count of round 2; correctly 36, because round 3 works into all of its chain spaces (PQW-870). */
  readonly round2StatedCount?: number;
  /** Round 2's closing slip stitch goes into the round's first double crochet, not the top of the beginning chain. */
  readonly round2JoinsFirstDc?: boolean;
}

export function grannySquare(options: GrannyOptions = {}): Example {
  const b = new PieceBuilder('p1', 'Nagymama-négyzet');
  const ring = b.ring();

  const cluster = (target: Target, count = 3) => Array.from({ length: count }, () => b.stitch('dc', target));

  // Round 1: ch 3 (1 dc), 2 dc, ch 2, (3 dc, ch 2) ×3, slip stitch into the top of the beginning chain.
  const tc1 = b.chain(3);
  const r1: NodeId[] = [...cluster({ ring }, 2)];
  const corners1: SpaceId[] = [b.chainSpace(2)];
  for (let i = 0; i < 3; i += 1) {
    r1.push(...cluster({ ring }));
    corners1.push(b.chainSpace(2));
  }
  r1.push(b.stitch('sl-st', tc1[2]!));
  // 12 double crochets and the 8 chains of the corners, because round 2 works into the corner chain spaces (PQW-870).
  b.event('join-slip', 20);

  /*
   * Round 2 of a motif and the ones after it: slip stitch over to the corner
   * chain space, 3 chains, and the matching group into every chain space.
   */
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

  // The order of the side chain spaces in round 3: after every corner comes the side chain space that belongs to it.
  const r3 = round(r2.firstDc, r2.corners, r2.sides);
  const join3 = b.stitch('sl-st', r3.chains[2]!);
  // The chains are stitches too (PQW-940): 36 double crochets and 16 chains.
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
