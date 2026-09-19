/*
 * Shape, piece and round-and-motif core messages as sentences. Two of them
 * quote an interface element: the „Új minta ebből” button, whose label is taken
 * from `markup.ts` so the two cannot drift apart, and the Check panel.
 *
 * KB: dictionaries.md §1, §5, §6
 */

import type { AmigurumiCode } from '../../../core/amigurumi-generator.ts';
import type { CoreData, CoreText } from '../../../core/messages.ts';
import type { MotifCode } from '../../../core/round-generator.ts';
import { uiLanguage } from '../../i18n.ts';
import { MARKUP_TEXTS } from '../markup.ts';
import { RIBBING_EN, RIBBING_HU } from './ribbing.ts';
import { num, renderCoreText, str } from './render.ts';
import type { CoreDictionary, CoreEntry } from './render.ts';

export type AmigurumiCoreCode = AmigurumiCode | MotifCode;

const HU_FIELDS: Readonly<Record<string, string>> = {
  diameter: 'Az átmérő',
  height: 'A magasság',
  length: 'A hossz',
  width: 'A szélesség',
};

const EN_FIELDS: Readonly<Record<string, string>> = {
  diameter: 'The diameter',
  height: 'The height',
  length: 'The length',
  width: 'The width',
};

const HU_INTERNAL: Readonly<Record<string, (data: CoreData) => string>> = {
  'oval-round-count': (data) => `Az ovális ${num(data, 'round')}. köre ${num(data, 'count')} szem lett ${num(data, 'expected')} helyett`,
};

const EN_INTERNAL: Readonly<Record<string, (data: CoreData) => string>> = {
  'oval-round-count': (data) =>
    `Round ${num(data, 'round')} of the oval came out with ${num(data, 'count')} stitches instead of ${num(data, 'expected')}`,
};

const huInternal = (data: CoreData): string => HU_INTERNAL[str(data, 'inner')]?.(data) ?? '';
const enInternal = (data: CoreData): string => EN_INTERNAL[str(data, 'inner')]?.(data) ?? '';

const hu: Readonly<Record<AmigurumiCoreCode, CoreEntry>> = {
  ...RIBBING_HU,

  'size-range': (data) => `${HU_FIELDS[str(data, 'field')] ?? ''} 0 és ${num(data, 'max')} cm közötti szám lehet.`,
  'cone-increases-range': (data) => `A körönkénti szaporítás 0 és ${num(data, 'max')} közötti szám lehet, pl. 2,5.`,
  'oval-length': 'Az ovális hossza legalább akkora legyen, mint a szélessége: a hosszabbik méret a hossz.',
  'profile-points': 'A profilhoz legalább két pont kell: soronként sugár és magasság cm-ben.',
  'profile-range': (data) => `A profil pontjaiban a sugár 0 és ${num(data, 'max')} cm, a magasság legfeljebb ${num(data, 'max')} cm lehet.`,
  'profile-same-points': 'A profil pontjai egybeesnek: adj meg különböző pontokat.',
  'profile-zero-radius': 'A profil sugara mindenhol 0: legalább egy pontban adj meg sugarat.',
  'too-many-rounds': (data) => `Ez ${num(data, 'rounds')} kör lenne; legfeljebb ${num(data, 'max')} kör készíthető. Válassz kisebb méretet.`,
  'join-count-differs': (data) =>
    `A két szél szemszáma eltér (${num(data, 'a')} és ${num(data, 'b')} szem), és nincs megadva, hogyan oszlanak el a szemek.`,
  'distribution-mismatch': (data) =>
    `Az elosztás nem illik a két szélhez: a ${num(data, 'small')} szemes szél minden szeméhez legalább 1 szem kell, összesen ${num(data, 'large')}.`,

  'open-start-piece': 'Nyitott kezdésű rész csak folytatólagosan, egy előző rész nyitott végéhez kapcsolható.',
  'no-previous-piece': `Előbb hozz létre egy részt az „${MARKUP_TEXTS.hu.amigurumiCreate}” gombbal; a következő rész ehhez kapcsolódik.`,
  'previous-piece-broken': 'Az előző rész szerkezete hibás, ezért nem kapcsolható hozzá új rész; a hibákat az Ellenőrzés sorolja fel.',
  'continuous-closed-end':
    'Folytatólagosan csak nyitott végű részhez lehet kapcsolni, az előző rész vége zárt. Válaszd nála a nyitott véget, vagy varrd a részeket.',
  'continuous-needs-open-start': 'A folytatólagosan kapcsolt rész nyitott kezdésű: válaszd a henger vagy a forgástest nyitott kezdését.',
  'continuous-count-differs': (data) =>
    `Az előző rész utolsó köre ${num(data, 'previous')} szem, az új rész első köre ${num(data, 'first')} szem. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.`,
  'sewn-count-differs': (data) =>
    `Az új rész ${num(data, 'round')}. körén ${num(data, 'count')} szem van, az előző rész ${num(data, 'previousRound')}. körén ${num(data, 'previousCount')}. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.`,
  'round-growth': (data) =>
    `A ${num(data, 'round')}. körben ${num(data, 'previous')} szemből ${num(data, 'count')} lenne: egy körben legfeljebb duplázás vagy felezés fér bele.`,
  'oval-ends-increase': (data) => `Az ovális ${num(data, 'round')}. körében a végek szaporítása nem fér el.`,
  'internal-error': (data) => `${huInternal(data)}: ez a program hibája, kérlek, jelezd.`,

  'rounds-range': (data) => `A körök száma 1 és ${num(data, 'max')} között lehet.`,
  'color-rounds-whole': 'A színváltás köreinek száma nem negatív egész szám.',
  'base-stitch': 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca vagy pálca.',
  'granny-start': 'A nagymama-négyzet varázskörrel vagy láncgyűrűvel kezdődik.',
  'granny-spiral': 'A nagymama-négyzet köreit kúszószemmel zárjuk, spirálban nem horgolható.',
  'chain-start-limit': (data) => `Egy láncszembe legfeljebb ${num(data, 'max')} szem fér: kezdd varázskörrel vagy láncgyűrűvel.`,
  'round-plan-mismatch': (data) => `A(z) ${num(data, 'round')}. kör terve nem illik az előző körhöz.`,
  'into-one-limit': (data) =>
    `A(z) ${num(data, 'round')}. körben egy szembe ${num(data, 'count')} szem kerülne: ennyit nem lehet egy szembe horgolni.`,
};

const en: Readonly<Record<AmigurumiCoreCode, CoreEntry>> = {
  ...RIBBING_EN,

  'size-range': (data) => `${EN_FIELDS[str(data, 'field')] ?? ''} must be a number between 0 and ${num(data, 'max')} cm.`,
  'cone-increases-range': (data) => `The increases per round must be a number between 0 and ${num(data, 'max')}, e.g. 2.5.`,
  'oval-length': 'The length of the oval must be at least as large as its width: the longer measurement is the length.',
  'profile-points': 'The profile needs at least two points: radius and height in cm, one per line.',
  'profile-range': (data) =>
    `In the points of the profile the radius can be between 0 and ${num(data, 'max')} cm, and the height at most ${num(data, 'max')} cm.`,
  'profile-same-points': 'The points of the profile coincide: give different points.',
  'profile-zero-radius': 'The radius of the profile is 0 everywhere: give a radius in at least one point.',
  'too-many-rounds': (data) => `That would be ${num(data, 'rounds')} rounds; at most ${num(data, 'max')} rounds can be made. Choose a smaller size.`,
  'join-count-differs': (data) =>
    `The two edges have different stitch counts (${num(data, 'a')} and ${num(data, 'b')} stitches), and there is no distribution given for the stitches.`,
  'distribution-mismatch': (data) =>
    `The distribution does not fit the two edges: every stitch of the ${num(data, 'small')}-stitch edge needs at least 1 stitch, ${num(data, 'large')} in total.`,

  'open-start-piece': 'A piece with an open start can only be added as a continuation, joined to the open end of a previous piece.',
  'no-previous-piece': `First create a piece with the “${MARKUP_TEXTS.en.amigurumiCreate}” button; the next piece is joined to it.`,
  'previous-piece-broken':
    'The structure of the previous piece is faulty, so no new piece can be joined to it; the Check section lists the errors.',
  'continuous-closed-end':
    'A piece can only be worked on onto a piece with an open end, and the previous piece ends closed. Choose the open end for it, or sew the pieces together.',
  'continuous-needs-open-start': 'A piece that is worked on needs an open start: choose the open start of the cylinder or the solid of revolution.',
  'continuous-count-differs': (data) =>
    `The last round of the previous piece has ${num(data, 'previous')} stitches, the first round of the new piece has ${num(data, 'first')} stitches. Turn on the even distribution, or adjust the size.`,
  'sewn-count-differs': (data) =>
    `Round ${num(data, 'round')} of the new piece has ${num(data, 'count')} stitches, round ${num(data, 'previousRound')} of the previous piece has ${num(data, 'previousCount')}. Turn on the even distribution, or adjust the size.`,
  'round-growth': (data) =>
    `In round ${num(data, 'round')} ${num(data, 'previous')} stitches would become ${num(data, 'count')}: a round can at most double or halve the stitch count.`,
  'oval-ends-increase': (data) => `In round ${num(data, 'round')} of the oval the increases at the ends do not fit.`,
  'internal-error': (data) => `${enInternal(data)}: this is a bug in the program, please report it.`,

  'rounds-range': (data) => `The number of rounds can be between 1 and ${num(data, 'max')}.`,
  'color-rounds-whole': 'The number of rounds between colour changes must be a non-negative whole number.',
  'base-stitch': 'Choose a basic stitch for this generator: single crochet, half double crochet or double crochet.',
  'granny-start': 'The granny square starts with a magic ring or a chain ring.',
  'granny-spiral': 'The rounds of the granny square are joined with a slip stitch; it cannot be worked in a spiral.',
  'chain-start-limit': (data) => `At most ${num(data, 'max')} stitches fit into one chain: start with a magic ring or a chain ring.`,
  'round-plan-mismatch': (data) => `The plan of round ${num(data, 'round')} does not fit the previous round.`,
  'into-one-limit': (data) =>
    `In round ${num(data, 'round')} ${num(data, 'count')} stitches would go into one stitch: that many cannot be worked into one stitch.`,
};

export const AMIGURUMI_CORE_TEXTS: CoreDictionary<AmigurumiCoreCode> = { hu, en };

export function amigurumiCoreText(message: CoreText<AmigurumiCoreCode>): string {
  return renderCoreText(AMIGURUMI_CORE_TEXTS[uiLanguage()], message);
}
