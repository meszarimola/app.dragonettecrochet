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
  LayerEvent,
  Locale,
  Pattern,
  PatternConventions,
  PatternNotation,
  Piece,
  RepeatSpec,
  Ring,
  RowConventions,
  Space,
  StitchFlag,
  StitchGroup,
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

function readPattern(value: unknown, path: string): Pattern {
  const raw = object(value, path, ['formatVersion', 'title', 'conventions', 'pieces'], ['notation']);
  return {
    formatVersion: oneOf(raw['formatVersion'], `${path}.formatVersion`, [FORMAT_VERSION]),
    title: text(raw['title'], `${path}.title`),
    ...(raw['notation'] === undefined ? {} : { notation: readNotation(raw['notation'], `${path}.notation`) }),
    conventions: readPatternConventions(raw['conventions'], `${path}.conventions`),
    pieces: array(raw['pieces'], `${path}.pieces`, readPiece),
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
  const raw = object(value, path, ['id', 'name', 'stitches', 'spaces', 'rings', 'groups', 'events', 'skipped']);
  return {
    id: string(raw['id'], `${path}.id`),
    name: text(raw['name'], `${path}.name`),
    stitches: array(raw['stitches'], `${path}.stitches`, readNode),
    spaces: array(raw['spaces'], `${path}.spaces`, readSpace),
    rings: array(raw['rings'], `${path}.rings`, readRing),
    groups: array(raw['groups'], `${path}.groups`, readGroup),
    events: array(raw['events'], `${path}.events`, readEvent),
    skipped: array(raw['skipped'], `${path}.skipped`, string),
  };
}

function readNode(value: unknown, path: string): StitchNode {
  const raw = object(value, path, ['id', 'def', 'prev', 'anchors'], ['flags', 'pinned']);
  return {
    id: string(raw['id'], `${path}.id`),
    def: string(raw['def'], `${path}.def`),
    prev: raw['prev'] === null ? null : string(raw['prev'], `${path}.prev`),
    anchors: array(raw['anchors'], `${path}.anchors`, readAnchor),
    ...(raw['flags'] === undefined
      ? {}
      : { flags: array(raw['flags'], `${path}.flags`, (flag, flagPath) => oneOf(flag, flagPath, FLAGS)) }),
    ...(raw['pinned'] === undefined ? {} : { pinned: readPinned(raw['pinned'], `${path}.pinned`) }),
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
  const into = oneOf(value['into'], `${path}.into`, ['stitch', 'space', 'ring']);
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
  const raw = object(value, path, ['after', 'kind'], ['statedCount', 'conventions']);
  return {
    after: string(raw['after'], `${path}.after`),
    kind: oneOf(raw['kind'], `${path}.kind`, ['turn', 'join-slip', 'spiral', 'fasten-off']),
    ...(raw['statedCount'] === undefined ? {} : { statedCount: integer(raw['statedCount'], `${path}.statedCount`, 0) }),
    ...(raw['conventions'] === undefined
      ? {}
      : { conventions: readRowConventions(raw['conventions'], `${path}.conventions`) }),
  };
}

function readRowConventions(value: unknown, path: string): Partial<RowConventions> {
  const raw = object(value, path, [], ['turningChainCounts']);
  return raw['turningChainCounts'] === undefined
    ? {}
    : { turningChainCounts: readTurningChainCounts(raw['turningChainCounts'], `${path}.turningChainCounts`) };
}
