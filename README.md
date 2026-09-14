# Mintatervező — app.dragonettecrochet.com

Jeldiagram-szerkesztő a [Dragonette Crochet](https://dragonettecrochet.com)
mintáihoz. Vanilla TypeScript + canvas, Vite build. A fő oldaltól külön repó,
mert saját aldomainre kerül.

## Futtatás

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # típusellenőrzés: az egész src/, majd a src/core/ DOM nélkül
npm run build    # tsc --noEmit + vite build → dist/
npm test         # node:test; a build után (az analitika-teszt a dist/-et is nézi)
npm run preview  # a buildelt kimenet kiszolgálása
```

Node 22.18 vagy újabb kell (`package.json` `engines`): a tesztek a
TypeScriptet a Node beépített típuseltávolításával futtatják, fordítás és új
függőség nélkül. A CI (`.github/workflows/ci.yml`) minden PR-on és a `main`,
`develop` ágon lefuttatja a `check`, `build`, `test` lépéseket.

## Mit tud most (v0.0.1)

Egyetlen vászon, jobb oldalon kinyíló jelkészlettel. Kiválasztasz egy jelet,
és kattintásra pontosan oda kerül, ahová mutattál — nincs rács, nincs
pattanás.

A jelkészlet a teljes öltéskönyvtárat mutatja négy csoportban: alapöltések,
szaporítás és fogyasztás, összetett öltések, láncív és varázskör. A gombon a
magyar név, összetett öltésnél a szerkezet (pl. „2 rp egy öltésbe”) és az
amerikai jelölés áll. Az első kilenc öltés gyorsbillentyűje `1`–`9`.

A jelek a Craft Yarn Council jelölését követik, és a könyvtár adataiból
rajzolódnak: a szár hossza a láncszem-magasságból, a ferde vonalak száma a
ráhajtásokból jön; a szaporítás talpa és a fogyasztás teteje közös.

`Esc` megszünteti a kijelölést; a kiválasztott jelre újra kattintva is.

A fejléc bal oldalán a **Főoldal** gomb visz vissza a
`dragonettecrochet.com`-ra.

## Fájlfelelősségek

| Hol | Mi |
|---|---|
| `src/core/types.ts` | **Az öltés és az öltésgráf felülete**, csak típusok. Erre épül az öltéskönyvtár (PQW-867) és az öltésgráf az ellenőrzővel (PQW-856). |
| `src/core/stitches.ts` | **Az öltéskönyvtár** (PQW-867): minden öltés adatként, az összetett öltések építőfüggvényei, a csoportok a palettához. Új öltés itt kezdődik; a paletta és a jel magától követi. |
| `src/core/stitchText.ts` | Az öltés kiírt neve és szerkezete magyar, amerikai és brit jelöléssel. Kimenetben csak a jóváhagyott név és rövidítés szerepel. |
| `src/ui/symbols.ts` | **Paraméteres jelrajz:** az öltés adataiból geometria, böngésző nélkül tesztelhetően, és ennek kirajzolása. Ugyanez rajzol a vászonra és a paletta előnézetébe. |
| `src/core/graph.ts` | Az öltésgráfból számolt sorok és körök: öltésszám, pozíciószám, színe vagy visszája, fordulólánc, haladási irány (PQW-856). |
| `src/core/validate.ts`, `src/core/rules.ts` | Az ellenőrző és a szabálykatalógus. Minden szabálynál ott a súlyosság és a tudásbázis pontja; új szabály előbb a `rules.ts`-be kerül. |
| `src/core/pattern-json.ts` | A minta mentése és betöltése verziózott JSON-ként (`formatVersion`), mezőútvonalas hibával. |
| `src/core/repeat.ts`, `src/core/stitch-library.ts` | Láncalap és „X többszöröse + Y” számítása; az öltéskönyvtár mint azonosító → definíció. |
| `src/ui/palette.ts` | A paletta tartalma a könyvtárból: csoportcímek, feliratok, gyorsbillentyűk, DOM nélkül. |
| `src/ui/board.ts` | A vászon: HiDPI-méretezés, a lerakott jelek tárolása, újrarajzolás. |
| `src/ui/main.ts` | Belépési pont: a paletta felépítése, kiválasztás, lerakás, panel, billentyűk. |
| `src/ui/styles.css` | A fő oldal design tokenjeinek szűk metszete. Konkrét hexet komponensben ne írj le. |
| `src/ui/consent.ts`, `src/ui/analytics.ts` | **A fő oldal repójából másolva, változtatás nélkül** (csak az import kiterjesztése `.js`). Ha ott változik, itt is kell. |
| `src/ui/consentBanner.ts` | A süti-sáv és a jelkészlet „Süti-beállítások" gombja. |
| `src/config.ts` | A GA4 mérési azonosító (`mintatervező` property). Üres stringre a mérés és a süti-sáv kikapcsol. |
| `public/.htaccess` | Biztonsági fejlécek és cache. A CSP a GA-azonosítóval együtt változik — a `tests/analytics.test.mjs` őrzi. |
| `tests/*.test.mjs` | `node:test` tesztek; a `core-*` a magot, a `ui-*` a jelrajzot és a palettát, az `analytics` a süti-sávot és a CSP-t nézi. |
| `tests/*.check.ts` | Csak fordítási próba: a `tsconfig.core.json` típusellenőrzi, nem fut. |
| `tsconfig.core.json` | A `src/core/` típusellenőrzése DOM-típusok nélkül. |

## Mag és felület

A horgolási logika (öltések, gráf, ellenőrzés, írott minta) a `src/core/`-ban
él, a vászon és minden böngészős kód a `src/ui/`-ban. A mag böngésző nélkül fut,
és teljesen tesztelt; a felület csak megjeleníti és szerkeszti.

- **A `src/core/` csak a saját mappájából importál**, és nem használ DOM-ot. Az
  importot a `tests/core-boundary.test.mjs`, a DOM-ot a `tsconfig.core.json`
  (`lib` DOM nélkül) fogja meg.
- **A magon belül `.ts` kiterjesztéssel importálunk**, mert a Node a
  forrásfájlt közvetlenül futtatja, és nem fordítja le a `.js`-t `.ts`-re. A
  `src/ui/` a Vite-nak szól, ott maradhat a `.js`; kivétel a `symbols.ts` és
  a `palette.ts`, mert ezeket a tesztek a Node-dal is futtatják.
- **Csak törölhető TypeScript-szintaxis** (`erasableSyntaxOnly`): se `enum`, se
  `namespace`, se konstruktor-paraméter-tulajdonság, mert a Node ezeket nem
  tudja eltávolítani.
- A mag tesztjei `tests/core-*.test.mjs` néven, `node:test`-tel készülnek.

## Analitika

Ugyanaz a hozzájárulás-kezelés, mint a fő oldalon — a részletek a fő oldal
repójának CLAUDE.md-jében, az „Analitika" szakaszban. A lényeg:

- a gtag.js csak elfogadás után töltődik be, addig a Google felé nem megy kérés,
- a döntés a `dragonettecrochet.com` domainre szóló `dc_consent` sütiben él,
  tehát a fő oldalon adott döntést a tervező is látja, és fordítva,
- a mérés külön property-be megy: a fő oldalé `G-GRSENBPJXK`, a tervezőé
  `G-GSHBHXV7MJ`.

A sáv a fejléc fölött áll, és a vászon a maradék helyet kapja; a `Board`
`ResizeObserver`-e a sáv eltűnésekor újraméretezi.

```bash
npm test   # a build után: CSP ↔ azonosító, inline szkript, közös süti
```

## Amit tudatosan nem tartalmaz

Ez az első lokális prototípus; a következő lépések nyitottak:

- **Visszavonás és törlés.** Jelenleg egy félrekattintás csak újratöltéssel
  szüntethető meg. Ez az első dolog, amit érdemes hozzátenni.
- **Mentés, betöltés, PDF-export.** A diagram az oldal frissítésével elvész.
- **Rács és öltésszám-ellenőrzés.** A szabad elhelyezés rajzolásra jó, de nem
  tud öltést számolni. Ha később mégis kellenek a szabályok (öltésszám-egyezés,
  kapcsolódási pontok), az rácsra pattanást kíván.
- **Körkörös nézet.** Most csak sík vászon van; az amigurumihoz poláris
  elrendezés kell majd.
- **Billentyűzetes lerakás.** A paletta végigjárható és kezelhető
  billentyűzettel, de magára a vászonra kattintani kell. Ez a fő oldal
  akadálymentességi elveivel még adós.
- **Önhosztolt betűk.** Az Instrument Serif és a Karla fájljai még nincsenek
  itt, ezért rendszerbetűk ugranak be. A Google Fonts CDN-t nem használjuk: az
  EU-ban hozzájárulás nélkül továbbítaná a látogató IP-címét.

## Kapcsolódás a fő oldalhoz

A szerkesztő a `dragonettecrochet.com`-ról nyílik majd, és az
`app.dragonettecrochet.com` aldomainen fut. A kivezető link a fő oldalon a
PQW-835, az aldomain beállítása a PQW-834 ticket.
