# Kiadás és élesítés

Ez a futtatókönyv. A telepítés **egy parancs**, és a lépéseit nem kell fejből tudni.

## A szokásos kiadás

```
git checkout develop && git pull
npm run kiadas -- 0.20.0
```

Ennyi. A szkript elvégzi a verzióemelést, a két összevonást, a buildet, a
telepítést és az ellenőrzést, majd kiírja, mi a teendő, ha baj van.

## Mielőtt élesbe mennél: főpróba

```
npm run kiadas -- --proba
```

Lefuttatja az összes ellenőrzést és a buildet, majd megmutatja a
próbaszinkront — de **semmit nem változtat sehol**: se git, se kiszolgáló.
Bármikor, bárhonnan, akárhányszor futtatható, worktree-ből is.

## Ha baj van

```
npm run visszaallitas -- 0.18.0     # az előző kiadás visszaállítása
npm run kiadas -- 0.20.0 --ujra     # ugyanaz a verzió újratelepítése
```

A `--ujra` akkor kell, ha a kiadás már bement a gitbe, de a telepítés vagy az
ellenőrzés bukott el. A gitflow-t nem futtatja újra, csak a címkéből buildel és
feltölt. Akárhányszor megismételhető.

A `visszaallitas` tíz másodperc gondolkodási időt ad, mielőtt hozzákezd; ezt a
`--azonnal` kapcsoló kihagyja.

## A biztonsági kapuk

Bármelyik bukása leállítja az egészet — félbehagyott élesítés nem marad.

**Indulás előtt.** Tiszta munkafa · a `develop` ágon állsz · naprakész az
`origin`-nal · a kiszolgáló ssh-n válaszol · a verzió `X.Y.Z` alakú, szigorúan
nagyobb a jelenleginél, és még nincs ilyen címke.

**Kiadás előtt.** `npm run check` · egységtesztek · (`--bongeszo` esetén a
teljes böngészős készlet is).

**Build után.** A kiadott verziónak bele kell égnie a csomagba · a
`dist/index.html` megvan · a `dist` nem gyanúsan üres.

**Telepítés előtt.** Próbaszinkron `--itemize-changes`-szel, gépi elemzéssel:
törölni kizárólag régi `assets/index-*.js` és `.css` fájlt szabad. Bármi más
törlés, vagy tíznél több törlés → megáll.

**Telepítés után.** `index.html`, JS, CSS és `robots.txt` 200 · a kiszolgált
csomagban a most kiadott verzió · a régi csomag 404 · http→https 301 · a négy
biztonsági fejléc megléte (CSP, HSTS, `X-Content-Type-Options`,
`Referrer-Policy`) · böngészős füstpróba két méretben, konzolhiba-tűrés nulla.

## Amit tudni érdemes

**Ágvédelem nincs**, ezért a `gh pr merge --merge` mindig átmegy, és `--admin`
soha nem kell. A CI a push után külön fut; ha pirosra vált, az látszik, de a
kiadást nem állítja meg. Ha meg akarod várni, futtasd `--bongeszo`-val.

**A teljes kiadás abból a munkapéldányból indul, ahol a `develop` ki van
fejtve** — worktree-ből a `--proba` és a `--ujra` megy, a teljes kiadás nem.

**A füstpróba az `e2e-prod/` mappában van**, külön beállítással
(`playwright.prod.config.ts`), hogy egyetlen rendes böngészős teszt se
futhasson véletlenül élesben. A választói szándékosan ugyanazok, mint az
`e2e/` készletben: korábban minden kiadásnál újraírt, találgatott választókkal
ment, és rendre elhasalt.

**Kézzel is futtatható:** `VART_VERZIO=0.19.0 npm run fust`.
