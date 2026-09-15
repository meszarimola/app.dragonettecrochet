/*
 * A minta azonosítóktól független alakja: két minta akkor ugyanaz a gráf, ha
 * ez a két alak egyezik.
 *
 * Az azonosítókat a szerkesztő vagy a beolvasó szabadon osztja ki, ezért az
 * összevetés előtt sorrend szerint újraszámozzuk őket:
 * - szem: `n1`, `n2`… a fonal útja szerint;
 * - láncív, gyűrű, csoport: az első szemük helye szerint;
 * - a kihagyott szemek és az események a szemek sorrendjében.
 * A kézi igazítás (`pinned`) csak a rajzhoz tartozik, ezért kimarad.
 */

import type { Anchor, NodeId, Pattern, Piece, StitchNode } from './types.ts';

export function canonicalPattern(pattern: Pattern): Pattern {
  return { ...pattern, pieces: pattern.pieces.map(canonicalPiece) };
}

export function canonicalPiece(piece: Piece): Piece {
  const order = new Map(piece.stitches.map((node, index) => [node.id, index]));
  const nodeId = new Map(piece.stitches.map((node, index) => [node.id, `n${index + 1}`]));
  const at = (id: NodeId) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const node = (id: NodeId) => nodeId.get(id) ?? id;

  const byFirst = <T>(items: readonly T[], first: (item: T) => NodeId) =>
    [...items].sort((a, b) => at(first(a)) - at(first(b)));
  const spaces = byFirst(piece.spaces, (space) => space.chains[0] ?? '');
  const rings = byFirst(piece.rings, (ring) => ring.node);
  const groups = byFirst(piece.groups, (group) => group.members[0] ?? '');
  const spaceId = new Map(spaces.map((space, index) => [space.id, `s${index + 1}`]));
  const ringId = new Map(rings.map((ring, index) => [ring.id, `r${index + 1}`]));

  const anchor = (target: Anchor): Anchor => {
    if (target.into === 'stitch') return { into: 'stitch', id: node(target.id), mode: target.mode };
    if (target.into === 'space') return { into: 'space', id: spaceId.get(target.id) ?? target.id };
    if (target.into === 'row-end') return { into: 'row-end', id: node(target.id) };
    if (target.into === 'underside') return { into: 'underside', id: node(target.id) };
    return { into: 'ring', id: ringId.get(target.id) ?? target.id };
  };
  const stitch = (source: StitchNode): StitchNode => ({
    id: node(source.id),
    def: source.def,
    prev: source.prev === null ? null : node(source.prev),
    anchors: source.anchors.map(anchor),
    ...(source.flags && source.flags.length > 0 ? { flags: [...source.flags].sort() } : {}),
    // Az első szín (0) a hiányzóval egyenértékű (PQW-864).
    ...(source.color ? { color: source.color } : {}),
  });

  return {
    id: piece.id,
    name: piece.name,
    stitches: piece.stitches.map(stitch),
    spaces: spaces.map((space, index) => ({ id: `s${index + 1}`, chains: space.chains.map(node) })),
    rings: rings.map((ring, index) => ({ id: `r${index + 1}`, node: node(ring.node) })),
    groups: groups.map((group, index) => ({ id: `g${index + 1}`, def: group.def, members: group.members.map(node) })),
    events: byFirst(piece.events, (event) => event.after).map((event) => ({ ...event, after: node(event.after) })),
    skipped: byFirst(piece.skipped, (id) => id).map(node),
  };
}
