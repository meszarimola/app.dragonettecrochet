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
npm run test:e2e # build, majd Playwright a buildelt kimeneten, a 5181-es porton
npm run preview  # a buildelt kimenet kiszolgálása
```

Node 22.18 vagy újabb kell (`package.json` `engines`): a tesztek a
TypeScriptet a Node beépített típuseltávolításával futtatják, fordítás és új
függőség nélkül. A CI (`.github/workflows/ci.yml`) minden PR-on és a `main`,
`develop` ágon lefuttatja a `check`, `build`, `test` lépéseket.

## Mit tud most

A vászon a gráfot szerkeszti (PQW-857). Nem helyet választasz, hanem
**célpontot**: az előző sor egyik szemét, egy láncívet vagy a varázskört. A jel
helye, iránya, a legyező és az összefutás ebből számolódik.

- **Kezdés:** láncalap („Láncszem”, a megadott számú láncszemmel) vagy
  varázskör. Az 1. sor első szemének célpontja magától a fordulólánc utáni
  láncszem.
- **Horgolás:** szem kiválasztása (`1`–`9` vagy a jelkészlet), a célpont
  nyilakkal vagy az egérrel, horgolás `Enter`-rel vagy kattintással. A kurzor
  a következő szabad célpontra lép; a fogyasztás annyi célpontot használ, ahány
  szemet összehorgol.
- **Még egy ugyanabba** (`Shift`+`Enter`): egy szemből szaporítás, a
  szaporításból és a kagylóból eggyel nagyobb lesz (pl. `inc-3dc`).
- **Sor vége, fordulás** (`F`) a kiválasztott szem fordulóláncával;
  **kör zárása** (`K`) kúszószemmel a kör első pozíciójába.
- **Visszavonás, újra, az utolsó lépés törlése** (`Ctrl`+`Z`,
  `Ctrl`+`Shift`+`Z`, `Backspace`). Egy lépés egy egység: csoport, láncív,
  fordulás.
- **Számolt elrendezés:** a sorok alulról felfelé, kígyózva; a sorszám a sor
  kezdő oldalán, a szemszám a végén; a színoldali és a visszai sorok színe
  eltér. Új szem csak a saját sorát rendezi át.
- **Élő ellenőrzés:** hibák és figyelmeztetések a vásznon (teli, illetve
  szaggatott karika) és a menüsor összecsukható hibalistájában, számlálóval
  (pl. „4 hiba”); kattintásra a vászon az érintett szemre ugrik. A félkész sor
  hátralévő célpontjai nem hibák.
- **Kézi igazítás:** kiválasztott szem nélkül a jel kijelölhető, és húzással,
  `Alt`+nyilakkal vagy a jobb oldali panel gombjaival eltolható. Az eltolás
  csak a rajzon változtat.
- **Mentés:** minden változás a böngészőbe mentődik (`localStorage`); JSON
  mentése és betöltése; PNG és SVG export jelmagyarázattal.
- **Tükrözött nézet** balkezeseknek (`M`).
- **Rács** (PQW-874): a menüsor nézet csoportjában ki- és bekapcsolható (`R`),
  a böngészőben marad. A számolt elrendezésből jön, a kézi igazítás nem mozdítja.
  Sorban soronként egy sáv, körben és motívumnál körgyűrű; a sávok színe
  váltakozik (akadálymentes kontraszttal), az 5. és a 10. vonal hangsúlyosabb.
  A sorszám a sor színével teli címkén áll, és kattintható (a sor kijelölése a
  PQW-875-ben jön). Kiválasztott szemmel a cellára kattintás a célpont: a
  célpont saját cellája és a fölötte lévő cella is; ahol nincs mibe horgolni,
  üzenet jön, és nem kerül le szem. Az exportba választhatóan kerül (a Minta
  szakasz jelölőnégyzete).
- **Felület** (PQW-873): ikonos menüsor csoportokba rendezve (fájl,
  szerkesztés, sor és kör, kijelölés, nézet), minden ikonon tooltip a
  gyorsbillentyűvel (saját tooltip: azonnal, fókuszra és inaktív gombon is);
  bal oldalt lenyitható **mintatípus**-menü (most a szabályos horgolás aktív, a
  többi „hamarosan”); jobb oldalt összecsukható szakaszok: legfelül a
  **szemek** listája csoportokkal és jel-előnézettel, alatta a ritkán állított
  jelölés és jelek (alapból csukva), majd a minta neve (PQW-882). A kijelölés-,
  törlés- és duplikálás-ikon csak helyet foglal, a művelet a PQW-875-ben jön.
- **Írott minta** (PQW-868, PQW-873): a vászon alján lenyitható panelben a
  minta szövege, minden szerkesztés után frissül, és egy gombbal másolható.
  Félkész sornál és hibás mintánál megjegyzés kíséri; amit a szöveg még nem tud
  kifejezni, arról üzenet szól.
- **Jelölés és jelstílus** (PQW-868): magyar, amerikai (US terms) vagy brit
  (UK terms) jelölés, CYC vagy japán (JIS) jelek, a rövidpálca + vagy ×. A
  felület nyelvétől független; a paletta, a szemnevek, a vászon, az írott
  minta és az export is ezt követi. A választás a böngészőben marad, a mentett
  JSON pedig rögzíti (`notation`). Az angol szöveg és a jelmagyarázat mindig
  megnevezi a rendszert.
- **Japán előbeállítás** (PQW-876): mintánként választható a „Jelölés és jelek”
  szakaszban. JIS jeleket és × rövidpálcát kapcsol be; a fordulólánc a
  félpálcától felfelé szemnek számít, és a számító fordulólánc egy
  alapláncszemen áll, ezért a félpálca a 4., a pálca az 5. láncszemtől indul (a
  láncalap N + T). Az ellenőrző, a vezetett kurzor, az írott minta és a
  visszaolvasás is ezzel számol; a mentett JSON a `conventions.tradition`
  mezőben rögzíti. JIS-ben a varázskör jele „わ”.

A jelek alapból a Craft Yarn Council jelölését követik, és a könyvtár adataiból
rajzolódnak: a szár hossza a láncszem-magasságból, a ferde vonalak száma a
ráhajtásokból jön.

A fejléc bal oldalán a **Főoldal** gomb visz vissza a
`dragonettecrochet.com`-ra.

## Fájlfelelősségek

| Hol | Mi |
|---|---|
| `src/core/types.ts` | **A szem és a szemgráf felülete**, csak típusok. Erre épül a szemkönyvtár (PQW-867) és a szemgráf az ellenőrzővel (PQW-856). |
| `src/core/stitches.ts` | **A szemkönyvtár** (PQW-867): minden szem adatként, az összetett szemek építőfüggvényei, a csoportok a palettához. Új szem itt kezdődik; a paletta és a jel magától követi. |
| `src/core/stitchText.ts` | A szem kiírt neve és szerkezete magyar, amerikai és brit jelöléssel. Kimenetben csak a jóváhagyott név és rövidítés szerepel. |
| `src/ui/symbols.ts` | **Paraméteres jelrajz:** a szem adataiból geometria, böngésző nélkül tesztelhetően, és ennek kirajzolása. Ugyanez rajzol a vászonra és a paletta előnézetébe. |
| `src/core/graph.ts` | A szemgráfból számolt sorok és körök: szemszám (a láncszemek a használatuk szerint, PQW-870), pozíciószám, színe vagy visszája, fordulólánc, haladási irány (PQW-856). |
| `src/core/validate.ts`, `src/core/rules.ts` | Az ellenőrző és a szabálykatalógus. Minden szabálynál ott a súlyosság és a tudásbázis pontja; új szabály előbb a `rules.ts`-be kerül. |
| `src/core/pattern-json.ts` | A minta mentése és betöltése verziózott JSON-ként (`formatVersion`), mezőútvonalas hibával. |
| `src/core/pattern-steps.ts` | **Az írott minta lépéssora** a gráfból (PQW-858), nyelvtől függetlenül: célpont az előző sor pozícióihoz képest, összevonás („5 rp”), legrövidebb ismétlődő egység. Itt dől el, mit tud a szöveg kifejezni. |
| `src/core/pattern-text.ts`, `src/core/hungarian.ts` | Az írott minta szövege magyarul, amerikai és brit jelöléssel; rövidítéslista és jelmagyarázat a használt szemekkel; a magyar ragozás. Minden kiírt kifejezés innen jön. |
| `src/core/pattern-read.ts`, `src/core/canonical.ts` | A saját szöveg visszaolvasása gráffá, a szöveg sorára mutató hibával; két minta összevetése az azonosítóktól függetlenül. |
| `src/core/repeat.ts`, `src/core/stitch-library.ts` | Láncalap és „X többszöröse + Y” számítása; a szemkönyvtár mint azonosító → definíció. |
| `src/ui/palette.ts` | A paletta tartalma a könyvtárból, a választott jelöléssel: csoportcímek, feliratok, gyorsbillentyűk, DOM nélkül. |
| `src/ui/pattern-types.ts` | A bal oldali mintatípus-menü tartalma (PQW-873): a négy típus neve, magyarázata és hogy be van-e kapcsolva; a típushoz tartozó rács (PQW-874). DOM nélküli. |
| `src/ui/grid-paths.ts` | A rács rajza útvonalakként: ugyanebből rajzol a vászon és az SVG-export. DOM nélküli. |
| `src/ui/notation.ts` | **A jelölés és a jelstílus beállítása** (PQW-868): alapértelmezés a felület nyelvéből, tárolás, a jelrajz beállítása, a minta jelölésének rögzítése. DOM nélküli. |
| `src/ui/written.ts` | **Az írott minta panelje** (PQW-868): a szöveg a jelöléssel, vagy érthető üzenet, ha a minta még nem írható ki. DOM nélküli. |
| `src/core/editor.ts` | **A szerkesztő műveletei** (PQW-857): célpontok, horgolás, „még egy ugyanabba”, fordulás, körzárás, az utolsó lépés törlése, kézi igazítás, élő ellenőrzés. |
| `src/core/grid.ts` | **A rács** (PQW-874): sávok és cellák az igazítás nélküli számolt elrendezésből, sorban és körben; találat, célzás és az üzenet, ha nincs mibe horgolni. Tiszta függvény. |
| `src/core/layout.ts` | **A számolt elrendezés** (PQW-857): hely, irány, legyező, összefutás, sorszám, színe és visszája, tükrözés. Tiszta függvény. |
| `src/core/history.ts` | Visszavonás és újra. |
| `src/core/stitch-variants.ts` | Az összetett szemek változatai azonosítóból (pl. `inc-3dc`), és a minta könyvtára. |
| `src/core/tradition.ts` | **A számolási hagyomány** (PQW-876): CYC vagy japán fordulólánc és láncalap. A gráf, az ellenőrző, a szerkesztő, az írott minta és a visszaolvasó innen veszi a szabályt. |
| `src/ui/chart-svg.ts` | A diagram SVG-ként jelmagyarázattal; ebből készül az SVG- és a PNG-export. DOM nélküli. |
| `src/ui/chart-labels.ts` | A diagram feliratai hagyományonként (PQW-876): CYC-ben zárójeles szemszám, japánban „18目” és „11目1模様”. A `chart-svg.ts` és a `board.ts` még nem használja. |
| `src/ui/board.ts` | A vászon: nézet (nagyítás, eltolás), kirajzolás az elrendezésből, célpontok, hibajelölés, találatkeresés. |
| `src/ui/main.ts` | Belépési pont: állapot és visszavonás, ikonos menüsor, mintatípus-menü, szemválasztó panel és hibalista, jelölés és írott minta, billentyűk és egér, mentés, export. |
| `src/ui/styles.css` | A fő oldal design tokenjeinek szűk metszete. Konkrét hexet komponensben ne írj le. |
| `src/ui/consent.ts`, `src/ui/analytics.ts` | **A fő oldal repójából másolva, változtatás nélkül** (csak az import kiterjesztése `.js`). Ha ott változik, itt is kell. |
| `src/ui/consentBanner.ts` | A süti-sáv és a jelkészlet „Süti-beállítások" gombja. |
| `src/config.ts` | A GA4 mérési azonosító (`mintatervező` property). Üres stringre a mérés és a süti-sáv kikapcsol. |
| `public/.htaccess` | Biztonsági fejlécek és cache. A CSP a GA-azonosítóval együtt változik — a `tests/analytics.test.mjs` őrzi. |
| `tests/*.test.mjs` | `node:test` tesztek; a `core-*` a magot, a `ui-*` a jelrajzot, a palettát és az SVG-t, az `analytics` a süti-sávot és a CSP-t, a `hu-vocabulary` a magyar szóhasználatot (szem = stitch) nézi. |
| `tests/fixtures/written/` | Az írott minta rögzített szövege kidolgozott példánként (`hu`, `en-US`); a magyart a tulajdonos hagyja jóvá. |
| `e2e/*.spec.ts`, `playwright.config.ts` | Böngészős tesztek a kritikus utakra: téglalap billentyűzettel, mentés és újratöltés, export, az írott minta panelje jelölésváltással, a japán előbeállítás (`editor.spec.ts`); mintatípus-választás, szemválasztás a panelből, hibaszámláló, alsó írott panel (`felulet.spec.ts`); az elrendezés helyei (`elrendezes.spec.ts`); a panel szakaszai és a tooltipek (`panel.spec.ts`); téglalap cellákra kattintva, a rács kapcsolója és exportja (`racs.spec.ts`). |
| `tests/*.check.ts` | Csak fordítási próba: a `tsconfig.core.json` típusellenőrzi, nem fut. |
| `tsconfig.core.json` | A `src/core/` típusellenőrzése DOM-típusok nélkül. |

## Mag és felület

A horgolási logika (szemek, gráf, ellenőrzés, írott minta) a `src/core/`-ban
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

- **Láncszem nélküli alapsor, láncszemgyűrűs kezdés, a fonal elvágása és új
  fonalszakasz, hosszú szem korábbi sorba.** A gráf ezeket még nem, vagy csak
  részben kezeli.
- **A beszúrási mód választása** (első vagy hátsó szál, relief): PQW-869.
  Most minden szem az alapértelmezett móddal megy.
- **Körnézet finomítása.** A körök egyszerű, sugárirányú elrendezést kapnak;
  a nagymama-négyzet sarkai még nem szögletesek.
- **PDF-export.**
- **A rács teljes változatai.** A filé cellás rácsának csak az alapja van meg
  (egyforma cellák, PQW-864), az amigurumi szöveges nézetének csak a típusa
  (PQW-863); mindkét mintatípus még „hamarosan”. Nincs még oszlopszámozás, és a
  cellák aránya a könyvtár becslése, nem a gauge-profil (PQW-859).
- **Önhosztolt betűk.** Az Instrument Serif és a Karla fájljai még nincsenek
  itt, ezért rendszerbetűk ugranak be. A Google Fonts CDN-t nem használjuk: az
  EU-ban hozzájárulás nélkül továbbítaná a látogató IP-címét.

## Kapcsolódás a fő oldalhoz

A szerkesztő a `dragonettecrochet.com`-ról nyílik majd, és az
`app.dragonettecrochet.com` aldomainen fut. A kivezető link a fő oldalon a
PQW-835, az aldomain beállítása a PQW-834 ticket.
