// The free-form chart file. KB: core-domain §8, core-domain §11

import {
  ARC_COUNT_RANGE,
  type ArcShape,
  DEFAULT_POLAR,
  FAN_COUNT_RANGE,
  FAN_LENGTH_RANGE,
  FAN_SPREAD_RANGE,
  type FanMode,
  IRREGULAR_FORMAT_VERSION,
  type IrregularGroup,
  type IrregularGuides,
  type IrregularItem,
  type IrregularLayer,
  type IrregularPattern,
  type IrregularRow,
  type LegendBlock,
  POLAR_RANGE,
  type PolarGuide,
  type RowDirection,
  type RowKind,
  type StitchKeyEntry,
} from './irregular-types.ts';
import type { CoreData, CoreText } from './messages.ts';
import type { ChartStyle, Locale, PatternNotation, StitchInsertion } from './types.ts';

export type IrregularJsonCode =
  | 'invalid-json'
  | 'unsupported-version'
  | 'expected-object'
  | 'missing-field'
  | 'unknown-field'
  | 'expected-nonempty-string'
  | 'expected-string'
  | 'expected-boolean'
  | 'expected-number'
  | 'expected-one-of'
  | 'expected-array'
  | 'expected-nonempty-array'
  | 'expected-positive'
  | 'expected-whole-number'
  | 'expected-in-range'
  | 'expected-hex-color'
  | 'duplicate-row-id'
  | 'duplicate-layer-id'
  | 'duplicate-item-id'
  | 'unknown-row'
  | 'unknown-layer'
  | 'duplicate-key-entry-id'
  | 'duplicate-group-id'
  | 'shared-group-member'
  | 'group-count-mismatch'
  | 'unknown-item'
  | 'key-entry-unnamed';

export interface IrregularLoadError {
  readonly code: 'invalid-json' | 'unsupported-version' | 'invalid-format';
  readonly path: string;
  readonly message: CoreText<IrregularJsonCode>;
}

export type IrregularLoadResult =
  | { readonly ok: true; readonly pattern: IrregularPattern }
  | { readonly ok: false; readonly error: IrregularLoadError };

export function saveIrregular(pattern: IrregularPattern): string {
  return `${JSON.stringify(readIrregular(pattern, '$'), null, 2)}\n`;
}

export function loadIrregular(source: string): IrregularLoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    // The JS error text stays as data: we did not write it, so we do not translate it.
    return fail('invalid-json', '$', { code: 'invalid-json', data: { detail: (error as Error).message } });
  }

  const version = isObject(raw) ? raw['formatVersion'] : undefined;
  if (typeof version === 'number' && version > IRREGULAR_FORMAT_VERSION) {
    return fail('unsupported-version', '$.formatVersion', {
      code: 'unsupported-version',
      data: { found: version, known: IRREGULAR_FORMAT_VERSION },
    });
  }

  try {
    return { ok: true, pattern: readIrregular(raw, '$') };
  } catch (error) {
    if (error instanceof FormatError) return fail('invalid-format', error.path, messageOf(error));
    throw error;
  }
}

/** The file menu picks the reader with this, so a broken file is an answer, not a throw. */
export function isIrregularJson(source: string): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return false;
  }
  return isObject(raw) && raw['type'] === 'irregular';
}

function fail(
  code: IrregularLoadError['code'],
  path: string,
  message: CoreText<IrregularJsonCode>,
): IrregularLoadResult {
  return { ok: false, error: { code, path, message } };
}

function messageOf(error: FormatError): CoreText<IrregularJsonCode> {
  return error.data === undefined ? { code: error.code } : { code: error.code, data: error.data };
}

/** `Error.message` is the code itself, so the developer log stays readable. */
class FormatError extends Error {
  readonly path: string;
  readonly code: IrregularJsonCode;
  readonly data: CoreData | undefined;

  constructor(path: string, code: IrregularJsonCode, data?: CoreData) {
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

function object(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): JsonObject {
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

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new FormatError(path, 'expected-number');
  return value;
}

function positive(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new FormatError(path, 'expected-positive');
  }
  return value;
}

/** Whole numbers with a ceiling: a file may not ask for a million rings. */
function whole(value: unknown, path: string, range: { readonly min: number; readonly max: number }): number {
  const found = finite(value, path);
  if (!Number.isInteger(found)) throw new FormatError(path, 'expected-whole-number');
  return ranged(found, path, range);
}

function ranged(value: number, path: string, range: { readonly min: number; readonly max: number }): number {
  if (value < range.min || value > range.max) {
    throw new FormatError(path, 'expected-in-range', { min: range.min, max: range.max });
  }
  return value;
}

function hexOrNull(value: unknown, path: string): string | null {
  if (value === null) return null;
  const hex = string(value, path);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new FormatError(path, 'expected-hex-color');
  return hex;
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
const ROW_KINDS: readonly RowKind[] = ['row', 'round'];
const ROW_DIRECTIONS: readonly RowDirection[] = ['ltr', 'rtl', 'cw', 'ccw'];

function readIrregular(value: unknown, path: string): IrregularPattern {
  const raw = object(
    value,
    path,
    ['formatVersion', 'type', 'title', 'rows', 'layers', 'items', 'activeRowId', 'activeLayerId', 'guides'],
    ['titleGenerated', 'notation', 'stitchKey', 'legend', 'groups'],
  );
  const rows = array(raw['rows'], `${path}.rows`, readRow);
  if (rows.length === 0) throw new FormatError(`${path}.rows`, 'expected-nonempty-array');
  const layers = array(raw['layers'], `${path}.layers`, readLayer);
  if (layers.length === 0) throw new FormatError(`${path}.layers`, 'expected-nonempty-array');
  const rowIds = idsOf(rows, `${path}.rows`, 'duplicate-row-id');
  const layerIds = idsOf(layers, `${path}.layers`, 'duplicate-layer-id');

  const items = array(raw['items'], `${path}.items`, readItem);
  idsOf(items, `${path}.items`, 'duplicate-item-id');
  items.forEach((item, index) => {
    if (!rowIds.has(item.rowId)) throw new FormatError(`${path}.items[${index}].rowId`, 'unknown-row');
    if (!layerIds.has(item.layerId)) throw new FormatError(`${path}.items[${index}].layerId`, 'unknown-layer');
  });

  const itemIds = new Set(items.map((item) => item.id));
  const groups =
    raw['groups'] === undefined
      ? undefined
      : array(raw['groups'], `${path}.groups`, (entry, where) => readGroup(entry, where, rowIds, layerIds, itemIds));
  if (groups !== undefined) {
    idsOf(groups, `${path}.groups`, 'duplicate-group-id');
    const claimed = new Set<string>();
    groups.forEach((group, index) => {
      group.memberIds.forEach((member, spot) => {
        if (claimed.has(member)) {
          throw new FormatError(`${path}.groups[${index}].memberIds[${spot}]`, 'shared-group-member');
        }
        claimed.add(member);
      });
    });
  }

  const activeRowId = string(raw['activeRowId'], `${path}.activeRowId`);
  if (!rowIds.has(activeRowId)) throw new FormatError(`${path}.activeRowId`, 'unknown-row');
  const activeLayerId = string(raw['activeLayerId'], `${path}.activeLayerId`);
  if (!layerIds.has(activeLayerId)) throw new FormatError(`${path}.activeLayerId`, 'unknown-layer');

  return {
    formatVersion: oneOf(raw['formatVersion'], `${path}.formatVersion`, [IRREGULAR_FORMAT_VERSION]),
    type: oneOf(raw['type'], `${path}.type`, ['irregular'] as const),
    title: text(raw['title'], `${path}.title`),
    ...(raw['titleGenerated'] === undefined
      ? {}
      : { titleGenerated: boolean(raw['titleGenerated'], `${path}.titleGenerated`) }),
    ...(raw['notation'] === undefined ? {} : { notation: readNotation(raw['notation'], `${path}.notation`) }),
    rows,
    layers,
    items,
    activeRowId,
    activeLayerId,
    ...(groups === undefined || groups.length === 0 ? {} : { groups }),
    guides: readGuides(raw['guides'], `${path}.guides`),
    ...(raw['stitchKey'] === undefined ? {} : { stitchKey: readStitchKey(raw['stitchKey'], `${path}.stitchKey`) }),
    ...(raw['legend'] === undefined ? {} : { legend: readLegend(raw['legend'], `${path}.legend`) }),
  };
}

function readStitchKey(value: unknown, path: string): StitchKeyEntry[] {
  const entries = array(value, path, readKeyEntry);
  idsOf(entries, path, 'duplicate-key-entry-id');
  return entries;
}

function readKeyEntry(value: unknown, path: string): StitchKeyEntry {
  const raw = object(value, path, [
    'id',
    'stitch',
    'customName',
    'glyphOverride',
    'abbreviationOverride',
    'labelOverride',
  ]);
  const stitch = raw['stitch'] === null ? null : string(raw['stitch'], `${path}.stitch`);
  const customName = raw['customName'] === null ? null : string(raw['customName'], `${path}.customName`);
  // One of the two has to name the stitch, or the entry stands for nothing.
  if (stitch === null && customName === null) throw new FormatError(`${path}.stitch`, 'key-entry-unnamed');
  return {
    id: string(raw['id'], `${path}.id`),
    stitch,
    customName,
    glyphOverride: raw['glyphOverride'] === null ? null : string(raw['glyphOverride'], `${path}.glyphOverride`),
    abbreviationOverride:
      raw['abbreviationOverride'] === null ? null : string(raw['abbreviationOverride'], `${path}.abbreviationOverride`),
    labelOverride: raw['labelOverride'] === null ? null : string(raw['labelOverride'], `${path}.labelOverride`),
  };
}

function readLegend(value: unknown, path: string): LegendBlock {
  const raw = object(value, path, ['visible', 'position', 'columns', 'showCounts']);
  return {
    visible: boolean(raw['visible'], `${path}.visible`),
    position: readPoint(raw['position'], `${path}.position`),
    columns: oneOf(raw['columns'], `${path}.columns`, [1, 2, 3] as const),
    showCounts: boolean(raw['showCounts'], `${path}.showCounts`),
  };
}

function readPoint(value: unknown, path: string): { x: number; y: number } {
  const raw = object(value, path, ['x', 'y']);
  return { x: finite(raw['x'], `${path}.x`), y: finite(raw['y'], `${path}.y`) };
}

function idsOf(
  entries: readonly { readonly id: string }[],
  path: string,
  code: IrregularJsonCode,
): ReadonlySet<string> {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    if (ids.has(entry.id)) throw new FormatError(`${path}[${index}].id`, code);
    ids.add(entry.id);
  });
  return ids;
}

function readNotation(value: unknown, path: string): PatternNotation {
  const raw = object(value, path, ['terms', 'chartStyle', 'singleCrochet']);
  return {
    terms: oneOf(raw['terms'], `${path}.terms`, LOCALES),
    chartStyle: oneOf(raw['chartStyle'], `${path}.chartStyle`, CHART_STYLES),
    singleCrochet: oneOf(raw['singleCrochet'], `${path}.singleCrochet`, ['plus', 'cross']),
  };
}

function readRow(value: unknown, path: string): IrregularRow {
  const raw = object(value, path, ['id', 'kind', 'direction', 'color', 'visible', 'locked'], ['order']);
  const order = raw['order'];
  return {
    id: string(raw['id'], `${path}.id`),
    kind: oneOf(raw['kind'], `${path}.kind`, ROW_KINDS),
    direction: oneOf(raw['direction'], `${path}.direction`, ROW_DIRECTIONS),
    color: hexOrNull(raw['color'], `${path}.color`),
    visible: boolean(raw['visible'], `${path}.visible`),
    locked: boolean(raw['locked'], `${path}.locked`),
    ...(order === undefined
      ? {}
      : { order: order === 'auto' ? ('auto' as const) : array(order, `${path}.order`, string) }),
  };
}

function readLayer(value: unknown, path: string): IrregularLayer {
  const raw = object(value, path, ['id', 'name', 'visible', 'locked']);
  return {
    id: string(raw['id'], `${path}.id`),
    name: text(raw['name'], `${path}.name`),
    visible: boolean(raw['visible'], `${path}.visible`),
    locked: boolean(raw['locked'], `${path}.locked`),
  };
}

function readItem(value: unknown, path: string): IrregularItem {
  const raw = object(value, path, [
    'id',
    'kind',
    'keyEntryId',
    'insertion',
    'rowId',
    'layerId',
    'color',
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'flipX',
    'flipY',
  ]);
  return {
    id: string(raw['id'], `${path}.id`),
    kind: oneOf(raw['kind'], `${path}.kind`, ['stitch'] as const),
    keyEntryId: string(raw['keyEntryId'], `${path}.keyEntryId`),
    insertion: oneOf(raw['insertion'], `${path}.insertion`, INSERTIONS),
    rowId: string(raw['rowId'], `${path}.rowId`),
    layerId: string(raw['layerId'], `${path}.layerId`),
    color: hexOrNull(raw['color'], `${path}.color`),
    x: finite(raw['x'], `${path}.x`),
    y: finite(raw['y'], `${path}.y`),
    width: positive(raw['width'], `${path}.width`),
    height: positive(raw['height'], `${path}.height`),
    rotation: finite(raw['rotation'], `${path}.rotation`),
    flipX: boolean(raw['flipX'], `${path}.flipX`),
    flipY: boolean(raw['flipY'], `${path}.flipY`),
  };
}

function readGuides(value: unknown, path: string): IrregularGuides {
  const raw = object(value, path, ['grid', 'snap'], ['polar']);
  const grid = object(raw['grid'], `${path}.grid`, ['visible', 'size']);
  return {
    grid: {
      visible: boolean(grid['visible'], `${path}.grid.visible`),
      size: positive(grid['size'], `${path}.grid.size`),
    },
    // Written since PQW-966; a file from before that keeps the preset circle guide.
    polar: raw['polar'] === undefined ? DEFAULT_POLAR : readPolar(raw['polar'], `${path}.polar`),
    snap: boolean(raw['snap'], `${path}.snap`),
  };
}

const ARC_SHAPES: readonly ArcShape[] = ['arc', 'straight'];

/**
 * A group is read against the items it claims: a run pointing at a stitch that
 * is not in the file would draw nothing and could never be laid out again.
 */
function readGroup(
  value: unknown,
  path: string,
  rowIds: ReadonlySet<string>,
  layerIds: ReadonlySet<string>,
  itemIds: ReadonlySet<string>,
): IrregularGroup {
  if (!isObject(value)) throw new FormatError(path, 'expected-object');
  const kind = oneOf(value['kind'], `${path}.kind`, GROUP_KINDS);
  const shared = kind === 'fan' ? FAN_FIELDS : ARC_FIELDS;
  const raw = object(value, path, shared);
  const rowId = string(raw['rowId'], `${path}.rowId`);
  if (!rowIds.has(rowId)) throw new FormatError(`${path}.rowId`, 'unknown-row');
  const layerId = string(raw['layerId'], `${path}.layerId`);
  if (!layerIds.has(layerId)) throw new FormatError(`${path}.layerId`, 'unknown-layer');
  const memberIds = array(raw['memberIds'], `${path}.memberIds`, (member, where) => {
    const id = string(member, where);
    if (!itemIds.has(id)) throw new FormatError(where, 'unknown-item');
    return id;
  });
  const count = whole(raw['count'], `${path}.count`, kind === 'fan' ? FAN_COUNT_RANGE : ARC_COUNT_RANGE);
  if (count !== memberIds.length) throw new FormatError(`${path}.count`, 'group-count-mismatch');
  const common = {
    id: string(raw['id'], `${path}.id`),
    rowId,
    layerId,
    keyEntryId: string(raw['keyEntryId'], `${path}.keyEntryId`),
    count,
    memberIds,
  };
  if (kind === 'fan') {
    return {
      ...common,
      kind,
      mode: oneOf(raw['mode'], `${path}.mode`, FAN_MODES),
      origin: readPoint(raw['origin'], `${path}.origin`),
      direction: ranged(finite(raw['direction'], `${path}.direction`), `${path}.direction`, ANGLE_RANGE),
      spreadAngle: ranged(finite(raw['spreadAngle'], `${path}.spreadAngle`), `${path}.spreadAngle`, FAN_SPREAD_RANGE),
      length: ranged(positive(raw['length'], `${path}.length`), `${path}.length`, FAN_LENGTH_RANGE),
    };
  }
  return {
    ...common,
    kind,
    shape: oneOf(raw['shape'], `${path}.shape`, ARC_SHAPES),
    start: readPoint(raw['start'], `${path}.start`),
    end: readPoint(raw['end'], `${path}.end`),
    bulge: finite(raw['bulge'], `${path}.bulge`),
  };
}

const GROUP_KINDS: readonly IrregularGroup['kind'][] = ['chainArc', 'fan'];
const FAN_MODES: readonly FanMode[] = ['spread', 'converge'];
const ARC_FIELDS = [
  'id',
  'kind',
  'rowId',
  'layerId',
  'keyEntryId',
  'shape',
  'start',
  'end',
  'bulge',
  'count',
  'memberIds',
];
const FAN_FIELDS = [
  'id',
  'kind',
  'rowId',
  'layerId',
  'keyEntryId',
  'mode',
  'origin',
  'direction',
  'spreadAngle',
  'length',
  'count',
  'memberIds',
];

const ANGLE_RANGE = { min: 0, max: 360 } as const;

function readPolar(value: unknown, path: string): PolarGuide {
  const raw = object(value, path, ['visible', 'center', 'rings', 'spacing', 'spokes', 'startAngle']);
  const center = object(raw['center'], `${path}.center`, ['x', 'y']);
  return {
    visible: boolean(raw['visible'], `${path}.visible`),
    center: { x: finite(center['x'], `${path}.center.x`), y: finite(center['y'], `${path}.center.y`) },
    rings: whole(raw['rings'], `${path}.rings`, POLAR_RANGE.rings),
    spacing: ranged(positive(raw['spacing'], `${path}.spacing`), `${path}.spacing`, POLAR_RANGE.spacing),
    spokes: whole(raw['spokes'], `${path}.spokes`, POLAR_RANGE.spokes),
    startAngle: ranged(finite(raw['startAngle'], `${path}.startAngle`), `${path}.startAngle`, ANGLE_RANGE),
  };
}
