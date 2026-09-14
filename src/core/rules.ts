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
}

export const RULES = {
  /* ---- Szerkezet: ha ezek közül bármelyik jelez, a darab többi ellenőrzése nem fut ---- */
  'unknown-stitch': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'Az öltés nincs a könyvtárban, vagy nem lehet csomópont (összetett csoport, láncív-elem).',
  },
  'dangling-reference': {
    severity: 'error',
    reference: '06 §5.2',
    summary: 'Nem létező öltésre, láncívre, gyűrűre vagy csoportra mutató hivatkozás, vagy ismétlődő azonosító.',
  },
  'yarn-path': {
    severity: 'error',
    reference: '06 §5.3 V2',
    summary: 'Az előző öltés nem a fonal útján előtte lévő, vagy fonalszakasz a fonal elvágása nélkül kezdődik.',
  },

  /* ---- Célpontok ---- */
  'future-anchor': {
    severity: 'error',
    reference: '06 §5.3 V1',
    summary: 'Az öltés később készülő öltésbe, láncívbe vagy gyűrűbe van horgolva.',
  },
  'anchor-layer': {
    severity: 'error',
    reference: '03 §10 C16, C17',
    summary: 'A célpont nem az előző sor horgolható pozíciója; korábbi sorba csak hosszú öltés mehet.',
  },
  'turning-chain-placement': {
    severity: 'error',
    reference: '03 §10 A4, 03 §1.3',
    summary: 'Számító fordulóláncnál a sor utolsó öltése nem a tetejébe megy, vagy nem számító fordulóláncba horgoltak.',
  },
  'unworkable-top': {
    severity: 'error',
    reference: '01 §8.2 szabály 10',
    summary: 'Bele nem horgolható tetejű öltésbe (pl. rákhurok) horgoltak.',
  },
  'anchor-count': {
    severity: 'error',
    reference: '03 §10 C12',
    summary: 'Az öltés célpontjainak száma nem egyezik azzal, amennyit az öltés felhasznál.',
  },
  'unmarked-increase': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Több öltés egy célpontban, de nincs szaporításnak, kagylónak vagy V-öltésnek jelölve.',
  },
  'unmarked-decrease': {
    severity: 'error',
    reference: '03 §10 C14',
    summary: 'Több célpont egy öltésben, de nincs fogyasztásnak vagy fürtnek jelölve.',
  },
  'group-mismatch': {
    severity: 'error',
    reference: '03 §10 C14, 01 §8.2 szabály 7',
    summary: 'A csoport tagjai nem egymás utáni, egy célpontba horgolt öltések a csoport definíciója szerint.',
  },
  'against-direction': {
    severity: 'error',
    reference: '03 §10 C13',
    summary: 'A célpont a haladási irány ellen van, és az öltés nincs keresztezettnek vagy reliefnek jelölve.',
  },
  'reach': {
    severity: 'error',
    reference: '03 §10 C15, 03 §4.2',
    summary: 'Túl nagy ugrás: a kihagyott pozíciókat sem láncszem, sem legyező nem hidalja át.',
  },
  'reach-single': {
    severity: 'warning',
    reference: '03 §10 C15',
    summary: 'Egy pozíció kimarad láncszem és legyező nélkül.',
  },
  'unused-position': {
    severity: 'error',
    reference: '03 §10 B8',
    summary: 'Az előző sor egy pozíciója nincs felhasználva, és nincs jelölten kihagyva vagy áthidalva.',
  },
  'floating-chain': {
    severity: 'error',
    reference: '03 §10 C18, 03 §9.8',
    summary: 'Lógó lánc: a sor végi láncszemekbe semmi nem horgol, és nem fordulólánc.',
  },

  /* ---- Láncalap, fordulólánc, számok ---- */
  'foundation-chain': {
    severity: 'error',
    reference: '03 §10 A2, 03 §1.2',
    summary: 'Rossz láncalap: az 1. sor első öltése nem a fordulólánc után következő láncszembe megy.',
  },
  'turning-chain-height': {
    severity: 'warning',
    reference: '03 §10 A1, D20',
    summary: 'A fordulólánc magassága eltér a sort kezdő öltésétől.',
  },
  'stated-count': {
    severity: 'error',
    reference: '03 §10 B7, B10, 06 §5.3 V3',
    summary: 'A megadott öltésszám eltér a számolttól.',
  },
  'round-join': {
    severity: 'error',
    reference: '06 §5.3 V4',
    summary: 'A kör záró kúszószeme nem a kör első öltésébe vagy a kezdőlánc tetejébe megy.',
  },
  'repeat-balance': {
    severity: 'error',
    reference: '03 §10 E23, 03 §4.2',
    summary: 'Ismételt mintában a sor több vagy kevesebb pozíciót ad, mint amennyit felhasznál.',
  },

  /* ---- Magasság ---- */
  'mixed-heights': {
    severity: 'warning',
    reference: '03 §10 D19, 03 §2.3',
    summary: 'Keverten magas öltések, és a következő 1–3 sor nem egyenlíti ki őket.',
  },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULES;
