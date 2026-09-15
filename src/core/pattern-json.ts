/*
 * A minta mentése és betöltése verziózott JSON-ként.
 *
 * - A `formatVersion` minden nem visszafelé kompatibilis változásnál nő
 *   (types.ts `Pattern`). Újabb verziót nem töltünk be, mert csendben adat
 *   veszne el.
 * - A betöltés szigorú: ismeretlen mező, hiányzó mező vagy rossz típus hibát
 *   ad a mező útvonalával. A gráf tartalmát (pl. létező-e egy hivatkozott
 *   szem) nem itt, hanem a `validatePattern` ellenőrzi.
 * - A mentés a mezőket mindig ugyanabban a sorrendben írja, így két mentés
 *   különbsége olvasható.
 */

import type {
  Anchor,
  ChartStyle,
  GaugeEntry,
  GaugeForm,
  GridTechnique,
  GridUnit,
  JoinEdge,
  LayerEvent,
  Locale,
  Pattern,
  PatternColor,
  PatternConventions,
  PatternGauge,
  PatternGaugeProfile,
  PatternNotation,
  Piece,
  PieceBorder,
  PieceEnd,
  PieceGrid,
  PieceJoin,
  PieceSection,
  ProfilePoint,
  RepeatSpec,
  Ring,
  RoundMark,
  RowConventions,
  ShapeSpec,
  Space,
  StitchFlag,
  StitchGroup,
  StitchDefId,
  StitchInsertion,
  StitchNode,
  Tradition,
} from './types.ts';

export const FORMAT_VERSION = 1;

export interface LoadError {
  readonly code: 'invalid-json' | 'unsupported-version' | 'invalid-format';
  /** A hibás mező útvonala, pl. `$.pieces[0].stitches[3].anchors[0].mode`. */
  readonly path: string;
  readonly message: string;
}

export type LoadResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly error: LoadError };

/** A minta JSON-szövege. Ha a minta nem felel meg a formátumnak, hibát dob. */
export function savePattern(pattern: Pattern): string {
  return `${JSON.stringify(readPattern(pattern, '$'), null, 2)}\n`;
}

export function loadPattern(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail('invalid-json', '$', `Nem érvényes JSON: ${(error as Error).message}`);
  }

  if (isObject(raw) && typeof raw['formatVersion'] === 'number' && raw['formatVersion'] > FORMAT_VERSION) {
    return fail(
      'unsupported-version',
      '$.formatVersion',
      `A minta újabb formátumú (${raw['formatVersion']}), mint amit ez a verzió ismer (${FORMAT_VERSION}).`,
    );
  }

  try {
    return { ok: true, pattern: readPattern(raw, '$') };
  } catch (error) {
    if (error instanceof FormatError) return fail('invalid-format', error.path, error.message);
    throw error;
  }
}

function fail(code: LoadError['code'], path: string, message: string): LoadResult {
  return { ok: false, error: { code, path, message } };
}

class FormatError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

/* ---- Olvasók ---- */

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') throw new FormatError(path, 'Nem üres szöveget vártunk.');
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new FormatError(path, 'Szöveget vártunk.');
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new FormatError(path, 'Logikai értéket vártunk.');
  return value;
}

function integer(value: unknown, path: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new FormatError(path, `Legalább ${min} értékű egész számot vártunk.`);
  }
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new FormatError(path, 'Számot vártunk.');
  return value;
}

function oneOf<const T extends string | boolean | number>(value: unknown, path: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new FormatError(path, `Megengedett értékek: ${allowed.map((item) => JSON.stringify(item)).join(', ')}.`);
  }
  return value as T;
}

function array<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) throw new FormatError(path, 'Tömböt vártunk.');
  return value.map((item, index) => read(item, `${path}[${index}]`));
}

const LOCALES: readonly Locale[] = ['hu', 'en-US', 'en-GB'];
const CHART_STYLES: readonly ChartStyle[] = ['cyc', 'jis'];
const INSERTIONS: readonly StitchInsertion[] = ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post'];
const FLAGS: readonly StitchFlag[] = ['crossed', 'spike'];
const TRADITIONS: readonly Tradition[] = ['cyc', 'japanese'];
/** A profilban mérhető alapszemek (docs/calibration/, a láncszem és a kúszószem nélkül). */
export const GAUGE_STITCHES: readonly StitchDefId[] = ['sc', 'hdc', 'dc', 'tr'];
const GAUGE_FORMS: readonly GaugeForm[] = ['rows', 'rounds'];

function readPattern(value: unknown, path: string): Pattern {
  const raw = object(value, path, ['formatVersion', 'title', 'conventions', 'pieces'], ['notation', 'gauge', 'joins', 'toy']);
  return {
    formatVersion: oneOf(raw['formatVersion'], `${path}.formatVersion`, [FORMAT_VERSION]),
    title: text(raw['title'], `${path}.title`),
    ...(raw['notation'] === undefined ? {} : { notation: readNotation(raw['notation'], `${path}.notation`) }),
    ...(raw['gauge'] === undefined ? {} : { gauge: readGauge(raw['gauge'], `${path}.gauge`) }),
    conventions: readPatternConventions(raw['conventions'], `${path}.conventions`),
    pieces: array(raw['pieces'], `${path}.pieces`, readPiece),
    // A kapcsolások és a játék adatai a PQW-863 előtti mentésben nincsenek.
    ...(raw['joins'] === undefined ? {} : { joins: array(raw['joins'], `${path}.joins`, readJoin) }),
    ...(raw['toy'] === undefined ? {} : { toy: readToy(raw['toy'], `${path}.toy`) }),
  };
}

function positive(value: unknown, path: string, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    throw new FormatError(path, max === Number.POSITIVE_INFINITY ? 'Pozitív számot vártunk.' : `0 és ${max} közötti pozitív számot vártunk.`);
  }
  return value;
}

function positiveOrNull(value: unknown, path: string): number | null {
  return value === null ? null : positive(value, path);
}

/** A profilok nem kötelezők: a PQW-859 előtti mentésekben nincsenek, ezért a `formatVersion` nem nő. */
function readGauge(value: unknown, path: string): PatternGauge {
  const raw = object(value, path, ['active', 'profiles']);
  const profiles = array(raw['profiles'], `${path}.profiles`, readGaugeProfile);
  const ids = new Set<string>();
  profiles.forEach((profile, i) => {
    if (ids.has(profile.id)) throw new FormatError(`${path}.profiles[${i}].id`, 'Kétszer szereplő profilazonosító.');
    ids.add(profile.id);
  });
  const active = raw['active'] === null ? null : string(raw['active'], `${path}.active`);
  if (active !== null && !ids.has(active)) throw new FormatError(`${path}.active`, 'Nincs ilyen azonosítójú profil.');
  return { active, profiles };
}

function readGaugeProfile(value: unknown, path: string): PatternGaugeProfile {
  const raw = object(value, path, ['id', 'yarn', 'hookMm', 'blocked', 'gauges', 'swatch']);
  const yarn = object(raw['yarn'], `${path}.yarn`, ['name', 'cycWeight', 'metersPer100g', 'ballMassG']);
  const swatch = object(raw['swatch'], `${path}.swatch`, ['widthCm', 'heightCm', 'massG']);
  const gauges = array(raw['gauges'], `${path}.gauges`, readGaugeEntry);
  const keys = new Set<string>();
  gauges.forEach((entry, i) => {
    const key = `${entry.stitch}/${entry.form}`;
    if (keys.has(key)) throw new FormatError(`${path}.gauges[${i}]`, 'Ugyanaz a szem ugyanabban a formában kétszer szerepel.');
    keys.add(key);
  });
  const cycPath = `${path}.yarn.cycWeight`;
  return {
    id: string(raw['id'], `${path}.id`),
    yarn: {
      name: text(yarn['name'], `${path}.yarn.name`),
      cycWeight: yarn['cycWeight'] === null ? null : oneOf(yarn['cycWeight'], cycPath, [0, 1, 2, 3, 4, 5, 6, 7]),
      metersPer100g: positiveOrNull(yarn['metersPer100g'], `${path}.yarn.metersPer100g`),
      ballMassG: positiveOrNull(yarn['ballMassG'], `${path}.yarn.ballMassG`),
    },
    hookMm: positive(raw['hookMm'], `${path}.hookMm`, 30),
    blocked: boolean(raw['blocked'], `${path}.blocked`),
    gauges,
    swatch: {
      widthCm: positiveOrNull(swatch['widthCm'], `${path}.swatch.widthCm`),
      heightCm: positiveOrNull(swatch['heightCm'], `${path}.swatch.heightCm`),
      massG: positiveOrNull(swatch['massG'], `${path}.swatch.massG`),
    },
  };
}

function readGaugeEntry(value: unknown, path: string): GaugeEntry {
  const raw = object(value, path, ['stitch', 'form', 'stitchesPer10cm', 'rowsPer10cm', 'source']);
  return {
    stitch: oneOf(raw['stitch'], `${path}.stitch`, GAUGE_STITCHES),
    form: oneOf(raw['form'], `${path}.form`, GAUGE_FORMS),
    stitchesPer10cm: positiveOrNull(raw['stitchesPer10cm'], `${path}.stitchesPer10cm`),
    rowsPer10cm: positiveOrNull(raw['rowsPer10cm'], `${path}.rowsPer10cm`),
    source: oneOf(raw['source'], `${path}.source`, ['measured', 'label']),
  };
}

/** A jelölés nem kötelező: a PQW-868 előtti mentésekben nincs, ezért a `formatVersion` nem nő. */
function readNotation(value: unknown, path: string): PatternNotation {
  const raw = object(value, path, ['terms', 'chartStyle', 'singleCrochet']);
  return {
    terms: oneOf(raw['terms'], `${path}.terms`, LOCALES),
    chartStyle: oneOf(raw['chartStyle'], `${path}.chartStyle`, CHART_STYLES),
    singleCrochet: oneOf(raw['singleCrochet'], `${path}.singleCrochet`, ['plus', 'cross']),
  };
}

function readTurningChainCounts(value: unknown, path: string): RowConventions['turningChainCounts'] {
  return oneOf(value, path, ['stitch-default', true, false]);
}

function readPatternConventions(value: unknown, path: string): PatternConventions {
  const raw = object(
    value,
    path,
    ['turningChainCounts', 'roundEnd', 'picotCounts', 'joinSlipStitchCounts'],
    ['chainCounts', 'tradition', 'repeat'],
  );
  return {
    turningChainCounts: readTurningChainCounts(raw['turningChainCounts'], `${path}.turningChainCounts`),
    roundEnd: oneOf(raw['roundEnd'], `${path}.roundEnd`, ['stitch-default', 'join-slip', 'spiral']),
    picotCounts: boolean(raw['picotCounts'], `${path}.picotCounts`),
    joinSlipStitchCounts: boolean(raw['joinSlipStitchCounts'], `${path}.joinSlipStitchCounts`),
    // A PQW-870 előtti mentésben nincs ilyen mező; akkor is a használat szerinti szabály érvényes.
    chainCounts:
      raw['chainCounts'] === undefined
        ? 'worked-into'
        : oneOf(raw['chainCounts'], `${path}.chainCounts`, ['worked-into', true, false]),
    // A PQW-876 előtti mentésben nincs; akkor a minta a CYC szerint számol.
    ...(raw['tradition'] === undefined ? {} : { tradition: oneOf(raw['tradition'], `${path}.tradition`, TRADITIONS) }),
    ...(raw['repeat'] === undefined ? {} : { repeat: readRepeat(raw['repeat'], `${path}.repeat`) }),
  };
}

function readRepeat(value: unknown, path: string): RepeatSpec {
  const raw = object(value, path, ['repeatWidth', 'edgeStitches', 'turningChainIncluded']);
  return {
    repeatWidth: integer(raw['repeatWidth'], `${path}.repeatWidth`, 1),
    edgeStitches: integer(raw['edgeStitches'], `${path}.edgeStitches`, 0),
    turningChainIncluded: boolean(raw['turningChainIncluded'], `${path}.turningChainIncluded`),
  };
}

function readPiece(value: unknown, path: string): Piece {
  const raw = object(
    value,
    path,
    ['id', 'name', 'stitches', 'spaces', 'rings', 'groups', 'events', 'skipped'],
    ['corners', 'border', 'sections', 'grid', 'rowShape'],
  );
  return {
    id: string(raw['id'], `${path}.id`),
    name: text(raw['name'], `${path}.name`),
    stitches: array(raw['stitches'], `${path}.stitches`, readNode),
    spaces: array(raw['spaces'], `${path}.spaces`, readSpace),
    rings: array(raw['rings'], `${path}.rings`, readRing),
    groups: array(raw['groups'], `${path}.groups`, readGroup),
    events: array(raw['events'], `${path}.events`, readEvent),
    skipped: array(raw['skipped'], `${path}.skipped`, string),
    // A PQW-861 előtti mentésben nincs: a körökben horgolt darab kör.
    ...(raw['corners'] === undefined ? {} : { corners: integer(raw['corners'], `${path}.corners`, 3) }),
    // A PQW-863 előtti mentésben nincs: a darab nem részekből készült.
    ...(raw['sections'] === undefined ? {} : { sections: array(raw['sections'], `${path}.sections`, readSection) }),
    // A PQW-862 előtti mentésben nincs: a darabnak nincs szegélye.
    ...(raw['border'] === undefined ? {} : { border: readBorder(raw['border'], `${path}.border`) }),
    // A PQW-864 előtti mentésben nincs: a darab nem rácsmintából készült.
    ...(raw['grid'] === undefined ? {} : { grid: readGrid(raw['grid'], `${path}.grid`) }),
    // A PQW-893 előtti mentésben nincs: a sorok egyenesek.
    ...(raw['rowShape'] === undefined ? {} : { rowShape: readRowShape(raw['rowShape'], `${path}.rowShape`) }),
  };
}

/** A sorban horgolt kendő rajzának alakja; a szögek fokban, 0 és 360 között. */
function readRowShape(value: unknown, path: string): NonNullable<Piece['rowShape']> {
  const kind = oneOf(isObject(value) ? value['kind'] : undefined, `${path}.kind`, ['arc', 'chevron'] as const);
  const angle = (raw: JsonObject, key: string) => {
    const degrees = finite(raw[key], `${path}.${key}`);
    if (degrees <= 0 || degrees >= 360) throw new FormatError(`${path}.${key}`, '0 és 360 fok közötti szöget vártunk.');
    return degrees;
  };
  if (kind === 'arc') {
    const raw = object(value, path, ['kind', 'neckAngle']);
    return { kind, neckAngle: angle(raw, 'neckAngle') };
  }
  const raw = object(value, path, ['kind', 'neckAngle', 'tipAngle']);
  return { kind, neckAngle: angle(raw, 'neckAngle'), tipAngle: angle(raw, 'tipAngle') };
}

const GRID_TECHNIQUES: readonly GridTechnique[] = ['filet', 'c2c', 'tapestry', 'graphgan', 'mosaic'];

function readGrid(value: unknown, path: string): PieceGrid {
  const raw = object(value, path, ['technique', 'cells', 'colors', 'unit', 'lettering']);
  const cells = array(raw['cells'], `${path}.cells`, (row, rowPath) => array(row, rowPath, (cell, cellPath) => integer(cell, cellPath, -1)));
  const width = cells[0]?.length ?? 0;
  cells.forEach((row, y) => {
    if (row.length !== width) throw new FormatError(`${path}.cells[${y}]`, `Soronként ${width} cellát vártunk.`);
  });
  return {
    technique: oneOf(raw['technique'], `${path}.technique`, GRID_TECHNIQUES),
    cells,
    colors: array(raw['colors'], `${path}.colors`, readColor),
    unit: raw['unit'] === null ? null : readUnit(raw['unit'], `${path}.unit`),
    lettering: boolean(raw['lettering'], `${path}.lettering`),
  };
}

function readColor(value: unknown, path: string): PatternColor {
  const raw = object(value, path, ['name', 'hex']);
  const hex = string(raw['hex'], `${path}.hex`);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new FormatError(`${path}.hex`, '#rrggbb alakú színt vártunk.');
  return { name: text(raw['name'], `${path}.name`), hex };
}

function readUnit(value: unknown, path: string): GridUnit {
  const raw = object(value, path, ['x', 'y', 'width', 'height']);
  return {
    x: integer(raw['x'], `${path}.x`, 0),
    y: integer(raw['y'], `${path}.y`, 0),
    width: integer(raw['width'], `${path}.width`, 1),
    height: integer(raw['height'], `${path}.height`, 1),
  };
}

function readBorder(value: unknown, path: string): PieceBorder {
  const raw = object(value, path, ['stitch', 'hdcRowEnd']);
  return {
    stitch: oneOf(raw['stitch'], `${path}.stitch`, ['sc'] as const),
    hdcRowEnd: oneOf(raw['hdcRowEnd'], `${path}.hdcRowEnd`, [1, 2] as const),
  };
}

function readNode(value: unknown, path: string): StitchNode {
  const raw = object(value, path, ['id', 'def', 'prev', 'anchors'], ['flags', 'pinned', 'color']);
  return {
    id: string(raw['id'], `${path}.id`),
    def: string(raw['def'], `${path}.def`),
    prev: raw['prev'] === null ? null : string(raw['prev'], `${path}.prev`),
    anchors: array(raw['anchors'], `${path}.anchors`, readAnchor),
    ...(raw['flags'] === undefined
      ? {}
      : { flags: array(raw['flags'], `${path}.flags`, (flag, flagPath) => oneOf(flag, flagPath, FLAGS)) }),
    ...(raw['pinned'] === undefined ? {} : { pinned: readPinned(raw['pinned'], `${path}.pinned`) }),
    // A PQW-864 előtti mentésben nincs: a szem az első színnel készül.
    ...(raw['color'] === undefined ? {} : { color: integer(raw['color'], `${path}.color`, 0) }),
  };
}

function readPinned(value: unknown, path: string): NonNullable<StitchNode['pinned']> {
  const raw = object(value, path, ['x', 'y', 'rotation']);
  return {
    x: finite(raw['x'], `${path}.x`),
    y: finite(raw['y'], `${path}.y`),
    rotation: finite(raw['rotation'], `${path}.rotation`),
  };
}

function readAnchor(value: unknown, path: string): Anchor {
  if (!isObject(value)) throw new FormatError(path, 'Objektumot vártunk.');
  const into = oneOf(value['into'], `${path}.into`, ['stitch', 'space', 'ring', 'row-end']);
  if (into === 'stitch') {
    const raw = object(value, path, ['into', 'id', 'mode']);
    return { into, id: string(raw['id'], `${path}.id`), mode: oneOf(raw['mode'], `${path}.mode`, INSERTIONS) };
  }
  const raw = object(value, path, ['into', 'id']);
  return { into, id: string(raw['id'], `${path}.id`) };
}

function readSpace(value: unknown, path: string): Space {
  const raw = object(value, path, ['id', 'chains']);
  return { id: string(raw['id'], `${path}.id`), chains: array(raw['chains'], `${path}.chains`, string) };
}

function readRing(value: unknown, path: string): Ring {
  const raw = object(value, path, ['id', 'node']);
  return { id: string(raw['id'], `${path}.id`), node: string(raw['node'], `${path}.node`) };
}

function readGroup(value: unknown, path: string): StitchGroup {
  const raw = object(value, path, ['id', 'def', 'members']);
  return {
    id: string(raw['id'], `${path}.id`),
    def: string(raw['def'], `${path}.def`),
    members: array(raw['members'], `${path}.members`, string),
  };
}

function readEvent(value: unknown, path: string): LayerEvent {
  const raw = object(value, path, ['after', 'kind'], ['statedCount', 'conventions', 'colorChange', 'jogFix', 'marks']);
  return {
    after: string(raw['after'], `${path}.after`),
    kind: oneOf(raw['kind'], `${path}.kind`, ['turn', 'join-slip', 'spiral', 'fasten-off']),
    ...(raw['statedCount'] === undefined ? {} : { statedCount: integer(raw['statedCount'], `${path}.statedCount`, 0) }),
    ...(raw['conventions'] === undefined
      ? {}
      : { conventions: readRowConventions(raw['conventions'], `${path}.conventions`) }),
    // A színváltás és a lépcsőjavítás a PQW-861 előtti mentésben nincs.
    ...(raw['colorChange'] === undefined ? {} : { colorChange: boolean(raw['colorChange'], `${path}.colorChange`) }),
    ...(raw['jogFix'] === undefined ? {} : { jogFix: oneOf(raw['jogFix'], `${path}.jogFix`, ['slip-stitch', 'back-loop']) }),
    // A jelölések a PQW-863 előtti mentésben nincsenek.
    ...(raw['marks'] === undefined
      ? {}
      : { marks: array(raw['marks'], `${path}.marks`, (mark, markPath) => oneOf(mark, markPath, MARKS)) }),
  };
}

/* ---- Amigurumi (PQW-863) ---- */

const MARKS: readonly RoundMark[] = ['safety-eyes', 'embroider-eyes', 'stuffing', 'close-opening'];
const ENDS: readonly PieceEnd[] = ['open', 'closed'];
const SHAPES: readonly ShapeSpec['kind'][] = ['sphere', 'hemisphere', 'egg', 'cylinder', 'cone', 'revolution'];

function readSection(value: unknown, path: string): PieceSection {
  const raw = object(value, path, ['name', 'layer', 'shape', 'stagger']);
  return {
    name: text(raw['name'], `${path}.name`),
    layer: integer(raw['layer'], `${path}.layer`, 1),
    shape: readShape(raw['shape'], `${path}.shape`),
    stagger: boolean(raw['stagger'], `${path}.stagger`),
  };
}

function readShape(value: unknown, path: string): ShapeSpec {
  if (!isObject(value)) throw new FormatError(path, 'Objektumot vártunk.');
  const kind = oneOf(value['kind'], `${path}.kind`, SHAPES);
  const size = (raw: JsonObject, key: string) => positive(raw[key], `${path}.${key}`);
  const end = (raw: JsonObject, key: string) => oneOf(raw[key], `${path}.${key}`, ENDS);
  const method = (raw: JsonObject) => oneOf(raw['method'], `${path}.method`, ['6n', 'sine']);
  switch (kind) {
    case 'sphere': {
      const raw = object(value, path, ['kind', 'diameterCm', 'method']);
      return { kind, diameterCm: size(raw, 'diameterCm'), method: method(raw) };
    }
    case 'hemisphere': {
      const raw = object(value, path, ['kind', 'diameterCm', 'method', 'top']);
      return { kind, diameterCm: size(raw, 'diameterCm'), method: method(raw), top: end(raw, 'top') };
    }
    case 'egg': {
      const raw = object(value, path, ['kind', 'diameterCm', 'heightCm']);
      return { kind, diameterCm: size(raw, 'diameterCm'), heightCm: size(raw, 'heightCm') };
    }
    case 'cylinder': {
      const raw = object(value, path, ['kind', 'diameterCm', 'heightCm', 'bottom', 'top']);
      return { kind, diameterCm: size(raw, 'diameterCm'), heightCm: size(raw, 'heightCm'), bottom: end(raw, 'bottom'), top: end(raw, 'top') };
    }
    case 'cone': {
      const raw = object(value, path, ['kind', 'diameterCm', 'heightCm', 'increases', 'top']);
      return {
        kind,
        diameterCm: size(raw, 'diameterCm'),
        heightCm: size(raw, 'heightCm'),
        increases: raw['increases'] === null ? null : size(raw, 'increases'),
        top: end(raw, 'top'),
      };
    }
    case 'revolution': {
      const raw = object(value, path, ['kind', 'profile', 'bottom', 'top']);
      return { kind, profile: array(raw['profile'], `${path}.profile`, readProfilePoint), bottom: end(raw, 'bottom'), top: end(raw, 'top') };
    }
  }
}

function readProfilePoint(value: unknown, path: string): ProfilePoint {
  const raw = object(value, path, ['radiusCm', 'heightCm']);
  const radiusCm = finite(raw['radiusCm'], `${path}.radiusCm`);
  if (radiusCm < 0) throw new FormatError(`${path}.radiusCm`, 'Nem negatív számot vártunk.');
  return { radiusCm, heightCm: finite(raw['heightCm'], `${path}.heightCm`) };
}

function readJoin(value: unknown, path: string): PieceJoin {
  const raw = object(value, path, ['a', 'b'], ['distribution']);
  return {
    a: readJoinEdge(raw['a'], `${path}.a`),
    b: readJoinEdge(raw['b'], `${path}.b`),
    ...(raw['distribution'] === undefined
      ? {}
      : { distribution: array(raw['distribution'], `${path}.distribution`, (n, itemPath) => integer(n, itemPath, 1)) }),
  };
}

function readJoinEdge(value: unknown, path: string): JoinEdge {
  const raw = object(value, path, ['piece', 'layer']);
  return { piece: string(raw['piece'], `${path}.piece`), layer: integer(raw['layer'], `${path}.layer`, 1) };
}

function readToy(value: unknown, path: string): { readonly under3: boolean } {
  const raw = object(value, path, ['under3']);
  return { under3: boolean(raw['under3'], `${path}.under3`) };
}

function readRowConventions(value: unknown, path: string): Partial<RowConventions> {
  const raw = object(value, path, [], ['turningChainCounts']);
  return raw['turningChainCounts'] === undefined
    ? {}
    : { turningChainCounts: readTurningChainCounts(raw['turningChainCounts'], `${path}.turningChainCounts`) };
}
