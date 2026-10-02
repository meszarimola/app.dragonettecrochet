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
    sectionStitchesTitle: 'Szemek',
    stitchesPaletteLabel: 'Szemek',
    boardIrregularLabel: 'Szabadkézi diagram: válassz szemet, és kattints a rajzlapra',
    boardIrregularRoleDescription: 'szabadkézi jeldiagram',
    uiLanguageLabel: 'A felület nyelve',
    chartStyleLabel: 'Jelstílus',
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
    sectionStitchesTitle: 'Stitches',
    stitchesPaletteLabel: 'Stitches',
    boardIrregularLabel: 'Free-form chart: pick a stitch and click the drawing area',
    boardIrregularRoleDescription: 'free-form crochet chart',
    uiLanguageLabel: 'Interface language',
    chartStyleLabel: 'Symbol style',
  },
} satisfies Dictionary<Record<string, string>>;
