// The free-form chart file. KB: core-domain §8, core-domain §11

import {
  IRREGULAR_FORMAT_VERSION,
  type IrregularGuides,
  type IrregularItem,
  type IrregularLayer,
  type IrregularPattern,
  type IrregularRow,
  type LegendBlock,
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
  | 'expected-hex-color'
  | 'duplicate-row-id'
  | 'duplicate-layer-id'
  | 'duplicate-item-id'
  | 'unknown-row'
  | 'unknown-layer'
  | 'duplicate-key-entry-id'
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
    ['titleGenerated', 'notation', 'stitchKey', 'legend'],
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
  const raw = object(value, path, ['grid', 'snap']);
  const grid = object(raw['grid'], `${path}.grid`, ['visible', 'size']);
  return {
    grid: {
      visible: boolean(grid['visible'], `${path}.grid.visible`),
      size: positive(grid['size'], `${path}.grid.size`),
    },
    snap: boolean(raw['snap'], `${path}.snap`),
  };
}
