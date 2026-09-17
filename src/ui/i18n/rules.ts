/*
 * Az ellenőrző szabályainak szövege a felület nyelvén (PQW-900).
 *
 * - A mag magyar szövege az alap: a `src/core/rules.ts` `RULES` objektuma adja a
 *   `summary` és a `message` mezőt, és a mag magyar marad. A felület csak
 *   kiválasztja, melyik nyelven mutatja ugyanazt a szabályt.
 * - Ezért a magyar ág nincs kézzel másolva, hanem a `RULES`-ból származik: így
 *   nem csúszhat el a magtól, és egy magyar szöveg javítása egy helyen történik.
 *   Az angol ág a kézzel írt fordítás, szabályazonosítónként.
 * - A `summary` a szerkesztőnek és a teszteknek szól (rövid, szakmai leírás), a
 *   `message` a felhasználónak a szerkesztőben (PQW-879): belső fogalom (réteg,
 *   darab) és tudásbázis-kód nélkül. A `severity` és a `reference` nem fordul,
 *   mert azok nem szövegek: a magból jönnek.
 * - A felhasználónak szóló üzenetek szándékosan kerülik a jelölésfüggő
 *   szemneveket, mert a felület nyelve és a minta jelölése két független
 *   beállítás (PQW-868).
 *
 * DOM nélküli, ezért a Node is futtatja, és a magot `.ts` kiterjesztéssel
 * importálja.
 */

import { RULES, type RuleId } from '../../core/rules.ts';
import type { Dictionary } from '../i18n.ts';

export interface RuleText {
  /** Rövid leírás a szerkesztőnek és a teszteknek. */
  readonly summary: string;
  /** A felhasználónak szóló üzenet a szerkesztőben. */
  readonly message: string;
}

/** A magyar szöveg a magból: minden szabály a `RULES` `summary`/`message` mezőjével. */
const HU_TEXTS = Object.fromEntries(
  Object.entries(RULES).map(([id, rule]) => [id, { summary: rule.summary, message: rule.message }]),
) as Readonly<Record<RuleId, RuleText>>;

export const RULE_TEXTS = {
  hu: HU_TEXTS,
  en: {
    /* ---- Structure ---- */
    'unknown-stitch': {
      summary: 'The stitch is not in the library, or it cannot be a node (compound group, chain-space element).',
      message: 'There is an unknown stitch in the pattern.',
    },
    'dangling-reference': {
      summary: 'A reference to a stitch, chain space, ring or group that does not exist, or a duplicate id.',
      message: 'A stitch in the pattern points to a target that is not there.',
    },
    'yarn-path': {
      summary: 'The previous stitch is not the one before it on the yarn path, or a yarn run starts without cutting the yarn.',
      message: 'The yarn path breaks: a stitch does not continue from the previous one.',
    },

    /* ---- Targets ---- */
    'future-anchor': {
      summary: 'The stitch is worked into a stitch, chain space or ring that is made later.',
      message: 'This stitch anchors into a stitch that is only made later.',
    },
    'anchor-layer': {
      summary: 'The target is not a workable position of the previous row; only a spike stitch may reach an earlier row.',
      message: 'This stitch does not anchor into a stitch of the row below it.',
    },
    'resume-layer': {
      summary: 'After fastening off, the section would continue over a row that does not exist or is not an earlier row.',
      message: 'After the yarn is cut, the work would continue above a row that is missing, or that is not an earlier row.',
    },
    'turning-chain-placement': {
      summary: 'With a counting turning chain the last stitch of the row does not go into its top, or a stitch was worked into a turning chain that does not count.',
      message: 'The beginning or the end of the row does not line up with the chains at the start of the row.',
    },
    'unworkable-top': {
      summary: 'A stitch was worked into the top of a stitch that cannot be worked into (e.g. crab stitch).',
      message: 'You cannot work into the top of this stitch.',
    },
    'insertion-mode': {
      summary:
        'The stitch cannot be worked in this insertion mode: the mode as seen from the crocheter is not in the insertionModes list of the stitch (for a compound stitch, of the group) (PQW-869).',
      message: 'This stitch cannot be worked in this insertion mode (e.g. crab stitch in back loop only, shell around the post): choose another mode.',
    },
    'anchor-count': {
      summary: 'The number of targets of the stitch does not match how many it uses up.',
      message: 'This stitch does not anchor into as many stitches as it should.',
    },
    'unmarked-increase': {
      summary: 'Several stitches in one target, but not marked as an increase, a shell or a V-stitch.',
      message: 'Several stitches went into the same stitch. If you meant this, mark it as an increase.',
    },
    'unmarked-decrease': {
      summary: 'Several targets in one stitch, but not marked as a decrease or a cluster.',
      message: 'One stitch anchors into several stitches. If you meant this, mark it as a decrease.',
    },
    'group-mismatch': {
      summary: 'The members of the group are not consecutive stitches worked into one target, as the definition of the group requires.',
      message: 'The stitches of the increase or the shell did not go one after another into the same stitch.',
    },
    'against-direction': {
      summary: 'The target lies against the working direction, and the stitch is not marked as crossed or as a post stitch.',
      message: 'This stitch anchors into a stitch that lies against the working direction. If this is on purpose, mark it as a crossed stitch.',
    },
    reach: {
      summary: 'Too large a jump: the skipped positions are bridged by neither chains nor a fan.',
      message: 'Too large a jump: the skipped stitches are bridged by neither chains nor an increase.',
    },
    'reach-single': {
      summary: 'One position is left out without a chain or a fan.',
      message: 'One stitch was skipped in the row.',
    },
    'unused-position': {
      summary: 'A position of the previous row is unused, and it is not marked as skipped or bridged.',
      message: 'Nothing was worked into one stitch of the row below.',
    },
    'floating-chain': {
      summary: 'Floating chain: nothing works into the chains at the end of the row, and they are not a turning chain.',
      message: 'Chains are left at the end of the row with nothing worked into them.',
    },

    /* ---- Foundation chain, turning chain, counts ---- */
    'foundation-chain': {
      summary:
        'Wrong foundation chain: the first stitch of row 1 does not go into the chain that follows the turning chain; with a counting turning chain it goes into the chain after the foundation chain below it, and that foundation chain is not worked into (PQW-891).',
      message: 'The first stitch of row 1 went into the wrong chain.',
    },
    'turning-chain-height': {
      summary: 'The height of the turning chain differs from the stitch that starts the row.',
      message: 'The chains at the start of the row do not match the height of the stitch that begins the row.',
    },
    'stated-count': {
      summary: 'The stated stitch count differs from the counted one.',
      message: 'The stated stitch count does not match the counted one.',
    },
    'round-join': {
      summary: 'The closing slip stitch of the round does not go into the first stitch of the round or into the top of the beginning chain.',
      message: 'The stitch that closes the round does not go into the first stitch of the round.',
    },
    'repeat-balance': {
      summary: 'In a repeated pattern the row gives more or fewer positions than it uses up.',
      message: 'In the repeated pattern the row gives more or fewer stitches than it uses up.',
    },

    /* ---- Rounds (PQW-861) ---- */
    'round-growth': {
      summary: 'The position count of the round is more than double or less than half of the previous round.',
      message: 'In this round the stitch count more than doubles or drops to half: one round can take at most a doubling or a halving.',
    },
    'round-cupping': {
      summary: 'In at least two consecutive rounds the increase stays below ~85% of the flat value: the piece cups.',
      message: 'Too few increases: if you want this flat, these rounds will cup. Increase more, or work the outer rounds with a larger hook.',
    },
    'round-ruffling': {
      summary: 'The increase in the round is above ~130% of the flat value: the piece ruffles.',
      message: 'Too many increases: this round will ruffle. Work 1-2 rounds without increases, or increase less.',
    },
    'stacked-increases': {
      summary: 'Over three or more rounds the increases stack on top of each other (intentional in a polygon, where it does not flag).',
      message: 'The increases stack on top of each other over three rounds, so the round turns polygonal. Stagger them from round to round (offset increases).',
    },
    'spiral-color-jog': {
      summary: 'Color change in a spiral without a jog fix.',
      message:
        'In a spiral a color change leaves a jog. Fix it like this: work a slip stitch instead of the first stitch of the next round, or join the new color in the back loop of the first stitch.',
    },

    /* ---- Amigurumi (PQW-863) ---- */
    'join-edge': {
      summary: 'The seam points to a piece or a round that does not exist.',
      message: 'The seam points to a part or a round that is not there.',
    },
    'join-count': {
      summary: 'The stitch counts of the two sewn edges differ, and no distribution is given, or the distribution does not fit the two edges.',
      message: 'The two sewn edges have different stitch counts. Say how the stitches are spread out, or adjust the size of the parts.',
    },
    'toy-safety-eyes': {
      summary: 'Safety eyes are marked in a toy intended for a child under 3.',
      message: 'A toy meant for a child under 3 must not have safety eyes or beads: embroider the eyes instead.',
    },

    /* ---- Grid techniques (PQW-864) ---- */
    'carried-colors': {
      summary: 'In tapestry more than 3 colors have to be carried inside the stitches in one row.',
      message:
        'More than 3 colors have to be carried inside the stitches in this row: this is an advanced technique, and the fabric gets stiffer. Simplify the row, or work it graphgan style, with a separate bobbin for each color.',
    },
    'spike-depth': {
      summary: 'The spike stitch is worked more than 3 rows down, into an earlier row (PQW-894).',
      message: 'This spike stitch goes too deep: you can work at most 3 rows down, into a skipped stitch.',
    },
  },
} satisfies Dictionary<Readonly<Record<RuleId, RuleText>>>;
