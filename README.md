# Mintatervező — app.dragonettecrochet.com

Jeldiagram-szerkesztő a [Dragonette Crochet](https://dragonettecrochet.com)
mintáihoz. Vanilla TypeScript + canvas, Vite build. A fő oldaltól külön repó,
mert saját aldomainre kerül.

## Futtatás

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # típusellenőrzés
npm run build    # tsc --noEmit + vite build → dist/
npm run preview  # a buildelt kimenet kiszolgálása
```

## Mit tud most (v0.0.1)

Egyetlen vászon, jobb oldalon kinyíló jelkészlettel. Kiválasztasz egy jelet,
és kattintásra pontosan oda kerül, ahová mutattál — nincs rács, nincs
pattanás.

Négy alap jel, a Craft Yarn Council nemzetközi jelölései szerint:

| Jel | Magyar | Angol | Billentyű |
|---|---|---|---|
| ⬭ | Láncszem | Chain (ch) | `1` |
| + | Rövidpálca | Single crochet (sc) | `2` |
| T | Félpálca | Half double crochet (hdc) | `3` |
| T̸ | Pálca | Double crochet (dc) | `4` |

`Esc` megszünteti a kijelölést; a kiválasztott jelre újra kattintva is.

A fejléc bal oldalán a **Főoldal** gomb visz vissza a
`dragonettecrochet.com`-ra.

## Fájlfelelősségek

| Hol | Mi |
|---|---|
| `src/stitches.ts` | **A jelkészlet egyetlen igazságforrása.** Név, rövidítés, billentyű és a rajzoló függvény. Új jel itt kezdődik. |
| `src/board.ts` | A vászon: HiDPI-méretezés, a lerakott jelek tárolása, újrarajzolás. |
| `src/main.ts` | A paletta felépítése, kiválasztás, lerakás, panel, billentyűk. |
| `src/styles.css` | A fő oldal design tokenjeinek szűk metszete. Konkrét hexet komponensben ne írj le. |
| `src/config.ts` | A GA4 mérési azonosító (`mintatervező` property). Üres stringre a mérés és a süti-sáv kikapcsol. |
| `src/consent.ts`, `src/analytics.ts` | **A fő oldal repójából másolva, változtatás nélkül** (csak az import kiterjesztése `.js`). Ha ott változik, itt is kell. |
| `src/consentBanner.ts` | A süti-sáv és a jelkészlet „Süti-beállítások" gombja. |
| `public/.htaccess` | Biztonsági fejlécek és cache. A CSP a GA-azonosítóval együtt változik — a `tests/analytics.test.mjs` őrzi. |

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

A jeleket ugyanaz a függvény rajzolja a vászonra és a paletta előnézetébe —
egy jel megváltoztatásához egyetlen helyet kell módosítani.

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
