// KB: interface.md §1, §2, §4, §5

import { MARKUP_TEXTS } from './i18n/markup.ts';
import { MESSAGE_TEXTS } from './i18n/messages.ts';
import { PANEL_TEXTS } from './i18n/panels.ts';
import { RULE_TEXTS } from './i18n/rules.ts';
import { SECTION_TEXTS } from './i18n/sections.ts';
import type { UiLanguage } from './notation.ts';

export type { UiLanguage } from './notation.ts';

export const UI_LANGUAGES: readonly UiLanguage[] = ['hu', 'en'];

export type Dictionary<T> = Readonly<Record<UiLanguage, T>>;

export interface UiTexts {
  readonly markup: (typeof MARKUP_TEXTS)['hu'];
  readonly messages: (typeof MESSAGE_TEXTS)['hu'];
  readonly panels: (typeof PANEL_TEXTS)['hu'];
  readonly sections: (typeof SECTION_TEXTS)['hu'];
  readonly rules: (typeof RULE_TEXTS)['hu'];
}

export const UI_TEXTS: Dictionary<UiTexts> = {
  hu: {
    markup: MARKUP_TEXTS.hu,
    messages: MESSAGE_TEXTS.hu,
    panels: PANEL_TEXTS.hu,
    sections: SECTION_TEXTS.hu,
    rules: RULE_TEXTS.hu,
  },
  en: {
    markup: MARKUP_TEXTS.en,
    messages: MESSAGE_TEXTS.en,
    panels: PANEL_TEXTS.en,
    sections: SECTION_TEXTS.en,
    rules: RULE_TEXTS.en,
  },
};

export function languageFromSearch(search: string): UiLanguage | null {
  const value = new URLSearchParams(search).get('lang');
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return normalized.startsWith('hu') ? 'hu' : null;
}

export function storedLanguage(value: string | null): UiLanguage | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'en') return 'en';
  return normalized === 'hu' ? 'hu' : null;
}

// KB: interface.md §4
export function resolveUiLanguage(search: string, stored: string | null, documentLanguage: string): UiLanguage {
  return languageFromSearch(search) ?? storedLanguage(stored) ?? (/^en\b/i.test(documentLanguage) ? 'en' : 'hu');
}

export function homeUrl(language: UiLanguage): string {
  return language === 'en' ? 'https://dragonettecrochet.com/en/' : 'https://dragonettecrochet.com/hu/';
}

export function urlWithLanguage(href: string, language: UiLanguage): string {
  const url = new URL(href);
  url.searchParams.set('lang', language);
  return url.toString();
}

let current: UiLanguage = 'hu';

export function uiLanguage(): UiLanguage {
  return current;
}

export function texts(): UiTexts {
  return UI_TEXTS[current];
}

export function setUiLanguage(language: UiLanguage): void {
  current = language;
}

// KB: interface.md §4 — an unknown key throws, so a missing translation fails the browser test.
export function applyStaticTexts(root: ParentNode, markup: UiTexts['markup']): void {
  const value = (key: string): string => {
    const text = (markup as Record<string, string>)[key];
    if (text === undefined) throw new Error(`Hiányzó felirat a szótárból: ${key}`);
    return text;
  };
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = value(element.dataset['i18n']!);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-tip]')) {
    element.dataset['tip'] = value(element.dataset['i18nTip']!);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    element.setAttribute('aria-label', value(element.dataset['i18nLabel']!));
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-content]')) {
    element.setAttribute('content', value(element.dataset['i18nContent']!));
  }
}
