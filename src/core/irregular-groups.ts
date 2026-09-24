// Parametric groups: a run of stitches generated from a path. KB: core-geometry §52

import { arcStops } from './irregular-arc.ts';
import { nextId, normalizeAngle } from './irregular-document.ts';
import { fanShapes } from './irregular-fan.ts';
import { grannyShapes } from './irregular-granny.ts';
import {
  ARC_COUNT_RANGE,
  type ChainArcGroup,
  FAN_COUNT_RANGE,
  FAN_LENGTH_RANGE,
  FAN_SPREAD_RANGE,
  type FanGroup,
  type GlyphSize,
  GRANNY_COUNT_RANGE,
  type GrannyRoundGroup,
  type IrregularGroup,
  type IrregularItem,
  type IrregularPattern,
  type MemberShape,
  type Point,
  type StitchItem,
} from './irregular-types.ts';

export type { GlyphSize } from './irregular-types.ts';

export interface ChainArcSpec {
  readonly rowId: string;
  readonly layerId: string;
  readonly keyEntryId: string;
  readonly shape: ChainArcGroup['shape'];
  readonly start: Point;
  readonly end: Point;
  readonly bulge: number;
  readonly count: number;
}

export type ChainArcPatch = Partial<Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge' | 'count'>>;

export interface FanSpec {
  readonly rowId: string;
  readonly layerId: string;
  readonly keyEntryId: string;
  readonly mode: FanGroup['mode'];
  readonly origin: Point;
  readonly direction: number;
  readonly spreadAngle: number;
  readonly length: number;
  readonly count: number;
}

export type FanPatch = Partial<Pick<FanGroup, 'mode' | 'origin' | 'direction' | 'spreadAngle' | 'length' | 'count'>>;

export interface GrannyRoundSpec {
  readonly rowId: string;
  readonly layerId: string;
  readonly keyEntryId: string;
  readonly center: Point;
  readonly inner: number;
  readonly count: number;
}

export function groupsOf(pattern: IrregularPattern): readonly IrregularGroup[] {
  return pattern.groups ?? [];
}

export function groupById(pattern: IrregularPattern, id: string): IrregularGroup | undefined {
  return groupsOf(pattern).find((group) => group.id === id);
}

/** The group a stitch belongs to, or nothing when it stands on its own. */
export function groupOfItem(pattern: IrregularPattern, itemId: string): IrregularGroup | undefined {
  return groupsOf(pattern).find((group) => group.memberIds.includes(itemId));
}

/** Every selected stitch pulls its whole group in, because a group is edited as one. */
export function withWholeGroups(pattern: IrregularPattern, ids: Iterable<string>): Set<string> {
  const wanted = new Set(ids);
  for (const id of [...wanted]) {
    const group = groupOfItem(pattern, id);
    if (group !== undefined) for (const member of group.memberIds) wanted.add(member);
  }
  return wanted;
}

/** Whether the selection holds every member of each group it touches. */
export function holdsWholeGroups(pattern: IrregularPattern, ids: ReadonlySet<string>): boolean {
  for (const id of ids) {
    const group = groupOfItem(pattern, id);
    if (group !== undefined && !group.memberIds.every((member) => ids.has(member))) return false;
  }
  return true;
}

export function clampCount(count: number): number {
  if (!Number.isFinite(count)) return ARC_COUNT_RANGE.min;
  return Math.min(ARC_COUNT_RANGE.max, Math.max(ARC_COUNT_RANGE.min, Math.round(count)));
}

/**
 * How far a stitch turns to follow the path. A glyph wider than it is tall — a
 * chain drawn as a flat oval — already lies along its own long axis, so it
 * turns a quarter less than an upright one.
 */
export function arcRotation(angle: number, glyph: GlyphSize): number {
  return normalizeAngle(glyph.width > glyph.height ? angle - 90 : angle);
}

/** Where each member of a group sits, whatever kind of group it is. */
export function memberShapes(group: IrregularGroup, glyph: GlyphSize): MemberShape[] {
  if (group.kind === 'fan') return fanShapes(group, glyph);
  if (group.kind === 'grannyRound') return grannyShapes(group, glyph);
  return arcStops(group).map((stop) => ({
    at: stop.at,
    rotation: arcRotation(stop.angle, glyph),
    width: glyph.width,
    height: glyph.height,
  }));
}

export function addFan(
  pattern: IrregularPattern,
  spec: FanSpec,
  glyph: GlyphSize,
): { pattern: IrregularPattern; id: string } {
  const group: FanGroup = {
    ...spec,
    id: nextGroupId(pattern),
    kind: 'fan',
    count: clampFanCount(spec.count),
    spreadAngle: clampSpread(spec.spreadAngle),
    length: clampLength(spec.length),
    direction: normalizeAngle(finiteOr(spec.direction, 0)),
    memberIds: [],
  };
  return { pattern: laidOut(pattern, group, glyph), id: group.id };
}

export function updateFan(pattern: IrregularPattern, id: string, patch: FanPatch, glyph: GlyphSize): IrregularPattern {
  const group = groupById(pattern, id);
  if (group === undefined || group.kind !== 'fan') return pattern;
  const next: FanGroup = {
    ...group,
    mode: patch.mode ?? group.mode,
    origin: patch.origin ?? group.origin,
    direction: normalizeAngle(finiteOr(patch.direction, group.direction)),
    spreadAngle: clampSpread(finiteOr(patch.spreadAngle, group.spreadAngle)),
    length: clampLength(finiteOr(patch.length, group.length)),
    count: patch.count === undefined ? group.count : clampFanCount(patch.count),
  };
  if (sameFan(group, next)) return pattern;
  return laidOut(pattern, next, glyph);
}

export function clampGrannyCount(count: number): number {
  if (!Number.isFinite(count)) return GRANNY_COUNT_RANGE.min;
  return Math.min(GRANNY_COUNT_RANGE.max, Math.max(GRANNY_COUNT_RANGE.min, Math.round(count)));
}

export function addGrannyRound(
  pattern: IrregularPattern,
  spec: GrannyRoundSpec,
  glyph: GlyphSize,
): { pattern: IrregularPattern; id: string } {
  const group: GrannyRoundGroup = {
    ...spec,
    id: nextGroupId(pattern),
    kind: 'grannyRound',
    inner: Math.max(0, finiteOr(spec.inner, 0)),
    count: clampGrannyCount(spec.count),
    memberIds: [],
  };
  return { pattern: laidOut(pattern, group, glyph), id: group.id };
}

export function setGrannyCount(
  pattern: IrregularPattern,
  id: string,
  count: number,
  glyph: GlyphSize,
): IrregularPattern {
  const group = groupById(pattern, id);
  if (group === undefined || group.kind !== 'grannyRound') return pattern;
  const wanted = clampGrannyCount(count);
  if (wanted === group.count) return pattern;
  return laidOut(pattern, { ...group, count: wanted }, glyph);
}

/** The granny rounds from the middle outwards, in the order their rows stand. */
export function grannyRounds(pattern: IrregularPattern): GrannyRoundGroup[] {
  const order = new Map(pattern.rows.map((row, index) => [row.id, index]));
  return groupsOf(pattern)
    .filter((group): group is GrannyRoundGroup => group.kind === 'grannyRound')
    .sort((a, b) => (order.get(a.rowId) ?? 0) - (order.get(b.rowId) ?? 0) || a.inner - b.inner);
}

function sameFan(a: FanGroup, b: FanGroup): boolean {
  return (
    a.mode === b.mode &&
    a.origin.x === b.origin.x &&
    a.origin.y === b.origin.y &&
    a.direction === b.direction &&
    a.spreadAngle === b.spreadAngle &&
    a.length === b.length &&
    a.count === b.count
  );
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function clampFanCount(count: number): number {
  if (!Number.isFinite(count)) return FAN_COUNT_RANGE.min;
  return Math.min(FAN_COUNT_RANGE.max, Math.max(FAN_COUNT_RANGE.min, Math.round(count)));
}

export function clampSpread(angle: number): number {
  return clamp(angle, FAN_SPREAD_RANGE.min, FAN_SPREAD_RANGE.max);
}

export function clampLength(length: number): number {
  return clamp(length, FAN_LENGTH_RANGE.min, FAN_LENGTH_RANGE.max);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function nextGroupId(pattern: IrregularPattern): string {
  return nextId(
    'g',
    groupsOf(pattern).map((group) => group.id),
  );
}

export function addChainArc(
  pattern: IrregularPattern,
  spec: ChainArcSpec,
  glyph: GlyphSize,
): { pattern: IrregularPattern; id: string } {
  const id = nextGroupId(pattern);
  const group: ChainArcGroup = { ...spec, id, kind: 'chainArc', count: clampCount(spec.count), memberIds: [] };
  return { pattern: laidOut(pattern, group, glyph), id };
}

export function updateChainArc(
  pattern: IrregularPattern,
  id: string,
  patch: ChainArcPatch,
  glyph: GlyphSize,
): IrregularPattern {
  const group = groupById(pattern, id);
  if (group === undefined || group.kind !== 'chainArc') return pattern;
  const next: ChainArcGroup = {
    ...group,
    shape: patch.shape ?? group.shape,
    start: patch.start ?? group.start,
    end: patch.end ?? group.end,
    bulge: Number.isFinite(patch.bulge) ? (patch.bulge ?? group.bulge) : group.bulge,
    count: patch.count === undefined ? group.count : clampCount(patch.count),
  };
  if (sameArc(group, next)) return pattern;
  return laidOut(pattern, next, glyph);
}

/** Draws the group again with a new glyph size, even though the path did not move. */
export function relayoutGroup(pattern: IrregularPattern, id: string, glyph: GlyphSize): IrregularPattern {
  const group = groupById(pattern, id);
  if (group === undefined) return pattern;
  return laidOut(pattern, group, glyph);
}

/** Moving a whole group carries its path along, so it stays the arc it was. */
export function translateGroups(
  pattern: IrregularPattern,
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): IrregularPattern {
  const groups = groupsOf(pattern);
  if (groups.length === 0 || (dx === 0 && dy === 0)) return pattern;
  const touched = groups.filter((group) => group.memberIds.some((member) => ids.has(member)));
  if (touched.length === 0) return pattern;
  const shift = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy });
  const moved = new Map<string, IrregularGroup>(
    touched.map((group) => [
      group.id,
      group.kind === 'fan'
        ? { ...group, origin: shift(group.origin) }
        : group.kind === 'grannyRound'
          ? { ...group, center: shift(group.center) }
          : { ...group, start: shift(group.start), end: shift(group.end) },
    ]),
  );
  return { ...pattern, groups: groups.map((group) => moved.get(group.id) ?? group) };
}

/** The stitches stay where they are; only the recipe that made them is forgotten. */
export function explodeGroups(pattern: IrregularPattern, ids: Iterable<string>): IrregularPattern {
  const gone = new Set(ids);
  const groups = groupsOf(pattern);
  const kept = groups.filter((group) => !gone.has(group.id));
  if (kept.length === groups.length) return pattern;
  return withGroups(pattern, kept);
}

/**
 * Puts each group on the row and layer its stitches actually sit on, and forgets
 * any group whose stitches are gone or no longer agree. A group that named a
 * deleted row could not be written to a file at all, so this runs on every edit
 * rather than at the few places that could break it. KB: core-geometry §52
 */
export function reseatGroups(pattern: IrregularPattern): IrregularPattern {
  const groups = groupsOf(pattern);
  if (groups.length === 0) return pattern;
  const byId = new Map(pattern.items.map((item) => [item.id, item]));
  const kept: IrregularGroup[] = [];
  let changed = false;
  for (const group of groups) {
    const members = group.memberIds.map((id) => byId.get(id));
    const first = members[0];
    if (first === undefined || members.some((member) => member === undefined)) {
      changed = true;
      continue;
    }
    const together =
      members.every((member) => member?.rowId === first.rowId) &&
      members.every((member) => member?.layerId === first.layerId);
    if (!together) {
      changed = true;
      continue;
    }
    if (group.rowId === first.rowId && group.layerId === first.layerId) {
      kept.push(group);
      continue;
    }
    kept.push({ ...group, rowId: first.rowId, layerId: first.layerId });
    changed = true;
  }
  if (!changed) return pattern;
  return withGroups(pattern, kept);
}

/** Forgets any group that lost a member, so no group ever describes stitches that are gone. */
export function forgetBrokenGroups(pattern: IrregularPattern): IrregularPattern {
  const alive = new Set(pattern.items.map((item) => item.id));
  const groups = groupsOf(pattern);
  const kept = groups.filter((group) => group.memberIds.every((member) => alive.has(member)));
  if (kept.length === groups.length) return pattern;
  return withGroups(pattern, kept);
}

function withGroups(pattern: IrregularPattern, groups: readonly IrregularGroup[]): IrregularPattern {
  if (groups.length === 0) {
    const { groups: _dropped, ...rest } = pattern;
    return rest;
  }
  return { ...pattern, groups };
}

function sameArc(a: ChainArcGroup, b: ChainArcGroup): boolean {
  return (
    a.shape === b.shape &&
    a.start.x === b.start.x &&
    a.start.y === b.start.y &&
    a.end.x === b.end.x &&
    a.end.y === b.end.y &&
    a.bulge === b.bulge &&
    a.count === b.count
  );
}

/**
 * Rebuilds the group's stitches. Ids are kept where the run overlaps the old
 * one, so raising the count keeps every stitch that was already there and the
 * selection survives.
 */
function laidOut(pattern: IrregularPattern, group: IrregularGroup, glyph: GlyphSize): IrregularPattern {
  const stops = memberShapes(group, glyph);
  const taken = new Set(pattern.items.map((item) => item.id));
  for (const id of group.memberIds) taken.delete(id);
  const memberIds: string[] = [];
  const members: StitchItem[] = [];
  stops.forEach((stop, index) => {
    const kept = group.memberIds[index];
    const id = kept ?? nextId('i', [...taken, ...memberIds]);
    memberIds.push(id);
    members.push({
      id,
      kind: 'stitch',
      keyEntryId: group.keyEntryId,
      insertion: 'both-loops',
      rowId: group.rowId,
      layerId: group.layerId,
      color: null,
      x: stop.at.x,
      y: stop.at.y,
      width: stop.width,
      height: stop.height,
      rotation: stop.rotation,
      flipX: false,
      flipY: false,
    });
  });

  const next: IrregularGroup = { ...group, memberIds };
  const byId = new Map(members.map((member) => [member.id, member]));
  const dropped = new Set(group.memberIds.filter((id) => !byId.has(id)));
  const items: IrregularItem[] = [];
  let placed = false;
  for (const item of pattern.items) {
    if (dropped.has(item.id)) continue;
    const member = byId.get(item.id);
    if (member === undefined) {
      items.push(item);
      continue;
    }
    if (!placed) {
      items.push(...members);
      placed = true;
    }
    byId.delete(item.id);
  }
  if (!placed) items.push(...members);

  const groups = groupsOf(pattern);
  const known = groups.some((candidate) => candidate.id === next.id);
  return {
    ...pattern,
    items,
    groups: known ? groups.map((candidate) => (candidate.id === next.id ? next : candidate)) : [...groups, next],
  };
}
