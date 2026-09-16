/*
 * Az írott minta panelje (PQW-868): a szöveg a választott jelöléssel, vagy
 * érthető üzenet, ha a minta még nem írható ki.
 *
 * - Üres mintánál nincs mit kiírni.
 * - Amit a szövegíró még nem tud kifejezni (pattern-steps.ts), arról a
 *   szövegíró üzenete szól; más hibánál az Ellenőrzés listájára utalunk.
 * - A félkész sor és a hibás minta szövege látszik, de megjegyzés kíséri.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-written.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import type { LiveCheck, WorkContext } from '../core/editor.ts';
import { WrittenPatternError } from '../core/pattern-steps.ts';
import { formatWrittenPattern, writePattern } from '../core/pattern-text.ts';
import type { Locale, Pattern } from '../core/types.ts';
import { texts } from './i18n.ts';
import { SECTION_TEXTS } from './i18n/sections.ts';
import { textLanguage } from './notation.ts';

export type WrittenView =
  | { readonly kind: 'text'; readonly text: string; readonly notices: readonly string[] }
  | { readonly kind: 'message'; readonly message: string };

export function writtenView(pattern: Pattern, context: WorkContext, check: LiveCheck, terms: Locale): WrittenView {
  const { written, size } = texts().sections;
  if (pattern.pieces.every((piece) => piece.stitches.length === 0)) {
    return { kind: 'message', message: written.empty };
  }

  let text: string;
  try {
    // A cím helye a szöveg nyelvén áll (a jelölésé), nem a felületén: a kiírt minta egynyelvű marad.
    const untitled = SECTION_TEXTS[textLanguage(terms)].written.untitled;
    const titled = pattern.title.trim() ? pattern : { ...pattern, title: untitled };
    text = formatWrittenPattern(writePattern(titled, context.library, terms));
  } catch (error) {
    if (error instanceof WrittenPatternError) {
      return { kind: 'message', message: written.notWritable(error.message) };
    }
    return { kind: 'message', message: written.broken };
  }

  const notices: string[] = [];
  if (check.remaining > 0) {
    notices.push(written.partial(size.result.layerLabel(context.layer, context.shape === 'round'), check.remaining));
  }
  const errors = check.findings.filter((finding) => finding.severity === 'error').length;
  if (errors > 0) notices.push(written.errors(errors));
  return { kind: 'text', text, notices };
}
