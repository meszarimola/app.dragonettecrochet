/*
 * Turns a core code plus its data into a sentence in the interface language.
 *
 * KB: dictionaries.md §1, decisions.md §2
 */

import type { CoreData, CoreText, CoreValue } from '../../../core/messages.ts';
import type { Dictionary } from '../../i18n.ts';

export type CoreEntry = string | ((data: CoreData) => string);

export type CoreDictionary<Code extends string> = Dictionary<Readonly<Record<Code, CoreEntry>>>;

/** An unknown code renders as the code itself, so the interface survives a core that is ahead of its dictionary. */
export function renderCoreText<Code extends string>(
  dictionary: Readonly<Record<Code, CoreEntry>>,
  message: CoreText<Code>,
): string {
  const entry = dictionary[message.code];
  if (entry === undefined) return message.code;
  return typeof entry === 'string' ? entry : entry(message.data ?? {});
}

export function num(data: CoreData, key: string, fallback = 0): number {
  const value: CoreValue | undefined = data[key];
  return typeof value === 'number' ? value : fallback;
}

export function str(data: CoreData, key: string, fallback = ''): string {
  const value: CoreValue | undefined = data[key];
  return typeof value === 'string' ? value : fallback;
}

export function bool(data: CoreData, key: string): boolean {
  return data[key] === true;
}

export function list(data: CoreData, key: string): readonly (string | number)[] {
  const value: CoreValue | undefined = data[key];
  return Array.isArray(value) ? (value as readonly (string | number)[]) : [];
}

export function isRound(data: CoreData, key = 'shape'): boolean {
  return str(data, key) === 'round';
}
