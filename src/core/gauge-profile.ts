/*
 * Gauge-profil: a próbadarabok mérései a docs/calibration/ formátumában, és a
 * belőlük számolt profilok (PQW-859; a formátum: PQW-860).
 *
 * A mérési fájl nyers leolvasásokat tárol. Az átlagot, a szórást, az
 * szemenkénti méretet, a területre jutó tömeget és a blokkolás hatását itt
 * számoljuk, hogy egy elírást egy helyen lehessen javítani
 * (docs/calibration/README.md, „Derived values”).
 *
 * Egy fájl mérésenként (blokkolás előtt, után) egy mintát ad. A profil a
 * horgoló × fonal × tű × blokkolás szerint gyűjti össze őket, szemenként és
 * azon belül formánként, mert a gauge-et abban a formában kell mérni, ahogy
 * használjuk (README §4.2). Minden profilérték mért; ami hiányzik, azt a
 * `gauge.ts` becsüli, és becslésként jelöli.
 */

import type { Sourced, StitchDefId, StitchInsertion } from './types.ts';
import { classifyByMeterage, metersPer100g } from './yarn-weight.ts';

/* ---- Típusok ---- */

export const GAUGE_SAMPLE_SCHEMA_VERSION = 1;

/** Amiből szemméret jön: sík sorok, cső vagy lapos kör. */
export type WorkedIn = 'rows' | 'rounds-tube' | 'rounds-flat';

/** A mérési fájl formái; a láncszemsor csak a láncszem hosszát adja. */
export type SampleForm = WorkedIn | 'chain';

export type SampleInsertion = Extract<StitchInsertion, 'both-loops' | 'back-loop' | 'front-loop'>;

export type FabricShape = 'flat' | 'cupping' | 'ruffling';

/** Átlag, mintabeli szórás (n − 1) és a leolvasások száma. */
export interface Stat {
  readonly mean: number;
  readonly sd: number;
  readonly n: number;
}

export interface Fibre {
  readonly material: string;
  readonly percent: number | null;
}

export interface SampleYarn {
  readonly id: string;
  readonly brand: string;
  readonly line: string;
  readonly colour: string | null;
  readonly dyeLot: string | null;
  readonly fibre: readonly Fibre[];
  /** A címkéről; `null`, ha nincs rajta. */
  readonly cycWeight: number | null;
  readonly label: {
    readonly lengthM: number | null;
    readonly massG: number | null;
    readonly hookMmMin: number | null;
    readonly hookMmMax: number | null;
  };
}

/** Egy leolvasássor terjedelme a tűrés fölött: a feszesség a darabon belül változott (02 §3.1, §9 10.). */
export interface DriftWarning {
  /** A leolvasások helye a fájlban, pl. `$.measurements[0].grid.widthMm`. */
  readonly path: string;
  /** `(max − min) / átlag`. */
  readonly spread: number;
}

export const DRIFT_LIMIT = 0.05;

/** Egy mérés egy fájlból, a számolt értékekkel (06 §5.2 `GaugeSample`). */
export interface GaugeSample {
  /** A fájl azonosítója, `GS-ÉÉÉÉHHNN-SS`. */
  readonly sampleId: string;
  readonly date: string;
  readonly crocheterId: string;
  readonly yarn: SampleYarn;
  readonly hookMm: number;
  /** Könyvtári azonosító: a kalibrációs `slst` itt `sl-st`. */
  readonly stitch: StitchDefId;
  readonly insertion: SampleInsertion;
  readonly workedIn: SampleForm;
  readonly blocked: boolean;
  /** Szemenkénti szélesség leolvasásonként, mm. Láncszemsornál üres. */
  readonly widthReadingsMm: readonly number[];
  /** Soronkénti (körönkénti) magasság leolvasásonként, mm. */
  readonly heightReadingsMm: readonly number[];
  /** Láncszemenkénti hossz leolvasásonként, mm. Csak láncszemsornál. */
  readonly chainReadingsMm: readonly number[];
  readonly widthMm: Stat | null;
  readonly heightMm: Stat | null;
  readonly chainLengthMm: Stat | null;
  readonly swatchAreaCm2: number | null;
  readonly swatchMassG: number | null;
  readonly massPerAreaGPerCm2: number | null;
  readonly yarnPerStitchCm: number | null;
  /** Lapos körnél: lapos maradt, csészésedik vagy fodrosodik. */
  readonly shape: FabricShape | null;
  readonly drift: readonly DriftWarning[];
  readonly photoIds: readonly string[];
  readonly notes: string | null;
}

/** Egy szem egy formában, a profil összes mintájából. */
export interface StitchGauge {
  readonly widthMm: Stat;
  readonly heightMm: Stat;
  readonly massPerAreaGPerCm2: number | null;
  readonly yarnPerStitchCm: number | null;
  readonly shape: FabricShape | null;
  /** Blokkolt profilban a blokkolás előttihez képest, relatív; máshol `null` (02 §3.7). */
  readonly blockingChange: { readonly width: number; readonly height: number } | null;
  readonly samples: readonly string[];
}

export interface ProfileYarn {
  readonly id: string;
  readonly name: string;
  readonly fibre: readonly Fibre[];
  /** A címkéről, vagy ha ott nincs, a méterből becsülve. */
  readonly cycWeight: Sourced<number> | null;
  readonly metersPer100g: Sourced<number> | null;
  readonly label: { readonly lengthM: number | null; readonly massG: number | null };
}

/** A tervező ebből számol méretet (06 §5.2 `GaugeProfile`, docs/calibration/README.md). */
export interface GaugeProfile {
  /** Pl. `owner-pelda-pamut-125-4mm-unblocked`. */
  readonly id: string;
  readonly crocheterId: string;
  readonly yarn: ProfileYarn;
  readonly hookMm: number;
  readonly blocked: boolean;
  /** Szemkulcs (`sc`, `sc/back-loop`) → forma → mérés. */
  readonly perStitch: Readonly<Partial<Record<string, Readonly<Partial<Record<WorkedIn, StitchGauge>>>>>>;
  readonly chainLengthMm: Stat | null;
  readonly samples: readonly string[];
}

/* ---- Betöltés ---- */

export interface SampleLoadError {
  readonly code: 'invalid-json' | 'unsupported-version' | 'invalid-format';
  /** A hibás mező útvonala, pl. `$.measurements[0].grid.widthMm`. */
  readonly path: string;
  readonly message: string;
}

export type SampleLoadResult =
  | { readonly ok: true; readonly samples: readonly GaugeSample[] }
  | { readonly ok: false; readonly error: SampleLoadError };

/** Egy `GS-….json` mérési fájl; mérésenként egy minta. */
export function loadGaugeSample(text: string): SampleLoadResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail('invalid-json', '$', 'Érvénytelen JSON.');
  }
  if (isObject(value) && typeof value['schemaVersion'] === 'number' && value['schemaVersion'] !== GAUGE_SAMPLE_SCHEMA_VERSION) {
    return fail('unsupported-version', '$.schemaVersion', `Ismeretlen sémaverzió: ${value['schemaVersion']}.`);
  }
  try {
    return { ok: true, samples: readSampleFile(value) };
  } catch (error) {
    if (error instanceof FormatError) return fail('invalid-format', error.path, error.message);
    throw error;
  }
}

function fail(code: SampleLoadError['code'], path: string, message: string): SampleLoadResult {
  return { ok: false, error: { code, path, message } };
}

class FormatError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objektum a kötelező mezőkkel; ismeretlen mező hiba, hogy az elírás ne vesszen el. */
function object(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): JsonObject {
  if (!isObject(value)) throw new FormatError(path, 'Objektumot vártunk.');
  for (const key of required) {
    if (!(key in value)) throw new FormatError(`${path}.${key}`, 'Hiányzó mező.');
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) throw new FormatError(`${path}.${key}`, 'Ismeretlen mező.');
  }
  return value;
}

function optional<T>(raw: JsonObject, key: string, path: string, read: (value: unknown, path: string) => T): T | null {
  return key in raw ? read(raw[key], `${path}.${key}`) : null;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') throw new FormatError(path, 'Nem üres szöveget vártunk.');
  return value;
}

function nullableText(value: unknown, path: string): string | null {
  if (value !== null && typeof value !== 'string') throw new FormatError(path, 'Szöveget vagy null-t vártunk.');
  return value;
}

function matching(value: unknown, path: string, pattern: RegExp, message: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new FormatError(path, message);
  return value;
}

function slug(value: unknown, path: string): string {
  return matching(value, path, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'Kisbetűs, kötőjeles ASCII azonosítót vártunk.');
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new FormatError(path, 'Logikai értéket vártunk.');
  return value;
}

function positive(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new FormatError(path, 'Pozitív számot vártunk.');
  return value;
}

function positiveOrNull(value: unknown, path: string): number | null {
  return value === null ? null : positive(value, path);
}

function integer(value: unknown, path: string, min: number, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new FormatError(path, max === Number.POSITIVE_INFINITY ? `Legalább ${min} értékű egészet vártunk.` : `${min} és ${max} közötti egészet vártunk.`);
  }
  return value;
}

function oneOf<const T extends string | number | boolean | null>(value: unknown, path: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new FormatError(path, `Megengedett értékek: ${allowed.map((item) => JSON.stringify(item)).join(', ')}.`);
  }
  return value as T;
}

function array<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) throw new FormatError(path, 'Tömböt vártunk.');
  return value.map((item, index) => read(item, `${path}[${index}]`));
}

/** Egyedi leolvasások mm-ben, legalább három, sosem előre átlagolva. */
function readings(value: unknown, path: string): number[] {
  const values = array(value, path, positive);
  if (values.length < 3) throw new FormatError(path, 'Legalább három leolvasást vártunk.');
  return values;
}

/** A kalibrációs szemazonosító a könyvtáréra (docs/calibration/README.md, „Identifiers”). */
const CALIBRATION_STITCHES: Readonly<Record<string, StitchDefId>> = {
  ch: 'ch',
  slst: 'sl-st',
  sc: 'sc',
  hdc: 'hdc',
  dc: 'dc',
  tr: 'tr',
};

interface Construction {
  readonly workedIn: SampleForm;
  readonly rounds: number | null;
  readonly lastRoundStitches: number | null;
  readonly chains: number | null;
}

const CONSTRUCTION_REQUIRED: Readonly<Record<SampleForm, readonly string[]>> = {
  rows: ['foundationChains', 'rows', 'turningChain'],
  'rounds-tube': ['stitchesPerRound', 'rounds', 'start', 'roundJoin'],
  'rounds-flat': ['rounds', 'lastRoundStitches', 'start', 'roundJoin'],
  chain: ['chains'],
};

const MEASUREMENT_BLOCK: Readonly<Record<SampleForm, 'grid' | 'circle' | 'chain'>> = {
  rows: 'grid',
  'rounds-tube': 'grid',
  'rounds-flat': 'circle',
  chain: 'chain',
};

interface Measurement {
  readonly state: 'unblocked' | 'blocked';
  readonly grid: {
    readonly stitchesSpanned: number;
    readonly rowsSpanned: number;
    readonly widthMm: readonly number[];
    readonly heightMm: readonly number[];
  } | null;
  readonly circle: { readonly diameterMm: readonly number[]; readonly shape: FabricShape } | null;
  readonly chain: { readonly lengthMm: readonly number[] } | null;
  readonly swatch: { readonly widthMm: number | null; readonly heightMm: number | null; readonly massG: number | null };
  readonly photos: readonly string[];
  readonly notes: string | null;
}

function readSampleFile(value: unknown): GaugeSample[] {
  const raw = object(
    value,
    '$',
    ['schemaVersion', 'id', 'date', 'crocheter', 'yarn', 'hook', 'stitch', 'construction', 'measurements'],
    ['$schema', 'context', 'notes'],
  );
  oneOf(raw['schemaVersion'], '$.schemaVersion', [GAUGE_SAMPLE_SCHEMA_VERSION]);
  const sampleId = matching(raw['id'], '$.id', /^GS-\d{8}-\d{2}$/, '`GS-ÉÉÉÉHHNN-SS` alakú azonosítót vártunk.');
  const date = matching(raw['date'], '$.date', /^\d{4}-\d{2}-\d{2}$/, '`ÉÉÉÉ-HH-NN` dátumot vártunk.');

  const crocheter = object(raw['crocheter'], '$.crocheter', ['id'], ['handedness']);
  const crocheterId = slug(crocheter['id'], '$.crocheter.id');
  optional(crocheter, 'handedness', '$.crocheter', (item, path) => oneOf(item, path, ['right', 'left', null]));

  const yarn = readYarn(raw['yarn'], '$.yarn');

  const hook = object(raw['hook'], '$.hook', ['mm'], ['brand', 'material']);
  const hookMm = positive(hook['mm'], '$.hook.mm');
  if (hookMm > 30) throw new FormatError('$.hook.mm', 'Legfeljebb 30 mm-es tűt vártunk.');
  optional(hook, 'brand', '$.hook', nullableText);
  optional(hook, 'material', '$.hook', (item, path) =>
    oneOf(item, path, ['aluminium', 'steel', 'bamboo', 'wood', 'plastic', 'other', null]),
  );

  const stitch = object(raw['stitch'], '$.stitch', ['id', 'insertion']);
  const calibrationStitch = oneOf(stitch['id'], '$.stitch.id', Object.keys(CALIBRATION_STITCHES));
  const insertion = oneOf(stitch['insertion'], '$.stitch.insertion', ['both-loops', 'back-loop', 'front-loop']);

  const construction = readConstruction(raw['construction'], '$.construction');
  if ((construction.workedIn === 'chain') !== (calibrationStitch === 'ch')) {
    throw new FormatError('$.stitch.id', 'A `ch` szem és a `chain` forma csak együtt szerepelhet.');
  }

  const measurements = array(raw['measurements'], '$.measurements', (item, path) =>
    readMeasurement(item, path, construction.workedIn),
  );
  if (measurements.length < 1 || measurements.length > 2) {
    throw new FormatError('$.measurements', 'Egy vagy két mérést vártunk.');
  }
  if (measurements.length === 2 && (measurements[0].state !== 'unblocked' || measurements[1].state !== 'blocked')) {
    throw new FormatError('$.measurements', 'Két mérésnél az első blokkolás előtti, a második utáni.');
  }

  if ('context' in raw) {
    const context = object(raw['context'], '$.context', [], ['timeOfDay', 'fatigue', 'tensionNotes']);
    optional(context, 'timeOfDay', '$.context', (item, path) =>
      oneOf(item, path, ['morning', 'afternoon', 'evening', 'night', null]),
    );
    optional(context, 'fatigue', '$.context', (item, path) => (item === null ? null : integer(item, path, 1, 5)));
    optional(context, 'tensionNotes', '$.context', nullableText);
  }
  const fileNotes = optional(raw, 'notes', '$', nullableText);

  return measurements.map((measurement, index) => {
    const path = `$.measurements[${index}]`;
    const derived = derive(measurement, construction, yarn, path);
    return {
      sampleId,
      date,
      crocheterId,
      yarn,
      hookMm,
      stitch: CALIBRATION_STITCHES[calibrationStitch] ?? calibrationStitch,
      insertion,
      workedIn: construction.workedIn,
      blocked: measurement.state === 'blocked',
      ...derived,
      photoIds: measurement.photos,
      notes: [fileNotes, measurement.notes].filter((note) => note !== null && note !== '').join('\n') || null,
    };
  });
}

function readYarn(value: unknown, path: string): SampleYarn {
  const raw = object(value, path, ['id', 'brand', 'line'], ['colour', 'dyeLot', 'fibre', 'cycWeight', 'label']);
  const label = 'label' in raw ? object(raw['label'], `${path}.label`, [], ['lengthM', 'massG', 'hookMmMin', 'hookMmMax']) : {};
  const labelPath = `${path}.label`;
  return {
    id: slug(raw['id'], `${path}.id`),
    brand: text(raw['brand'], `${path}.brand`),
    line: text(raw['line'], `${path}.line`),
    colour: optional(raw, 'colour', path, nullableText),
    dyeLot: optional(raw, 'dyeLot', path, nullableText),
    fibre: optional(raw, 'fibre', path, (item, itemPath) => array(item, itemPath, readFibre)) ?? [],
    cycWeight: optional(raw, 'cycWeight', path, (item, itemPath) => (item === null ? null : integer(item, itemPath, 0, 7))),
    label: {
      lengthM: optional(label, 'lengthM', labelPath, positiveOrNull),
      massG: optional(label, 'massG', labelPath, positiveOrNull),
      hookMmMin: optional(label, 'hookMmMin', labelPath, positiveOrNull),
      hookMmMax: optional(label, 'hookMmMax', labelPath, positiveOrNull),
    },
  };
}

function readFibre(value: unknown, path: string): Fibre {
  const raw = object(value, path, ['material', 'percent']);
  const percent = raw['percent'] === null ? null : positive(raw['percent'], `${path}.percent`);
  if (percent !== null && percent > 100) throw new FormatError(`${path}.percent`, 'Legfeljebb 100 %-ot vártunk.');
  return { material: text(raw['material'], `${path}.material`), percent };
}

function readConstruction(value: unknown, path: string): Construction {
  const raw = object(
    value,
    path,
    ['workedIn'],
    ['foundationChains', 'rows', 'turningChain', 'start', 'roundJoin', 'rounds', 'stitchesPerRound', 'lastRoundStitches', 'chains'],
  );
  const workedIn = oneOf(raw['workedIn'], `${path}.workedIn`, ['rows', 'rounds-tube', 'rounds-flat', 'chain']);
  for (const key of CONSTRUCTION_REQUIRED[workedIn]) {
    if (!(key in raw)) throw new FormatError(`${path}.${key}`, 'Ehhez a formához kötelező mező.');
  }
  const count = (key: string) => optional(raw, key, path, (item, itemPath) => integer(item, itemPath, 1));
  count('foundationChains');
  count('rows');
  count('stitchesPerRound');
  optional(raw, 'turningChain', path, (item, itemPath) => {
    const turningChain = object(item, itemPath, ['chains', 'countsAsStitch']);
    integer(turningChain['chains'], `${itemPath}.chains`, 0);
    return boolean(turningChain['countsAsStitch'], `${itemPath}.countsAsStitch`);
  });
  optional(raw, 'start', path, (item, itemPath) => oneOf(item, itemPath, ['magic-ring', 'chain-ring']));
  optional(raw, 'roundJoin', path, (item, itemPath) => oneOf(item, itemPath, ['spiral', 'joined']));
  return { workedIn, rounds: count('rounds'), lastRoundStitches: count('lastRoundStitches'), chains: count('chains') };
}

function readMeasurement(value: unknown, path: string, form: SampleForm): Measurement {
  const raw = object(value, path, ['state', 'blocking', 'tool'], ['grid', 'circle', 'chain', 'swatch', 'photos', 'notes']);
  const state = oneOf(raw['state'], `${path}.state`, ['unblocked', 'blocked']);
  if (state === 'unblocked') {
    if (raw['blocking'] !== null) throw new FormatError(`${path}.blocking`, 'Blokkolás előtti mérésnél null.');
  } else {
    const blocking = object(raw['blocking'], `${path}.blocking`, ['method'], ['dryHours', 'pinned']);
    oneOf(blocking['method'], `${path}.blocking.method`, ['wet', 'steam', 'spray']);
  }
  oneOf(raw['tool'], `${path}.tool`, ['ruler', 'calliper', 'tape']);

  const block = MEASUREMENT_BLOCK[form];
  for (const other of ['grid', 'circle', 'chain']) {
    if (other !== block && other in raw) throw new FormatError(`${path}.${other}`, `Ehhez a formához (${form}) a \`${block}\` mérés tartozik.`);
  }
  if (!(block in raw)) throw new FormatError(`${path}.${block}`, 'Hiányzó mező.');

  return {
    state,
    grid: block === 'grid' ? readGrid(raw['grid'], `${path}.grid`) : null,
    circle: block === 'circle' ? readCircle(raw['circle'], `${path}.circle`) : null,
    chain:
      block === 'chain'
        ? { lengthMm: readings(object(raw['chain'], `${path}.chain`, ['lengthMm'])['lengthMm'], `${path}.chain.lengthMm`) }
        : null,
    swatch: readSwatch(raw, path),
    photos: optional(raw, 'photos', path, (item, itemPath) => array(item, itemPath, readPhoto)) ?? [],
    notes: optional(raw, 'notes', path, nullableText),
  };
}

function readGrid(value: unknown, path: string): NonNullable<Measurement['grid']> {
  const raw = object(value, path, ['stitchesSpanned', 'rowsSpanned', 'widthMm', 'heightMm']);
  return {
    stitchesSpanned: integer(raw['stitchesSpanned'], `${path}.stitchesSpanned`, 1),
    rowsSpanned: integer(raw['rowsSpanned'], `${path}.rowsSpanned`, 1),
    widthMm: readings(raw['widthMm'], `${path}.widthMm`),
    heightMm: readings(raw['heightMm'], `${path}.heightMm`),
  };
}

function readCircle(value: unknown, path: string): NonNullable<Measurement['circle']> {
  const raw = object(value, path, ['diameterMm', 'shape']);
  return {
    diameterMm: readings(raw['diameterMm'], `${path}.diameterMm`),
    shape: oneOf(raw['shape'], `${path}.shape`, ['flat', 'cupping', 'ruffling']),
  };
}

function readSwatch(measurement: JsonObject, path: string): Measurement['swatch'] {
  const raw = optional(measurement, 'swatch', path, (item, itemPath) =>
    object(item, itemPath, [], ['widthMm', 'heightMm', 'massG', 'scaleResolutionG']),
  );
  if (!raw) return { widthMm: null, heightMm: null, massG: null };
  const swatchPath = `${path}.swatch`;
  optional(raw, 'scaleResolutionG', swatchPath, positiveOrNull);
  return {
    widthMm: optional(raw, 'widthMm', swatchPath, positiveOrNull),
    heightMm: optional(raw, 'heightMm', swatchPath, positiveOrNull),
    massG: optional(raw, 'massG', swatchPath, positiveOrNull),
  };
}

function readPhoto(value: unknown, path: string): string {
  const raw = object(value, path, ['file', 'side']);
  oneOf(raw['side'], `${path}.side`, ['rs', 'ws']);
  return matching(raw['file'], `${path}.file`, /^[A-Za-z0-9._-]+\.(jpe?g|png|heic)$/, 'Fényképfájl nevét vártunk.');
}

/* ---- Számolt értékek ---- */

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Átlag és mintabeli szórás; üres listára `null`. */
export function stat(values: readonly number[]): Stat | null {
  const n = values.length;
  if (n === 0) return null;
  const average = mean(values);
  const sd = n > 1 ? Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (n - 1)) : 0;
  return { mean: average, sd, n };
}

/**
 * Fonal szemenként, cm: a területre jutó tömegből, a szem területéből és a
 * címke hossz/tömeg arányából (docs/calibration/README.md, „Derived values”).
 */
export function yarnPerStitchCm(massPerAreaGPerCm2: number, widthMm: number, heightMm: number, lengthM: number, massG: number): number {
  return massPerAreaGPerCm2 * ((widthMm * heightMm) / 100) * (lengthM / massG) * 100;
}

type Derived = Pick<
  GaugeSample,
  | 'widthReadingsMm'
  | 'heightReadingsMm'
  | 'chainReadingsMm'
  | 'widthMm'
  | 'heightMm'
  | 'chainLengthMm'
  | 'swatchAreaCm2'
  | 'swatchMassG'
  | 'massPerAreaGPerCm2'
  | 'yarnPerStitchCm'
  | 'shape'
  | 'drift'
>;

function derive(measurement: Measurement, construction: Construction, yarn: SampleYarn, path: string): Derived {
  const { grid, circle, chain, swatch } = measurement;
  const drift: DriftWarning[] = [];
  const checkDrift = (values: readonly number[], at: string) => {
    const spread = (Math.max(...values) - Math.min(...values)) / mean(values);
    if (spread > DRIFT_LIMIT) drift.push({ path: at, spread });
  };

  let widths: number[] = [];
  let heights: number[] = [];
  let chains: number[] = [];
  let area: number | null = null;

  if (grid) {
    widths = grid.widthMm.map((value) => value / grid.stitchesSpanned);
    heights = grid.heightMm.map((value) => value / grid.rowsSpanned);
    checkDrift(grid.widthMm, `${path}.grid.widthMm`);
    checkDrift(grid.heightMm, `${path}.grid.heightMm`);
    if (swatch.widthMm !== null && swatch.heightMm !== null) {
      // A cső kilapítva két réteg.
      const layers = construction.workedIn === 'rounds-tube' ? 2 : 1;
      area = (layers * swatch.widthMm * swatch.heightMm) / 100;
    }
  }
  if (circle && construction.lastRoundStitches !== null && construction.rounds !== null) {
    const { lastRoundStitches, rounds } = construction;
    // A külső kör kerülete az utolsó kör szemein; a sugár körönként egy körmagasságnyit nő (02 §4.3).
    widths = circle.diameterMm.map((diameter) => (Math.PI * diameter) / lastRoundStitches);
    heights = circle.diameterMm.map((diameter) => diameter / 2 / rounds);
    checkDrift(circle.diameterMm, `${path}.circle.diameterMm`);
    area = (Math.PI * mean(circle.diameterMm) ** 2) / 400;
  }
  if (chain && construction.chains !== null) {
    const count = construction.chains;
    chains = chain.lengthMm.map((length) => length / count);
    checkDrift(chain.lengthMm, `${path}.chain.lengthMm`);
  }

  const widthMm = stat(widths);
  const heightMm = stat(heights);
  const massPerArea = swatch.massG !== null && area !== null ? swatch.massG / area : null;
  const { lengthM, massG } = yarn.label;
  return {
    widthReadingsMm: widths,
    heightReadingsMm: heights,
    chainReadingsMm: chains,
    widthMm,
    heightMm,
    chainLengthMm: stat(chains),
    swatchAreaCm2: area,
    swatchMassG: swatch.massG,
    massPerAreaGPerCm2: massPerArea,
    yarnPerStitchCm:
      massPerArea !== null && widthMm && heightMm && lengthM !== null && massG !== null
        ? yarnPerStitchCm(massPerArea, widthMm.mean, heightMm.mean, lengthM, massG)
        : null,
    shape: circle?.shape ?? null,
    drift,
  };
}

/* ---- Profilok ---- */

const WORKED_IN: readonly WorkedIn[] = ['rows', 'rounds-tube', 'rounds-flat'];

export function profileId(crocheterId: string, yarnId: string, hookMm: number, blocked: boolean): string {
  return `${crocheterId}-${yarnId}-${hookMm}mm-${blocked ? 'blocked' : 'unblocked'}`;
}

/** A beszúrás csak akkor része a kulcsnak, ha nem a két szál (docs/calibration/README.md). */
export function stitchKey(stitch: StitchDefId, insertion: SampleInsertion): string {
  return insertion === 'both-loops' ? stitch : `${stitch}/${insertion}`;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function relativeChange(before: number, after: number): number {
  return (after - before) / before;
}

/**
 * Profilok a mintákból: horgoló × fonal × tű × blokkolás szerint. Az azonos
 * kulcsú minták leolvasásai összeadódnak, az `n` a leolvasások száma.
 */
export function buildGaugeProfiles(samples: readonly GaugeSample[]): GaugeProfile[] {
  const groups = new Map<string, GaugeSample[]>();
  const sorted = [...samples].sort((a, b) => compare(a.sampleId, b.sampleId) || Number(a.blocked) - Number(b.blocked));
  for (const sample of sorted) {
    const id = profileId(sample.crocheterId, sample.yarn.id, sample.hookMm, sample.blocked);
    groups.set(id, [...(groups.get(id) ?? []), sample]);
  }
  const profiles = [...groups.entries()].sort(([a], [b]) => compare(a, b)).map(([id, group]) => buildProfile(id, group));
  return profiles.map((profile) => withBlockingChange(profile, profiles));
}

function buildProfile(id: string, group: readonly GaugeSample[]): GaugeProfile {
  const first = group[0];
  const cells = new Map<string, Map<WorkedIn, GaugeSample[]>>();
  for (const sample of group) {
    if (sample.workedIn === 'chain') continue;
    const key = stitchKey(sample.stitch, sample.insertion);
    const byForm = cells.get(key) ?? new Map<WorkedIn, GaugeSample[]>();
    byForm.set(sample.workedIn, [...(byForm.get(sample.workedIn) ?? []), sample]);
    cells.set(key, byForm);
  }

  const perStitch: Record<string, Partial<Record<WorkedIn, StitchGauge>>> = {};
  for (const key of [...cells.keys()].sort(compare)) {
    const byForm: Partial<Record<WorkedIn, StitchGauge>> = {};
    for (const form of WORKED_IN) {
      const pooled = cells.get(key)?.get(form);
      if (pooled) byForm[form] = poolStitch(pooled, first.yarn);
    }
    perStitch[key] = byForm;
  }

  return {
    id,
    crocheterId: first.crocheterId,
    yarn: profileYarn(first.yarn),
    hookMm: first.hookMm,
    blocked: first.blocked,
    perStitch,
    chainLengthMm: stat(group.flatMap((sample) => sample.chainReadingsMm)),
    samples: unique(group.map((sample) => sample.sampleId)),
  };
}

function poolStitch(samples: readonly GaugeSample[], yarn: SampleYarn): StitchGauge {
  const widthMm = stat(samples.flatMap((sample) => sample.widthReadingsMm));
  const heightMm = stat(samples.flatMap((sample) => sample.heightReadingsMm));
  if (!widthMm || !heightMm) throw new Error('Rács- vagy körmérés leolvasások nélkül.');

  const weighed = samples.filter((sample) => sample.swatchMassG !== null && sample.swatchAreaCm2 !== null);
  const massPerArea =
    weighed.length === 0
      ? null
      : weighed.reduce((total, sample) => total + (sample.swatchMassG ?? 0), 0) /
        weighed.reduce((total, sample) => total + (sample.swatchAreaCm2 ?? 0), 0);
  const { lengthM, massG } = yarn.label;
  const shapes = samples.map((sample) => sample.shape).filter((shape): shape is FabricShape => shape !== null);

  return {
    widthMm,
    heightMm,
    massPerAreaGPerCm2: massPerArea,
    yarnPerStitchCm:
      massPerArea !== null && lengthM !== null && massG !== null
        ? yarnPerStitchCm(massPerArea, widthMm.mean, heightMm.mean, lengthM, massG)
        : null,
    shape: shapes.at(-1) ?? null,
    blockingChange: null,
    samples: unique(samples.map((sample) => sample.sampleId)),
  };
}

function profileYarn(yarn: SampleYarn): ProfileYarn {
  const { lengthM, massG } = yarn.label;
  const meterage = lengthM !== null && massG !== null ? metersPer100g(lengthM, massG) : null;
  let cycWeight: Sourced<number> | null = null;
  if (yarn.cycWeight !== null) cycWeight = { value: yarn.cycWeight, source: 'label' };
  else if (meterage !== null) cycWeight = { value: classifyByMeterage(meterage).weight, source: 'estimated' };
  return {
    id: yarn.id,
    name: `${yarn.brand} ${yarn.line}`,
    fibre: yarn.fibre,
    cycWeight,
    metersPer100g: meterage === null ? null : { value: meterage, source: 'label' },
    label: { lengthM, massG },
  };
}

/** A blokkolt profil szemeihez a blokkolás előttihez képesti változás (02 §3.7). */
function withBlockingChange(profile: GaugeProfile, profiles: readonly GaugeProfile[]): GaugeProfile {
  if (!profile.blocked) return profile;
  const beforeId = profileId(profile.crocheterId, profile.yarn.id, profile.hookMm, false);
  const before = profiles.find((other) => other.id === beforeId);
  if (!before) return profile;

  const perStitch: Record<string, Partial<Record<WorkedIn, StitchGauge>>> = {};
  for (const [key, byForm] of Object.entries(profile.perStitch)) {
    const next: Partial<Record<WorkedIn, StitchGauge>> = {};
    for (const form of WORKED_IN) {
      const after = byForm?.[form];
      if (!after) continue;
      const earlier = before.perStitch[key]?.[form];
      next[form] = earlier
        ? {
            ...after,
            blockingChange: {
              width: relativeChange(earlier.widthMm.mean, after.widthMm.mean),
              height: relativeChange(earlier.heightMm.mean, after.heightMm.mean),
            },
          }
        : after;
    }
    perStitch[key] = next;
  }
  return { ...profile, perStitch };
}
