/*
 * A compile-time probe: can a worked example be expressed through the core's
 * public types? It never runs; `npm run check` is what exercises it, through
 * tsconfig.core.json.
 *
 * The example, in single crochet rows:
 * - foundation: 4 chains (3 stitches plus 1 turning chain, which does not count);
 * - row 1: 3 single crochet from the second chain from the hook (3);
 * - turn, 1 chain;
 * - row 2: 2 single crochet into the first stitch, the remaining two worked
 *   together (3).
 */

import type { GroupStitchDef, JoinedStitchDef, Pattern, SimpleStitchDef } from '../src/core/types.ts';

export const singleCrochet = {
  id: 'sc',
  kind: 'basic',
  terms: {
    hu: { name: 'rövidpálca', abbr: 'rp', aliases: ['kispálca'] },
    'en-US': { name: 'single crochet', abbr: 'sc', aliases: [] },
    'en-GB': { name: 'double crochet', abbr: 'dc', aliases: [] },
  },
  yarnOvers: 0,
  chainHeight: 1,
  turningChain: 1,
  turningChainCounts: false,
  roundEnd: 'spiral',
  // Single crochet is the unit of measure itself.
  heightFactor: { value: 1, source: 'estimated' },
  consumes: 1,
  produces: 1,
  producesSpaces: 0,
  workableTop: true,
  insertionModes: ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post', 'space', 'ring'],
} satisfies SimpleStitchDef;

export const singleCrochetIncrease = {
  ...singleCrochet,
  id: 'sc-inc',
  kind: 'group',
  terms: {
    hu: { name: 'szaporítás', abbr: null, aliases: [] },
    'en-US': { name: 'increase', abbr: 'inc', aliases: [] },
    'en-GB': { name: 'increase', abbr: 'inc', aliases: [] },
  },
  produces: 2,
  members: ['sc', 'sc'],
} satisfies GroupStitchDef;

export const singleCrochetTwoTogether = {
  ...singleCrochet,
  id: 'sc2tog',
  kind: 'joined',
  terms: {
    hu: { name: 'fogyasztás', abbr: null, aliases: [] },
    'en-US': { name: 'single crochet two together', abbr: 'sc2tog', aliases: [] },
    'en-GB': { name: 'double crochet two together', abbr: 'dc2tog', aliases: [] },
  },
  consumes: 2,
  insertionModes: ['both-loops'],
  base: 'spread',
  part: 'sc',
  parts: 2,
} satisfies JoinedStitchDef;

const both = 'both-loops';

export const swatch = {
  formatVersion: 1,
  title: 'Rövidpálcás próba',
  conventions: {
    turningChainCounts: 'stitch-default',
    roundEnd: 'stitch-default',
    picotCounts: false,
    joinSlipStitchCounts: false,
    chainCounts: 'worked-into',
  },
  pieces: [
    {
      id: 'p1',
      name: 'Próbadarab',
      stitches: [
        { id: 'ch1', def: 'ch', prev: null, anchors: [] },
        { id: 'ch2', def: 'ch', prev: 'ch1', anchors: [] },
        { id: 'ch3', def: 'ch', prev: 'ch2', anchors: [] },
        { id: 'ch4', def: 'ch', prev: 'ch3', anchors: [] },
        { id: 'r1s1', def: 'sc', prev: 'ch4', anchors: [{ into: 'stitch', id: 'ch3', mode: both }] },
        { id: 'r1s2', def: 'sc', prev: 'r1s1', anchors: [{ into: 'stitch', id: 'ch2', mode: both }] },
        { id: 'r1s3', def: 'sc', prev: 'r1s2', anchors: [{ into: 'stitch', id: 'ch1', mode: both }] },
        { id: 'r2t', def: 'ch', prev: 'r1s3', anchors: [] },
        { id: 'r2s1', def: 'sc', prev: 'r2t', anchors: [{ into: 'stitch', id: 'r1s3', mode: both }] },
        { id: 'r2s2', def: 'sc', prev: 'r2s1', anchors: [{ into: 'stitch', id: 'r1s3', mode: both }] },
        {
          id: 'r2s3',
          def: 'sc2tog',
          prev: 'r2s2',
          anchors: [
            { into: 'stitch', id: 'r1s2', mode: both },
            { into: 'stitch', id: 'r1s1', mode: both },
          ],
        },
      ],
      spaces: [],
      rings: [],
      groups: [{ id: 'g1', def: 'sc-inc', members: ['r2s1', 'r2s2'] }],
      events: [
        { after: 'r1s3', kind: 'turn', statedCount: 3 },
        { after: 'r2s3', kind: 'fasten-off', statedCount: 3 },
      ],
      skipped: [],
    },
  ],
} satisfies Pattern;
