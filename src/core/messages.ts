/*
 * Kód és adat a mondat helyett (PQW-904).
 *
 * A mag nem magyar mondatot ad vissza, hanem azonosítót és a behelyettesítendő
 * értékeket; a mondatot a felület állítja össze a saját nyelvén
 * (`src/ui/i18n/core/`). Így a mag nyelvfüggetlen és DOM-mentes marad, és egy
 * újabb nyelv (japán, PQW-877) csak a felületi szótárat érinti.
 *
 * A névelő, a ragozás és a sor/kör szava is a felületé: a mag az adatban a
 * nyers értéket adja (rétegszám, `shape`, mezőnév), nem a magyar szót. Ezért a
 * `data` kulcsai nyelvsemleges nevek, és az értékei számok, azonosítók vagy
 * felsorolások — soha nem kész mondatrészek.
 *
 * Az előkép a `ShawlWarning` (shawls.ts): az már a PQW-865 óta kódot és arányt
 * ad, a mondatot a kendőpanel rakja össze.
 */

/** A `data` megengedett értékei: nyers adat, nem szöveges mondatrész. */
export type CoreValue = string | number | boolean | readonly string[] | readonly number[];

export type CoreData = Readonly<Record<string, CoreValue>>;

/**
 * Egy felhasználónak szánt üzenet a magból: mit jelent (`code`), és milyen
 * értékek kerülnek bele (`data`). A kódkészletet területenként szűk
 * sztringunió írja le, hogy a felületi szótárból ne maradhasson ki tétel.
 */
export interface CoreText<Code extends string = string> {
  readonly code: Code;
  readonly data?: CoreData;
}

/** Rövid alak a mag oldalán: `text('width-range', { max: 300 })`. */
export function text<Code extends string>(code: Code, data?: CoreData): CoreText<Code> {
  return data === undefined ? { code } : { code, data };
}

/** Beágyazott üzenet (pl. a szegély indoka az írott minta hibájában). */
export function nested(code: string, inner: CoreText): CoreText {
  return { code, data: { inner: inner.code, ...(inner.data ?? {}) } };
}
