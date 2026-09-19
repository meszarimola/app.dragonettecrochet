/*
 * Editor and selection core messages as sentences. The core gives a layer
 * index, a `shape` and an `unchanged` flag; the article, the suffix, the row or
 * round word and the closing "the pattern is unchanged" are added here.
 *
 * KB: dictionaries.md §1, §5, §6
 */

import type { EditCode } from '../../../core/editor.ts';
import type { CoreData } from '../../../core/messages.ts';
import type { CopyCode, LayerCount } from '../../../core/selection.ts';
import { resolveStitch } from '../../../core/stitch-variants.ts';
import type { StitchInsertion } from '../../../core/types.ts';
import { termsLocale } from '../../notation.ts';
import { SECTION_TEXTS } from '../sections.ts';
import { enLayer, enLayerCounts, enStitches, huLayer, huLayerCounts, huStitches } from './layer-counts.ts';
import { bool, isRound, list, num, str, type CoreDictionary } from './render.ts';

type Language = 'hu' | 'en';

/**
 * The stitch name follows the NOTATION, not the interface language, so it is not
 * read from the dictionary. KB: interface.md §2, §3
 */
function stitchName(data: CoreData): string {
  const marked = str(data, 'stitchName');
  if (marked) return marked;
  const id = str(data, 'stitch');
  return resolveStitch(id)?.terms[termsLocale()].name ?? id;
}

const insertionName = (language: Language, mode: string): string =>
  SECTION_TEXTS[language].insertion.names[mode as StitchInsertion] ?? mode;

const insertionList = (language: Language, data: CoreData): string =>
  list(data, 'allowed')
    .map((mode) => insertionName(language, String(mode)))
    .join(', ');

const huShape = (data: CoreData): string => (isRound(data) ? 'kör' : 'sor');

const HU_SLOT_NOUN: Readonly<Record<string, string>> = { space: 'láncív', ring: 'varázskör', stitch: 'szem' };
const HU_SLOT_INTO: Readonly<Record<string, string>> = { space: 'láncívbe', ring: 'varázskörbe', stitch: 'szembe' };

const huUnchanged = (data: CoreData): string => (bool(data, 'unchanged') ? ' A minta nem változott.' : '');

const byLayer = (data: CoreData): readonly LayerCount[] => {
  const shapes = list(data, 'shapes');
  const counts = list(data, 'counts');
  return list(data, 'layers').map((layer, i): LayerCount => ({
    layer: Number(layer),
    shape: shapes[i] === 'round' ? 'round' : 'row',
    count: Number(counts[i] ?? 0),
  }));
};

const huByLayer = (data: CoreData): string => huLayerCounts(byLayer(data));

const enShape = (data: CoreData): string => (isRound(data) ? 'round' : 'row');

const EN_SLOT_NOUN: Readonly<Record<string, string>> = { space: 'chain space', ring: 'magic ring', stitch: 'stitch' };

const enUnchanged = (data: CoreData): string => (bool(data, 'unchanged') ? ' The pattern is unchanged.' : '');

const enByLayer = (data: CoreData): string => enLayerCounts(byLayer(data));

/** One dictionary for two areas: `CopyCode` is a subset of `EditCode`, because duplication passes those codes on in the `EditResult`. */
export const EDITOR_CORE_TEXTS: CoreDictionary<EditCode | CopyCode> = {
  hu: {
    'tradition-unchanged': 'A minta már ezt a hagyományt követi.',
    'unknown-stitch': (data) => `Ismeretlen szem: ${str(data, 'id')}`,
    'ring-only-at-start': 'Varázskör csak a minta elején lehet.',
    'chain-count-range': (data) => `A láncszemek száma ${num(data, 'min')} és ${num(data, 'max')} között lehet.`,
    'space-needs-row': 'A láncív egy sorban készül: előbb láncalap kell.',
    'needs-foundation': 'Előbb láncalap vagy varázskör kell.',
    'picot-after-row-end': 'A pikó egy szem tetejére kerül; a sor már véget ért.',
    'row-end-reached': 'A sor végére értél: fordulj (F), zárd a kört (K), vagy válassz célpontot a nyilakkal.',
    'no-slots': 'Nincs célpont: ebben a sorban nincs hová horgolni.',
    'needs-adjacent-stitches': (data) => `Ehhez ${num(data, 'count')} egymás melletti szem kell a célponttól.`,
    'stitch-not-into-stitch': (data) => `A(z) ${stitchName(data)} nem horgolható szembe.`,
    'insertion-not-allowed': (data) =>
      `A(z) ${stitchName(data)} nem horgolható így: ${insertionName('hu', str(data, 'requested'))}. Választható: ${insertionList('hu', data)}.`,
    'stitch-not-into-space': (data) => `A(z) ${stitchName(data)} nem horgolható láncívbe.`,
    'stitch-not-into-ring': (data) => `A(z) ${stitchName(data)} nem horgolható varázskörbe.`,
    'same-needs-basic': 'Ugyanabba csak alapszem horgolható még egyszer.',
    'same-no-stitch': 'Nincs szem ebben a sorban, amelynek a célpontjába horgolni lehetne.',
    'same-single-anchor': 'Az utolsó szemnek nincs egyetlen célpontja.',
    'same-wrong-target': 'Ez a szem ide nem horgolható.',
    'same-other-group': 'Az utolsó csoport más szemekből áll.',
    'same-other-stitch': 'Az utolsó szem nem ugyanez a szem.',
    'fill-needs-targeted': 'Ezzel a szemmel nem lehet sort kitölteni: válassz célpontba horgolható szemet.',
    'fill-no-free-slot': 'Ebben a sorban nincs szabad célpont a kitöltéshez.',
    'row-empty': 'Ebben a sorban még nincs szem.',
    'no-turn-in-round': 'Körben nem fordulunk: zárd a kört.',
    'ring-needs-chains': (data) =>
      `A láncgyűrűhöz legalább ${num(data, 'min')} láncszem kell; 2 láncszemnél horgold az 1. kört a 2. láncszembe.`,
    'insert-needs-chain-base': 'Láncszemet a láncalapba lehet beszúrni: ehhez láncszemes kezdés kell.',
    'insert-at-turning-chain': 'A láncalapnak ezen a végén az 1. sor fordulólánca áll: ide nem szúrunk be láncszemet.',
    'gap-needs-basic': 'A korábbi sor üres cellájába egyelőre alapszem kerülhet: rövidpálca, félpálca vagy pálca.',
    'gap-not-free': 'Ez a hely nem üres cella egy korábbi sorban.',
    'round-empty': 'Ebben a körben még nincs szem.',
    'no-close-in-row': 'Sorban nincs körzárás: a sor végén fordulunk.',
    'round-no-first-stitch': 'A körnek nincs első szeme, amelybe zárni lehetne.',
    'no-spiral-in-row': 'Sorban nincs spirál: a sor végén fordulunk.',
    'pattern-empty': 'A minta üres.',
    'no-such-node': (data) => `Nincs ilyen szem: ${str(data, 'id')}`,

    'no-selection': 'Nincs kijelölt szem.',
    'has-dependents': (data) =>
      `A kijelölt szemekbe még ${huStitches(num(data, 'count'))} horgol (${huByLayer(data)}); csak velük együtt törölhető.${huUnchanged(data)}`,
    'no-piece': 'A mintában nincs darab.',
    'clipboard-empty': 'A vágólap üres: előbb másolj ki szemeket.',
    'foundation-needs-empty': (data) => `A láncalapot és a varázskört csak üres mintába lehet beilleszteni.${huUnchanged(data)}`,
    'paste-needs-foundation': 'Előbb láncalap vagy varázskör kell: a beillesztett szemeknek célpont kell.',
    'paste-shape-mismatch': (data) => `${isRound(data) ? 'Kört sorba' : 'Sort körbe'} nem lehet beilleszteni.${huUnchanged(data)}`,
    'paste-round-starts-with-slip': (data) =>
      `A kör elején már van láncszem, a másolt kör kúszószemmel indul: töröld a láncszemeket, és illeszd be újra.${huUnchanged(data)}`,
    'paste-too-many-chains': (data) =>
      `A ${huShape(data)} elején már ${num(data, 'present')} láncszem van, a másolt ${huShape(data)} ${num(data, 'copied')} láncszemmel kezdődik: töröld a fölösleget, és illeszd be újra.${huUnchanged(data)}`,
    'paste-span-mismatch': (data) =>
      `A másolt ${huShape(data)} ${num(data, 'needed')} szemre épül, alatta most ${num(data, 'available')} van: a szemszám nem jön ki, ezért nem illesztettem be.${huUnchanged(data)}`,
    'paste-not-enough-slots': (data) =>
      `Nincs elég célpont: a beillesztett szemek ${num(data, 'need')} célpontra horgolnának ${bool(data, 'fromLayerStart') ? `a ${huShape(data)} elejétől` : 'a kurzortól'}, de csak ${num(data, 'available')} van.${huUnchanged(data)}`,
    'paste-slot-kind': (data) =>
      `A(z) ${num(data, 'at')}. célpont ${HU_SLOT_NOUN[str(data, 'slot')] ?? HU_SLOT_NOUN['stitch']}, a másolt szem viszont ${HU_SLOT_INTO[str(data, 'copied')] ?? HU_SLOT_INTO['stitch']} horgolt.${huUnchanged(data)}`,
    'paste-slot-used': (data) => `A(z) ${num(data, 'at')}. célpontba már horgoltál: vidd a kurzort szabad célpontra.${huUnchanged(data)}`,
    'paste-against-direction': (data) =>
      `A beillesztés a haladási irány ellen horgolna: vidd a kurzort a már horgolt célpontok utánra.${huUnchanged(data)}`,
    'paste-no-reuse-slots': (data) => `Nincs elég célpont a beillesztéshez.${huUnchanged(data)}`,
    'paste-would-break': (data) => `A beillesztés hibás szerkezetet adna, ezért nem illesztettem be.${huUnchanged(data)}`,

    'copy-broken-pattern': 'A minta szerkezete hibás, ezért nem másolható.',
    'copy-layer-outside': (data) =>
      `A kijelölt ${huLayer(num(data, 'layer'), isRound(data))} olyan szemekbe is horgol, amelyek nincsenek kijelölve: jelöld ki az alatta lévő sort is.`,
    'copy-oval-first-round':
      'Az ovális 1. köre a láncalap mindkét oldalába horgol, ezért csak a láncalappal együtt másolható, és üres mintába illeszthető be.',
    'copy-anchor-unsupported':
      'A kijelölés egy szeme nem a közvetlenül alatta lévő sor egy célpontjába horgol (pl. hosszú szem, vagy egy láncív egyik láncszeme); ezt még nem lehet másolni.',
  },
  en: {
    'tradition-unchanged': 'The pattern already follows this preset.',
    'unknown-stitch': (data) => `Unknown stitch: ${str(data, 'id')}`,
    'ring-only-at-start': 'A magic ring can only be at the start of the pattern.',
    'chain-count-range': (data) => `The number of chains must be between ${num(data, 'min')} and ${num(data, 'max')}.`,
    'space-needs-row': 'A chain space is made in a row: you need a foundation chain first.',
    'needs-foundation': 'You need a foundation chain or a magic ring first.',
    'picot-after-row-end': 'A picot goes on top of a stitch; this row has already ended.',
    'row-end-reached': 'You are at the end of the row: turn (F), join the round (K), or pick a target with the arrow keys.',
    'no-slots': 'No target: there is nowhere to work in this row.',
    'needs-adjacent-stitches': (data) => `This needs ${num(data, 'count')} neighbouring stitches from the target.`,
    'stitch-not-into-stitch': (data) => `The ${stitchName(data)} cannot be worked into a stitch.`,
    'insertion-not-allowed': (data) =>
      `The ${stitchName(data)} cannot be worked like this: ${insertionName('en', str(data, 'requested'))}. You can choose: ${insertionList('en', data)}.`,
    'stitch-not-into-space': (data) => `The ${stitchName(data)} cannot be worked into a chain space.`,
    'stitch-not-into-ring': (data) => `The ${stitchName(data)} cannot be worked into a magic ring.`,
    'same-needs-basic': 'Only a basic stitch can go into the same target once more.',
    'same-no-stitch': 'There is no stitch in this row whose target could be used.',
    'same-single-anchor': 'The last stitch does not have exactly one target.',
    'same-wrong-target': 'This stitch cannot be worked here.',
    'same-other-group': 'The last group is made of other stitches.',
    'same-other-stitch': 'The last stitch is not the same stitch.',
    'fill-needs-targeted': 'This stitch cannot fill a row: choose a stitch that is worked into a target.',
    'fill-no-free-slot': 'There is no free target left to fill in this row.',
    'row-empty': 'There is no stitch in this row yet.',
    'no-turn-in-round': 'You do not turn in a round: join the round.',
    'ring-needs-chains': (data) =>
      `A chain ring needs at least ${num(data, 'min')} chains; with 2 chains work round 1 into the 2nd chain.`,
    'insert-needs-chain-base': 'A chain can be inserted into the foundation chain: that needs a chain start.',
    'insert-at-turning-chain': 'This end of the foundation carries the turning chain of row 1: no chain is inserted here.',
    'gap-needs-basic': 'An empty cell in an earlier row takes a basic stitch for now: single, half double or double crochet.',
    'gap-not-free': 'This place is not an empty cell in an earlier row.',
    'round-empty': 'There is no stitch in this round yet.',
    'no-close-in-row': 'A row is not joined: at the end of a row you turn.',
    'round-no-first-stitch': 'The round has no first stitch to join into.',
    'no-spiral-in-row': 'A row has no spiral: at the end of a row you turn.',
    'pattern-empty': 'The pattern is empty.',
    'no-such-node': (data) => `There is no such stitch: ${str(data, 'id')}`,

    'no-selection': 'No stitch is selected.',
    'has-dependents': (data) =>
      `${enStitches(num(data, 'count'))} are still worked into the selected stitches (${enByLayer(data)}); they can only be deleted together.${enUnchanged(data)}`,
    'no-piece': 'The pattern has no piece.',
    'clipboard-empty': 'The clipboard is empty: copy some stitches first.',
    'foundation-needs-empty': (data) =>
      `A foundation chain and a magic ring can only be pasted into an empty pattern.${enUnchanged(data)}`,
    'paste-needs-foundation': 'You need a foundation chain or a magic ring first: the pasted stitches need a target.',
    'paste-shape-mismatch': (data) =>
      `${isRound(data) ? 'A round cannot be pasted into a row' : 'A row cannot be pasted into a round'}.${enUnchanged(data)}`,
    'paste-round-starts-with-slip': (data) =>
      `There are already chains at the start of the round, and the copied round starts with a slip stitch: delete the chains and paste again.${enUnchanged(data)}`,
    'paste-too-many-chains': (data) =>
      `The ${enShape(data)} already starts with ${num(data, 'present')} chains, and the copied ${enShape(data)} starts with ${num(data, 'copied')} chains: delete the extra ones and paste again.${enUnchanged(data)}`,
    'paste-span-mismatch': (data) =>
      `The copied ${enShape(data)} is built on ${num(data, 'needed')} stitches, but there are ${num(data, 'available')} below it now: the stitch count does not work out, so nothing was pasted.${enUnchanged(data)}`,
    'paste-not-enough-slots': (data) =>
      `Not enough targets: the pasted stitches would need ${num(data, 'need')} targets ${bool(data, 'fromLayerStart') ? `from the start of the ${enShape(data)}` : 'from the cursor'}, but there are only ${num(data, 'available')}.${enUnchanged(data)}`,
    'paste-slot-kind': (data) =>
      `Target ${num(data, 'at')} is a ${EN_SLOT_NOUN[str(data, 'slot')] ?? EN_SLOT_NOUN['stitch']}, but the copied stitch was worked into a ${EN_SLOT_NOUN[str(data, 'copied')] ?? EN_SLOT_NOUN['stitch']}.${enUnchanged(data)}`,
    'paste-slot-used': (data) =>
      `You have already worked into target ${num(data, 'at')}: move the cursor to a free target.${enUnchanged(data)}`,
    'paste-against-direction': (data) =>
      `Pasting would work against the direction of travel: move the cursor past the targets you have worked.${enUnchanged(data)}`,
    'paste-no-reuse-slots': (data) => `There are not enough targets to paste into.${enUnchanged(data)}`,
    'paste-would-break': (data) => `Pasting would give a broken structure, so nothing was pasted.${enUnchanged(data)}`,

    'copy-broken-pattern': 'The structure of the pattern is broken, so it cannot be copied.',
    'copy-layer-outside': (data) =>
      `The selected ${enLayer(num(data, 'layer'), isRound(data))} is also worked into stitches that are not selected: select the row below it as well.`,
    'copy-oval-first-round':
      'Round 1 of the oval is worked into both sides of the foundation chain, so it can only be copied together with the foundation chain, and pasted into an empty pattern.',
    'copy-anchor-unsupported':
      'One of the selected stitches is not worked into a target of the row directly below it (for example a spike stitch, or a single chain of a chain space); this cannot be copied yet.',
  },
};
