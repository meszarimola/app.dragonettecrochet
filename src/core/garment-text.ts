/*
 * A ruhadarab méretsorozatának szövege (PQW-866, 05 §8.1, §8.2): a méretek
 * „S (M, L)” alakban, utána a kész méretek, darabonként a láncalap, a
 * szemszám, a sorok, a vállvarrás, az ujj szaporítása és a fonal, mindig a
 * méretek sorrendjében: az első méret száma elöl, a többié zárójelben.
 *
 * A számok a mintával mentett sorozatból jönnek (types.ts `PatternGarment`),
 * így a szöveg a mentés után sem változik. A sorokat soronként a gráf írja, a
 * gráf mérete szerint; ezt a blokk második mondata mondja ki.
 */

import { bodySizeName, hatSizeName } from './body-sizes.ts';
import { article } from './hungarian.ts';
import type { Locale, PatternGarment } from './types.ts';

/** Ledobott vállú pulóver: a kész méretek (cm), a hátrész és elejerész, a váll és az ujj számai. */
export const DROP_SHOULDER_KEYS = [
  'chestCm',
  'lengthCm',
  'sleeveCm',
  'panelStitches',
  'panelFoundation',
  'panelRows',
  'hemRows',
  'armholeRows',
  'shoulder',
  'neck',
  'sleeveFoundation',
  'cuffStitches',
  'sleeveTop',
  'sleeveRows',
  'cuffRows',
  'firstIncrease',
  'everyA',
  'timesA',
  'everyB',
  'timesB',
] as const;

/** Sapka: a kész körméret és magasság (cm), a korona és az oldal körei. */
export const HAT_KEYS = ['hatCm', 'heightCm', 'increases', 'crownRounds', 'hatStitches', 'sideRounds', 'brimRounds', 'totalRounds'] as const;

/** Felülről horgolt raglán: a nyak, a raglánkörök, a szétosztás és a törzs számai. */
export const RAGLAN_KEYS = [
  'raglanChestCm',
  'raglanLengthCm',
  'raglanNeck',
  'raglanNeckFront',
  'raglanNeckSleeve',
  'raglanRounds',
  'raglanBodyRounds',
  'raglanBody',
  'raglanSleeve',
  'raglanUnderarm',
  'raglanFront',
  'raglanTargetSleeve',
  'raglanBelowRounds',
  'raglanHemRounds',
  // Az ujj csöve a hónaljtól a mandzsettáig (PQW-913).
  'raglanSleeveRounds',
  'raglanSleeveDecreases',
  'raglanSleeveCuff',
  'raglanSleeveCuffRounds',
] as const;

/** Fonal méretenként, ha a profilból becsülhető (m tartalékkal, gombolyag). */
export const YARN_KEYS = ['yarnM', 'balls'] as const;

export const SERIES_KEYS: readonly string[] = [...DROP_SHOULDER_KEYS, ...HAT_KEYS, ...RAGLAN_KEYS, ...YARN_KEYS];

/** „80 (86, 92)”: az első méret elöl, a többi zárójelben. */
export function seriesText(values: readonly number[] | undefined, format: (n: number) => string = String): string {
  if (!values || values.length === 0) return '';
  const [first, ...rest] = values.map(format);
  return rest.length === 0 ? first! : `${first} (${rest.join(', ')})`;
}

const huOrdinal = (n: number) => (n > 0 ? `${n}.` : '–');

function enOrdinal(n: number): string {
  if (n <= 0) return '–';
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** A névelő a méret neve előtt: „az M”, „az XL”, „a 2X”, „az 5X”, „a Felnőtt M”. */
function sizeArticle(name: string): 'a' | 'az' {
  if (/^\d/.test(name)) return article(Number.parseInt(name, 10));
  // Egybetűs vagy betűkódos méret: a betű kiejtett neve dönt (ef, el, em, en, er, es, iksz).
  if (/^[A-Z]{1,3}$/.test(name)) return 'AEFILMNORSX'.includes(name[0]!) ? 'az' : 'a';
  return /^[aáeéiíoóöőuúüű]/i.test(name) ? 'az' : 'a';
}

/** A méretsorozat sorai az írott minta „Méretek” blokkjába. */
export function sizingLines(garment: PatternGarment, locale: Locale): string[] {
  const hu = locale === 'hu';
  const values = (key: string) => garment.values[key];
  const any = (key: string) => (values(key) ?? []).some((n) => n > 0);
  const s = (key: string) => seriesText(values(key));
  const ordinal = (key: string) => seriesText(values(key), hu ? huOrdinal : enOrdinal);
  const names = garment.sizes.map((id) => (garment.table === 'hat' ? hatSizeName(id, locale) : bodySizeName(garment.table, id, locale)));
  const base = names[garment.base] ?? names[0]!;

  const lines = [seriesText(names.map((_, i) => i), (i) => names[i]!)];
  if (names.length > 1) {
    lines.push(
      hu
        ? `A sorok és a rajz ${sizeArticle(base)} ${base} méretre készültek; a zárójelben a többi méret számai állnak.`
        : `The rows and chart are for size ${base}; numbers for the other sizes are in parentheses.`,
    );
  }

  if (garment.kind === 'hat') {
    lines.push(hu ? `Kész körméret: ${s('hatCm')} cm; magasság: ${s('heightCm')} cm.` : `Finished circumference: ${s('hatCm')} cm; height: ${s('heightCm')} cm.`);
    lines.push(
      hu
        ? `Korona: ${s('crownRounds')} kör, körönként ${s('increases')} szaporítással, az utolsó körben a szemszám igazítva: ${s('hatStitches')} szem.`
        : `Crown: ${s('crownRounds')} rnds, ${s('increases')} incs per rnd, adjusted in the last rnd: ${s('hatStitches')} sts.`,
    );
    const brim = any('brimRounds');
    lines.push(
      hu
        ? `Oldal: ${s('sideRounds')} kör egyenesen${brim ? `, ebből az utolsó ${s('brimRounds')} kör a perem` : ''}; összesen ${s('totalRounds')} kör.`
        : `Sides: ${s('sideRounds')} rnds even${brim ? `, the last ${s('brimRounds')} rnds are the brim` : ''}; ${s('totalRounds')} rnds in total.`,
    );
  } else if (garment.kind === 'raglan') {
    lines.push(
      hu
        ? `Kész mellbőség: ${s('raglanChestCm')} cm; hossz: ${s('raglanLengthCm')} cm.`
        : `Finished chest: ${s('raglanChestCm')} cm; length: ${s('raglanLengthCm')} cm.`,
    );
    lines.push(
      hu
        ? `Nyak: ${s('raglanNeck')} lsz körbe zárva; elöl és hátul ${s('raglanNeckFront')} szem, ujjanként ${s('raglanNeckSleeve')} szem.`
        : `Neck: ch ${s('raglanNeck')} joined in a ring; ${s('raglanNeckFront')} sts front and back, ${s('raglanNeckSleeve')} sts per sleeve.`,
    );
    lines.push(
      hu
        ? `Raglán: ${s('raglanRounds')} kör, körönként a négy raglánvonal mellett szaporítva; ${s('raglanBodyRounds')} körben az elején és a hátán külön szaporítás is.`
        : `Raglan: ${s('raglanRounds')} rnds, increasing beside the four raglan lines; in ${s('raglanBodyRounds')} rnds the front and back also get their own increases.`,
    );
    lines.push(
      hu
        ? `Szétosztás: elöl és hátul ${s('raglanFront')} szem, ujjanként ${s('raglanTargetSleeve')} szem, a hónaljlánc ${s('raglanUnderarm')} lsz; a törzs ${s('raglanBody')} szem, egy ujj ${s('raglanSleeve')} szem.`
        : `Divide: ${s('raglanFront')} sts front and back, ${s('raglanTargetSleeve')} sts per sleeve, underarm ch ${s('raglanUnderarm')}; the body is ${s('raglanBody')} sts and each sleeve ${s('raglanSleeve')} sts.`,
    );
    lines.push(
      hu
        ? `Törzs: ${s('raglanBelowRounds')} kör a szétosztástól, ebből az utolsó ${s('raglanHemRounds')} kör az alsó szegély.`
        : `Body: ${s('raglanBelowRounds')} rnds from the divide, the last ${s('raglanHemRounds')} rnds are the hem.`,
    );
    lines.push(
      hu
        ? `Ujj (2 db): a hónaljlánc és a kihagyott szemek mentén ${s('raglanSleeveRounds')} kör; ${s('raglanSleeveDecreases')} körben a hónalj két oldalán 1-1 összehorgolás, a mandzsetta ${s('raglanSleeveCuff')} szem, ${s('raglanSleeveCuffRounds')} kör.`
        : `Sleeve (make 2): ${s('raglanSleeveRounds')} rnds along the underarm chain and the skipped sts; in ${s('raglanSleeveDecreases')} rnds decrease once on each side of the underarm, the cuff is ${s('raglanSleeveCuff')} sts over ${s('raglanSleeveCuffRounds')} rnds.`,
    );
  } else {
    lines.push(
      hu
        ? `Kész mellbőség: ${s('chestCm')} cm; hossz: ${s('lengthCm')} cm; ujjhossz: ${s('sleeveCm')} cm.`
        : `Finished chest: ${s('chestCm')} cm; length: ${s('lengthCm')} cm; sleeve: ${s('sleeveCm')} cm.`,
    );
    const hem = any('hemRows');
    lines.push(
      hu
        ? `Hátrész és elejerész (2 db): láncalap ${s('panelFoundation')} lsz; ${s('panelStitches')} szem, ${s('panelRows')} sor${hem ? `, ebből az első ${s('hemRows')} sor az alsó szegély` : ''}. A karöltő a darab utolsó ${s('armholeRows')} sora.`
        : `Back and front (make 2): ch ${s('panelFoundation')}; ${s('panelStitches')} sts, ${s('panelRows')} rows${hem ? `, the first ${s('hemRows')} rows are the hem` : ''}. The armhole is the last ${s('armholeRows')} rows.`,
    );
    lines.push(
      hu
        ? `Vállvarrás: mindkét szélről ${s('shoulder')} szem; a középső ${s('neck')} szem a nyaknak nyitva marad.`
        : `Shoulder seams: ${s('shoulder')} sts from each edge; leave the center ${s('neck')} sts open for the neck.`,
    );
    const cuff = any('cuffRows');
    const start = hu
      ? `Ujj (2 db): láncalap ${s('sleeveFoundation')} lsz; ${s('cuffStitches')} szem${cuff ? `, az első ${s('cuffRows')} sor a mandzsetta` : ''}.`
      : `Sleeve (make 2): ch ${s('sleeveFoundation')}; ${s('cuffStitches')} sts${cuff ? `, the first ${s('cuffRows')} rows are the cuff` : ''}.`;
    let shaping: string;
    if (any('firstIncrease')) {
      const first = values('firstIncrease')!.find((n) => n > 0)!;
      const a = any('timesA');
      const b = any('timesB');
      shaping = hu
        ? `Szaporíts mindkét szélen 1-1 szemet ${article(first)} ${ordinal('firstIncrease')} sorban` +
          (a ? `, majd ${ordinal('everyA')} soronként ${s('timesA')} alkalommal` : '') +
          (b ? `, ${a ? 'aztán' : 'majd'} ${ordinal('everyB')} soronként ${s('timesB')} alkalommal` : '') +
          `: ${s('sleeveTop')} szem; összesen ${s('sleeveRows')} sor.`
        : `Inc 1 st at each edge in row ${s('firstIncrease')}` +
          (a ? `, then every ${ordinal('everyA')} row ${s('timesA')} times` : '') +
          (b ? `, then every ${ordinal('everyB')} row ${s('timesB')} times` : '') +
          `: ${s('sleeveTop')} sts; ${s('sleeveRows')} rows in total.`;
    } else {
      shaping = hu ? `Az ujj egyenes, alakítás nélkül: ${s('sleeveRows')} sor.` : `Work the sleeve even: ${s('sleeveRows')} rows.`;
    }
    lines.push(`${start} ${shaping}`);
  }

  if (any('yarnM')) {
    lines.push(hu ? `Fonal tartalékkal: kb. ${s('yarnM')} m, ${s('balls')} gombolyag.` : `Yarn with buffer: approx. ${s('yarnM')} m, ${s('balls')} balls.`);
  }
  return lines;
}
