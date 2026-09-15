/*
 * A magyar mintaszöveg ragozása: a számok után a -szor/-szer/-ször, és a
 * „számít valaminek” részeshatározó.
 *
 * A számot számjeggyel írjuk, a rag kötőjellel kapcsolódik hozzá („3-szor”). A
 * rag hangrendjét a szám kiejtett alakjának utolsó szava dönti el, ezért a
 * kerek számoknál a helyiérték szava számít (tíz, húsz, száz, ezer).
 */

/** Az egyes számjegyek kiejtett alakjának ragja: egyszer, kétszer, háromszor… */
const DIGIT_SUFFIX = ['', 'szer', 'szer', 'szor', 'szer', 'ször', 'szor', 'szer', 'szor', 'szer'] as const;

/** A kerek tízesek ragja: tízszer, húszszor, harmincszor, negyvenszer… */
const TENS_SUFFIX = ['', 'szer', 'szor', 'szor', 'szer', 'szer', 'szor', 'szer', 'szor', 'szer'] as const;

/** „3-szor”, „5-ször”, „20-szor”, „100-szor”. */
export function times(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Pozitív egész számot vártunk, nem ${n}`);
  return `${n}-${timesSuffix(n)}`;
}

function timesSuffix(n: number): string {
  if (n % 10 !== 0) return DIGIT_SUFFIX[n % 10]!;
  if (n % 100 !== 0) return TENS_SUFFIX[(n % 100) / 10]!;
  // Száz(szor), ezer(szer), millió(szor): a legkisebb nem nulla helyiérték szava.
  if (n % 1000 !== 0) return 'szor';
  if (n % 1_000_000 !== 0) return 'szer';
  return 'szor';
}

const BACK_VOWELS = new Set([...'aáoóuú']);
const VOWELS = new Set([...'aáeéiíoóöőuúüű']);

/**
 * Részeshatározó rag egy szem nevére vagy rövidítésére: „erp-nek”, „pálcának”,
 * „rákhuroknak”. A rövidítés betűit egyenként ejtjük (er-pé, el-esz), ezért
 * mindig magas hangrendű, és kötőjellel kapcsolódik.
 */
export function dative(word: string, isAbbreviation: boolean): string {
  if (isAbbreviation) return `${word}-nek`;
  if (word.endsWith('a')) return `${word.slice(0, -1)}ának`;
  if (word.endsWith('e')) return `${word.slice(0, -1)}ének`;
  const lastVowel = [...word].reverse().find((letter) => VOWELS.has(letter));
  return `${word}${lastVowel !== undefined && BACK_VOWELS.has(lastVowel) ? 'nak' : 'nek'}`;
}
