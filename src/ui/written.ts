// KB: interface.md §1, §2

import type { LiveCheck, WorkContext } from '../core/editor.ts';
import { WrittenPatternError } from '../core/pattern-steps.ts';
import { formatWrittenPattern, writePattern } from '../core/pattern-text.ts';
import type { Locale, Pattern } from '../core/types.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { WRITTEN_CORE_TEXTS } from './i18n/core/written.ts';
import { SECTION_TEXTS } from './i18n/sections.ts';
import { texts, uiLanguage } from './i18n.ts';
import { textLanguage } from './notation.ts';

export type WrittenView =
  | { readonly kind: 'text'; readonly text: string; readonly notices: readonly string[] }
  | { readonly kind: 'message'; readonly message: string };

function coreMessage(error: WrittenPatternError): string {
  return renderCoreText(WRITTEN_CORE_TEXTS[uiLanguage()], error.coreText);
}

export function writtenView(pattern: Pattern, context: WorkContext, check: LiveCheck, terms: Locale): WrittenView {
  const { written, size } = texts().sections;
  if (pattern.pieces.every((piece) => piece.stitches.length === 0)) {
    return { kind: 'message', message: written.empty };
  }

  let text: string;
  try {
    // KB: interface.md §2 — the written pattern stays monolingual, in the notation's language.
    const untitled = SECTION_TEXTS[textLanguage(terms)].written.untitled;
    const titled = pattern.title.trim() ? pattern : { ...pattern, title: untitled };
    text = formatWrittenPattern(writePattern(titled, context.library, terms));
  } catch (error) {
    if (error instanceof WrittenPatternError) {
      return { kind: 'message', message: written.notWritable(coreMessage(error)) };
    }
    return { kind: 'message', message: written.broken };
  }

  const notices: string[] = [];
  if (check.remaining > 0) {
    // KB: interface.md §33 — pass the raw layer index; the dictionary shifts it.
    notices.push(written.partial(size.result.layerLabel(context.layer, context.shape === 'round'), check.remaining));
  }
  const errors = check.findings.filter((finding) => finding.severity === 'error').length;
  if (errors > 0) notices.push(written.errors(errors));
  return { kind: 'text', text, notices };
}
