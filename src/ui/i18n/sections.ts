/*
 * The panel sections and the pattern-type menu (PQW-900): the size and yarn
 * section, the written-pattern panel, the insertion modes, the palette group
 * titles, the notation names, the chart export labels and the dialog buttons.
 *
 * KB: dictionaries.md §1, §6, interface.md §2
 */

import type { DimensionBasis } from '../../core/gauge.ts';
import type { YarnMissing } from '../../core/pattern-size.ts';
import type { StitchSectionId } from '../../core/stitches.ts';
import type { ChartStyle, GaugeForm, Locale, StitchInsertion, Tradition, ValueSource } from '../../core/types.ts';
import type { Dictionary } from '../i18n.ts';
import type { PatternTypeId } from '../pattern-types.ts';
import { enLayer, huLayer } from './core/layer-counts.ts';

interface TypeEntry {
  readonly name: string;
  readonly detail: string;
}

export interface SectionTexts {
  readonly types: {
    readonly menu: Readonly<Record<PatternTypeId, TypeEntry>>;
    readonly soon: string;
  };
  readonly size: {
    readonly sources: Readonly<Record<ValueSource, string>>;
    readonly forms: Readonly<Record<GaugeForm, string>>;
    readonly hook: {
      readonly steel: string;
      readonly oldUk: (size: string) => string;
      readonly none: string;
      readonly nonStandard: (mm: string, names: string) => string;
    };
    readonly profile: {
      readonly unnamedYarn: string;
      readonly blocked: string;
      readonly unblocked: string;
      readonly none: string;
      readonly noCyc: string;
      readonly chosen: (label: string) => string;
      readonly cleared: string;
      readonly added: string;
      readonly removed: (label: string) => string;
      readonly nameChanged: string;
      readonly cycChanged: string;
      readonly blockedOn: string;
      readonly blockedOff: string;
      readonly estimatedFromMeterage: (label: string) => string;
      readonly invalid: {
        readonly meterage: string;
        readonly ball: string;
        readonly hook: string;
        readonly swatchWidth: string;
        readonly swatchHeight: string;
        readonly swatchMass: string;
      };
      readonly changed: {
        readonly meterage: string;
        readonly ball: string;
        readonly hook: string;
        readonly swatchWidth: string;
        readonly swatchHeight: string;
        readonly swatchMass: string;
      };
    };
    readonly gauge: {
      readonly stitch: string;
      readonly form: string;
      readonly stitches: string;
      readonly rows: string;
      readonly rounds: string;
      readonly source: string;
      readonly remove: string;
      readonly removeLabel: (name: string) => string;
      readonly added: string;
      readonly removed: string;
      readonly allUsed: string;
      readonly duplicate: (name: string, form: string) => string;
      readonly changed: string;
      readonly invalidNumber: string;
      readonly note: (stitches: string, rows: string, form: GaugeForm) => string;
    };
    readonly result: {
      readonly basis: Readonly<Record<Exclude<DimensionBasis, 'measured'>, string>>;
      readonly missing: Readonly<Record<YarnMissing, string>>;
      readonly noProfile: (hookMm: string) => string;
      readonly partial: (how: string) => string;
      readonly width: string;
      readonly height: string;
      readonly diameter: string;
      readonly noLayers: string;
      readonly mixedTotal: string;
      readonly headers: (round: boolean) => readonly string[];
      readonly layerLabel: (index: number, round: boolean) => string;
      readonly yarnInPiece: string;
      readonly lengthWithBuffer: string;
      readonly balls: string;
      readonly ballsUnit: string;
      readonly yarnNote: (ballMassG: string, ballLengthM: string) => string;
      readonly missingNote: (list: string) => string;
      readonly range: (range: string) => string;
    };
  };
  readonly written: {
    readonly empty: string;
    readonly notWritable: (reason: string) => string;
    readonly broken: string;
    readonly partial: (layer: string, remaining: number) => string;
    readonly errors: (count: number) => string;
    /** Stands in for a missing title; its language is the notation's, not the interface's. */
    readonly untitled: string;
  };
  readonly insertion: {
    readonly names: Readonly<Record<StitchInsertion, string>>;
    readonly written: string;
  };
  readonly palette: {
    readonly titles: Readonly<Record<StitchSectionId, string>>;
  };
  readonly notation: {
    readonly terms: Readonly<Record<Locale, string>>;
    readonly chartStyles: Readonly<Record<ChartStyle, string>>;
    readonly traditions: Readonly<Record<Tradition, string>>;
  };
  readonly chart: {
    readonly title: (title: string) => string;
    readonly untitled: string;
    readonly legend: string;
    readonly legendWith: (system: string) => string;
    readonly rightSide: string;
    readonly wrongSide: string;
    readonly notation: (terms: string, style: string) => string;
    readonly repeat: (repeat: string) => string;
    readonly insertions: string;
    readonly grid: string;
    readonly unitFrame: string;
    readonly spike: string;
    readonly mirror: string;
    readonly layerName: (layer: number, round: boolean) => string;
    readonly cycNote: string;
    readonly japaneseNote: string;
  };
  readonly dialog: {
    readonly cancel: string;
    readonly details: string;
  };
}

const capitalize = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const hu: SectionTexts = {
  types: {
    menu: {
      regular: { name: 'Szabályos horgolás', detail: 'Sík sorok, kör és motívum (pl. nagymama-négyzet).' },
      filet: { name: 'Filéhorgolás', detail: 'Rács teli és nyitott cellákkal; C2C, tapestry és graphgan is.' },
      // The words „írott minta” may not appear here: the panel toggle's accessible name has to stay unique.
      amigurumi: { name: 'Amigurumi', detail: 'Térbeli forma spirálban, részekből: gömb, henger, kúp. A mintát szövegként írja, a rajz kiegészítés.' },
      irregular: { name: 'Szabálytalan horgolás', detail: 'Formázott, amorf darab (pl. ruhadarab, babacipő).' },
    },
    soon: 'Hamarosan',
  },
  size: {
    sources: { measured: 'mért', label: 'címkéről', estimated: 'becsült' },
    forms: { rows: 'síkban', rounds: 'körben' },
    hook: {
      steel: 'Acéltű: az amerikai számozás gyártónként eltér, a mm a mérvadó.',
      oldUk: (size) => `régi UK ${size}`,
      none: 'Nincs amerikai és régi brit megfelelője.',
      nonStandard: (mm, names) => `Nem szabványos méret; a legközelebbi ${mm} mm${names ? ` (${names})` : ''}.`,
    },
    profile: {
      unnamedYarn: 'Névtelen fonal',
      blocked: 'blokkolva',
      unblocked: 'blokkolás nélkül',
      none: 'Profil nélkül (becslés)',
      noCyc: 'Nincs a címkén',
      chosen: (label) => `Profil: ${label}.`,
      cleared: 'Profil nélkül: a méret becslés, tartománnyal.',
      added: 'Új profil: add meg a fonalat, a tűt és a mért értékeket.',
      removed: (label) => `Profil törölve: ${label}. Visszavonással visszajön.`,
      nameChanged: 'A fonal neve módosult.',
      cycChanged: 'A fonal vastagsági kategóriája módosult.',
      blockedOn: 'A profil blokkolva mért.',
      blockedOff: 'A profil blokkolás nélkül mért.',
      estimatedFromMeterage: (label) => `becsült a m/100 g-ből: ${label}`,
      invalid: {
        meterage: 'A méter/100 g pozitív szám, vagy maradjon üresen.',
        ball: 'A gombolyag tömege pozitív szám, vagy maradjon üresen.',
        hook: 'A tű mérete kötelező: 30 mm-nél nem nagyobb pozitív szám.',
        swatchWidth: 'A próbadarab szélessége pozitív szám, vagy maradjon üresen.',
        swatchHeight: 'A próbadarab magassága pozitív szám, vagy maradjon üresen.',
        swatchMass: 'A próbadarab tömege pozitív szám, vagy maradjon üresen.',
      },
      changed: {
        meterage: 'A fonal m/100 g értéke módosult.',
        ball: 'A gombolyag tömege módosult.',
        hook: 'A tű mérete módosult.',
        swatchWidth: 'A próbadarab szélessége módosult.',
        swatchHeight: 'A próbadarab magassága módosult.',
        swatchMass: 'A próbadarab tömege módosult.',
      },
    },
    gauge: {
      stitch: 'Szem',
      form: 'Mérve',
      stitches: 'Szem 10 cm-en',
      rows: 'Sor 10 cm-en',
      rounds: 'Kör 10 cm-en',
      source: 'Eredet',
      remove: 'Sor törlése',
      removeLabel: (name) => `${name}: a sor törlése`,
      added: 'Új sor a mintasűrűséghez.',
      removed: 'A mintasűrűség sora törölve.',
      allUsed: 'Minden szem mindkét formában szerepel már.',
      duplicate: (name, form) => `${name}, ${form}: ilyen sor már van.`,
      changed: 'A mintasűrűség módosult.',
      invalidNumber: 'A 10 cm-en számolt szem és sor pozitív szám, vagy maradjon üresen.',
      note: (stitches, rows, form) =>
        `Hiányos, a méretbe még nem számít. Becslés ehhez a profilhoz: ${stitches} szem és ${rows} ${form === 'rows' ? 'sor' : 'kör'} 10 cm-en.`,
    },
    result: {
      basis: {
        'profile-stitch': 'a nem mért szemek más mért szemből átszámolva',
        'profile-other-form': 'a másik formában mért rövidpálcából',
        hook: 'a tűméretből',
      },
      missing: {
        profile: 'egy profil a próbadarab tömegével',
        swatch: 'a próbadarab szélessége, magassága és tömege',
        meterage: 'a fonal m/100 g értéke',
        ball: 'egy gombolyag tömege',
        size: 'a darab teljes mérete',
      },
      noProfile: (hookMm) =>
        `Nincs profil: a méret becslés ${hookMm} mm-es tűből, tartománnyal. Pontosabb lesz, ha próbadarabot mérsz, és profilként megadod.`,
      partial: (how) => `A méret egy része becslés${how ? ` (${how})` : ''}, tartománnyal.`,
      width: 'Szélesség',
      height: 'Magasság',
      diameter: 'Átmérő',
      noLayers: 'Még nincs sor vagy kör: kezdd láncalappal vagy varázskörrel, és horgolj legalább egy sort.',
      mixedTotal: 'Sorokból és körökből álló darab teljes mérete még nem számolható; soronként lent látszik.',
      headers: (round) => (round ? ['Kör', 'Kerület, cm', 'Magasság, cm', 'Sugár, cm'] : ['Sor', 'Szélesség, cm', 'Magasság, cm', 'Eddig, cm']),
      // KB: interface.md §33
      layerLabel: (index, round) => (round ? `${index}. kör` : `${index + 1}. sor`),
      yarnInPiece: 'Fonal a darabban',
      lengthWithBuffer: 'Hossz tartalékkal',
      balls: 'Gombolyag',
      ballsUnit: 'db',
      yarnNote: (ballMassG, ballLengthM) =>
        `Egy gombolyag ${ballMassG} g, ${ballLengthM} m. A próbadarab tömegéből, 10–15 % tartalékkal, egész gombolyagra felfelé kerekítve.`,
      missingNote: (list) => `A fonalbecsléshez hiányzik: ${list}.`,
      range: (range) => `tartomány: ${range}`,
    },
  },
  written: {
    empty: 'Még nincs mit kiírni: kezdd láncalappal vagy varázskörrel.',
    notWritable: (reason) => `Ez a minta még nem írható ki. ${reason}`,
    broken: 'A minta szerkezete hibás, ezért nem írható ki; a hibákat az Ellenőrzés sorolja fel.',
    partial: (layer, remaining) => `A ${layer} félkész, még ${remaining} célpont van hátra: a szöveg a mostani állapotot írja le.`,
    errors: (count) => `A mintában ${count} hiba van (lásd Ellenőrzés), ezért a szöveg így nem követhető.`,
    untitled: 'Névtelen minta',
  },
  insertion: {
    names: {
      'both-loops': 'mindkét szál',
      'front-loop': 'első szál',
      'back-loop': 'hátsó szál',
      'front-post': 'első relief',
      'back-post': 'hátsó relief',
    },
    written: 'Írott mintában: ',
  },
  palette: {
    titles: {
      basic: 'Alapszemek',
      'increase-decrease': 'Szaporítás és fogyasztás',
      compound: 'Összetett szemek',
      structure: 'Láncív és varázskör',
    },
  },
  notation: {
    terms: { hu: 'magyar', 'en-US': 'amerikai angol', 'en-GB': 'brit angol' },
    chartStyles: { cyc: 'CYC', jis: 'japán (JIS)' },
    traditions: { cyc: 'nemzetközi (CYC)', japanese: 'japán' },
  },
  chart: {
    title: (title) => `${title} — horgolásminta-diagram`,
    untitled: 'Minta',
    legend: 'Jelmagyarázat',
    legendWith: (system) => `Jelmagyarázat (${system})`,
    rightSide: 'Színoldali sor',
    wrongSide: 'Visszai sor',
    notation: (terms, style) => `Jelölés: ${terms}; jelek: ${style}.`,
    repeat: (repeat) => `Ismétlés: ${repeat}.`,
    insertions: 'A szál és a relief jele a színoldalról nézve; visszai soron a horgoló a másik szálba, illetve a másik oldalról szúr.',
    grid: 'Rács: váltakozó sávok, minden 5. és 10. sorvonal vastagabb.',
    unitFrame: 'Szaggatott keret: az ismétlő egység.',
    spike: 'Pötty a szár végén: a lejjebb, a kihagyott szembe horgolt szem.',
    mirror: 'Tükrözött nézet balkezeseknek.',
    // On the chart the foundation row also gets the longer label; mid-sentence the short form stands.
    layerName: (layer, round) => (layer === 0 && !round ? '1. sor – alapsor' : capitalize(huLayer(layer, round))),
    cycNote: 'A sorszám a sor kezdő oldalán áll, zárójelben a szemszám.',
    japaneseNote: 'A sorszám a sor kezdő oldalán áll, a végén a szemszám: 18目 = 18 szem; 11目1模様 = 11 szemenként ismétlődő minta.',
  },
  dialog: {
    cancel: 'Mégse',
    details: 'Részletek',
  },
};

const en: SectionTexts = {
  types: {
    menu: {
      regular: { name: 'Regular crochet', detail: 'Flat rows, rounds and motifs (e.g. granny square).' },
      filet: { name: 'Filet crochet', detail: 'A grid of filled and open cells; C2C, tapestry and graphgan too.' },
      amigurumi: { name: 'Amigurumi', detail: 'A 3D shape in a spiral, from parts: sphere, cylinder, cone. The pattern comes as text, the chart supports it.' },
      irregular: { name: 'Irregular crochet', detail: 'Shaped, free-form piece (e.g. a garment, baby booties).' },
    },
    soon: 'Coming soon',
  },
  size: {
    sources: { measured: 'measured', label: 'from the label', estimated: 'estimated' },
    forms: { rows: 'flat', rounds: 'in the round' },
    hook: {
      steel: 'Steel hook: US numbering varies by maker, the mm size is what counts.',
      oldUk: (size) => `old UK ${size}`,
      none: 'No US or old UK equivalent.',
      nonStandard: (mm, names) => `Not a standard size; the nearest is ${mm} mm${names ? ` (${names})` : ''}.`,
    },
    profile: {
      unnamedYarn: 'Unnamed yarn',
      blocked: 'blocked',
      unblocked: 'unblocked',
      none: 'No profile (estimate)',
      noCyc: 'Not on the label',
      chosen: (label) => `Profile: ${label}.`,
      cleared: 'No profile: the size is an estimate, with a range.',
      added: 'New profile: enter the yarn, the hook and the measured values.',
      removed: (label) => `Profile deleted: ${label}. Undo brings it back.`,
      nameChanged: 'The yarn name changed.',
      cycChanged: 'The yarn weight category changed.',
      blockedOn: 'The profile is measured blocked.',
      blockedOff: 'The profile is measured unblocked.',
      estimatedFromMeterage: (label) => `estimated from m/100 g: ${label}`,
      invalid: {
        meterage: 'Meters per 100 g must be a positive number, or leave it empty.',
        ball: 'The ball mass must be a positive number, or leave it empty.',
        hook: 'The hook size is required: a positive number no larger than 30 mm.',
        swatchWidth: 'The swatch width must be a positive number, or leave it empty.',
        swatchHeight: 'The swatch height must be a positive number, or leave it empty.',
        swatchMass: 'The swatch mass must be a positive number, or leave it empty.',
      },
      changed: {
        meterage: 'The yarn m/100 g changed.',
        ball: 'The ball mass changed.',
        hook: 'The hook size changed.',
        swatchWidth: 'The swatch width changed.',
        swatchHeight: 'The swatch height changed.',
        swatchMass: 'The swatch mass changed.',
      },
    },
    gauge: {
      stitch: 'Stitch',
      form: 'Measured',
      stitches: 'Stitches per 10 cm',
      rows: 'Rows per 10 cm',
      rounds: 'Rounds per 10 cm',
      source: 'Source',
      remove: 'Delete row',
      removeLabel: (name) => `${name}: delete the row`,
      added: 'New gauge row.',
      removed: 'Gauge row deleted.',
      allUsed: 'Every stitch is already listed in both forms.',
      duplicate: (name, form) => `${name}, ${form}: there is already such a row.`,
      changed: 'The gauge changed.',
      invalidNumber: 'Stitches and rows per 10 cm must be a positive number, or leave it empty.',
      note: (stitches, rows, form) =>
        `Incomplete, not counted in the size yet. Estimate for this profile: ${stitches} stitches and ${rows} ${form === 'rows' ? 'rows' : 'rounds'} per 10 cm.`,
    },
    result: {
      basis: {
        'profile-stitch': 'the stitches that were not measured converted from another measured stitch',
        'profile-other-form': 'from the single crochet measured in the other form',
        hook: 'from the hook size',
      },
      missing: {
        profile: 'a profile with the mass of the swatch',
        swatch: 'the width, height and mass of the swatch',
        meterage: 'the m/100 g of the yarn',
        ball: 'the mass of one ball',
        size: 'the finished size of the piece',
      },
      noProfile: (hookMm) =>
        `No profile: the size is estimated from a ${hookMm} mm hook, with a range. It gets more accurate once you measure a swatch and save it as a profile.`,
      partial: (how) => `Part of the size is an estimate${how ? ` (${how})` : ''}, with a range.`,
      width: 'Width',
      height: 'Height',
      diameter: 'Diameter',
      noLayers: 'No rows or rounds yet: start with a foundation chain or a magic ring, and work at least one row.',
      mixedTotal: 'The finished size of a piece made of both rows and rounds cannot be worked out yet; it is shown row by row below.',
      headers: (round) =>
        round ? ['Round', 'Circumference, cm', 'Height, cm', 'Radius, cm'] : ['Row', 'Width, cm', 'Height, cm', 'Total, cm'],
      layerLabel: (index, round) => (round ? `Round ${index}` : `Row ${index + 1}`),
      yarnInPiece: 'Yarn in the piece',
      lengthWithBuffer: 'Length with extra',
      balls: 'Balls',
      ballsUnit: 'balls',
      yarnNote: (ballMassG, ballLengthM) =>
        `One ball is ${ballMassG} g, ${ballLengthM} m. From the mass of the swatch, with 10–15 % extra, rounded up to whole balls.`,
      missingNote: (list) => `The yarn estimate is missing: ${list}.`,
      range: (range) => `range: ${range}`,
    },
  },
  written: {
    empty: 'Nothing to write out yet: start with a foundation chain or a magic ring.',
    notWritable: (reason) => `This pattern cannot be written out yet. ${reason}`,
    broken: 'The structure of the pattern is faulty, so it cannot be written out; the Check section lists the errors.',
    partial: (layer, remaining) => `${layer} is unfinished, ${remaining} targets are left: the text describes the current state.`,
    errors: (count) => `The pattern has ${count} errors (see Check), so the text cannot be followed as it is.`,
    untitled: 'Untitled pattern',
  },
  insertion: {
    names: {
      'both-loops': 'both loops',
      'front-loop': 'front loop',
      'back-loop': 'back loop',
      'front-post': 'front post',
      'back-post': 'back post',
    },
    written: 'In the written pattern: ',
  },
  palette: {
    titles: {
      basic: 'Basic stitches',
      'increase-decrease': 'Increases and decreases',
      compound: 'Compound stitches',
      structure: 'Chain space and magic ring',
    },
  },
  notation: {
    terms: { hu: 'Hungarian', 'en-US': 'US English', 'en-GB': 'UK English' },
    chartStyles: { cyc: 'CYC', jis: 'Japanese (JIS)' },
    traditions: { cyc: 'international (CYC)', japanese: 'Japanese' },
  },
  chart: {
    title: (title) => `${title} — crochet stitch chart`,
    untitled: 'Pattern',
    legend: 'Legend',
    legendWith: (system) => `Legend (${system})`,
    rightSide: 'Right-side row',
    wrongSide: 'Wrong-side row',
    notation: (terms, style) => `Terms: ${terms}; symbols: ${style}.`,
    repeat: (repeat) => `Repeat: ${repeat}.`,
    insertions: 'Loop and post symbols are drawn as seen from the right side; on a wrong-side row you work into the other loop, or from the other side.',
    grid: 'Grid: alternating bands, every 5th and 10th row line is heavier.',
    unitFrame: 'Dashed frame: the repeat unit.',
    spike: 'Dot at the foot of the stem: a spike stitch worked lower, into the skipped stitch.',
    mirror: 'Mirrored view for left-handed crocheters.',
    // On the chart the foundation row also gets the longer label; mid-sentence the short form stands.
    layerName: (layer, round) => (layer === 0 && !round ? 'Row 1 – foundation' : capitalize(enLayer(layer, round))),
    cycNote: 'The row number is at the starting side of the row, the stitch count in brackets.',
    japaneseNote: 'The row number is at the starting side of the row, the stitch count at the end: 18目 = 18 stitches; 11目1模様 = a pattern repeating every 11 stitches.',
  },
  dialog: {
    cancel: 'Cancel',
    details: 'Details',
  },
};

export const SECTION_TEXTS = { hu, en } satisfies Dictionary<SectionTexts>;
