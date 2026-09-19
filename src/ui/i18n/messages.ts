/*
 * The status line, the dialogs and the toolbar (main.ts), PQW-900. A Hungarian
 * sentence holds the place of a stitch name in a single substitution, so
 * main.ts can give the name its own `lang` attribute.
 *
 * KB: dictionaries.md §1, §2, §5, interface.md §3
 */

import type { LayerCount } from '../../core/selection.ts';
import type { Dictionary } from '../i18n.ts';
import { enLayerCounts, huLayerCounts } from './core/layer-counts.ts';

const stitches = (count: number): string => `${count} ${count === 1 ? 'stitch' : 'stitches'}`;

const chains = (count: number): string => `${count} ${count === 1 ? 'chain' : 'chains'}`;

const hu = {
  storage: {
    broken: 'A böngészőben mentett minta nem tölthető be, ezért új minta indult.',
    saveFailed: 'A mintát nem sikerült a böngészőbe menteni; JSON-ként mentsd le.',
  },

  layer: {
    /** In rows the printed number is one higher than the layer index. KB: interface.md §33 */
    name: (index: number, round: boolean): string => `${index + (round ? 0 : 1)}. ${round ? 'kör' : 'sor'}`,
    count: (count: number, round: boolean): string => `${count} ${round ? 'kör' : 'sor'}`,
  },

  progress: {
    next: (layer: string): string => `${layer} következik.`,
    current: (layer: string, count: number, rest: string): string => `${layer}: ${count} szem${rest}.`,
    remaining: (count: number): string => `, még ${count} célpont`,
    spiralHint: ' A kör végén folytasd spirálban (Alt+S).',
    closeHint: ' A kör végén zárd a kört (Alt+K).',
  },

  target: {
    rowEnd: 'A sor végén vagy: nincs több célpont.',
    none: 'Nincs célpont.',
    space: (chainCount: number): string => `láncív (${chainCount} láncszem)`,
    ring: 'varázskör',
    underside: 'láncszem másik oldala',
    stitch: 'szem',
    used: ', már horgoltál bele',
    at: (index: number, total: number, what: string, used: string): string => `Célpont: ${index}/${total}, ${what}${used}.`,
  },

  summary: {
    empty: 'Üres minta: kezdd láncalappal (Láncszem) vagy varázskörrel.',
    clean: 'Nincs hiba és figyelmeztetés.',
    counts: (errors: number, warnings: number): string => `${errors} hiba, ${warnings} figyelmeztetés.`,
  },

  errorBar: {
    none: 'Nincs hiba',
    errors: (count: number): string => `${count} hiba`,
    warnings: (count: number): string => `${count} figyelmeztetés`,
  },

  findings: {
    error: 'Hiba: ',
    warning: 'Figyelmeztetés: ',
    nodes: (count: number): string => ` · ${count} szem`,
    /*
     * There is no „Részletek” disclosure and no knowledge-base reference here:
     * both were removed in PQW-930. KB: decisions.md §3
     */
    marked: 'A találat szemei megjelölve a mintán.',
  },

  adjust: {
    pinned: ', kézzel igazítva',
  },

  hint: {
    none: 'Válassz szemet. Szem nélkül kattintással szemet jelölsz ki (Shift-tel többet, a sorszámmal a teljes sort), és törölheted, duplikálhatod vagy igazíthatod.',
    chain: (name: string): string => `${name}: Enterrel vagy a vászonra kattintva horgolod, a megadott számú láncszemmel.`,
    simple: (name: string): string => `${name}: Enterrel vagy a vászonra kattintva horgolod.`,
    targeted: (name: string): string => `${name}: nyilakkal választod a célpontot, Enterrel vagy kattintással horgolsz bele.`,
  },

  written: {
    copied: 'Az írott minta a vágólapra került.',
    copyFailed: 'A másolás nem sikerült; a szöveg ki van jelölve, Ctrl+C-vel másolhatod.',
    sizeValue: (percent: number): string => `A munkaterület ${percent} százaléka`,
    back: 'Vissza',
    full: 'Teljes nézet',
    restored: 'Az írott minta visszakapta a korábbi magasságát.',
    fullscreen: 'Az írott minta a teljes munkaterületen.',
  },

  notation: {
    terms: (label: string): string => `Jelölés: ${label}.`,
    chartStyle: (label: string): string => `Jelstílus: ${label}.`,
    /* The user does not choose the single crochet symbol (PQW-929), so nothing reports it. KB: decisions.md §4 */
    tradition: (label: string): string => `Előbeállítás: ${label}. A jelek és a számolás is ezt követik.`,
  },

  work: {
    needStitch: 'Előbb válassz szemet a jelkészletből (Alt+1–9).',
    needStitchShort: 'Előbb válassz szemet.',
    chains: (name: string, count: number): string => `${name}: ${count} láncszem.`,
    worked: (name: string): string => `${name} horgolva.`,
    workedInto: (name: string, mode: string): string => `${name} horgolva${mode}.`,
    increase: (name: string): string => `${name}: szaporítás.`,
    sameAgain: 'Még egy ugyanabba.',
    fillRow: (mode: string): string => `Sor kitöltve${mode}.`,
    needTargetStitch: 'Előbb válassz célpontba horgolható szemet a sor kitöltéséhez.',
    foundationDone: 'Az 1. sor kész, a munka megfordítva.',
    rowEnd: 'Sor vége, fordulás.',
    chainInserted: 'Láncszem beszúrva a láncalapba.',
    gapFilled: 'Szem a korábbi sor üres cellájába.',
    chainRing: 'Láncgyűrű: a láncszemek gyűrűvé zárva.',
    roundClosed: 'Kör zárva.',
    spiral: 'Kör vége: a következő kör zárás nélkül, spirálban folytatódik.',
    deleteLast: 'Az utolsó lépés törölve.',
    undo: 'Visszavonva.',
    redo: 'Újra.',
    nudged: 'Jel eltolva.',
    unpinned: 'A jel a számolt helyére került.',
    /* A new pattern announces nothing (PQW-929). KB: decisions.md §4 */
    titleChanged: 'A minta neve módosult.',
  },

  dialog: {
    /* Only deleting asks; increasing and filling in do not (PQW-931, PQW-932). KB: decisions.md §4 */
    deleteQuestion: (selected: number, dependents: number, where: readonly LayerCount[]): string =>
      `A kijelölt ${selected} szembe még ${dependents} szem horgol: ${huLayerCounts(where, dependents)}. Velük együtt törlöd?`,
    deleteConfirm: 'Törlés velük együtt',
    /** The cancel button of the delete dialog; every other dialog takes dialog.ts's default. */
    cancel: 'Megszakítás',
  },

  view: {
    gridOn: 'Rács bekapcsolva.',
    gridOff: 'Rács kikapcsolva.',
    aspectOn: 'Arányhelyes nézet: a cellák és a rács a valós szemarányt követik.',
    aspectOff: 'Arányhelyes nézet kikapcsolva.',
  },

  file: {
    fallbackName: 'minta',
    jsonSaved: 'JSON mentve.',
    svgSaved: 'SVG mentve.',
    pngSaved: 'PNG mentve.',
    pngFailed: 'A PNG-t nem sikerült elkészíteni; az SVG-export működik.',
    loadFailed: (message: string, path: string): string => `A fájl nem tölthető be: ${message} (${path})`,
    brokenStructure: (problem: string): string => `A fájl szerkezete hibás, ezért nem tölthető be: ${problem}`,
    notationNote: (recorded: string, shown: string): string =>
      ` A minta ${recorded} jelöléssel készült; a nézet a beállításod szerint ${shown}.`,
    loaded: (note: string): string => `Minta betöltve; visszavonással a korábbi visszajön.${note}`,
  },

  selection: {
    none: 'Nincs kijelölt szem.',
    focus: (name: string): string => `${name}. `,
    count: (count: number, where: readonly LayerCount[]): string => `Kijelölve: ${count} szem (${huLayerCounts(where, count)}).`,
    layer: (layer: string, count: number): string => `${layer} kijelölve: ${count} szem.`,
    areaOn: 'Terület: húzz téglalapot a szemek köré (Shift: hozzáadás).',
    areaOff: 'Terület kijelölése kikapcsolva.',
    emptyRect: 'A téglalapban nincs szem.',
    needSelection: 'Nincs kijelölt szem: kattints egy szemre vagy a sorszámra.',
    deleteCancelled: 'A törlés megszakítva; a minta nem változott.',
    deleted: (count: number): string => `${count} szem törölve.`,
    nothingToCopy: 'Nincs kijelölt szem a másoláshoz.',
    nothingToDuplicate: 'Nincs kijelölt szem a duplikáláshoz.',
    copied: (count: number, where: string): string => `${count} szem a vágólapon; Ctrl+V: beillesztés ${where}.`,
    asLayer: (round: boolean): string => `új ${round ? 'körként' : 'sorként'}`,
    atCursor: 'a kurzortól',
    clipboardEmpty: 'A vágólap üres: jelölj ki szemeket, és másold ki őket (Ctrl+C).',
    pasted: (count: number): string => `${count} szem beillesztve.`,
    duplicated: (count: number): string => `A kijelölés duplikálva (${count} szem).`,
    emptyPattern: 'A minta üres: nincs mit kijelölni.',
  },

  types: {
    selected: (name: string, detail: string): string => `Mintatípus: ${name}. ${detail}`,
  },

  language: {
    changed: 'A felület nyelve magyar.',
  },
};

const en: typeof hu = {
  storage: {
    broken: 'The pattern saved in your browser cannot be loaded, so a new pattern was started.',
    saveFailed: 'The pattern could not be saved in your browser; save it as a JSON file.',
  },

  layer: {
    name: (index, round) => `${round ? 'Round' : 'Row'} ${index + (round ? 0 : 1)}`,
    count: (count, round) => `${count} ${round ? (count === 1 ? 'round' : 'rounds') : count === 1 ? 'row' : 'rows'}`,
  },

  progress: {
    next: (layer) => `${layer} is next.`,
    current: (layer, count, rest) => `${layer}: ${stitches(count)}${rest}.`,
    remaining: (count) => `, ${count} more ${count === 1 ? 'target' : 'targets'}`,
    spiralHint: ' At the end of the round, continue in a spiral (Alt+S).',
    closeHint: ' At the end of the round, join the round (Alt+K).',
  },

  target: {
    rowEnd: 'You are at the end of the row: no more targets.',
    none: 'No target.',
    space: (chainCount) => `chain space (${chains(chainCount)})`,
    ring: 'magic ring',
    underside: 'the other side of the chain',
    stitch: 'stitch',
    used: ', already worked into',
    at: (index, total, what, used) => `Target: ${index}/${total}, ${what}${used}.`,
  },

  summary: {
    empty: 'Empty pattern: start with a foundation chain (Chain) or a magic ring.',
    clean: 'No errors or warnings.',
    counts: (errors, warnings) =>
      `${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}.`,
  },

  errorBar: {
    none: 'No errors',
    errors: (count) => `${count} ${count === 1 ? 'error' : 'errors'}`,
    warnings: (count) => `${count} ${count === 1 ? 'warning' : 'warnings'}`,
  },

  findings: {
    error: 'Error: ',
    warning: 'Warning: ',
    nodes: (count) => ` · ${stitches(count)}`,
    marked: 'The stitches of the finding are marked on the chart.',
  },

  adjust: {
    pinned: ', moved by hand',
  },

  hint: {
    none: 'Choose a stitch. With no stitch chosen, clicking selects a stitch (Shift for more, the row number for the whole row), which you can then delete, duplicate or move.',
    chain: (name) => `${name}: work it with Enter or by clicking the canvas, with the number of chains you set.`,
    simple: (name) => `${name}: work it with Enter or by clicking the canvas.`,
    targeted: (name) => `${name}: pick the target with the arrow keys, then work into it with Enter or a click.`,
  },

  written: {
    copied: 'The written pattern is on the clipboard.',
    copyFailed: 'Copying failed; the text is selected, so you can copy it with Ctrl+C.',
    sizeValue: (percent) => `${percent} percent of the work area`,
    back: 'Back',
    full: 'Full view',
    restored: 'The written pattern is back to its earlier height.',
    fullscreen: 'The written pattern fills the whole work area.',
  },

  notation: {
    terms: (label) => `Notation: ${label}.`,
    chartStyle: (label) => `Symbol style: ${label}.`,
    tradition: (label) => `Preset: ${label}. The symbols and the stitch counts follow it too.`,
  },

  work: {
    needStitch: 'First choose a stitch from the symbol set (Alt+1–9).',
    needStitchShort: 'First choose a stitch.',
    chains: (name, count) => `${name}: ${chains(count)}.`,
    worked: (name) => `${name} worked.`,
    workedInto: (name, mode) => `${name} worked${mode}.`,
    increase: (name) => `${name}: increase.`,
    sameAgain: 'One more into the same target.',
    fillRow: (mode) => `Row filled${mode}.`,
    needTargetStitch: 'To fill the row, first choose a stitch that is worked into a target.',
    foundationDone: 'Row 1 is finished, the work is turned.',
    rowEnd: 'End of row, turning.',
    chainInserted: 'Chain inserted into the foundation.',
    gapFilled: 'Stitch placed into the empty cell of an earlier row.',
    chainRing: 'Chain ring: the chains are joined into a ring.',
    roundClosed: 'Round joined.',
    spiral: 'End of round: the next round continues in a spiral, without joining.',
    deleteLast: 'The last step is deleted.',
    undo: 'Undone.',
    redo: 'Redone.',
    nudged: 'Symbol moved.',
    unpinned: 'The symbol is back at its calculated place.',
    titleChanged: 'The pattern name has changed.',
  },

  dialog: {
    deleteQuestion: (selected, dependents, where) =>
      `${stitches(dependents)} are still worked into the ${stitches(selected)} you selected: ${enLayerCounts(where, dependents)}. Delete them together?`,
    deleteConfirm: 'Delete together',
    cancel: 'Cancel',
  },

  view: {
    gridOn: 'Grid on.',
    gridOff: 'Grid off.',
    aspectOn: 'True-proportion view: the cells and the grid follow the real gauge.',
    aspectOff: 'True-proportion view off.',
  },

  file: {
    fallbackName: 'pattern',
    jsonSaved: 'JSON saved.',
    svgSaved: 'SVG saved.',
    pngSaved: 'PNG saved.',
    pngFailed: 'The PNG could not be created; the SVG export still works.',
    loadFailed: (message, path) => `The file cannot be loaded: ${message} (${path})`,
    brokenStructure: (problem) => `The file has a broken structure, so it cannot be loaded: ${problem}`,
    notationNote: (recorded, shown) => ` The pattern was made in ${recorded} notation; your setting shows it in ${shown}.`,
    loaded: (note) => `Pattern loaded; undo brings the previous one back.${note}`,
  },

  selection: {
    none: 'No stitch is selected.',
    focus: (name) => `${name}. `,
    count: (count, where) => `Selected: ${stitches(count)} (${enLayerCounts(where, count)}).`,
    layer: (layer, count) => `${layer} selected: ${stitches(count)}.`,
    areaOn: 'Area: drag a rectangle around the stitches (Shift: add to the selection).',
    areaOff: 'Area selection off.',
    emptyRect: 'There is no stitch in the rectangle.',
    needSelection: 'No stitch is selected: click a stitch or a row number.',
    deleteCancelled: 'Deleting cancelled; the pattern has not changed.',
    deleted: (count) => `${stitches(count)} deleted.`,
    nothingToCopy: 'No stitch is selected to copy.',
    nothingToDuplicate: 'No stitch is selected to duplicate.',
    copied: (count, where) => `${stitches(count)} on the clipboard; Ctrl+V pastes ${where}.`,
    asLayer: (round) => `as a new ${round ? 'round' : 'row'}`,
    atCursor: 'at the cursor',
    clipboardEmpty: 'The clipboard is empty: select stitches and copy them (Ctrl+C).',
    pasted: (count) => `${stitches(count)} pasted.`,
    duplicated: (count) => `Selection duplicated (${stitches(count)}).`,
    emptyPattern: 'The pattern is empty: there is nothing to select.',
  },

  types: {
    selected: (name, detail) => `Pattern type: ${name}. ${detail}`,
  },

  language: {
    changed: 'The interface language is English.',
  },
};

export const MESSAGE_TEXTS = { hu, en } satisfies Dictionary<typeof hu>;
