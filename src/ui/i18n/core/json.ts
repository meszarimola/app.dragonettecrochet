/*
 * Pattern-loading failures as sentences. The caller writes the failing field's
 * path (`LoadError.path`) beside the sentence, so only the failure itself is
 * here.
 *
 * KB: dictionaries.md §1
 */

import type { JsonCode } from '../../../core/pattern-json.ts';
import { type CoreDictionary, list, num, str } from './render.ts';

export const JSON_CORE_TEXTS: CoreDictionary<JsonCode> = {
  hu: {
    // The engine's own wording: raw data, not translated.
    'invalid-json': (data) => `Nem érvényes JSON: ${str(data, 'detail')}`,
    'unsupported-version': (data) =>
      `A minta újabb formátumú (${num(data, 'found')}), mint amit ez a verzió ismer (${num(data, 'known')}).`,
    'expected-object': 'Objektumot vártunk.',
    'missing-field': 'Hiányzó mező.',
    'unknown-field': 'Ismeretlen mező.',
    'legacy-border':
      'A fájl olyan szegélyt tartalmaz, amit ez a verzió már nem ismer, ezért a minta nem tölthető be. A szegélyt a program korábbi változata készítette.',
    'expected-nonempty-string': 'Nem üres szöveget vártunk.',
    'expected-string': 'Szöveget vártunk.',
    'expected-boolean': 'Logikai értéket vártunk.',
    'expected-integer-min': (data) => `Legalább ${num(data, 'min')} értékű egész számot vártunk.`,
    'expected-number': 'Számot vártunk.',
    'expected-one-of': (data) => `Megengedett értékek: ${list(data, 'values').join(', ')}.`,
    'expected-array': 'Tömböt vártunk.',
    'expected-positive': 'Pozitív számot vártunk.',
    'expected-positive-max': (data) => `0 és ${num(data, 'max')} közötti pozitív számot vártunk.`,
    'duplicate-profile-id': 'Kétszer szereplő profilazonosító.',
    'unknown-profile': 'Nincs ilyen azonosítójú profil.',
    'duplicate-gauge': 'Ugyanaz a szem ugyanabban a formában kétszer szerepel.',
    'expected-angle': '0 és 360 fok közötti szöget vártunk.',
    'expected-cells-per-row': (data) => `Soronként ${num(data, 'width')} cellát vártunk.`,
    'expected-hex-color': '#rrggbb alakú színt vártunk.',
    'repeat-width-max': (data) => `Legfeljebb ${num(data, 'max')} szemes ismétlést vártunk.`,
    'repeat-edge-max': (data) => `Legfeljebb ${num(data, 'max')} kiegyenlítő szemet vártunk.`,
    'join-edge-both': 'A szél vagy a sor egy szakasza, vagy sorvégek: a kettő együtt nem lehet.',
    'expected-size': 'Legalább egy méretet vártunk.',
    'expected-integer-max': (data) => `Legfeljebb ${num(data, 'max')} értékű egész számot vártunk.`,
    'expected-numbers-per-size': (data) => `${num(data, 'count')} számot vártunk, méretenként egyet.`,
    'expected-non-negative': 'Nem negatív számot vártunk.',
  },
  en: {
    'invalid-json': (data) => `Not valid JSON: ${str(data, 'detail')}`,
    'unsupported-version': (data) =>
      `The pattern has a newer format (${num(data, 'found')}) than this version knows (${num(data, 'known')}).`,
    'expected-object': 'An object was expected.',
    'missing-field': 'Missing field.',
    'unknown-field': 'Unknown field.',
    'legacy-border':
      'The file contains a border this version no longer supports, so the pattern cannot be loaded. The border was made by an earlier version of the program.',
    'expected-nonempty-string': 'A non-empty text was expected.',
    'expected-string': 'A text was expected.',
    'expected-boolean': 'A true or false value was expected.',
    'expected-integer-min': (data) => `An integer of at least ${num(data, 'min')} was expected.`,
    'expected-number': 'A number was expected.',
    'expected-one-of': (data) => `Allowed values: ${list(data, 'values').join(', ')}.`,
    'expected-array': 'An array was expected.',
    'expected-positive': 'A positive number was expected.',
    'expected-positive-max': (data) => `A positive number between 0 and ${num(data, 'max')} was expected.`,
    'duplicate-profile-id': 'Duplicate profile identifier.',
    'unknown-profile': 'There is no profile with this identifier.',
    'duplicate-gauge': 'The same stitch appears twice in the same form.',
    'expected-angle': 'An angle between 0 and 360 degrees was expected.',
    'expected-cells-per-row': (data) => `${num(data, 'width')} cells per row were expected.`,
    'expected-hex-color': 'A color in #rrggbb form was expected.',
    'repeat-width-max': (data) => `A repeat of at most ${num(data, 'max')} stitches was expected.`,
    'repeat-edge-max': (data) => `At most ${num(data, 'max')} balancing stitches were expected.`,
    'join-edge-both': 'The edge is either a part of a row or row ends: the two cannot be given together.',
    'expected-size': 'At least one size was expected.',
    'expected-integer-max': (data) => `An integer of at most ${num(data, 'max')} was expected.`,
    'expected-numbers-per-size': (data) => `${num(data, 'count')} numbers were expected, one per size.`,
    'expected-non-negative': 'A non-negative number was expected.',
  },
};
