// Parametric groups: a run of stitches generated from a path. KB: core-geometry §52

import { arcStops } from './irregular-arc.ts';
import { nextId, normalizeAngle } from './irregular-document.ts';
import {
  ARC_COUNT_RANGE,
  type ChainArcGroup,
  type IrregularGroup,
  type IrregularItem,
  type IrregularPattern,
  type Point,
  type StitchItem,
} from './irregular-types.ts';

/**
 * What the interface measured for the glyph. The core owns the rule that
 * follows from it, so the turn is decided in one place and can be tested.
 */
export interface GlyphSize {
  readonly width: number;
  readonly height: number;
}

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

export function addChainArc(
  pattern: IrregularPattern,
  spec: ChainArcSpec,
  glyph: GlyphSize,
): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'g',
    groupsOf(pattern).map((group) => group.id),
  );
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
  if (group === undefined) return pattern;
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
  const moved = new Map(
    touched.map((group) => [
      group.id,
      {
        ...group,
        start: { x: group.start.x + dx, y: group.start.y + dy },
        end: { x: group.end.x + dx, y: group.end.y + dy },
      },
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
function laidOut(pattern: IrregularPattern, group: ChainArcGroup, glyph: GlyphSize): IrregularPattern {
  const stops = arcStops(group);
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
      width: glyph.width,
      height: glyph.height,
      rotation: arcRotation(stop.angle, glyph),
      flipX: false,
      flipY: false,
    });
  });

  const next: ChainArcGroup = { ...group, memberIds };
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
