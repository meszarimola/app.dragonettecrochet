/*
 * Az ellenőrző szabályai: azonosító, súlyosság és a tudásbázis pontja.
 *
 * Minden `Finding` innen kapja a `severity` és a `reference` mezőt, így egy
 * szabály hivatkozása egyetlen helyen van. A hivatkozások a
 * docs/knowledge-base/ jelentéseire mutatnak.
 */

import type { Finding } from './types.ts';

export interface RuleDef {
  readonly severity: Finding['severity'];
  readonly reference: string;
  /** Rövid magyar leírás a szerkesztőnek és a teszteknek. */
  readonly summary: string;
  /**
   * A felhasználónak szóló üzenet a szerkesztőben (PQW-879): a „szem”
   * szóhasználattal, belső fogalom (réteg, darab) és tudásbázis-kód nélkül —
   * a hivatkozás csak lenyitható részletként jelenik meg.
   */
  readonly message: string;
}

export const RULES = {
  /* ---- Szerkezet: ha ezek közül bármelyik jelez, a többi ellenőrzés nem fut ---- */
  'unknown-stitch': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'A szem nincs a könyvtárban, vagy nem lehet csomópont (összetett csoport, láncív-elem).',
    message: 'Ismeretlen szem van a mintában.',
  },
  'dangling-reference': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'Nem létező szemre, láncívre, gyűrűre vagy csoportra mutató hivatkozás, vagy ismétlődő azonosító.',
    message: 'A minta egy szem olyan célpontra mutat, amely nincs meg.',
  },
  'yarn-path': {
    severity: 'error',
    reference: '06 §5.3 V2',
    summary: 'Az előző szem nem a fonal útján előtte lévő, vagy fonalszakasz a fonal elvágása nélkül kezdődik.',
    message: 'A fonal útja megszakad: egy szem nem az előző után folytatódik.',
  },

  /* ---- Célpontok ---- */
  'future-anchor': {
    severity: 'error',
    reference: '06 §5.3 V1',
    summary: 'A szem később készülő szembe, láncívbe vagy gyűrűbe van horgolva.',
    message: 'Ez a szem egy csak később elkészülő szembe kapaszkodik.',
  },
  'anchor-layer': {
    severity: 'error',
    reference: '03 §10 C16, C17',
    summary: 'A célpont nem az előző sor horgolható pozíciója; korábbi sorba csak hosszú szem mehet.',
    message: 'Ez a szem nem az alatta lévő sor egy szemébe kapaszkodik.',
  },
  'turning-chain-placement': {
    severity: 'error',
    reference: '03 §10 A4, 03 §1.3',
    summary: 'Számító fordulóláncnál a sor utolsó szeme nem a tetejébe megy, vagy nem számító fordulóláncba horgoltak.',
    message: 'A sor eleji láncszemekhez rosszul illeszkedik a sor eleje vagy vége.',
  },
  'unworkable-top': {
    severity: 'error',
    reference: '01 §8.2 szabály 10',
    summary: 'Bele nem horgolható tetejű szembe (pl. rákhurok) horgoltak.',
    message: 'Ennek a szemnek a tetejébe nem lehet belehorgolni.',
  },
  'insertion-mode': {
    severity: 'error',
    reference: '01 §4.3',
    summary:
      'A szem ezzel a beszúrási móddal nem horgolható: a horgoló felől nézett mód nincs a szem (összetett szemnél a csoport) insertionModes listájában (PQW-869).',
    message: 'Ez a szem ebben a beszúrási módban nem horgolható (pl. rákhurok hátsó szálba, kagyló reliefben): válassz másik módot.',
  },
  'anchor-count': {
    severity: 'error',
    reference: '03 §10 C12',
    summary: 'A szem célpontjainak száma nem egyezik azzal, amennyit a szem felhasznál.',
    message: 'Ez a szem nem annyi szembe kapaszkodik, amennyibe kellene.',
  },
  'unmarked-increase': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Több szem egy célpontban, de nincs szaporításnak, kagylónak vagy V-szemnek jelölve.',
    message: 'Több szem került ugyanabba a szembe. Ha ezt szeretted, jelöld szaporításnak.',
  },
  'unmarked-decrease': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Több célpont egy szemben, de nincs fogyasztásnak vagy fürtnek jelölve.',
    message: 'Egy szem több szembe kapaszkodik. Ha ezt szeretted, jelöld fogyasztásnak.',
  },
  'group-mismatch': {
    severity: 'error',
    reference: '03 §10 C14, 01 §8.2 szabály 7',
    summary: 'A csoport tagjai nem egymás utáni, egy célpontba horgolt szemek a csoport definíciója szerint.',
    message: 'A szaporítás vagy a kagyló szemei nem egymás után, ugyanabba a szembe kerültek.',
  },
  'against-direction': {
    severity: 'error',
    reference: '03 §10 C13',
    summary: 'A célpont a haladási irány ellen van, és a szem nincs keresztezettnek vagy reliefnek jelölve.',
    message: 'Ez a szem a haladási iránnyal szemben lévő szembe kapaszkodik. Ha szándékos, jelöld keresztezett szemnek.',
  },
  'reach': {
    severity: 'error',
    reference: '03 §10 C15, 03 §4.2',
    summary: 'Túl nagy ugrás: a kihagyott pozíciókat sem láncszem, sem legyező nem hidalja át.',
    message: 'Túl nagy ugrás: a kimaradt szemeket sem láncszem, sem szaporítás nem hidalja át.',
  },
  'reach-single': {
    severity: 'warning',
    reference: '03 §10 C15',
    summary: 'Egy pozíció kimarad láncszem és legyező nélkül.',
    message: 'Egy szem kimaradt a sorban.',
  },
  'unused-position': {
    severity: 'error',
    reference: '03 §10 B8',
    summary: 'Az előző sor egy pozíciója nincs felhasználva, és nincs jelölten kihagyva vagy áthidalva.',
    message: 'Az alatta lévő sor egy szemébe nem került semmi.',
  },
  'floating-chain': {
    severity: 'error',
    reference: '03 §10 C18, 03 §9.8',
    summary: 'Lógó lánc: a sor végi láncszemekbe semmi nem horgol, és nem fordulólánc.',
    message: 'A sor végén olyan láncszemek maradtak, amelyekbe semmi nem horgol.',
  },

  /* ---- Láncalap, fordulólánc, számok ---- */
  'foundation-chain': {
    severity: 'error',
    reference: '03 §10 A2, 03 §1.2',
    summary:
      'Rossz láncalap: az 1. sor első szeme nem a fordulólánc után következő láncszembe megy; számító fordulóláncnál az alatta álló alapláncszem utánira, és az alapláncszembe nem horgolunk (PQW-891).',
    message: 'Az 1. sor első szeme nem a megfelelő láncszembe került.',
  },
  'turning-chain-height': {
    severity: 'warning',
    reference: '03 §10 A1, D20',
    summary: 'A fordulólánc magassága eltér a sort kezdő szemétől.',
    message: 'A sor eleji láncszemek magassága nem illik a sort kezdő szemhez.',
  },
  'stated-count': {
    severity: 'error',
    reference: '03 §10 B7, B10, 06 §5.3 V3',
    summary: 'A megadott szemszám eltér a számolttól.',
    message: 'A megadott szemszám nem egyezik a megszámolttal.',
  },
  'round-join': {
    severity: 'error',
    reference: '06 §5.3 V4',
    summary: 'A kör záró kúszószeme nem a kör első szemébe vagy a kezdőlánc tetejébe megy.',
    message: 'A kört záró szem nem a kör első szemébe megy.',
  },
  'repeat-balance': {
    severity: 'error',
    reference: '03 §10 E23, 03 §4.2',
    summary: 'Ismételt mintában a sor több vagy kevesebb pozíciót ad, mint amennyit felhasznál.',
    message: 'Az ismételt mintában a sor több vagy kevesebb szemet ad, mint amennyit felhasznál.',
  },

  /* ---- Szegély (PQW-889) ---- */
  'border-row-end': {
    severity: 'warning',
    reference: '03 §10 H38, 03 §7.1',
    summary:
      'A szegély egy sorvégébe nem a sor szeméhez illő számú szem megy: rövidpálcás sorvégre 1, félpálcásra a darab választása szerint 1 vagy 2, pálcásra 2, kétráhajtásosra 3.',
    message: 'A szegély oldalán egy sor végére nem annyi szem került, amennyi a sor magasságához illik: a szegély hullámos lesz vagy behúzza a szélt.',
  },
  'border-corner': {
    severity: 'warning',
    reference: '03 §7.1, 03 §10 H38',
    summary: 'A szegély sarkába nem 3 szem megy.',
    message: 'A szegély sarkába 3 szem kell, hogy a sarok laposan forduljon.',
  },

  /* ---- Magasság ---- */
  'mixed-heights': {
    severity: 'warning',
    reference: '03 §10 D19, 03 §2.3',
    summary: 'Keverten magas szemek, és a következő 1–3 sor nem egyenlíti ki őket.',
    message: 'Különböző magasságú szemek egy sorban, és a következő sorok nem egyenlítik ki.',
  },

  /* ---- Körök (PQW-861); csak a befejezett körökön ---- */
  'round-growth': {
    severity: 'warning',
    reference: '04 §9.0',
    summary: 'A kör pozíciószáma több mint kétszerese vagy kevesebb mint fele az előző körének.',
    message: 'Ebben a körben a szemszám több mint duplájára nő vagy felére csökken: egy körben legfeljebb duplázás vagy felezés fér bele.',
  },
  'round-cupping': {
    severity: 'warning',
    reference: '04 §8, §9.6',
    summary: 'Legalább két egymás utáni körben a szaporítás a lapos érték ~85%-a alatt: a darab kunkorodik.',
    message: 'Kevés a szaporítás: ha laposnak szánod, ezek a körök kunkorodnak. Szaporíts többet, vagy a külső köröket horgold nagyobb tűvel.',
  },
  'round-ruffling': {
    severity: 'warning',
    reference: '04 §8, §9.6',
    summary: 'A körben a szaporítás a lapos érték ~130%-a fölött: a darab fodrosodik.',
    message: 'Sok a szaporítás: ez a kör fodrosodik. Horgolj 1–2 kört szaporítás nélkül, vagy szaporíts kevesebbet.',
  },
  'stacked-increases': {
    severity: 'warning',
    reference: '04 §3.2, §8, §9.6',
    summary: 'Három vagy több körön a szaporítások egymás fölé kerülnek (sokszögben szándékos, ott nem jelez).',
    message: 'A szaporítások három körön át egymás fölé kerülnek, ezért a kör sokszögletű lesz. Told el őket körönként (eltolt szaporítás).',
  },
  'spiral-color-jog': {
    severity: 'warning',
    reference: '04 §2',
    summary: 'Spirálban színváltás lépcsőjavítás nélkül.',
    message:
      'Spirálban a színváltás lépcsőt hagy. Javítás: a következő kör első szeme helyett kúszószem, vagy az új színt az első szem hátsó szálába kapcsold be.',
  },

  /* ---- Amigurumi (PQW-863) ---- */
  'join-edge': {
    severity: 'error',
    reference: '04 §5.4',
    summary: 'Az összevarrás nem létező darabra vagy körre mutat.',
    message: 'Az összevarrás egy olyan részre vagy körre mutat, amely nincs meg.',
  },
  'join-count': {
    severity: 'error',
    reference: '04 §5.4, §9.0',
    summary: 'A két összevarrt szél szemszáma eltér, és nincs megadva elosztás, vagy az elosztás nem illik a két szélhez.',
    message: 'A két összevarrt szél szemszáma eltér. Add meg, hogyan oszlanak el a szemek, vagy igazítsd a részek méretét.',
  },
  'toy-safety-eyes': {
    severity: 'warning',
    reference: '04 §5.7, §9.6',
    summary: '3 év alatti gyereknek szánt játékban biztonsági szem van jelölve.',
    message: '3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem vagy gyöngy: a szemeket hímezd ki.',
  },

  /* ---- Rácsos technikák (PQW-864) ---- */
  'carried-colors': {
    severity: 'warning',
    reference: '03 §5.3, §10 G36',
    summary: 'Tapestryben egy sorban 3-nál több színt kell a szemekben vinni.',
    message:
      'Ebben a sorban 3-nál több színt kell a szemekben vinni: ez haladó szint, és a szövet merevebb lesz. Egyszerűsítsd a sort, vagy horgold graphganként, színenként külön gombolyaggal.',
  },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULES;
