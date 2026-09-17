/*
 * Az írott minta hibái mondattá (PQW-904).
 *
 * A kódokat a mag adja (`src/core/pattern-steps.ts`, `WrittenCode`); a mondat
 * itt készül, a felület nyelvén. A magyar ág betűre azonos a PQW-904 előtti
 * szövegekkel: ez átvezetés, nem újrafogalmazás.
 *
 * - `layer-unsupported`: a mag csak a sorszámot (`index`), a sor/kör formáját
 *   (`shape`) és a mondatvég kódját (`inner`) adja. A névelő, a sor/kör szava és
 *   a mondatvég összeillesztése a felületé — a magyar „A(z)” alak változatlan.
 */

import type { UnsupportedCode, WrittenCode } from '../../../core/pattern-steps.ts';
import { type CoreDictionary, isRound, num, str } from './render.ts';

/**
 * A mondatvégek: önmagukban nem mondatok, a `layer-unsupported` burkoló illeszti
 * őket a sor vagy a kör mögé.
 */
const HU_REASONS: Readonly<Record<UnsupportedCode, string>> = {
  'underside-place': 'a láncszem másik oldalába olyan helyen horgol, amely még nem írható ki',
  'underside-backwards': 'a láncszemek másik oldalán a haladási iránnyal szemben horgol',
  'space-misplaced': 'olyan láncívbe kapaszkodik, amely nincs a megfelelő helyen',
  'space-backwards': 'a haladási iránnyal szemben lévő láncívbe kapaszkodik',
  'stitch-misplaced': 'olyan szembe kapaszkodik, amely nincs a megfelelő helyen',
  'stitch-backwards': 'a haladási iránnyal szemben lévő szembe kapaszkodik',
  crossed: 'keresztezett szemet tartalmaz',
  'group-start': 'a csoport nem az első tagjával kezdődik',
  'group-chains': 'a csoport láncszemei nem láncívet adnak',
  'group-target': 'a csoport célpontja nem egyértelmű',
  'chain-run': 'a sor közbeni láncszemek nem pontosan egy láncívet adnak',
  'stitch-kind': 'ez a szemfajta itt nem állhat',
  'decrease-targets': 'a fogyasztás célpontjai nem egymás utániak',
  'decrease-used': 'a fogyasztás egy már használt szemből indul',
  'anchor-count': 'a szemnek nem egy célpontja van',
  'join-target': 'a kör zárása nem a kör első pozíciójába megy',
};

const EN_REASONS: Readonly<Record<UnsupportedCode, string>> = {
  'underside-place': 'works into the other side of a chain in a place that cannot be written yet',
  'underside-backwards': 'works against the direction of travel on the other side of the chains',
  'space-misplaced': 'holds on to a chain space that is not in the right place',
  'space-backwards': 'holds on to a chain space that lies against the direction of travel',
  'stitch-misplaced': 'holds on to a stitch that is not in the right place',
  'stitch-backwards': 'holds on to a stitch that lies against the direction of travel',
  crossed: 'contains a crossed stitch',
  'group-start': 'has a group that does not start with its first member',
  'group-chains': 'has a group whose chains do not form a chain space',
  'group-target': 'has a group whose target is not unambiguous',
  'chain-run': 'has mid-row chains that do not form exactly one chain space',
  'stitch-kind': 'has a stitch kind that cannot stand here',
  'decrease-targets': 'has a decrease whose targets are not consecutive',
  'decrease-used': 'has a decrease that starts from an already used stitch',
  'anchor-count': 'has a stitch that does not have exactly one target',
  'join-target': 'has a round join that does not go into the first position of the round',
};

export const WRITTEN_CORE_TEXTS: CoreDictionary<WrittenCode> = {
  hu: {
    ...HU_REASONS,
    // A névelő is a felületé: a mai szöveg az „A(z)” alakot használja.
    // A láncalap az 1. sor (PQW-923): sorokban a kiírt szám a rétegénél eggyel nagyobb, körben változatlan.
    'layer-unsupported': (data) =>
      `A(z) ${num(data, 'index') + (isRound(data) ? 0 : 1)}. ${isRound(data) ? 'kör' : 'sor'} ${HU_REASONS[str(data, 'inner') as UnsupportedCode] ?? ''}.`,
    'needs-foundation': 'A minta láncalappal vagy varázskörrel kezdődik; enélkül még nem írható ki.',
    'foundation-event': 'A láncalapon lévő esemény még nem írható ki.',
  },
  en: {
    ...EN_REASONS,
    'layer-unsupported': (data) =>
      `${isRound(data) ? 'Round' : 'Row'} ${num(data, 'index') + (isRound(data) ? 0 : 1)} ${EN_REASONS[str(data, 'inner') as UnsupportedCode] ?? ''}.`,
    'needs-foundation': 'The pattern starts with a foundation chain or a magic ring; without one it cannot be written yet.',
    'foundation-event': 'An event on the foundation chain cannot be written yet.',
  },
};
