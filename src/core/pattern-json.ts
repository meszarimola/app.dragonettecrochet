// KB: core-domain §11, core-domain §19

import { SERIES_KEYS } from './garment-text.ts';
import type { CoreData, CoreText } from './messages.ts';
import type {
  Anchor,
  ChartStyle,
  GarmentKind,
  GarmentTable,
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
  PatternGarment,
  PatternGaugeProfile,
  PatternNotation,
  Piece,
  PieceEnd,
  PieceGrid,
  PieceJoin,
  PieceSection,
  ProfilePoint,
  RepeatSpec,
  Ring,
  RoundMark,
  RowConventions,
  OvalStitch,
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

// KB: core-domain §2
export type JsonCode =
  | 'invalid-json'
  | 'unsupported-version'
  | 'expected-object'
  | 'missing-field'
  | 'unknown-field'
  /** KB: core-domain §19 */
  | 'legacy-border'
  | 'expected-nonempty-string'
  | 'expected-string'
  | 'expected-boolean'
  | 'expected-integer-min'
  | 'expected-number'
  | 'expected-one-of'
  | 'expected-array'
  | 'expected-positive'
  | 'expected-positive-max'
  | 'duplicate-profile-id'
  | 'unknown-profile'
  | 'duplicate-gauge'
  | 'expected-angle'
  | 'expected-cells-per-row'
  | 'expected-hex-color'
  | 'repeat-width-max'
  | 'repeat-edge-max'
  | 'join-edge-both'
  | 'expected-size'
  | 'expected-integer-max'
  | 'expected-numbers-per-size'
  | 'expected-non-negative';

export interface LoadError {
  readonly code: 'invalid-json' | 'unsupported-version' | 'invalid-format';
  readonly path: string;
  readonly message: CoreText<JsonCode>;
}

export type LoadResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly error: LoadError };

export function savePattern(pattern: Pattern): string {
  return `${JSON.stringify(readPattern(pattern, '$'), null, 2)}\n`;
}

export function loadPattern(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    // The JS error text stays as data: we did not write it, so we do not translate it.
    return fail('invalid-json', '$', { code: 'invalid-json', data: { detail: (error as Error).message } });
  }

  const version = isObject(raw) ? raw['formatVersion'] : undefined;
  if (typeof version === 'number' && version > FORMAT_VERSION) {
    return fail('unsupported-version', '$.formatVersion', {
      code: 'unsupported-version',
      data: { found: version, known: FORMAT_VERSION },
    });
  }

  try {
    return { ok: true, pattern: readPattern(raw, '$') };
  } catch (error) {
    if (error instanceof FormatError) return fail('invalid-format', error.path, messageOf(error));
    throw error;
  }
}

function fail(code: LoadError['code'], path: string, message: CoreText<JsonCode>): LoadResult {
  return { ok: false, error: { code, path, message } };
}

function messageOf(error: FormatError): CoreText<JsonCode> {
  return error.data === undefined ? { code: error.code } : { code: error.code, data: error.data };
}

/** `Error.message` is the code itself, so the developer log stays readable. */
class FormatError extends Error {
  readonly path: string;
  readonly code: JsonCode;
  readonly data: CoreData | undefined;

  constructor(path: string, code: JsonCode, data?: CoreData) {
    super(code);
    this.path = path;
    this.code = code;
    this.data = data;
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): JsonObject {
  if (!isObject(value)) throw new FormatError(path, 'expected-object');
  for (const key of required) {
    if (!(key in value)) throw new FormatError(`${path}.${key}`, 'missing-field');
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) throw new FormatError(`${path}.${key}`, 'unknown-field');
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') throw new FormatError(path, 'expected-nonempty-string');
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new FormatError(path, 'expected-string');
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new FormatError(path, 'expected-boolean');
  return value;
}

function integer(value: unknown, path: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new FormatError(path, 'expected-integer-min', { min });
  }
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new FormatError(path, 'expected-number');
  return value;
}

function oneOf<const T extends string | boolean | number>(value: unknown, path: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new FormatError(path, 'expected-one-of', { values: allowed.map((item) => JSON.stringify(item)) });
  }
  return value as T;
}

function array<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) throw new FormatError(path, 'expected-array');
  return value.map((item, index) => read(item, `${path}[${index}]`));
}

const LOCALES: readonly Locale[] = ['hu', 'en-US', 'en-GB'];
const CHART_STYLES: readonly ChartStyle[] = ['cyc', 'jis'];
const INSERTIONS: readonly StitchInsertion[] = ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post'];
const FLAGS: readonly StitchFlag[] = ['crossed', 'spike'];
const TRADITIONS: readonly Tradition[] = ['cyc', 'japanese'];
/** Basic stitches a profile can measure; chain and slip stitch are excluded. */
export const GAUGE_STITCHES: readonly StitchDefId[] = ['sc', 'hdc', 'dc', 'tr'];
const GAUGE_FORMS: readonly GaugeForm[] = ['rows', 'rounds'];

function readPattern(value: unknown, path: string): Pattern {
  const raw = object(value, path, ['formatVersion', 'title', 'conventions', 'pieces'], ['titleGenerated', 'notation', 'gauge', 'joins', 'toy', 'garment']);
  return {
    formatVersion: oneOf(raw['formatVersion'], `${path}.formatVersion`, [FORMAT_VERSION]),
    title: text(raw['title'], `${path}.title`),
    ...(raw['titleGenerated'] === undefined ? {} : { titleGenerated: boolean(raw['titleGenerated'], `${path}.titleGenerated`) }),
    ...(raw['notation'] === undefined ? {} : { notation: readNotation(raw['notation'], `${path}.notation`) }),
    ...(raw['gauge'] === undefined ? {} : { gauge: readGauge(raw['gauge'], `${path}.gauge`) }),
    conventions: readPatternConventions(raw['conventions'], `${path}.conventions`),
    pieces: array(raw['pieces'], `${path}.pieces`, readPiece),
    ...(raw['joins'] === undefined ? {} : { joins: array(raw['joins'], `${path}.joins`, readJoin) }),
    ...(raw['toy'] === undefined ? {} : { toy: readToy(raw['toy'], `${path}.toy`) }),
    ...(raw['garment'] === undefined ? {} : { garment: readGarment(raw['garment'], `${path}.garment`) }),
  };
}

function positive(value: unknown, path: string, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    if (max === Number.POSITIVE_INFINITY) throw new FormatError(path, 'expected-positive');
    throw new FormatError(path, 'expected-positive-max', { max });
  }
  return value;
}

function positiveOrNull(value: unknown, path: string): number | null {
  return value === null ? null : positive(value, path);
}

function readGauge(value: unknown, path: string): PatternGauge {
  const raw = object(value, path, ['active', 'profiles']);
  const profiles = array(raw['profiles'], `${path}.profiles`, readGaugeProfile);
  const ids = new Set<string>();
  profiles.forEach((profile, i) => {
    if (ids.has(profile.id)) throw new FormatError(`${path}.profiles[${i}].id`, 'duplicate-profile-id');
    ids.add(profile.id);
  });
  const active = raw['active'] === null ? null : string(raw['active'], `${path}.active`);
  if (active !== null && !ids.has(active)) throw new FormatError(`${path}.active`, 'unknown-profile');
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
    if (keys.has(key)) throw new FormatError(`${path}.gauges[${i}]`, 'duplicate-gauge');
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
    chainCounts:
      raw['chainCounts'] === undefined
        ? 'worked-into'
        : oneOf(raw['chainCounts'], `${path}.chainCounts`, ['worked-into', true, false]),
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
    // KB: core-domain §19
    ['corners', 'border', 'sections', 'grid', 'rowShape', 'roundShape'],
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
    ...(raw['corners'] === undefined ? {} : { corners: integer(raw['corners'], `${path}.corners`, 3) }),
    ...(raw['sections'] === undefined ? {} : { sections: array(raw['sections'], `${path}.sections`, readSection) }),
    ...(raw['grid'] === undefined ? {} : { grid: readGrid(raw['grid'], `${path}.grid`) }),
    ...(raw['rowShape'] === undefined ? {} : { rowShape: readRowShape(raw['rowShape'], `${path}.rowShape`) }),
    ...(raw['roundShape'] === undefined ? {} : { roundShape: readRoundShape(raw['roundShape'], `${path}.roundShape`) }),
  };
}

function readRoundShape(value: unknown, path: string): NonNullable<Piece['roundShape']> {
  const kind = oneOf(isObject(value) ? value['kind'] : undefined, `${path}.kind`, ['cone'] as const);
  const raw = object(value, path, ['kind', 'throughRound']);
  return { kind, throughRound: integer(raw['throughRound'], `${path}.throughRound`, 2) };
}

/** Angles in degrees, between 0 and 360. */
function readRowShape(value: unknown, path: string): NonNullable<Piece['rowShape']> {
  const kind = oneOf(isObject(value) ? value['kind'] : undefined, `${path}.kind`, ['arc', 'chevron'] as const);
  const angle = (raw: JsonObject, key: string) => {
    const degrees = finite(raw[key], `${path}.${key}`);
    if (degrees <= 0 || degrees >= 360) throw new FormatError(`${path}.${key}`, 'expected-angle');
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
  const raw = object(value, path, ['technique', 'cells', 'colors', 'unit', 'lettering'], ['mosaicRows']);
  const cells = array(raw['cells'], `${path}.cells`, (row, rowPath) => array(row, rowPath, (cell, cellPath) => integer(cell, cellPath, -1)));
  const width = cells[0]?.length ?? 0;
  cells.forEach((row, y) => {
    if (row.length !== width) throw new FormatError(`${path}.cells[${y}]`, 'expected-cells-per-row', { width });
  });
  return {
    technique: oneOf(raw['technique'], `${path}.technique`, GRID_TECHNIQUES),
    cells,
    colors: array(raw['colors'], `${path}.colors`, readColor),
    unit: raw['unit'] === null ? null : readUnit(raw['unit'], `${path}.unit`),
    lettering: boolean(raw['lettering'], `${path}.lettering`),
    ...(raw['mosaicRows'] === undefined ? {} : { mosaicRows: oneOf(raw['mosaicRows'], `${path}.mosaicRows`, [1, 2] as const) }),
  };
}

function readColor(value: unknown, path: string): PatternColor {
  // A built-in color carries an id, an older save only a name; one of the two must be there.
  const raw = object(value, path, ['hex'], ['id', 'name']);
  const hex = string(raw['hex'], `${path}.hex`);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new FormatError(`${path}.hex`, 'expected-hex-color');
  if (raw['id'] === undefined && raw['name'] === undefined) throw new FormatError(`${path}.name`, 'missing-field');
  return {
    ...(raw['id'] === undefined ? {} : { id: text(raw['id'], `${path}.id`) }),
    ...(raw['name'] === undefined ? {} : { name: text(raw['name'], `${path}.name`) }),
    hex,
  };
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
  if (!isObject(value)) throw new FormatError(path, 'expected-object');
  // KB: core-domain §19
  if (isObject(value) && value['into'] === 'row-end') throw new FormatError(`${path}.into`, 'legacy-border');
  const into = oneOf(value['into'], `${path}.into`, ['stitch', 'space', 'ring', 'underside']);
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
  const raw = object(value, path, ['after', 'kind'], ['statedCount', 'conventions', 'colorChange', 'jogFix', 'marks', 'resume']);
  return {
    after: string(raw['after'], `${path}.after`),
    kind: oneOf(raw['kind'], `${path}.kind`, ['turn', 'join-slip', 'spiral', 'fasten-off']),
    ...(raw['statedCount'] === undefined ? {} : { statedCount: integer(raw['statedCount'], `${path}.statedCount`, 0) }),
    ...(raw['conventions'] === undefined
      ? {}
      : { conventions: readRowConventions(raw['conventions'], `${path}.conventions`) }),
    ...(raw['colorChange'] === undefined ? {} : { colorChange: boolean(raw['colorChange'], `${path}.colorChange`) }),
    ...(raw['jogFix'] === undefined ? {} : { jogFix: oneOf(raw['jogFix'], `${path}.jogFix`, ['slip-stitch', 'back-loop']) }),
    ...(raw['marks'] === undefined
      ? {}
      : { marks: array(raw['marks'], `${path}.marks`, (mark, markPath) => oneOf(mark, markPath, MARKS)) }),
    ...(raw['resume'] === undefined ? {} : { resume: readResume(raw['resume'], `${path}.resume`) }),
  };
}

function readResume(value: unknown, path: string): NonNullable<LayerEvent['resume']> {
  const raw = object(value, path, ['layer'], ['name', 'with']);
  return {
    layer: integer(raw['layer'], `${path}.layer`, 1),
    ...(raw['name'] === undefined ? {} : { name: string(raw['name'], `${path}.name`) }),
    ...(raw['with'] === undefined ? {} : { with: integer(raw['with'], `${path}.with`, 1) }),
  };
}

const MARKS: readonly RoundMark[] = ['safety-eyes', 'embroider-eyes', 'stuffing', 'close-opening'];
const ENDS: readonly PieceEnd[] = ['open', 'closed'];
const SHAPES: readonly ShapeSpec['kind'][] = ['sphere', 'hemisphere', 'egg', 'cylinder', 'cone', 'revolution', 'oval'];
const OVAL_STITCHES: readonly OvalStitch[] = ['sc', 'hdc', 'dc', 'tr'];

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
  if (!isObject(value)) throw new FormatError(path, 'expected-object');
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
    case 'oval': {
      const raw = object(value, path, ['kind', 'lengthCm', 'widthCm'], ['stitch']);
      const stitch = raw['stitch'] === undefined ? {} : { stitch: oneOf(raw['stitch'], `${path}.stitch`, OVAL_STITCHES) };
      return { kind, lengthCm: size(raw, 'lengthCm'), widthCm: size(raw, 'widthCm'), ...stitch };
    }
  }
}

function readProfilePoint(value: unknown, path: string): ProfilePoint {
  const raw = object(value, path, ['radiusCm', 'heightCm']);
  const radiusCm = finite(raw['radiusCm'], `${path}.radiusCm`);
  if (radiusCm < 0) throw new FormatError(`${path}.radiusCm`, 'expected-non-negative');
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
  const raw = object(value, path, ['piece', 'layer'], ['stitches', 'rows']);
  if (raw['stitches'] !== undefined && raw['rows'] !== undefined) {
    throw new FormatError(path, 'join-edge-both');
  }
  const layer = integer(raw['layer'], `${path}.layer`, 1);
  let stitches: JoinEdge['stitches'];
  if (raw['stitches'] !== undefined) {
    const range = object(raw['stitches'], `${path}.stitches`, ['from', 'count']);
    stitches = { from: integer(range['from'], `${path}.stitches.from`, 0), count: integer(range['count'], `${path}.stitches.count`, 1) };
  }
  let rows: JoinEdge['rows'];
  if (raw['rows'] !== undefined) {
    const range = object(raw['rows'], `${path}.rows`, ['to', 'side']);
    rows = { to: integer(range['to'], `${path}.rows.to`, layer), side: oneOf(range['side'], `${path}.rows.side`, ['left', 'right'] as const) };
  }
  return {
    piece: string(raw['piece'], `${path}.piece`),
    layer,
    ...(stitches ? { stitches } : {}),
    ...(rows ? { rows } : {}),
  };
}

const GARMENT_KINDS: readonly GarmentKind[] = ['hat', 'drop-shoulder'];
const GARMENT_TABLES: readonly GarmentTable[] = ['women', 'men', 'child', 'baby', 'hat'];

/** One number per size, keyed by `SERIES_KEYS`. */
function readGarment(value: unknown, path: string): PatternGarment {
  const raw = object(value, path, ['kind', 'table', 'sizes', 'base', 'values']);
  const sizes = array(raw['sizes'], `${path}.sizes`, string);
  if (sizes.length === 0) throw new FormatError(`${path}.sizes`, 'expected-size');
  const base = integer(raw['base'], `${path}.base`, 0);
  if (base >= sizes.length) throw new FormatError(`${path}.base`, 'expected-integer-max', { max: sizes.length - 1 });
  const rawValues = object(raw['values'], `${path}.values`, [], SERIES_KEYS);
  const values: Record<string, readonly number[]> = {};
  for (const key of SERIES_KEYS) {
    if (rawValues[key] === undefined) continue;
    const numbers = array(rawValues[key], `${path}.values.${key}`, finite);
    if (numbers.length !== sizes.length) throw new FormatError(`${path}.values.${key}`, 'expected-numbers-per-size', { count: sizes.length });
    values[key] = numbers;
  }
  return {
    kind: oneOf(raw['kind'], `${path}.kind`, GARMENT_KINDS),
    table: oneOf(raw['table'], `${path}.table`, GARMENT_TABLES),
    sizes,
    base,
    values,
  };
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
