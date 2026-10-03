/*
 * The static labels of index.html (PQW-900), a flat key-to-text dictionary the
 * `data-i18n*` attributes point at. An unknown key throws, so a key in the HTML
 * and a key here have to match exactly.
 *
 * KB: dictionaries.md §7
 */

import type { Dictionary } from '../i18n.ts';

export const MARKUP_TEXTS = {
  hu: {
    docTitle: 'Ingyenes horgolásminta-tervező és jeldiagram-készítő — Dragonette',
    docDescription:
      'Ingyenes horgolásminta-tervező a böngészőben: jeldiagram sorokhoz és körökhöz, élő ellenőrzés, írott minta, kendő, amigurumi és filé, PNG/SVG export.',
    homeLabel: 'Vissza a dragonettecrochet.com főoldalára',
    homeText: 'Főoldal',
    barTitle: 'Mintatervező',
    wipBanner: 'Fejlesztés alatt: a tervező folyamatosan bővül, nézz vissza később.',
    toolLabelNew: 'Új',
    irregularNewTitle: 'Új szabálytalan minta',
    toolLabelUndo: 'Visszavonás',
    undoTip: 'Visszavonás (Ctrl/⌘ + Z)',
    toolLabelRedo: 'Újra',
    redoTip: 'Újra (Ctrl/⌘ + Y vagy Ctrl/⌘ + Shift + Z)',
    toolPointerLabel: 'Kijelölés',
    selectToolTip:
      'Kijelölés: kattints egy szemre, vagy húzz területet; Ctrl/⌘ vagy Shift + kattintás: több szem. A kijelölést húzva mozgathatod, a kerek fogóval forgathatod, a sarkoknál nagyíthatod és kicsinyítheted.',
    toolLabelDuplicate: 'Másolás',
    duplicateTip: 'A kijelölés megkettőzése (Ctrl/⌘ + D). Ctrl/⌘ + C: másolás, Ctrl/⌘ + V: beillesztés.',
    toolLabelDeleteSelection: 'Törlés',
    toolDeleteSelectionTip: 'Kijelölt szemek törlése (Delete)',
    sectionStitchesTitle: 'Szemek',
    stitchesPaletteLabel: 'Szemek',
    boardIrregularLabel: 'Szabadkézi diagram: válassz szemet, és kattints a rajzlapra',
    boardIrregularRoleDescription: 'szabadkézi jeldiagram',
    uiLanguageLabel: 'A felület nyelve',
    chartStyleLabel: 'Jelstílus',
    inspectorLabel: 'Tulajdonságok',
    arrangeTitle: 'Rendezés',
    arrangeRowLabel: 'Sorba',
    arrangeAroundLabel: 'Ívbe',
    arrangeGapLabel: 'Távolság',
    arrangeRadiusLabel: 'Sugár',
    arrangeAngleLabel: 'Szög (°)',
    arrangeFacingLabel: 'A pont felé',
    arrangeFacingFeet: 'Talp',
    arrangeFacingTops: 'Csúcs',
    placeTitle: 'Lerakás',
    placeCountLabel: 'Darabszám',
    placePartsLabel: 'Szemek száma',
  },
  en: {
    docTitle: 'Free Crochet Pattern Designer & Chart Maker — Dragonette',
    docDescription:
      'Free crochet pattern designer and chart maker in your browser: symbol charts for rows and rounds, live checking, written patterns, shawls, amigurumi.',
    homeLabel: 'Back to the dragonettecrochet.com home page',
    homeText: 'Home',
    barTitle: 'Pattern designer',
    wipBanner: 'Work in progress: the designer keeps growing, so do check back later.',
    toolLabelNew: 'New',
    irregularNewTitle: 'New free-form pattern',
    toolLabelUndo: 'Undo',
    undoTip: 'Undo (Ctrl/⌘ + Z)',
    toolLabelRedo: 'Redo',
    redoTip: 'Redo (Ctrl/⌘ + Y or Ctrl/⌘ + Shift + Z)',
    toolPointerLabel: 'Select',
    selectToolTip:
      'Select: click a stitch or drag an area; Ctrl/⌘ or Shift + click: several. Drag the selection to move it, the round handle to rotate it, a corner to make it larger or smaller.',
    toolLabelDuplicate: 'Duplicate',
    duplicateTip: 'Duplicate the selection (Ctrl/⌘ + D). Ctrl/⌘ + C copies it, Ctrl/⌘ + V pastes it.',
    toolLabelDeleteSelection: 'Delete',
    toolDeleteSelectionTip: 'Delete the selected stitches (Delete)',
    sectionStitchesTitle: 'Stitches',
    stitchesPaletteLabel: 'Stitches',
    boardIrregularLabel: 'Free-form chart: pick a stitch and click the drawing area',
    boardIrregularRoleDescription: 'free-form crochet chart',
    uiLanguageLabel: 'Interface language',
    chartStyleLabel: 'Symbol style',
    inspectorLabel: 'Properties',
    arrangeTitle: 'Arrange',
    arrangeRowLabel: 'In a row',
    arrangeAroundLabel: 'Around',
    arrangeGapLabel: 'Spacing',
    arrangeRadiusLabel: 'Radius',
    arrangeAngleLabel: 'Angle (°)',
    arrangeFacingLabel: 'Facing the point',
    arrangeFacingFeet: 'Feet',
    arrangeFacingTops: 'Tops',
    placeTitle: 'Placing',
    placeCountLabel: 'Count',
    placePartsLabel: 'Number of stitches',
  },
} satisfies Dictionary<Record<string, string>>;
