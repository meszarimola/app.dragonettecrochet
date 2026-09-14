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

export type WrittenView =
  | { readonly kind: 'text'; readonly text: string; readonly notices: readonly string[] }
  | { readonly kind: 'message'; readonly message: string };

const UNTITLED = 'Névtelen minta';

export function writtenView(pattern: Pattern, context: WorkContext, check: LiveCheck, terms: Locale): WrittenView {
  if (pattern.pieces.every((piece) => piece.stitches.length === 0)) {
    return { kind: 'message', message: 'Még nincs mit kiírni: kezdd láncalappal vagy varázskörrel.' };
  }

  let text: string;
  try {
    const titled = pattern.title.trim() ? pattern : { ...pattern, title: UNTITLED };
    text = formatWrittenPattern(writePattern(titled, context.library, terms));
  } catch (error) {
    if (error instanceof WrittenPatternError) {
      return { kind: 'message', message: `Ez a minta még nem írható ki. ${error.message}` };
    }
    return { kind: 'message', message: 'A minta szerkezete hibás, ezért nem írható ki; a hibákat az Ellenőrzés sorolja fel.' };
  }

  const notices: string[] = [];
  if (check.remaining > 0) {
    const layer = `${context.layer}. ${context.shape === 'round' ? 'kör' : 'sor'}`;
    notices.push(`A ${layer} félkész, még ${check.remaining} célpont van hátra: a szöveg a mostani állapotot írja le.`);
  }
  const errors = check.findings.filter((finding) => finding.severity === 'error').length;
  if (errors > 0) notices.push(`A mintában ${errors} hiba van (lásd Ellenőrzés), ezért a szöveg így nem követhető.`);
  return { kind: 'text', text, notices };
}
