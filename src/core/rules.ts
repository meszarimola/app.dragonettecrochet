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
    summary: 'Rossz láncalap: az 1. sor első szeme nem a fordulólánc után következő láncszembe megy.',
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

  /* ---- Magasság ---- */
  'mixed-heights': {
    severity: 'warning',
    reference: '03 §10 D19, 03 §2.3',
    summary: 'Keverten magas szemek, és a következő 1–3 sor nem egyenlíti ki őket.',
    message: 'Különböző magasságú szemek egy sorban, és a következő sorok nem egyenlítik ki.',
  },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULES;
