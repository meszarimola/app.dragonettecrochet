/*
 * Free-form chart loading failures as sentences. The caller writes the failing
 * field's path beside the sentence, so only the failure itself is here.
 *
 * KB: dictionaries.md §1
 */

import type { IrregularJsonCode } from '../../../core/irregular-json.ts';
import { type CoreDictionary, list, num, str } from './render.ts';

export const IRREGULAR_JSON_CORE_TEXTS: CoreDictionary<IrregularJsonCode> = {
  hu: {
    // The engine's own wording: raw data, not translated.
    'invalid-json': (data) => `Nem érvényes JSON: ${str(data, 'detail')}`,
    'unsupported-version': (data) =>
      `A minta újabb formátumú (${num(data, 'found')}), mint amit ez a verzió ismer (${num(data, 'known')}).`,
    'expected-object': 'Objektumot vártunk.',
    'missing-field': 'Hiányzó mező.',
    'unknown-field': 'Ismeretlen mező.',
    'expected-nonempty-string': 'Nem üres szöveget vártunk.',
    'expected-string': 'Szöveget vártunk.',
    'expected-boolean': 'Logikai értéket vártunk.',
    'expected-number': 'Számot vártunk.',
    'expected-one-of': (data) => `Megengedett értékek: ${list(data, 'values').join(', ')}.`,
    'expected-array': 'Tömböt vártunk.',
    'expected-nonempty-array': 'Legalább egy elemet vártunk.',
    'expected-positive': 'Pozitív számot vártunk.',
    'expected-whole-number': 'Egész számot vártunk.',
    'expected-in-range': (data) => `${num(data, 'min')} és ${num(data, 'max')} közötti értéket vártunk.`,
    'expected-hex-color': 'Színkódot vártunk, például #b07cc6.',
    'duplicate-row-id': 'Két sor ugyanazzal az azonosítóval szerepel.',
    'duplicate-layer-id': 'Két réteg ugyanazzal az azonosítóval szerepel.',
    'duplicate-item-id': 'Két szem ugyanazzal az azonosítóval szerepel.',
    'unknown-row': 'A szem olyan sorra hivatkozik, ami nincs a fájlban.',
    'unknown-layer': 'A szem olyan rétegre hivatkozik, ami nincs a fájlban.',
    'duplicate-key-entry-id': 'Két jelkulcs-bejegyzés ugyanazzal az azonosítóval szerepel.',
    'key-entry-unnamed': 'A jelkulcs bejegyzése se szemet, se saját nevet nem ad meg.',
    'duplicate-group-id': 'Két csoport ugyanazzal az azonosítóval szerepel.',
    'shared-group-member': 'Ugyanaz a szem két csoporthoz tartozik.',
    'group-count-mismatch': 'A csoport darabszáma nem egyezik a benne felsorolt szemekkel.',
    'unknown-item': 'A csoport olyan szemre hivatkozik, ami nincs a fájlban.',
  },
  en: {
    'invalid-json': (data) => `Not valid JSON: ${str(data, 'detail')}`,
    'unsupported-version': (data) =>
      `The pattern uses a newer format (${num(data, 'found')}) than this version knows (${num(data, 'known')}).`,
    'expected-object': 'An object was expected.',
    'missing-field': 'A field is missing.',
    'unknown-field': 'Unknown field.',
    'expected-nonempty-string': 'A non-empty string was expected.',
    'expected-string': 'A string was expected.',
    'expected-boolean': 'A true or false value was expected.',
    'expected-number': 'A number was expected.',
    'expected-one-of': (data) => `Allowed values: ${list(data, 'values').join(', ')}.`,
    'expected-array': 'An array was expected.',
    'expected-nonempty-array': 'At least one entry was expected.',
    'expected-positive': 'A positive number was expected.',
    'expected-whole-number': 'A whole number was expected.',
    'expected-in-range': (data) => `A value between ${num(data, 'min')} and ${num(data, 'max')} was expected.`,
    'expected-hex-color': 'A colour code was expected, for example #b07cc6.',
    'duplicate-row-id': 'Two rows carry the same identifier.',
    'duplicate-layer-id': 'Two layers carry the same identifier.',
    'duplicate-item-id': 'Two stitches carry the same identifier.',
    'unknown-row': 'A stitch points at a row that is not in the file.',
    'unknown-layer': 'A stitch points at a layer that is not in the file.',
    'duplicate-key-entry-id': 'Two stitch key entries carry the same identifier.',
    'key-entry-unnamed': 'A stitch key entry names neither a stitch nor a name of its own.',
    'duplicate-group-id': 'Two groups carry the same identifier.',
    'shared-group-member': 'The same stitch belongs to two groups.',
    'group-count-mismatch': 'The group\u2019s count does not match the stitches it lists.',
    'unknown-item': 'A group points at a stitch that is not in the file.',
  },
};
