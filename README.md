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

## Kiadás

A kiadás gitflow szerint megy: a `develop`-ról indul a release ág, onnan PR a
`main`-be, és a `main` kerül élesbe.

1. A release ág indításakor a verzió emelése:
   `npm version <szám> --no-git-tag-version` (pl. `npm version 0.9.1
   --no-git-tag-version`). A `--no-git-tag-version` miatt csak a
   `package.json` (és a `package-lock.json`) változik, címke nem készül.
2. A verzió változása a release commitban megy, a kiadás többi
   előkészítésével együtt.
3. A számozás rendje: a 0.x kiadásokat sorban adjuk; az 1.0 (GA) időpontjáról
   a tulajdonos dönt.

A tervező a futó verziót a bal alsó sarokban kiírja (`v0.9.0`). A szám a
`package.json` `version` mezőjéből jön, build időben beégetve
(`vite.config.ts` `define` → `__APP_VERSION__`), ezért deploy után ránézésre
látszik, hogy tényleg frissült-e az oldal. Kézzel írt verziószám sehol nincs a
forrásban; ezt a `tests/version.test.mjs` őrzi.

## Mit tud most

A vászon a gráfot szerkeszti (PQW-857). Nem helyet választasz, hanem
**célpontot**: az előző sor egyik szemét, egy láncívet vagy a varázskört. A jel
helye, iránya, a legyező és az összefutás ebből számolódik.

- **Kezdés:** láncalap („Láncszem”, a megadott számú láncszemmel) vagy
  varázskör. A láncalap után az `F` megfordítja a munkát, és az 1. sor
  következik. Sorban a fordulólánc az 1. szem helyett áll, egy alapláncszemen
  (PQW-891): az 1. sor első szemének célpontja magától a rövidpálcánál a
  horogtól számított 3., félpálcánál a 4., egyráhajtásos pálcánál az 5.
  láncszem, N szemhez N + T láncszem kell, és a sorok utolsó szeme az előző
  fordulólánc tetejébe megy. Egy 40 láncszemes sál rövidpálcás sora így 39 szem.
- **Horgolás:** szem kiválasztása (`1`–`9` vagy a jelkészlet), a célpont
  nyilakkal vagy az egérrel, horgolás `Enter`-rel vagy kattintással. A kurzor
  a következő szabad célpontra lép; a fogyasztás annyi célpontot használ, ahány
  szemet összehorgol.
- **Még egy ugyanabba** (`Shift`+`Enter`): egy szemből szaporítás, a
  szaporításból és a kagylóból eggyel nagyobb lesz (pl. `inc-3dc`).
- **Sor vége, fordulás** (`F`) a kiválasztott szem fordulóláncával;
  **kör zárása** (`K`) kúszószemmel a kör első pozíciójába, csak láncszemekből
  láncgyűrű; **kör vége spirálban** (`S`), zárás nélkül (PQW-861).
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
- **Kijelölés, törlés, másolás, beillesztés, duplikálás** (PQW-875):
  kiválasztott szem nélkül kattintással egy szem, `Shift`-tel több, a
  sorszámmal a teljes sor vagy kör, a menüsor kijelölés-gombjával húzott
  téglalappal egy terület, billentyűzettel nyilakkal (`Shift`-tel tartomány,
  `Ctrl`+`A` minden szem) jelölhető ki. A kagyló, a szaporítás és a láncív csak
  egészben. A törlés (`Delete`) megmutatja a kijelöltekbe horgolt szemeket, és
  velük együtt töröl, vagy megszakítható. A másolat (`Ctrl`+`C`) célpont-
  eltolásokat visz: a beillesztés (`Ctrl`+`V`) a kurzortól köti újra a szemeket,
  a teljes sort új sorként; a duplikálás (`Ctrl`+`D`) egy lépésben másol és a
  minta végére illeszt, pl. „ismételd a 2. sort”. Ha nincs elég célpont, a
  célpont foglalt, vagy a szemszám nem jön ki, figyelmeztet, és a minta nem
  változik. Minden művelet egy lépésben visszavonható.
- **Beszúrási mód** (PQW-869): a Szemek szakaszban a kiválasztott szemhez
  mindkét szál, első szál, hátsó szál, első relief vagy hátsó relief
  választható; csak a szem `insertionModes` listájában szereplő módok jelennek
  meg, rádiógombként (Tab, nyilak). A mód a horgoló felől értendő, a gráf a
  színoldali módot tárolja (`Anchor.mode`): visszai soron megfordul. Minden
  lerakási út követi (horgolás, sor kitöltése, cellára kattintás); a
  beillesztés és a duplikálás más oldalú sorba megfordítva viszi át. A talpon
  jelölve látszik a vásznon és az exportban, CYC és JIS jelekkel; az export
  jelmagyarázata szemenként és módonként mutatja. Írott mintában „rp (hsz)”,
  „rp (esz)”, „Eerp”/„Herp” (máshol „(első relief)”), angolul „sc BLO”,
  „sc FLO”, „FPdc”/„BPdc”; visszaolvasható. A szem által nem engedett módot az
  ellenőrző jelzi (`insertion-mode`), a rajz ettől nem áll le.
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
  A sorszám a sor színével teli címkén áll, és kattintásra kijelöli a teljes
  sort (PQW-875). Kiválasztott szemmel a cellára kattintás a célpont: a
  célpont saját cellája és a fölötte lévő cella is; ahol nincs mibe horgolni,
  üzenet jön, és nem kerül le szem. Az exportba választhatóan kerül (a Minta
  szakasz jelölőnégyzete).
- **Felület** (PQW-873): ikonos menüsor csoportokba rendezve (fájl,
  szerkesztés, sor és kör, kijelölés, nézet), minden ikonon tooltip a
  gyorsbillentyűvel (saját tooltip: azonnal, fókuszra és inaktív gombon is);
  bal oldalt lenyitható **mintatípus**-menü (a szabályos horgolás és az
  amigurumi aktív, a többi „hamarosan”); jobb oldalt összecsukható szakaszok: legfelül a
  **szemek** listája csoportokkal és jel-előnézettel, alatta a ritkán állított
  jelölés és jelek (alapból csukva), majd a minta neve (PQW-882). A kijelölés
  csoportban a terület kijelölése, a kijelölés törlése és duplikálása (PQW-875).
- **Írott minta** (PQW-868, PQW-873): a vászon alján lenyitható panelben a
  minta szövege, minden szerkesztés után frissül, és egy gombbal másolható.
  Félkész sornál és hibás mintánál megjegyzés kíséri; amit a szöveg még nem tud
  kifejezni, arról üzenet szól.
  - **Magasság** (PQW-885): a panel tetején lévő elválasztó egérrel és
    érintéssel húzható, billentyűzettel a nyilakkal (5 %), `PageUp`/`PageDown`-
    nal (25 %), `Home`-mal és `End`-del állítható, a fejléctől a teljes
    munkaterületig. A fejléc alá húzva a panel lecsukódik. A „Teljes nézet” gomb
    a teljes munkaterületre nyitja, a „Vissza” a korábbi magasságra állítja.
    Alapból legfeljebb 22rem és a munkaterület fele; 40rem-nél alacsonyabb
    ablakban a 40%-a, és megjegyzett állapot nélkül csukva indul, hogy a
    vászon közepére lehessen kattintani (PQW-891); a
    beállítás csak a lapon belül él.
  - **Igazodás** (PQW-883, PQW-885): az „Egész minta” és a kurzor követése
    minden magasságnál a panel fölötti látható részre illeszt; teljes nézetben
    a vászon nem mozdul.
  - **Állapotsor** (PQW-884): a két oldalsáv között, a panel fölött áll, és
    hosszú üzenetnél több sorba törik; teljes nézetben a panel teteje ad neki
    helyet.
- **Jelölés és jelstílus** (PQW-868): magyar, amerikai (US terms) vagy brit
  (UK terms) jelölés, CYC vagy japán (JIS) jelek, a rövidpálca + vagy ×. A
  felület nyelvétől független; a paletta, a szemnevek, a vászon, az írott
  minta és az export is ezt követi. A választás a böngészőben marad, a mentett
  JSON pedig rögzíti (`notation`). Az angol szöveg és a jelmagyarázat mindig
  megnevezi a rendszert.
- **Japán előbeállítás** (PQW-876): mintánként választható a „Jelölés és jelek”
  szakaszban. JIS jeleket és × rövidpálcát kapcsol be; a fordulólánc a
  félpálcától felfelé szemnek számít, a rövidpálcáé nem, ezért a rövidpálcás
  sor a 2. láncszemtől indul. A félpálca a 4., a pálca az 5. láncszemtől indul,
  mint az alapértelmezésben (a láncalap N + T). Az ellenőrző, a vezetett kurzor, az írott minta és a
  visszaolvasás is ezzel számol; a mentett JSON a `conventions.tradition`
  mezőben rögzíti. JIS-ben a varázskör jele „わ”; a diagramon a szemszám
  „18目”, az exportban az ismétlés „6目1模様” alakú.
- **Méret és fonal** (PQW-859): a jobb oldali panel „Méret és fonal” szakasza
  (a Szemek alatt, alapból csukva).
  - **Profil-szerkesztő:** fonal (név, CYC vastagsági kategória, m/100 g, egy
    gombolyag tömege), tű mm-ben a US és a régi UK méretével, szemenként
    szem és sor 10 cm-en síkban vagy körben mérve, blokkolva vagy anélkül, a
    próbadarab mérete és tömege.
  - **Eredetjelölés:** minden érték mellett, hogy mért, címkéről vett vagy
    becsült; a becslés tartománnyal. Profil nélkül a méret 4 mm-es tűből
    becsült, és a szakasz ezt ki is írja.
  - **Kiírás:** kész szélesség és magasság soronként és a teljes darabra
    (körnél átmérő), fonal a próbadarab tömegéből 10–15 % tartalékkal, egész
    gombolyagra kerekítve.
  - **Profilok:** több profil között lehet váltani. A profilok a mintával
    mentődnek (a böngészőben és a JSON `gauge` mezőjében), és az új mintába is
    átkerülnek. A régi mentések változatlanul betöltődnek.
  - **Arányhelyes nézet:** kapcsolóval a jelek szára és a rács sorai a valós
    szemarányt követik; az export is. Újratöltés után nem marad meg.
- **Körök és motívumok** (PQW-861): a jobb oldali panel „Kör és motívum”
  szakasza (a Forma alatt, alapból csukva).
  - **Kezdés:** varázskör, láncgyűrű (a vásznon is: láncszemek, majd `K`), vagy
    „2 lsz, 6 rp a 2. láncszembe”.
  - **Kör vége:** zárt kör kúszószemmel és kezdőlánccal, vagy spirál; az írott
    minta a spirálnál egyszer, a darab elején kéri a körjelölőt. Színváltásnál
    spirálban lépcsőjavítás választható; nélküle az ellenőrző figyelmeztet és
    javasol. Az alapértelmezés a tulajdonos döntése szerint a mintatípusból
    jön, nem a szem magasságából: amigurumiban spirál, minden más körben zárt
    kör (PQW-892). Kézzel horgolt körnél a kör végén az állapotsor ennek
    megfelelően a `K`-t vagy az `S`-t javasolja.
  - **Lapos kör:** a szaporítás száma a körben mért mintasűrűségből
    (2π × magasság/szélesség, páros számra kerekítve); profil nélkül a
    szokásos körös arányból becsülve, és a szakasz ezt ki is írja. Eltolt
    szaporítással a 04 §3.2, nélküle a 04 §3.1 táblázata.
  - **Sokszög és motívum:** négyzet, hatszög, nyolcszög a sokszög lapos
    értékével, a sarkokban egymás fölé kerülő szaporítással; nagymama-négyzet
    láncívekkel (sarkonként 3 erp, 2 lsz, 3 erp).
  - **Ellenőrzés a befejezett körökön:** legfeljebb duplázás vagy felezés,
    kunkorodás (a lapos érték ~85%-a alatt két körön át), fodrosodás (~130%
    fölött), három körön át egymás fölé kerülő szaporítás (sokszögben nem).
  - **Írott minta körökre:** „3. kör: (1 rp, szap.) ×6 (18)”, angolul
    „Rnd 3: (sc, inc) x6 (18)”; a „szap.” a rövidítéslistában áll. A sorok
    alakja nem változott. Visszaolvasható, a japán előbeállítással is.
  - **Rajz:** a jelek sugárirányban a középpontból kifelé, az alapjuk az előző
    kör célpontszemén; a körszám a kör elején, a szemszám mögötte.
- **Sík formák** (PQW-862): a jobb oldali panel „Forma” szakasza (a Méret és
  fonal alatt, alapból csukva).
  - **Téglalap** cm-ből, alapszemmel. Mintaismétlésnél a szemszám „X
    többszöröse + Y”, a legközelebbi, a bővebb vagy a szűkebb többszörösre
    kerekítve, és a minta konvenciója az ismétlés lesz.
  - **Derékszögű és egyenlő szárú háromszög, trapéz, rombusz** a magasságból
    vagy az él függőlegeshez mért szögéből. Az él a sorok között egyenletesen
    tolódik (03 §3.4); szimmetrikus formában a szemszám soronként páros
    számmal változik.
  - **Élenként soronként legfeljebb 2** egy szembe: 3 szem egy szembe, 3 szem
    összehorgolása. Ha több kell, a sor elején láncos hosszabbítás az előző sor
    végén, a sor végén meghagyott szemek (lépcsős él). Számító fordulóláncnál a
    meghagyott szemek közé a fordulólánc teteje is tartozhat.
  - **A kész darab után** (PQW-897): a fonal elvágása után az állapotsor nem
    jósol következő sort vagy kört („Téglalap, 11 sor elkészült.”).
  - **Előnézet:** a forma lépcsős körvonala, a tényleges méret, a sorok, a szög
    és az alakítás módja. Profil nélkül a méret becslés, és a szakasz ezt ki is
    írja.
  - A létrehozás egy lépésben visszavonható, és minden generált minta
    hibátlanul átmegy az ellenőrzőn.
- **Kendőformák** (PQW-865): a jobb oldali panel „Kendő” szakasza (a Forma
  alatt, alapból csukva).
  - **Formák:** fentről induló szimmetrikus háromszög (szárnyakkal is),
    aszimmetrikus háromszög, félhold és félkör fordított sorokban, egyetlen
    láncszembe horgolt 1. sorral; kör, Pi-kendő és eltolt Pi-kendő körökben,
    varázskörből; téglalap stóla (a Forma téglalapja).
  - **Szaporítási arány** a mintasűrűségből (05 §1): háromszögnél soronként
    `4 · h/w` (élenként `h/w`, a gerincen `2 · h/w`) és `D / (√2 · h)` sor,
    félkörnél `π · h/w`, körnél `2π · h/w`, aszimmetrikus háromszögnél `h/w`,
    félholdnál élenként `2 · h/w`. A saját arány is megadható; az előnézet a
    kapott szöget és méretet mutatja. A tudásbázis „A” példája (pálcás
    háromszög, 45 sor, 360 szem) egyezik.
  - **Páros szimmetria:** a szimmetrikus kendőben a szaporítás párban jön; tört
    aránynál a sorok között elosztva, a +2-es sor felváltva a széleken és a
    gerincen. Pi-kendőnél duplázás a 2., 4., 8. … körben, eltolva a
    `round(2^k · 0,75)`. körben.
  - **Az utolsó sor** (körben az utolsó kör) a szegély „X többszöröse + Y”
    ismétléséhez igazítható, a szimmetrikus kendőben félenként.
  - **Előnézet:** a blokkolt (teli) és a blokkolatlan (szaggatott) körvonal és
    méret. Hogy melyik a mért, azt a profil jelöli; a másikat a megadott
    blokkolási nyúlás adja.
  - **Figyelmeztetés, nem hiba:** ha az arány 15%-nál többel eltér az
    ideálistól (kunkorodás, fodrosodás, mélyebb vagy laposabb háromszög, a
    Pi-kendő duplázás előtti köre).
  - A létrehozás egy lépésben visszavonható, és minden generált kendő
    hibátlanul átmegy az ellenőrzőn.
  - **Íves és megtört sorok a vásznon** (PQW-893): a félkör és a félhold sorai
    íven, a nyakszöget átfogva (félkörnél 180°); a fentről induló háromszög
    sorai a gerincnél megtörve, a két fél a terv szögében (ideális aránynál
    derékszögben). A rajz alulról felfelé halad: a nyak pontja alul. A sor
    menti távolság megmarad, a sor sugara a szélességéből jön, így az alak az
    arányhelyes nézetben és anélkül is a kendőé; a rács sávjai és cellái
    ugyanúgy görbülnek, a célzás rajtuk működik. Az alakot a darab tárolja
    (`Piece.rowShape`); a PQW-893 előtt mentett kendő egyenes sorokkal marad.
- **Ruhadarabok, első rész** (PQW-866): a jobb oldali panel „Ruhadarab” szakasza
  (a Kendő alatt, alapból csukva). Sapka és ledobott vállú pulóver testméretből,
  a választott méret gráfjával és méretsorozattal.
  - **Adatok** (05 §3, §5): a CYC női, férfi, gyerek- és babatáblázata, a
    fejkörfogat és a sapkaméretek forrással. A táblázat gyanús adatait az
    ellenőrzés jelzi: a hüvelyk és a cm eltérése (női 5X felkar), a csökkenő
    érték (férfi 4X karhossz), és három vagy több méreten át azonos két
    különböző méret (női 2X–5X háthossz, keresztháti szélesség, karhossz). A
    felület a méretnél kiírja. Bőségfokozatok a CYC szerint, ruhadarabonként.
  - **Szabásrajzból sorok** (05 §4, §9.5): minden vízszintes méret szem, a
    mintaismétlésre kerekítve a bőség irányába; minden függőleges szakasz
    páros számú sor; a lejtő a „mágikus képlettel”, egyenes véggel. A
    fordulólánc és a láncalap a `tradition.ts` szerint (N szemhez N + T).
  - **Ledobott vállú pulóver:** hátrész és elejerész téglalap, csónaknyakkal (a
    vállvarrás a két szélről a vállak szemét varrja); ujj mandzsettától
    felfelé, a felső él a karöltő kétszerese. A jobb ujj a bal tükörképe. A
    varrások a darabok kapcsolásai: a váll a felső sor szakasza, az oldal és az
    ujj alja a sorvégek, az ujj felső éle a karöltő sorvégeibe egyenletes
    elosztással (`JoinEdge.stitches`, `JoinEdge.rows`). A tudásbázis „B” példája
    egyezik; a formázott nyak fogyasztásait a terv kiszámolja, de a gráf még
    csónaknyakkal készül.
  - **Sapka** (05 §5, §9.7): a körméret a fej és a negatív bőség összege (46 cm
    alatt −2,5, fölötte −5 cm, legfeljebb 10%); a korona lapos kör, a
    körönkénti szaporítás `2π · h/w` körül, az utolsó koronakör igazítja a
    szemszámot; egyenes oldal, az utolsó köreiben a perem. A „D” példa egyezik.
  - **Méretsorozat** (05 §3.8, §9.6): méretenként újraszámolva, fázisonként
    igaz/hamis ellenőrzéssel, a szemszámok a méretek között nem csökkennek. Az
    írott minta a cím után „Méretek” blokkban „S (M, L)” alakban írja a
    számokat, a fonallal méretenként, ha a profilból becsülhető. A sorozat a
    mintával mentődik (`Pattern.garment`).
  - A negatív bőség 10% fölött figyelmeztet, 15% fölött a generátor megtagadja.
    A létrehozás egy lépésben visszavonható, és a generált minta hibátlanul
    átmegy az ellenőrzőn. A rajz az első darabot mutatja, a többi az írott
    mintában áll.
- **Ruhadarabok, második rész** (PQW-901): formázott nyakkivágás, felülről
  horgolt raglán és növedék-kompenzáció; mindegyik a „Ruhadarab” szakaszból.
  - **Elvágott fonal után új szakasz a gráfban** (a `LayerEvent.resume`): a
    munka a megadott sor fölött, más helyről folytatódik. A réteg tudja,
    melyik sorra épül (`Layer.below`) és hányadik sorként íródik ki
    (`Layer.row`), ezért két szakasz sorszáma egyezhet: a nyakkivágás két
    oldalán a két váll egyaránt a megosztás fölött kezdődik. Az írott minta a
    szakaszt „A másik váll (a 44. sor fölött):” fejléccel vezeti be, és ebből
    a visszaolvasó is tudja, hol folytassa; az ellenőrző a másik szakasz
    szemeit nem kéri számon (`resume-layer` szabály).
  - **Formázott nyakkivágás:** a megosztásig egy szakasz, fölötte a két váll,
    a nyak belső élén fogyasztással (elöl az első sorban több szem, utána
    soronként egy; hátul soronként egy). A két váll közti szemek a nyak
    közepén maradnak. A vállvarrás a két szakasz utolsó sorát köti össze. A
    csónaknyak továbbra is választható.
  - **Felülről horgolt raglán:** a nyak láncgyűrűjéből, körönként a négy
    raglánvonal mellett szaporítva; ahol a sarkok szaporítása nem elég az
    elejének és a hátának, ott külön törzsszaporítás jön (a tudásbázis „C”
    példája egységtesztben egyezik). A szétosztásnál hónaljlánc kerül a
    kihagyott ujjszemek helyére, és a lánc a törzsbe és az ujjba is
    beleszámít. A rajz a vállrészt és a törzset tartalmazza; **az ujjak
    számait a terv és az írott minta megadja, de a gráfjuk még nem készül el**.
    A raglán mért körös mintasűrűséget kíván: a becsült sormagasságból kevés
    kör jön ki, és a generátor ezt meg is mondja. A CYC táblázatban a
    karöltőmélység lassabban nő, mint a mellbőség, ezért a 3X fölötti
    méretekhez mélyebb raglán vagy más szabásmód kell; a generátor ezt is
    kiírja, nem tervez rossz darabot.
  - **Növedék-kompenzáció** (05 §7): a mosott, blokkolt, felakasztott
    próbadarab nyúlása százalékban megadható, és a hosszakat ezzel csökkenti.
  - **Javítási javaslat:** a hamis ellenőrzés mellé a panel kiírja, mit
    érdemes állítani.
- **Amigurumi és 3D formák** (PQW-863): a mintatípus-menü „Amigurumi” pontja és
  a jobb oldali panel „Amigurumi” szakasza (a Kör és motívum alatt). Az
  amigurumi fő nézete az írott minta: a típus kiválasztásakor a panel nagyban
  (keskeny ablakban teljes nézetben) nyílik, a rajz kiegészítés.
  - **Formák:** gömb 6n vagy szinuszos körtervvel, félgömb, tojás, henger, kúp
    (tört szaporítással is, pl. 2,5), forgástest soronként megadott profilból,
    és ovális láncalapról (PQW-890, 04 §3.4, §9.4): hossz és szélesség cm-ben;
    L láncszemből az 1. kör 2L + 2 szem, elöl a láncszemekbe, a láncszemek
    másik oldalán vissza (`underside` célpont), utána végenként a lapos érték
    felével szaporít (rövidpálcánál körönként +6), az egyenes oldalak szemszáma
    nem változik. A rajzon a láncalap egyenesen áll, az 1. kör a két oldalán.
    Önállóan (pl. talp) és részként is: varrva, vagy utána folytatólagosan fal.
    Félpálcás és pálcás ovális is (PQW-899): a „Szem” mező választja; a
    kezdőlánc a szem fordulólánca (félpálcánál 2, pálcánál 3 láncszem), számít
    vagy nem a kör szabálya szerint (`tradition.ts`), végenként 4, illetve 6
    szaporítással. Kétráhajtásos pálcával is (PQW-902): 4 láncszemes
    kezdőlánccal, végenként 8 szaporítással. A lapos ovális a figura
    magasságához a kelme vastagságával járul hozzá: két fonalátmérő, a fonal
    átmérője a tűből (02 §1.6, `hook_mm ≈ 1,4 · d_mm` szoros horgolásnál); a
    figura-jegyzet hossz × szélességet ír.
  - **Kézi ovális a szerkesztőben** (PQW-899): az Amigurumi mintatípusban a
    láncalapra horgolt 1. réteg kör, a vezetett kurzor a kezdőlánc utáni
    láncszemre áll. Az első szem után a láncszemek másik oldala is célpont (a
    legtávolabbi láncszem nélkül), a rajzon a láncszem túloldalán; a vezetett
    kurzor és a „Sor kitöltése” a legtávolabbi láncszem után oda fordul. Az
    ovális 1. köre csak a láncalappal együtt másolható, üres mintába.
    A körszám és a szaporítás a rövidpálca körben mért mintasűrűségéből jön;
    profil nélkül a tűből becsülve, és a szakasz ezt ki is írja. A 6 cm-es
    DK-gömb (04 §4.4) mindkét módszerrel egyezik.
  - **Korlátok:** spirál körök varázskörből, egy körben legfeljebb duplázás vagy
    felezés, eltolt szaporítás és fogyasztás (a harmadik egymás fölé kerülést
    elkerülve), láthatatlan fogyasztás, éles törés után hátsó szálas kör.
  - **Részek:** a „Hozzáadás részként” a minta utolsó darabjához kapcsol: varrva
    (új darab, az írott minta „Összeállítás” sorával) vagy folytatólagosan
    (ugyanaz a darab, a rész neve az első köre előtt). Eltérő szemszám hibát ad;
    egyező szemszám vagy egyenletes elosztás átmegy. A mentett kapcsolást az
    ellenőrző is nézi (`join-count`, `join-edge`).
  - **Jelölések az írott mintában:** a biztonsági szem és a tömés kezdete, a zárt
    vég összehúzása. 3 év alatti gyereknek hímzett szem; ha a játék így jelölt,
    de biztonsági szem van benne, figyelmeztetés (`toy-safety-eyes`).
  - **Görbület és méret:** körönként lapos, kunkorodó, henger, fodros vagy fogyó;
    a rész szélessége és magassága, a figura magassága a részekből (varrásnál a
    zárt rész besüllyedésével). A részekből készült darabon a kunkorodás nem
    figyelmeztet.
  - A mentett JSON a részeket (`sections`), a jelöléseket (`marks`), a
    kapcsolást (`joins`) és a játék adatát (`toy`) is rögzíti; a régi mentések
    változatlanul betöltődnek. A rajz több darabnál az első darabot mutatja.
- **Rácsos technikák** (PQW-864): a mintatípus-menü „Filéhorgolás” pontja és a
  jobb oldali panel „Rácsminta” szakasza (a Kendő alatt). Filé, sarokból
  sarokba (C2C), tapestry, graphgan és mozaik (PQW-894) cellánként rajzolva; a
  háttérben mindegyik szemgráf, és ugyanazon az ellenőrzőn megy át.
  - **Rácsszerkesztő:** a cellák a mintasűrűség arányában (filében 3 szem széles
    és egy sor magas cella), ecsettel festve: filében teli, nyitott vagy nincs
    cella, színes rácsban legfeljebb 8 szín. Billentyűzettel (nyilak, szóköz,
    Delete) és egérrel húzva is. A szakasz kiírja, hány sor kell egy négyzet
    alakú motívumhoz a mintasűrűség szerint.
  - **Ismétlő egység** (tulajdonosi kérés): elég az első sorokat teljesen
    megadni, a többinél a sor egy részét. A program felismeri az egységet, vagy
    kézzel megjelölhető; a meg nem adott cellák ebből töltődnek ki a teljes
    rácsra. Az ellenőrző a kiterjesztett mintát nézi, az írott minta ismétlésként
    írja, a rácsszerkesztő és a vászon kiemeli az egységet.
  - **Filé:** N cellás sor 3N + 1 pozíció; a láncalap és a fordulólánc a
    fordulólánc-szabályból (PQW-891): teli kezdésnél 3N + 4 lsz és az első pálca
    az 5. láncszembe, nyitott kezdésnél 3N + 6 és a 9.; a későbbi sorokban
    nyitott kezdésnél „3 lsz, 2 lsz”. Alakítás egész cellánként, a sor mindkét
    végén: a sor elején szaporítás láncos hosszabbítással, fogyasztás
    kúszószemekkel a cellák fölött (PQW-894); a sor végén meghagyott cellák, és
    szaporítás nyitott cellával: 2 lsz és a fordulólánc alatti szembe horgolt
    háromráhajtásos pálca (PQW-894).
  - **C2C:** W × H kép W + H − 1 átlós sor, csempe 3 lsz és 3 erp; a két oldal
    egymástól függetlenül szaporít, majd fogy. Színek csempénként.
  - **Tapestry és graphgan:** cellánként egy rövidpálca, a szem színe a cella
    színe. Az írott minta a színváltást az előző szem utolsó ráhajtásánál írja,
    és soronként (C2C-ben csempénként) felsorolja a színeket. Tapestryben 3-nál
    több vitt szín figyelmeztet (`carried-colors`).
  - **Mozaik** (PQW-894), egy- és kétsoros változatban: soronként egy szín; a más
    színű cella 1 lsz és 1 szem kihagyása, fölötte a sor színével egyező cella
    jelölt, lejjebb horgolt pálca a kihagyott szembe (2 sorral lejjebb
    egyráhajtásos, 3 sorral lejjebb kétráhajtásos). Az ellenőrző több sorral
    lejjebb csak jelölt szemet, csak korábban kihagyott szembe és legfeljebb 3
    sorral lejjebb enged (`spike-depth`, `anchor-layer`). Az írott minta „2
    sorral lejjebb” írja, a diagram és az export pöttyel jelöli a talpát.
  - **Kép betöltése** (PQW-894): PNG, JPEG, GIF vagy WebP a rácsba, csak a
    böngészőben. A szélesség a megadott cellaszám, a magasság a kép és a
    mintasűrűség arányából; filében a sötét rész teli cella, színes rácsban a
    legközelebbi szín, mozaikban horgolhatóvá igazítva.
  - **Az ismétlő egység kerete** a vásznon, az SVG- és a PNG-exportban, C2C-ben
    csempénként (PQW-894).
  - **Fonal színenként** a próbadarabos becslésből, a cellák arányában;
    **tükrözött nézetben** figyelmeztetés feliratos vagy aszimmetrikus
    motívumra. A rácsminta a darabbal mentődik (`grid`, a szem színe `color`),
    és a szakaszba visszatölthető.

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
| `src/core/pattern-title.ts` | **A generált cím** (PQW-896): minden generátor „Minta létrehozása” gombja a forma nevét adja címnek, hacsak a felhasználó nem írt saját címet a „Minta neve” mezőbe. A minta jelöli, hogy a cím generált-e (`titleGenerated`); a régi, jelölés nélküli mentésnél az alapértelmezett cím, a darab neve és a generátor ismert neve számít generáltnak. |
| `src/core/rounds.ts` | **Körök geometriája** (PQW-861): a lapos körhöz és sokszöghöz kellő szaporítás a körös mintasűrűségből, eredettel; a befejezett körök ellenőrzése (növekedés, kunkorodás, fodrosodás, egymás fölé kerülő szaporítás, spirál lépcsője). |
| `src/core/round-generator.ts` | **Kör- és motívumgenerátor** (PQW-861): lapos kör, négyzet, hatszög, nyolcszög, nagymama-négyzet szemgráfként, kezdéssel, körvéggel és színváltással. |
| `src/core/shapes.ts` | **Sík formák generátora** (PQW-862): téglalap, háromszögek, trapéz, rombusz cm-ből vagy az él szögéből, mintaismétlés; az élek egyenletes alakítása élenként legfeljebb 2-vel, láncos hosszabbítás és meghagyott szemek; a terv és a szemgráf. Tiszta függvény. |
| `src/core/shawls.ts` | **Kendőformák** (PQW-865): háromszög, aszimmetrikus háromszög, félhold, félkör, kör, Pi-kendő, eltolt Pi-kendő, stóla; elméleti vagy saját szaporítási arány, páros szimmetria, az utolsó sor igazítása a szegélyhez, blokkolt és blokkolatlan méret, figyelmeztetés az ideálistól való eltérésre; a terv és a szemgráf. Tiszta függvény. |
| `src/core/amigurumi.ts` | **Amigurumi és 3D formák** (PQW-863): a forma körterve a körben mért mintasűrűségből (gömb 6n és szinuszos, félgömb, tojás, henger, kúp, forgástest), a korlátok, egy kör elosztása, a görbület körönként, a méretbecslés és a kapcsolás ellenőrzése. |
| `src/core/amigurumi-generator.ts` | A körtervből szemgráf spirálban, jelölésekkel; új minta egy részből, új rész varrva vagy folytatólagosan. |
| `src/ui/amigurumi-view.ts`, `src/ui/amigurumi-panel.ts` | Az „Amigurumi” szakasz: a mezők a formához, az előnézet, a figura mérete (DOM nélkül), és a bekötése. |
| `src/core/pattern-size.ts` | **A minta mérete és fonala** (PQW-859): a mintával mentett profil a gauge-profil formájában, a méret rétegei a gráfból, fonalbecslés, profilok kezelése, az arányhelyes nézet szárhossza. |
| `src/core/pattern-steps.ts` | **Az írott minta lépéssora** a gráfból (PQW-858), nyelvtől függetlenül: célpont az előző sor pozícióihoz képest, összevonás („5 rp”), legrövidebb ismétlődő egység. Itt dől el, mit tud a szöveg kifejezni. |
| `src/core/pattern-text.ts`, `src/core/hungarian.ts` | Az írott minta szövege magyarul, amerikai és brit jelöléssel; rövidítéslista és jelmagyarázat a használt szemekkel; a magyar ragozás. Minden kiírt kifejezés innen jön. |
| `src/core/pattern-read.ts`, `src/core/canonical.ts` | A saját szöveg visszaolvasása gráffá, a szöveg sorára mutató hibával; két minta összevetése az azonosítóktól függetlenül. |
| `src/core/repeat.ts`, `src/core/stitch-library.ts` | Láncalap és „X többszöröse + Y” számítása; a szemkönyvtár mint azonosító → definíció. |
| `src/ui/palette.ts` | A paletta tartalma a könyvtárból, a választott jelöléssel: csoportcímek, feliratok, gyorsbillentyűk, DOM nélkül. |
| `src/ui/pattern-types.ts` | A bal oldali mintatípus-menü tartalma (PQW-873): a négy típus neve, magyarázata és hogy be van-e kapcsolva; a típushoz tartozó rács (PQW-874) és az írott minta magassága (PQW-863). DOM nélküli. |
| `src/ui/grid-paths.ts` | A rács rajza útvonalakként: ugyanebből rajzol a vászon és az SVG-export. DOM nélküli. |
| `src/ui/notation.ts` | **A jelölés és a jelstílus beállítása** (PQW-868): alapértelmezés a felület nyelvéből, tárolás, a jelrajz beállítása, a minta jelölésének rögzítése. DOM nélküli. |
| `src/ui/i18n.ts`, `src/ui/i18n/*.ts` | **A felület nyelve** (PQW-900): magyar és angol egy szótárból, területenként külön fájlban (jelölés, üzenetek, panelek, szakaszok, ellenőrző szabályai). A nyelv a `?lang` paraméterből vagy a dokumentum `lang` attribútumából jön, és a panel választójával váltható; a választás a lapon belül és a címsorban él, új tárolt kulcs nélkül. A statikus feliratokat a `data-i18n`, `data-i18n-tip` és `data-i18n-label` attribútumok kötik a szótárhoz. A felület nyelve független a jelöléstől: az írott minta és a szemnevek nyelvét továbbra is a jelölés adja. Új nyelv (japán, PQW-877) egy újabb `UiLanguage` érték és a szótárak bővítése. |
| A felület második köre (PQW-912) | A műveleti lenyíló a **gombjához** igazodik és a képernyőn belül marad (`.menu__pop.menu__list`): korábban a jobb szélhez rögzített, fix széles panel a bal oldali Fájl gombnál kilógott a képernyőről, és csak az üres széle látszott. A mintatípus-sáv keskenyebb, a kártyák a saját magasságukon állnak (a lista nem nyúlik), a verziófelirat pedig `margin-block-start: auto`-val ül alul. A sáv a menüsorból csukható és nyitható, az állapota a `dc-mintatervezo:mintatipus` kulcsban marad meg. Az írott minta panel csak a saját gombjára nyílik: a mintatípus megadja a méretarányt (amigurumiban nagyban), de csak akkor, ha a felhasználó nem állított saját magasságot. A hibalista, az írott minta és a szemek kapcsolója a menüsor jobb széléről indul, ikonnal és egyszavas felirattal; a fejlécben csak a Főoldal link és a cím maradt. |
| A felület letisztítása (PQW-911) | Az átvételi teszt nyomán: az írott minta panel csukva indul; a mentés, betöltés és képexport egyetlen lenyíló menübe került (`#file-toggle`, billentyűzettel járható, `Esc`-re csukódik, a fókusz visszatér a gombra); az „utolsó lépés törlése”, a „szaporítás”, a „szegély a darab körül” és a „tükrözött nézet” gombja lekerült a menüsorból (az első kettő művelete `Backspace`, illetve `Shift+Enter` billentyűvel megmaradt); a fordulás ikonja vízszintes, mert a horgolás is úgy halad; minden ikon alá egy szavas felirat került, a mintatípus-kártyák magyarázata pedig tooltipbe. Az egybillentyűs parancsok helyett `Alt`-kombináció szól (a szemválasztó `Alt`+1…9), mert egyetlen karakter nem lehet parancs; a felirata Mac gépen `⌥`, máshol `Alt` (`src/ui/platform.ts`). A `Ctrl`/`Cmd`+C és +V a vásznon másol és illeszt, a szövegmezőkben a böngésző alapértelmezése marad. Az automatikus szegélygenerálás a kódjával együtt kikerült; a `rowEdges` segéd a `graph.ts`-ben maradt, mert a ruhadarabok sorvégi varrása használja. |
| A kétnyelvűség apróságai (PQW-905, PQW-906) | A böngészőfül címe és a `meta description` a szótárból jön (`data-i18n`, `data-i18n-content`), és nyelvváltáskor is frissül. A számformázás a felület nyelvét követi: magyarul tizedesvessző, angolul tizedespont (`formatNumber`). A rács beépített színei nyelvfüggetlen azonosítót visznek a mentett mintába (`PatternColor.id`), a nevet a megjelenítés adja — a felületen a felület nyelvén, az írott mintában a jelölés nyelvén —, a felhasználó saját neve pedig nem fordul; a régi, névvel mentett minták változatlanul betölthetők. A választott nyelv a `dc-mintatervezo:nyelv` kulcsban marad meg: a `?lang` erősebb a tároltnál, a tárolt a dokumentum `lang` attribútumánál. A tárolás működési beállítás, nem követés, ezért a süti-sáv elutasítása mellett is él, és `try/catch`-ben fut, hogy privát ablakban se akadjon meg az indulás. |
| `src/core/messages.ts`, `src/ui/i18n/core/*.ts` | **Kód és adat a mondat helyett** (PQW-904): a mag nem magyar mondatot ad vissza, hanem azonosítót és a behelyettesítendő értékeket (`CoreText { code, data }`), a mondatot a felület állítja össze a területi szótárakból (`render.ts` + területenként egy fájl). A névelő, a ragozás és a sor/kör szava is a felületé, mert azok nyelvfüggők. Így a mag nyelvsemleges marad, és egy újabb nyelv (japán, PQW-877) csak a szótárakat érinti. A `tests/core-i18n.test.mjs` őrzi, hogy minden kódhoz legyen szöveg mindkét nyelven, és hogy a magban ne maradjon magyar mondat. |
| `src/ui/size-view.ts`, `src/ui/size-panel.ts` | **A „Méret és fonal” szakasz** (PQW-859): a kiírás szövegei eredettel és tartománnyal, tűátváltás (DOM nélkül); a profil-szerkesztő és a profilváltás a panelen. |
| `src/ui/written.ts` | **Az írott minta panelje** (PQW-868): a szöveg a jelöléssel, vagy érthető üzenet, ha a minta még nem írható ki. DOM nélküli. |
| `src/ui/rounds-view.ts`, `src/ui/rounds-panel.ts` | **A „Kör és motívum” szakasz** (PQW-861): a választások és a szaporítás magyarázata eredettel (DOM nélkül); a mezők és a minta létrehozása a panelen. |
| `src/ui/shapes-view.ts`, `src/ui/shapes-panel.ts` | **A „Forma” szakasz** (PQW-862): a választások, a mezők a formához, a terv kiírása eredettel és az előnézet körvonala (DOM nélkül); a mezők, az előnézet és a minta létrehozása a panelen. |
| `src/ui/shawls-view.ts`, `src/ui/shawls-panel.ts` | **A „Kendő” szakasz** (PQW-865): a választások, a mezők a kendőhöz, a terv kiírása a szöggel, a blokkolt és blokkolatlan mérettel és a figyelmeztetésekkel, az előnézet két körvonala (DOM nélkül); a mezők és a minta létrehozása a panelen. |
| `src/core/body-sizes.ts` | **Testméretek és bőség** (PQW-866): a CYC női, férfi, gyerek- és babatáblázata, a fejkörfogat és a sapkaméretek forrással; a gyanús adatok ellenőrzése; a bőségfokozatok és a sapka bősége. Függőség nélküli adat és tiszta függvény. |
| `src/core/garment-math.ts` | **A szabásrajz alapjai** (PQW-866): kerekítés a mintaismétlésre a bőség irányába, páros sorszám, a lejtő a „mágikus képlettel”, a változások sorai a másik irányból, egyenletes szaporítás, bal–jobb tükrözés. |
| `src/core/garments.ts`, `src/core/garment-text.ts` | **Ruhadarabok** (PQW-866): a sapka és a ledobott vállú pulóver terve méretenként, a méretek a táblázatból, a méretsorozat ellenőrzései és fonala, a darabok szemgráfja és varrásai; a méretsorozat „S (M, L)” szövege az írott mintába. |
| `src/ui/garment-view.ts`, `src/ui/garment-panel.ts` | **A „Ruhadarab” szakasz** (PQW-866): a választások és alapértékek, a terv, az ellenőrzések, a táblázat gyanús adatai és a sorozat szövege (DOM nélkül); a mezők és a minta létrehozása a panelen. |
| `src/core/pixel-chart.ts` | **A rácsminta** (PQW-864): a cella mérete a mintasűrűségből, arányos sorszám, átméretezés, az ismétlő egység felismerése, ellenőrzése és kiterjesztése, tükrözés, a C2C csempéi soronként, színek soronként, fonal színenként. Függőség nélküli, tiszta függvények. |
| `src/core/filet.ts`, `src/core/c2c.ts`, `src/core/colorwork.ts`, `src/core/mosaic.ts`, `src/core/grid-pattern.ts` | **Rácsos technikák** (PQW-864, PQW-894): a filé (3N + 1 pozíció, teli és nyitott kezdés, alakítás egész cellánként a sor mindkét végén), a C2C (átlós sorok, szaporító és fogyasztó oldal), a tapestry, graphgan (rövidpálcás sorok színnel) és a mozaik (kihagyás és lejjebb horgolt jelölt szem) terve és szemgráfja; a közös gráfíró és a generált minta ellenőrzése. |
| `src/ui/grid-chart-view.ts`, `src/ui/grid-chart-panel.ts` | **A „Rácsminta” szakasz** (PQW-864, PQW-894): ecsetek, cellanevek, az ismétlő egység állapota, a terv és a fonal kiírása, a létrehozás és a visszatöltés, a kép képpontjai cellákká, az egység keretei és a lejjebb horgolt szemek a diagramon és az exportban (DOM nélkül); a bejárható rácsszerkesztő, a színek, a kép betöltése és a minta létrehozása a panelen. |
| `src/core/insertion.ts` | **Beszúrási mód** (PQW-869): a szem megengedett módjai, az érvényes mód, a horgoló felőli és a színoldali mód átváltása, a szemek tárolt módja a rajzhoz. |
| `src/ui/insertion-view.ts`, `src/ui/insertion-panel.ts` | **A „Beszúrás” választó** a Szemek szakaszban (PQW-869): a módok, az érvényes mód és az írott alak (DOM nélkül); a rádiógombok a panelen. |
| `src/core/editor.ts` | **A szerkesztő műveletei** (PQW-857): célpontok, horgolás, „még egy ugyanabba”, fordulás, körzárás, az utolsó lépés törlése, kézi igazítás, élő ellenőrzés. |
| `src/core/selection.ts` | **Kijelölés, törlés, másolás, beillesztés, duplikálás** (PQW-875): egész egységek (csoport, láncív), sor, terület és billentyűzetes lépés; törlés a belé horgolt szemekkel; a másolat célpont-eltolásokkal, a beillesztés újraköt, és hibánál nem változtat. Tiszta függvény. |
| `src/core/grid.ts` | **A rács** (PQW-874): sávok és cellák az igazítás nélküli számolt elrendezésből, sorban és körben; íves és megtört sorban a téglalapok görbült sávok (PQW-893); találat, célzás és az üzenet, ha nincs mibe horgolni. Tiszta függvény. |
| `src/core/row-curve.ts` | **Íves és megtört sorok** (PQW-893): a sorban horgolt kendő (félkör, félhold, fentről induló háromszög) egyenes elrendezésének leképezése a valós alakra, a darab `rowShape` szögeiből; a rács sávjainak görbítése. A `layout.ts` a végén hívja; tiszta függvény. |
| `src/core/layout.ts` | **A számolt elrendezés** (PQW-857): hely, irány, legyező, összefutás, sorszám, színe és visszája, tükrözés. Tiszta függvény. |
| `src/core/history.ts` | Visszavonás és újra. |
| `src/core/stitch-variants.ts` | Az összetett szemek változatai azonosítóból (pl. `inc-3dc`), és a minta könyvtára. |
| `src/core/tradition.ts` | **A fordulólánc és a láncalap szabálya** (PQW-876, PQW-891): sorban a fordulólánc az 1. szem helyett áll, alapláncszemen; körben a kezdőlánc a szemkönyvtár szerint; a japán előbeállítás saját szabálya. A gráf, az ellenőrző, a szerkesztő, a generátorok, az írott minta és a visszaolvasó innen veszi a szabályt. |
| `src/ui/chart-svg.ts` | A diagram SVG-ként jelmagyarázattal; ebből készül az SVG- és a PNG-export. DOM nélküli. |
| `src/ui/chart-labels.ts` | A diagram feliratai hagyományonként (PQW-876): CYC-ben zárójeles szemszám, japánban „18目” és „11目1模様”. A vászon (`board.ts`) és az export (`chart-svg.ts`) ezt írja ki. |
| `src/ui/board.ts` | A vászon: nézet (nagyítás, eltolás), kirajzolás az elrendezésből, célpontok, hibajelölés, találatkeresés. |
| `src/ui/main.ts` | Belépési pont: állapot és visszavonás, ikonos menüsor, mintatípus-menü, szemválasztó panel és hibalista, jelölés és írott minta, billentyűk és egér, mentés, export. |
| `src/ui/styles.css` | A fő oldal design tokenjeinek szűk metszete. Konkrét hexet komponensben ne írj le. |
| `src/ui/consent.ts`, `src/ui/analytics.ts` | **A fő oldal repójából másolva, változtatás nélkül** (csak az import kiterjesztése `.js`). Ha ott változik, itt is kell. |
| `src/ui/consentBanner.ts` | A süti-sáv és a jelkészlet „Süti-beállítások" gombja. |
| `src/config.ts` | A GA4 mérési azonosító (`mintatervező` property). Üres stringre a mérés és a süti-sáv kikapcsol. |
| `public/.htaccess` | Biztonsági fejlécek és cache. A CSP a GA-azonosítóval együtt változik — a `tests/analytics.test.mjs` őrzi. Az `X-Robots-Tag` `noindex`, nofollow nélkül, és nincs robots.txt-tiltás (PQW-853) — a `tests/head.test.mjs` őrzi a forrásban és a buildelt kimenetben is. |
| `public/favicon.ico`, `public/apple-touch-icon.png` | A főoldal ikonjai, saját származásból (PQW-853). A fejben a magyar leírás és a `--c-bg` token színű `theme-color` (`tests/head.test.mjs`). |
| `tests/*.test.mjs` | `node:test` tesztek; a `core-*` a magot, a `ui-*` a jelrajzot, a palettát és az SVG-t, az `analytics` a süti-sávot és a CSP-t, a `hu-vocabulary` a magyar szóhasználatot (szem = stitch) nézi. |
| `tests/fixtures/written/` | Az írott minta rögzített szövege kidolgozott példánként (`hu`, `en-US`); a magyart a tulajdonos hagyja jóvá. |
| `e2e/*.spec.ts`, `playwright.config.ts` | Böngészős tesztek a kritikus utakra: téglalap billentyűzettel, mentés és újratöltés, export, az írott minta panelje jelölésváltással, a japán előbeállítás (`editor.spec.ts`); mintatípus-választás, szemválasztás a panelből, hibaszámláló, alsó írott panel (`felulet.spec.ts`); az elrendezés helyei (`elrendezes.spec.ts`); a panel szakaszai és a tooltipek (`panel.spec.ts`); téglalap cellákra kattintva, a rács kapcsolója és exportja (`racs.spec.ts`); becslés profil nélkül, profil megadása és mentése, arányhelyes nézet (`meret.spec.ts`); kijelölés a sorszámmal, billentyűzettel és területtel, másolás, beillesztés, duplikálás, törlés az érintett szemek megmutatásával, visszavonás (`kijeloles.spec.ts`); hátsó szálas és reliefes sor a beszúrási mód választójával (`beszuras.spec.ts`); téglalap profil nélkül és visszavonás, háromszög az él szögéből (`formak.spec.ts`); fentről induló háromszög-kendő saját aránnyal és figyelmeztetéssel, visszavonás, félkör, a félkör és a háromszög íves, illetve megtört sorokkal a vásznon (`kendok.spec.ts`); sál kezdése 40 láncszemmel, fordulással és rövidpálcás sorokkal, kattintással és billentyűzettel, 1000×506-ban és 1440×900-ban (`kezdes.spec.ts`); a generált cím generátorváltáskor és a kézzel írt cím megmaradása újratöltés után is (`generalt-cim.spec.ts`); felnőtt sapka és ledobott vállú pulóver M méretben, S–L sorozattal, varrásokkal és visszavonással (`ruhadarab.spec.ts`); a felület nyelve a `?lang=en` paraméterrel és a kézi választóval, a jelöléstől függetlenül (`nyelv.spec.ts`). |
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
- **A varrat nyitott része** (PQW-889): két sorokban horgolt darab
  összekapcsolása horgolva (az összevarrás a PQW-866 óta kapcsolásként megvan).
- **PDF-export.**
- **A rácsos technikák nyitott részei** (PQW-894, PQW-902): filében a sor végén
  teli új cella (most nyitott cellával szaporít): ehhez a szemnek az előző szem
  tövén kellene állnia, ilyen célpont a gráfban nincs. Ugyanazon az élen
  fogyasztás után a következő sorban szaporítás sem megy: a hosszú pálca nem
  éri el a két sorral lejjebbi szemet; a program ezt érthető okkal írja le. A
  mozaik írott mintája a színek felsorolása miatt még nem olvasható vissza (a
  lejjebb horgolt szem maga már igen). A vászon cellás rácsán nincs még
  oszlopszámozás.
- **A ruhadarabok nyitott részei** (PQW-866): raglán (a „C” példa), kerek
  betét, bevarrt ujj; formázott nyakkivágás a gráfban (a két váll egy darabon
  belül külön horgolva); bordás szegély és perem; a növedék kompenzálása a
  felakasztott próbadarabból, súly- és esésfigyelmeztetés; a hamis ellenőrzés
  automatikus javítása a fázisok hosszával; babacipő és zokni. A „Szabálytalan
  horgolás” mintatípus a tulajdonos döntéséig „hamarosan” marad.
- **Önhosztolt betűk.** Az Instrument Serif és a Karla fájljai még nincsenek
  itt, ezért rendszerbetűk ugranak be. A Google Fonts CDN-t nem használjuk: az
  EU-ban hozzájárulás nélkül továbbítaná a látogató IP-címét.

## Kapcsolódás a fő oldalhoz

A szerkesztő a `dragonettecrochet.com`-ról nyílik majd, és az
`app.dragonettecrochet.com` aldomainen fut. A kivezető link a fő oldalon a
PQW-835, az aldomain beállítása a PQW-834 ticket.
