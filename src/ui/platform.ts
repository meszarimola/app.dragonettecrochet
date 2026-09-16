/*
 * A módosítóbillentyű neve a rendszer szerint (PQW-911).
 *
 * A gyorsbillentyűk `Alt`-tal szólnak, mert egyetlen karakter nem lehet
 * parancs, a `Ctrl`/`Cmd`+szám pedig a böngésző lapváltása. Ugyanez a
 * billentyű a Mac gépeken `Option` (⌥) felirattal szerepel, ezért a
 * MEGJELENÍTÉS rendszerfüggő — a billentyűkezelés nem: az mindenhol
 * `event.altKey` + a szám vagy a betű fizikai helye (`event.code`).
 *
 * A felismerés itt, egyetlen helyen történik. A vizsgált érték paraméter, hogy
 * a Node is futtathassa; a böngészőben a `navigator` adja.
 */

/** A Mac gépek jelölése a platformszövegben: „macOS”, „MacIntel”, „iPhone”, „iPad”. */
export function applePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** A módosító neve: Mac gépen ⌥, máshol `Alt`. */
export function modifierName(platform: string): string {
  return applePlatform(platform) ? '⌥' : 'Alt';
}

/**
 * A kombináció felirata: Mac gépen „⌥1” (az Option jele a billentyű mellé
 * tapad), máshol „Alt+1”.
 */
export function modifierCombo(key: string, platform: string): string {
  return applePlatform(platform) ? `⌥${key}` : `Alt+${key}`;
}

/** A böngésző platformja; a `userAgentData` az újabb, a `platform` a régebbi forrás. */
export function currentPlatform(): string {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return data?.platform ?? navigator.platform ?? '';
}
