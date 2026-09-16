/*
 * A felület nyelve (PQW-900): magyar és angol, egy szótárból.
 *
 * - A felület nyelve független a minta jelölésétől (PQW-868): angol felületen
 *   is lehet magyar jelöléssel dolgozni. Az írott minta és a szemnevek nyelvét
 *   továbbra is a jelölés adja (notation.ts `textLanguage`).
 * - A nyelv a `?lang` paraméterből jön (a főoldal így linkel), enélkül a
 *   dokumentum `lang` attribútumából. A kézi választás a lapon belül él, és a
 *   címsorba is beírja a `?lang`-ot, hogy megosztható és újratölthető legyen.
 *   Új `localStorage` kulcsot nem vezetünk be: az a jogi szöveg miatt
 *   tulajdonosi döntés.
 * - A szótár területenként külön fájlban van (`src/ui/i18n/`), hogy a
 *   párhuzamos munkák ne ugyanazt a fájlt írják. Minden terület ugyanazt a
 *   kulcskészletet adja mindkét nyelven; ezt a típus és a
 *   `tests/ui-i18n.test.mjs` is őrzi. Egy új nyelv (japán, PQW-877) egy újabb
 *   `UiLanguage` érték és a szótárak bővítése.
 *
 * DOM-mal dolgozik (a statikus feliratok behelyettesítése), de a szótárak
 * maguk DOM nélküliek, ezért a Node is futtatja őket.
 */

import { MARKUP_TEXTS } from './i18n/markup.ts';
import { MESSAGE_TEXTS } from './i18n/messages.ts';
import { PANEL_TEXTS } from './i18n/panels.ts';
import { RULE_TEXTS } from './i18n/rules.ts';
import { SECTION_TEXTS } from './i18n/sections.ts';
import type { UiLanguage } from './notation.ts';

export type { UiLanguage } from './notation.ts';

export const UI_LANGUAGES: readonly UiLanguage[] = ['hu', 'en'];

/** Egy terület szótára: nyelvenként ugyanaz a kulcskészlet. */
export type Dictionary<T> = Readonly<Record<UiLanguage, T>>;

/** A felület minden szövege egy nyelven. */
export interface UiTexts {
  /** Az index.html feliratai (`data-i18n`, `data-i18n-tip`, `data-i18n-label`). */
  readonly markup: (typeof MARKUP_TEXTS)['hu'];
  /** Az állapotsor, a párbeszédablakok és a menüsor üzenetei (main.ts). */
  readonly messages: (typeof MESSAGE_TEXTS)['hu'];
  /** A jobb oldali panel szakaszainak szövegei (generátorok, méret, rácsminta, ruhadarab). */
  readonly panels: (typeof PANEL_TEXTS)['hu'];
  /** A bal oldali mintatípus-menü és a hozzá tartozó feliratok. */
  readonly sections: (typeof SECTION_TEXTS)['hu'];
  /** Az ellenőrző üzenetei szabályonként; a mag magyar szövege az alap (rules.ts). */
  readonly rules: (typeof RULE_TEXTS)['hu'];
}

export const UI_TEXTS: Dictionary<UiTexts> = {
  hu: { markup: MARKUP_TEXTS.hu, messages: MESSAGE_TEXTS.hu, panels: PANEL_TEXTS.hu, sections: SECTION_TEXTS.hu, rules: RULE_TEXTS.hu },
  en: { markup: MARKUP_TEXTS.en, messages: MESSAGE_TEXTS.en, panels: PANEL_TEXTS.en, sections: SECTION_TEXTS.en, rules: RULE_TEXTS.en },
};

/** A `?lang` paraméter értéke, ha értelmezhető nyelv; különben `null`. */
export function languageFromSearch(search: string): UiLanguage | null {
  const value = new URLSearchParams(search).get('lang');
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return normalized.startsWith('hu') ? 'hu' : null;
}

/** A felület nyelve induláskor: a `?lang` paraméter, enélkül a dokumentum nyelve. */
export function resolveUiLanguage(search: string, documentLanguage: string): UiLanguage {
  return languageFromSearch(search) ?? (/^en\b/i.test(documentLanguage) ? 'en' : 'hu');
}

/** A főoldal linkje a felület nyelvén (a leíró oldal magyarul és angolul is él). */
export function homeUrl(language: UiLanguage): string {
  return language === 'en' ? 'https://dragonettecrochet.com/en/' : 'https://dragonettecrochet.com/hu/';
}

/** A címsor a választott nyelvvel, hogy a link megosztható és újratölthető legyen. */
export function urlWithLanguage(href: string, language: UiLanguage): string {
  const url = new URL(href);
  url.searchParams.set('lang', language);
  return url.toString();
}

let current: UiLanguage = 'hu';

/** A felület mostani nyelve. */
export function uiLanguage(): UiLanguage {
  return current;
}

/** A felület szövegei a mostani nyelven. */
export function texts(): UiTexts {
  return UI_TEXTS[current];
}

/** A nyelv beállítása; a hívó gondoskodik a `<html lang>`-ról és az újrarajzolásról. */
export function setUiLanguage(language: UiLanguage): void {
  current = language;
}

/**
 * A statikus feliratok behelyettesítése a jelölésbe: `data-i18n` a szövegre,
 * `data-i18n-tip` a saját tooltipre (`data-tip`), `data-i18n-label` az
 * `aria-label`-re. Ismeretlen kulcsnál hibát dob, így a hiányzó fordítás a
 * böngészős tesztben azonnal kiderül.
 */
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
}
