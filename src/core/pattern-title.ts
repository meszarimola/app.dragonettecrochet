import type { Locale, Pattern } from './types.ts';

const NEW_PATTERN = 'New pattern';

// KB: owner-decisions.md §16
export const DEFAULT_TITLE: Readonly<Record<Locale, string>> = {
  hu: 'Új minta',
  'en-US': NEW_PATTERN,
  'en-GB': NEW_PATTERN,
};

/** KB: owner-decisions.md §16 */
export function titleLocale(pattern: Pattern): Locale {
  return pattern.notation?.terms ?? 'en-US';
}

type NameTable = Readonly<Record<Locale, Readonly<Record<string, string>>>>;

/** KB: core-domain §1 */
export function allLocaleNames(...tables: readonly NameTable[]): string[] {
  return tables.flatMap((table) => Object.values(table).flatMap((names) => Object.values(names)));
}

// KB: core-domain §1
export function hasOwnTitle(pattern: Pattern, generatedNames: Iterable<string> = []): boolean {
  const title = pattern.title.trim();
  if (title === '') return false;
  if (pattern.titleGenerated !== undefined) return !pattern.titleGenerated;
  if (Object.values(DEFAULT_TITLE).includes(title)) return false;
  if (pattern.pieces.some((piece) => piece.name === pattern.title)) return false;
  return ![...generatedNames].includes(pattern.title);
}

export function withGeneratedTitle(
  result: Pattern,
  source: Pattern,
  name: string,
  generatedNames: Iterable<string> = [],
): Pattern {
  const { titleGenerated: _, ...rest } = result;
  if (!hasOwnTitle(source, generatedNames)) return { ...rest, title: name, titleGenerated: true };
  return { ...rest, title: source.title, ...(source.titleGenerated === false ? { titleGenerated: false } : {}) };
}
