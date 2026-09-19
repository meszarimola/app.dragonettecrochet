import type { Pattern } from './types.ts';

export const DEFAULT_TITLE = 'Új minta';

// KB: core-domain §1
export function hasOwnTitle(pattern: Pattern, generatedNames: Iterable<string> = []): boolean {
  const title = pattern.title.trim();
  if (title === '') return false;
  if (pattern.titleGenerated !== undefined) return !pattern.titleGenerated;
  if (title === DEFAULT_TITLE || pattern.pieces.some((piece) => piece.name === pattern.title)) return false;
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
