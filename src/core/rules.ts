// KB: core-domain §14

import type { Finding } from './types.ts';

export interface RuleDef {
  readonly severity: Finding['severity'];
  readonly reference: string;
  /** Developer-facing; never rendered to the user. KB: core-domain §14 */
  readonly summary: string;
  /** Shown to the user in the editor: frozen Hungarian, no internal term, no knowledge-base code. KB: core-domain §14 */
  readonly message: string;
}

export const RULES = {
  'unknown-stitch': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'The stitch is not in the library, or it cannot be a node (compound group, chain-space element).',
    message: 'Ismeretlen szem van a mintában.',
  },
  'dangling-reference': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'A reference to a stitch, chain space, ring or group that does not exist, or a duplicate id.',
    message: 'A minta egy szem olyan célpontra mutat, amely nincs meg.',
  },
  'yarn-path': {
    severity: 'error',
    reference: '06 §5.3 V2',
    summary: 'The previous stitch is not the one before it on the yarn path, or a yarn run starts without cutting the yarn.',
    message: 'A fonal útja megszakad: egy szem nem az előző után folytatódik.',
  },

  'future-anchor': {
    severity: 'error',
    reference: '06 §5.3 V1',
    summary: 'The stitch is worked into a stitch, chain space or ring that is made later.',
    message: 'Ez a szem egy csak később elkészülő szembe kapaszkodik.',
  },
  'anchor-layer': {
    severity: 'error',
    reference: '03 §10 C16, C17',
    summary: 'The target is not a workable position of the previous row; only a spike stitch may reach an earlier row.',
    message: 'Ez a szem nem az alatta lévő sor egy szemébe kapaszkodik.',
  },
  'resume-layer': {
    severity: 'error',
    reference: '03 §10 C16, 05 §9.5',
    summary: 'After fastening off, the section would continue over a row that does not exist or is not an earlier row.',
    message: 'A fonal elvágása után a munka egy olyan sor fölött folytatódna, amely nincs meg, vagy nem korábbi sor.',
  },
  'turning-chain-placement': {
    severity: 'error',
    reference: '03 §10 A4, 03 §1.3',
    summary:
      'With a counting turning chain the last stitch of the row does not go into its top, or a stitch was worked into a turning chain that does not count.',
    message: 'A sor eleji láncszemekhez rosszul illeszkedik a sor eleje vagy vége.',
  },
  'unworkable-top': {
    severity: 'error',
    reference: '01 §8.2 szabály 10',
    summary: 'A stitch was worked into the top of a stitch that cannot be worked into (e.g. crab stitch).',
    message: 'Ennek a szemnek a tetejébe nem lehet belehorgolni.',
  },
  'insertion-mode': {
    severity: 'error',
    reference: '01 §4.3',
    summary:
      'The stitch cannot be worked in this insertion mode: the mode as seen from the crocheter is not in the insertionModes list of the stitch (for a compound stitch, of the group) (PQW-869).',
    message: 'Ez a szem ebben a beszúrási módban nem horgolható (pl. rákhurok hátsó szálba, kagyló reliefben): válassz másik módot.',
  },
  'anchor-count': {
    severity: 'error',
    reference: '03 §10 C12',
    summary: 'The number of targets of the stitch does not match how many it uses up.',
    message: 'Ez a szem nem annyi szembe kapaszkodik, amennyibe kellene.',
  },
  'unmarked-increase': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Several stitches in one target, but not marked as an increase, a shell or a V-stitch.',
    message: 'Több szem került ugyanabba a szembe. Ha ezt szeretted, jelöld szaporításnak.',
  },
  'unmarked-decrease': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Several targets in one stitch, but not marked as a decrease or a cluster.',
    message: 'Egy szem több szembe kapaszkodik. Ha ezt szeretted, jelöld fogyasztásnak.',
  },
  'group-mismatch': {
    severity: 'error',
    reference: '03 §10 C14, 01 §8.2 szabály 7',
    summary: 'The members of the group are not consecutive stitches worked into one target, as the definition of the group requires.',
    message: 'A szaporítás vagy a kagyló szemei nem egymás után, ugyanabba a szembe kerültek.',
  },
  'against-direction': {
    severity: 'error',
    reference: '03 §10 C13',
    summary: 'The target lies against the working direction, and the stitch is not marked as crossed or as a post stitch.',
    message: 'Ez a szem a haladási iránnyal szemben lévő szembe kapaszkodik. Ha szándékos, jelöld keresztezett szemnek.',
  },
  'reach': {
    severity: 'error',
    reference: '03 §10 C15, 03 §4.2',
    summary: 'Too large a jump: the skipped positions are bridged by neither chains nor a fan.',
    message: 'Túl nagy ugrás: a kimaradt szemeket sem láncszem, sem szaporítás nem hidalja át.',
  },
  'reach-single': {
    severity: 'warning',
    reference: '03 §10 C15',
    summary: 'One position is left out without a chain or a fan.',
    message: 'Egy szem kimaradt a sorban.',
  },
  // KB: core-domain §15; 03 §10 B8
  'unused-position': {
    severity: 'warning',
    reference: '03 §10 B8',
    summary: 'A position of the previous row is unused, and it is not marked as skipped or bridged.',
    message: 'Az alatta lévő sor egy szemébe nem került semmi.',
  },
  // KB: core-domain §15
  'floating-chain': {
    severity: 'warning',
    reference: '03 §10 C18, 03 §9.8',
    summary: 'Floating chain: nothing works into the chains at the end of the row, and they are not a turning chain.',
    message: 'A sor végén olyan láncszemek maradtak, amelyekbe semmi nem horgol.',
  },

  'foundation-chain': {
    severity: 'error',
    reference: '03 §10 A2, 03 §1.2',
    summary:
      'Wrong foundation chain: the first stitch of row 1 does not go into the chain that follows the skipped chains, and the skipped chains are not worked into. How many chains are skipped depends on the height of the stitch and on the tradition (PQW-924).',
    message: 'Az 1. sor első szeme nem a megfelelő láncszembe került.',
  },
  'turning-chain-height': {
    severity: 'warning',
    reference: '03 §10 A1, D20',
    summary: 'The height of the turning chain differs from the stitch that starts the row.',
    message: 'A sor eleji láncszemek magassága nem illik a sort kezdő szemhez.',
  },
  'stated-count': {
    severity: 'error',
    reference: '03 §10 B7, B10, 06 §5.3 V3',
    summary: 'The stated stitch count differs from the counted one.',
    message: 'A megadott szemszám nem egyezik a megszámolttal.',
  },
  'round-join': {
    severity: 'error',
    reference: '06 §5.3 V4',
    summary: 'The closing slip stitch of the round does not go into the first stitch of the round or into the top of the beginning chain.',
    message: 'A kört záró szem nem a kör első szemébe megy.',
  },
  'repeat-balance': {
    severity: 'error',
    reference: '03 §10 E23, 03 §4.2',
    summary: 'In a repeated pattern the row gives more or fewer positions than it uses up.',
    message: 'Az ismételt mintában a sor több vagy kevesebb szemet ad, mint amennyit felhasznál.',
  },

  'round-growth': {
    severity: 'warning',
    reference: '04 §9.0',
    summary: 'The position count of the round is more than double or less than half of the previous round.',
    message: 'Ebben a körben a szemszám több mint duplájára nő vagy felére csökken: egy körben legfeljebb duplázás vagy felezés fér bele.',
  },
  'round-cupping': {
    severity: 'warning',
    reference: '04 §8, §9.6',
    summary: 'In at least two consecutive rounds the increase stays below ~85% of the flat value: the piece cups.',
    message: 'Kevés a szaporítás: ha laposnak szánod, ezek a körök kunkorodnak. Szaporíts többet, vagy a külső köröket horgold nagyobb tűvel.',
  },
  'round-ruffling': {
    severity: 'warning',
    reference: '04 §8, §9.6',
    summary: 'The increase in the round is above ~130% of the flat value: the piece ruffles.',
    message: 'Sok a szaporítás: ez a kör fodrosodik. Horgolj 1–2 kört szaporítás nélkül, vagy szaporíts kevesebbet.',
  },
  'stacked-increases': {
    severity: 'warning',
    reference: '04 §3.2, §8, §9.6',
    summary: 'Over three or more rounds the increases stack on top of each other (intentional in a polygon, where it does not flag).',
    message: 'A szaporítások három körön át egymás fölé kerülnek, ezért a kör sokszögletű lesz. Told el őket körönként (eltolt szaporítás).',
  },
  'spiral-color-jog': {
    severity: 'warning',
    reference: '04 §2',
    summary: 'Color change in a spiral without a jog fix.',
    message:
      'Spirálban a színváltás lépcsőt hagy. Javítás: a következő kör első szeme helyett kúszószem, vagy az új színt az első szem hátsó szálába kapcsold be.',
  },

  'join-edge': {
    severity: 'error',
    reference: '04 §5.4',
    summary: 'The seam points to a piece or a round that does not exist.',
    message: 'Az összevarrás egy olyan részre vagy körre mutat, amely nincs meg.',
  },
  'join-count': {
    severity: 'error',
    reference: '04 §5.4, §9.0',
    summary: 'The stitch counts of the two sewn edges differ, and no distribution is given, or the distribution does not fit the two edges.',
    message: 'A két összevarrt szél szemszáma eltér. Add meg, hogyan oszlanak el a szemek, vagy igazítsd a részek méretét.',
  },
  'toy-safety-eyes': {
    severity: 'warning',
    reference: '04 §5.7, §9.6',
    summary: 'Safety eyes are marked in a toy intended for a child under 3.',
    message: '3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem vagy gyöngy: a szemeket hímezd ki.',
  },

  'carried-colors': {
    severity: 'warning',
    reference: '03 §5.3, §10 G36',
    summary: 'In tapestry more than 3 colors have to be carried inside the stitches in one row.',
    message:
      'Ebben a sorban 3-nál több színt kell a szemekben vinni: ez haladó szint, és a szövet merevebb lesz. Egyszerűsítsd a sort, vagy horgold graphganként, színenként külön gombolyaggal.',
  },
  'spike-depth': {
    severity: 'error',
    reference: '03 §5.6, §10 C17, G34',
    summary: 'The spike stitch is worked more than 3 rows down, into an earlier row (PQW-894).',
    message: 'Ez a hosszú szem túl mélyre megy: legfeljebb 3 sorral lejjebb, egy kihagyott szembe horgolhatsz.',
  },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULES;
