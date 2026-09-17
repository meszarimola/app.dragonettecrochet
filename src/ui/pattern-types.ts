/*
 * A bal oldali mintatípus-menü tartalma (PQW-873).
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-pattern-types.test.mjs). A
 * gombokat a main.ts rakja ki. A típus adja a kezdést és a körzárás
 * alapértelmezését; a még el nem készült típusok „hamarosan” jelzéssel,
 * inaktívan látszanak, és mérföldkövenként kapcsolnak be (PQW-861…866).
 *
 * Aktív a „szabályos horgolás” (sík sorok, kör és motívum). A szabálytalan
 * horgolás a saját jegyében készül el.
 *
 * A filéhorgolás (PQW-864: filé, C2C, tapestry, graphgan és mozaik rácsból) és
 * az amigurumi (PQW-863: 3D formák spirálban, részekből) az átvételi tesztelés
 * első körére IDEIGLENESEN ki van kapcsolva (PQW-925). A tulajdonos döntése:
 * előbb a szabályos horgolást tesszük rendbe, a többi addig ne vigye el a
 * figyelmet. A kód a helyén marad, csak nem érhető el; a visszakapcsolás
 * ennyi: `true` a listában. A `main.ts` a kikapcsolt típus szakaszát is
 * elrejti, és a paneljét meg sem építi.
 */

import type { GridKind } from '../core/grid.ts';
import { texts } from './i18n.ts';

export type PatternTypeId = 'regular' | 'filet' | 'amigurumi' | 'irregular';

export interface PatternType {
  readonly id: PatternTypeId;
  /** A menüpont neve a felület nyelvén. */
  readonly name: string;
  /** Rövid magyarázat: mit ad ez a típus. */
  readonly detail: string;
  /** Bekapcsolt-e; ha nem, „hamarosan” jelzéssel, inaktívan látszik. */
  readonly available: boolean;
}

/**
 * A név és a magyarázat a felület nyelvéből jön, lekérdezéskor (PQW-900): a
 * lista így a nyelvváltás után is a mostani nyelven szól, újraépítés nélkül.
 */
const patternType = (id: PatternTypeId, available: boolean): PatternType => ({
  id,
  available,
  get name(): string {
    return texts().sections.types.menu[id].name;
  },
  get detail(): string {
    return texts().sections.types.menu[id].detail;
  },
});

export const PATTERN_TYPES: readonly PatternType[] = [
  patternType('regular', true),
  // PQW-925: az átvételi tesztelés első köréig kikapcsolva, nem kivezetve.
  patternType('filet', false),
  patternType('amigurumi', false),
  patternType('irregular', false),
];

export const DEFAULT_PATTERN_TYPE: PatternTypeId = 'regular';

/** Amigurumiban ekkora hányadot kap az írott minta panel a munkaterületből. */
export const AMIGURUMI_WRITTEN_SHARE = 0.7;

/**
 * Az írott minta panel magassága a típus kiválasztásakor (PQW-874 pontosítás,
 * PQW-885): amigurumiban a szöveg az elsődleges nézet, ezért a panel nagyban,
 * keskeny ablakban teljes nézetben nyílik, a rajz kiegészítés. Más típusnál
 * `null`: a panel nem változik.
 */
export function writtenShareFor(type: PatternTypeId, narrow: boolean): number | null {
  if (type !== 'amigurumi') return null;
  return narrow ? 1 : AMIGURUMI_WRITTEN_SHARE;
}

/**
 * A rács típusa a mintatípusból (PQW-874, tulajdonosi pontosítás 2026-09-15):
 * szabályos horgolásnál sorban sorrács, körben és motívumnál koncentrikus;
 * filénél cellás rács (PQW-864); amigurumiban az írott minta az elsődleges
 * nézet, rács nélkül (PQW-863). A szabálytalan horgolás a szabályos szerint.
 */
export function gridKind(type: PatternTypeId, shape: 'row' | 'round'): GridKind {
  if (type === 'filet') return 'cells';
  if (type === 'amigurumi') return 'text';
  return shape === 'round' ? 'rounds' : 'rows';
}

/** Egy azonosító akkor érvényes, ha szerepel a listában és a típusa bekapcsolt. */
export function isAvailableType(id: string): id is PatternTypeId {
  return PATTERN_TYPES.some((type) => type.id === id && type.available);
}
