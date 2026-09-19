// KB: core-domain §3

const DIGIT_SUFFIX = ['', 'szer', 'szer', 'szor', 'szer', 'ször', 'szor', 'szer', 'szor', 'szer'] as const;

const TENS_SUFFIX = ['', 'szer', 'szor', 'szor', 'szer', 'szer', 'szor', 'szer', 'szor', 'szer'] as const;

export function times(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Pozitív egész számot vártunk, nem ${n}`);
  return `${n}-${timesSuffix(n)}`;
}

function timesSuffix(n: number): string {
  if (n % 10 !== 0) return DIGIT_SUFFIX[n % 10]!;
  if (n % 100 !== 0) return TENS_SUFFIX[(n % 100) / 10]!;
  if (n % 1000 !== 0) return 'szor';
  if (n % 1_000_000 !== 0) return 'szer';
  return 'szor';
}

export function article(n: number): 'a' | 'az' {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Nemnegatív egész számot vártunk, nem ${n}`);
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    return thousands === 1 ? 'az' : article(thousands);
  }
  if (n >= 10) return Math.floor(n / (n >= 100 ? 100 : 10)) === 5 ? 'az' : 'a';
  return n === 1 || n === 5 ? 'az' : 'a';
}

const BACK_VOWELS = new Set([...'aáoóuú']);
const VOWELS = new Set([...'aáeéiíoóöőuúüű']);

export function dative(word: string, isAbbreviation: boolean): string {
  if (isAbbreviation) return `${word}-nek`;
  if (word.endsWith('a')) return `${word.slice(0, -1)}ának`;
  if (word.endsWith('e')) return `${word.slice(0, -1)}ének`;
  const lastVowel = [...word].reverse().find((letter) => VOWELS.has(letter));
  return `${word}${lastVowel !== undefined && BACK_VOWELS.has(lastVowel) ? 'nak' : 'nek'}`;
}
