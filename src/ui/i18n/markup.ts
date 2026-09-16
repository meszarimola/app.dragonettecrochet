/*
 * Az index.html statikus feliratai (PQW-900).
 *
 * - Lapos kulcs→szöveg szótár: a jelölésben a `data-i18n` (szöveg),
 *   `data-i18n-tip` (saját tooltip) és `data-i18n-label` (`aria-label`)
 *   attribútumok hivatkoznak rá, a behelyettesítést az `applyStaticTexts`
 *   végzi (i18n.ts). Ismeretlen kulcsnál hibát dob, ezért a kulcsnévnek a
 *   HTML-ben és itt pontosan egyeznie kell.
 * - A magyar értékek betűre azonosak a jelölésben álló mai szöveggel: a
 *   behelyettesítés a magyar felületen semmit nem változtat. Aki a HTML-ben
 *   javít egy feliratot, itt is javítsa.
 * - A több elemből álló feliratok (jelölőnégyzet melletti szöveg, link előtti
 *   mondat, billentyűtáblázat) külön `<span>`-ben állnak, mert a `data-i18n`
 *   a teljes `textContent`-et cseréli, és a gyerekelemeket (input, kbd, a)
 *   kitörölné.
 * - A szemnevek és az írott minta nyelve NEM innen jön: azt a minta jelölése
 *   adja (notation.ts, pattern-text.ts), a felület nyelvétől függetlenül.
 *
 * DOM nélküli, ezért a Node is futtatja.
 */

import type { Dictionary } from '../i18n.ts';

export const MARKUP_TEXTS = {
  hu: {
    // A dokumentum feje: a böngészőfül címe és a leírás (PQW-905)
    docTitle: 'Mintatervező — Dragonette Crochet',
    docDescription:
      'A Dragonette Crochet mintatervezője: horgolásminták jeldiagramja szemgráfból, élő ellenőrzéssel, írott mintával és generátorokkal.',

    // Süti-sáv
    consentTitle: 'Mérhetem a látogatást?',
    consentBody:
      'A Google Analytics sütijeivel szeretném látni, hányan járnak az oldalon és a mintatervezőben, és mely oldalakat nézik. Csak ha elfogadod: hirdetésre nem használom, és a döntésed a jelkészlet „Süti-beállítások” gombjával bármikor megváltoztathatod.',
    consentDetails: 'Részletek az adatkezelési tájékoztatóban.',
    consentGranted: 'Jelenleg: a mérést elfogadtad.',
    consentDenied: 'Jelenleg: a mérést elutasítottad.',
    consentAccept: 'Elfogadom',
    consentDecline: 'Elutasítom',
    consentOpen: 'Süti-beállítások',

    // Menüsor
    homeLabel: 'Vissza a dragonettecrochet.com főoldalára',
    homeText: 'Főoldal',
    barTitle: 'Mintatervező',
    errorsRegionLabel: 'Hibák és figyelmeztetések',
    writtenToggle: 'Írott minta',
    panelToggle: 'Szemek és beállítások',

    // Eszközcsoportok
    toolGroupFile: 'Fájl',
    toolGroupEdit: 'Szerkesztés',
    toolGroupRow: 'Sor és kör',
    toolGroupSelect: 'Kijelölés',
    toolGroupView: 'Nézet',

    // Fájl
    toolNewLabel: 'Új minta',
    toolNewTip: 'Új minta',
    toolImportLabel: 'JSON betöltése',
    toolImportTip: 'JSON betöltése',
    toolExportJsonLabel: 'JSON mentése',
    toolExportJsonTip: 'JSON mentése',
    toolExportPngLabel: 'PNG',
    toolExportPngTip: 'PNG-kép mentése',
    toolExportSvgLabel: 'SVG',
    toolExportSvgTip: 'SVG-kép mentése (vektor)',

    // Szerkesztés
    toolUndoLabel: 'Visszavonás',
    toolUndoTip: 'Visszavonás (Ctrl+Z)',
    toolRedoLabel: 'Újra',
    toolRedoTip: 'Újra (Ctrl+Shift+Z)',

    // Sor és kör
    toolFillRowLabel: 'Sor kitöltése',
    toolFillRowTip: 'Sor kitöltése a kiválasztott szemmel (Shift+Alt+F)',

    // A fájlműveletek lenyíló menüje és az ikonok alatti egyszavas feliratok (PQW-911)
    toolFileMenuLabel: 'Fájlműveletek',
    toolFileMenuTip: 'Mentés, betöltés és képexport',
    toolLabelNew: 'Új',
    toolLabelFile: 'Fájl',
    toolLabelUndo: 'Vissza',
    toolLabelRedo: 'Újra',
    toolLabelFillRow: 'Kitöltés',
    toolLabelEndRow: 'Fordulás',
    toolLabelCloseRound: 'Zárás',
    toolLabelSpiral: 'Spirál',
    toolLabelSelectArea: 'Terület',
    toolLabelDeleteSelection: 'Törlés',
    toolLabelDuplicate: 'Duplikálás',
    toolLabelGrid: 'Rács',
    toolLabelZoomOut: 'Kicsinyítés',
    toolLabelZoomIn: 'Nagyítás',
    toolLabelFit: 'Teljes',

    // A panelek kapcsolói a menüsorban (PQW-912)
    toolGroupPanels: 'Nézet és panelek',
    toolGroupViews: 'Panelek',
    toolTypesLabel: 'Mintatípus sáv',
    toolTypesTip: 'A mintatípus sáv nyitása és csukása',
    toolLabelTypes: 'Típusok',
    toolPanelTip: 'A jobb oldali panel nyitása és csukása',
    toolLabelPanel: 'Szemek',
    toolWrittenTip: 'Az írott minta panel nyitása és csukása',
    toolLabelWritten: 'Szöveg',
    toolErrorsTip: 'A hibák és figyelmeztetések listája',
    toolEndRowLabel: 'Sor vége, fordulás',
    toolEndRowTip: 'Sor vége, fordulás (Alt+F)',
    toolCloseRoundLabel: 'Kör zárása',
    toolCloseRoundTip: 'Kör zárása kúszószemmel; láncszemekből láncgyűrű (Alt+K)',
    toolSpiralLabel: 'Kör vége spirálban',
    toolSpiralTip: 'Kör vége spirálban, zárás nélkül (Alt+S)',

    // Kijelölés
    toolSelectAreaLabel: 'Terület kijelölése',
    toolSelectAreaTip:
      'Terület kijelölése húzással. Szem nélkül kattintás: egy szem, Shift: több, sorszám: teljes sor',
    toolDeleteSelectionLabel: 'Kijelölés törlése',
    toolDeleteSelectionTip: 'Kijelölt szemek törlése (Delete)',
    toolDuplicateLabel: 'Kijelölés duplikálása',
    toolDuplicateTip: 'Kijelölés duplikálása, pl. a következő sorba (Ctrl+D)',

    // Nézet
    toolGridLabel: 'Rács',
    toolGridTip: 'Rács ki és be (Alt+R)',
    toolZoomOutLabel: 'Kicsinyítés',
    toolZoomOutTip: 'Kicsinyítés',
    toolZoomInLabel: 'Nagyítás',
    toolZoomInTip: 'Nagyítás',
    toolFitLabel: 'Egész minta',
    toolFitTip: 'Egész minta a képernyőre',

    // Mintatípus-menü és vászon
    typesNavLabel: 'Mintatípus',
    typesTitle: 'Mintatípus',
    typesIntro: 'A típus adja a kezdést és a körzárás alapértelmezését.',
    boardLabel: 'Diagram: nyilakkal a célpontok között, Enterrel horgolsz',

    // Írott minta
    writtenGripLabel: 'Az írott minta magassága',
    writtenTitle: 'Írott minta',
    writtenFullView: 'Teljes nézet',
    writtenCopy: 'Másolás',
    writtenClose: 'Lecsukás',
    writtenTextLabel: 'Az írott minta szövege',
    panelLabel: 'Szemek és beállítások',

    // Szemek
    sectionStitchesTitle: 'Szemek',
    stitchesChainCountLabel: 'Láncszemek száma',
    stitchesInsertionLegend: 'Beszúrás',
    stitchesInsertionNote: 'A horgoló felől értendő; visszai soron a diagram a színoldalt mutatja.',
    stitchesPaletteLabel: 'Szemek',

    // Méret és fonal
    sectionSizeTitle: 'Méret és fonal',
    sizeProfileLabel: 'Profil',
    sizeProfileNote: 'Egy fonal és tű mért mintasűrűsége. A mintával együtt mentődik, a JSON-exportban is.',
    sizeAdd: 'Új profil',
    sizeRemove: 'Profil törlése',
    sizeYarnLegend: 'Fonal',
    sizeYarnNameLabel: 'Név',
    sizeCycLabel: 'Vastagsági kategória (CYC)',
    sizeMeterageLabel: 'Méter 100 g-on',
    sizeBallLabel: 'Egy gombolyag, g',
    sizeHookLegend: 'Tű',
    sizeHookLabel: 'Méret, mm',
    sizeGaugeLegend: 'Mintasűrűség szemenként',
    sizeGaugeNote:
      'A próbadarab közepén 10 cm-en számolt szemek és sorok. Sorokhoz síkban, körökhöz körben mérj.',
    sizeGaugeAdd: 'Szem hozzáadása',
    sizeBlockedLabel: 'Blokkolva mérve',
    sizeSwatchLegend: 'Próbadarab',
    sizeSwatchWidthLabel: 'Szélesség, cm',
    sizeSwatchHeightLabel: 'Magasság, cm',
    sizeSwatchMassLabel: 'Tömeg, g',
    sizeSwatchNote: 'A tömegéből jön a fonalbecslés.',
    sizeFinishedTitle: 'Kész méret',
    sizeRowsLabel: 'Kész méret soronként',
    sizeYarnTitle: 'Fonal',
    sizeAspectLabel: 'Arányhelyes nézet',
    sizeAspectNote:
      'A diagram cellái és a rács a valós szemarányt követik: a profilból, profil nélkül a becslésből.',

    // Forma
    sectionShapeTitle: 'Forma',
    shapeGroupLabel: 'Sík forma létrehozása cm-ből',
    shapeNote:
      'Téglalapot, háromszöget, trapézt vagy rombuszt készít sorokban, a megadott méretből. Az új minta a mostani helyére kerül; visszavonással a korábbi visszajön.',
    shapeKindLabel: 'Forma',
    shapeStitchLabel: 'Szem',
    shapeWidthLabel: 'Szélesség, cm',
    shapeTopLabel: 'Felső él, cm',
    shapeMeasureLabel: 'Magasság vagy az él szöge',
    shapeHeightLabel: 'Magasság, cm',
    shapeAngleLabel: 'Az él szöge a függőlegestől, fok',
    shapeAngleNote: 'Egyenlő szárú háromszögnél a csúcsszög ennek kétszerese.',
    shapeRepeatLabel: 'Mintaismétlés: „X többszöröse + Y”',
    shapeRepeatXLabel: 'X: egy ismétlés szemei',
    shapeRepeatYLabel: 'Y: szélső szemek',
    shapeRoundingLabel: 'Kerekítés',
    shapeRibbingLabel: 'Bordás szegély a felső élen',
    shapeRibbingNote:
      'Váltakozó első és hátsó relief pálca (Eerp, Herp) az utolsó sor szemeinek pálcája köré: a szemszám nem változik. A sor 2 láncszemmel kezdődik, mert láncszem nem állhat relief szem helyett, és a fordulólánc tetejébe sima pálca kerül.',
    shapeRibbingRowsLabel: 'A bordázat sorai',
    shapeRibbingWidthLabel: 'A borda szélessége (1×1, 2×2)',
    shapeCreate: 'Minta létrehozása',

    // Kendő
    sectionShawlTitle: 'Kendő',
    shawlGroupLabel: 'Kendő létrehozása méretből',
    shawlNote:
      'Háromszög-, félhold-, félkör-, kör- vagy Pi-kendőt, illetve stólát készít a megadott méretből, a mintasűrűség szerinti szaporítással. Az új minta a mostani helyére kerül; visszavonással a korábbi visszajön.',
    shawlKindLabel: 'Kendő',
    shawlStitchLabel: 'Szem',
    shawlSizeLabel: 'Mélység a gerincen, cm',
    shawlLengthLabel: 'Hossz, cm',
    shawlRateLabel: 'Szaporítási arány',
    shawlCustomLabel: 'Szaporítás soronként, az egész sorra',
    shawlRateNote:
      'A kiadott horgolt kendők gyakran eltérnek az elméleti aránytól, és a blokkolásra számítanak. A saját arány szögét és méretét az előnézet mutatja.',
    shawlWingsLabel: 'Szárnyakkal: a második felében a széleken dupla szaporítás',
    shawlEdgingLabel: 'Az utolsó sor a szegély ismétléséhez',
    shawlEdgingXLabel: 'X: egy ismétlés szemei',
    shawlEdgingYLabel: 'Y: szélső szemek',
    shawlBlockWidthLabel: 'Blokkolva szélesebb, %',
    shawlBlockHeightLabel: 'Blokkolva hosszabb, %',
    shawlBlockNote:
      'Gyapjú blokkolva kb. 5–10%-kal szélesebb, a pamut alig változik; csipkénél mérd le a próbadarabot blokkolás előtt és után.',
    shawlPreviewNote: 'Teli vonal: blokkolva; szaggatott: blokkolás nélkül.',
    shawlCreate: 'Minta létrehozása',

    // Ruhadarab
    sectionGarmentTitle: 'Ruhadarab',
    garmentGroupLabel: 'Ruhadarab létrehozása testméretből',
    garmentNote:
      'Sapkát vagy ledobott vállú pulóvert készít testméretből, méretsorozattal. A rajz és a sorok a választott méreté, a többi méret számai az írott minta „Méretek” részében állnak. Az új minta a mostani helyére kerül; visszavonással a korábbi visszajön.',
    garmentKindLabel: 'Ruhadarab',
    garmentTableLabel: 'Testméret-táblázat',
    garmentSizeLabel: 'Méret a rajzhoz',
    garmentFromLabel: 'Sorozat első mérete',
    garmentToLabel: 'Sorozat utolsó mérete',
    garmentStitchLabel: 'Szem',
    garmentEaseLabel: 'Bőség a mellbőséghez, cm',
    garmentHemLabel: 'Szegély és mandzsetta, cm',
    garmentBelowLabel: 'Hossz a derék alatt, cm',
    garmentGrowthLabel: 'Növedék a felakasztott próbadarabból, %',
    garmentGrowthNote:
      'A horgolt anyag a súlyától és a mosástól hosszában nő. Mérd meg a mosott, blokkolt és felakasztott próbadarabot: a megadott százalékkal a generátor ennyivel rövidebbre tervezi a hosszakat.',
    garmentNecklineLabel: 'Formázott nyakkivágás: a két váll a nyak két oldalán külön készül',
    garmentRepeatLabel: 'A hátrész és az elejerész szemszáma mintaismétlésre',
    garmentRepeatXLabel: 'X: egy ismétlés szemei',
    garmentRepeatYLabel: 'Y: szélső szemek',
    garmentSeriesNote: 'A méretsorozat, ahogy az írott mintába kerül:',
    garmentRibbingLabel: 'Bordás szegély és mandzsetta',
    garmentRibbingNote:
      'Váltakozó első és hátsó relief pálca (Eerp, Herp) a szegély és a mandzsetta sorain, a szemek pálcája köré: a szemszám nem változik. Az első sor sima marad, mert láncszem köré nem lehet relief szemet horgolni. A nyak bordázata még nincs meg.',
    garmentRibbingRowsLabel: 'A bordázat sorai a szegélyből',
    garmentRibbingWidthLabel: 'A borda szélessége (1×1, 2×2)',
    garmentCreate: 'Minta létrehozása',

    // Rácsminta
    sectionGridTitle: 'Rácsminta',
    gridGroupLabel: 'Rácsminta: filé, C2C, tapestry, graphgan, mozaik',
    gridNote:
      'Filé, sarokból sarokba (C2C), tapestry, graphgan vagy mozaik cellánként. Elég az első 4–5 sort teljesen megadni, a többinél a sor egy részét: a program felismeri az ismétlő egységet, és kiterjeszti a teljes rácsra. Az új minta a mostani helyére kerül; visszavonással a korábbi visszajön.',
    gridTechniqueLabel: 'Technika',
    gridMosaicLabel: 'Mozaik',
    gridWidthLabel: 'Szélesség, cella',
    gridHeightLabel: 'Magasság, sor',
    gridImageLabel: 'Kép betöltése a rácsba',
    gridImageNote:
      'A kép a böngészőben marad, nem töltődik fel. A rács szélessége a megadott cellaszám, a magassága a kép és a mintasűrűség arányából jön; filében a sötét rész teli cella, színes rácsban a legközelebbi szín.',
    gridColorsLegend: 'Színek',
    gridColorAdd: 'Szín hozzáadása',
    gridBoardLabel: 'Rácsszerkesztő',
    gridHelp:
      'Nyilakkal lépsz a cellák között, szóközzel vagy Enterrel festesz a választott ecsettel, Delete-tel törlöd a cellát. Egérrel húzva több cellát festhetsz.',
    gridUnitManualLabel: 'Az ismétlő egységet kézzel jelölöm meg',
    gridUnitXLabel: 'Első cella, balról',
    gridUnitYLabel: 'Első sor, alulról',
    gridUnitWidthLabel: 'Az egység szélessége, cella',
    gridUnitHeightLabel: 'Az egység magassága, sor',
    gridFill: 'Kitöltés az ismétlő egységből',
    gridLetteringLabel: 'Feliratos motívum: tükrözött nézetben figyelmeztet',
    gridYarnLabel: 'Fonal',
    gridCreate: 'Minta létrehozása',
    gridLoad: 'Rács a mostani mintából',

    // Kör és motívum
    sectionRoundsTitle: 'Kör és motívum',
    roundsGroupLabel: 'Kör és motívum létrehozása',
    roundsNote:
      'Lapos kört, sokszöget vagy nagymama-négyzetet készít körönként. Az új minta a mostani helyére kerül; visszavonással a korábbi visszajön.',
    roundsShapeLabel: 'Forma',
    roundsStitchLabel: 'Szem',
    roundsStartLabel: 'Kezdés',
    roundsCountLabel: 'Körök száma',
    roundsClosingLabel: 'Kör vége',
    roundsClosingNote: 'Amigurumiban spirál, minden más körben haladó munkában zárt kör.',
    roundsStaggerLabel: 'Eltolt szaporítás (kerekebb kör)',
    roundsColorsLabel: 'Színváltás minden hányadik kör után (0: nincs)',
    roundsJogLabel: 'Lépcsőjavítás spirálban',
    roundsRibbingLabel: 'Bordás perem a kör végén',
    roundsRibbingNote:
      'Váltakozó első és hátsó relief pálca (Eerp, Herp) az utolsó kör szemeinek pálcája köré: a szemszám nem változik. Csak kúszószemes zárásnál, és ha a szemszám a borda kétszeresével osztható.',
    roundsRibbingRowsLabel: 'A bordázat körei',
    roundsRibbingWidthLabel: 'A borda szélessége (1×1, 2×2)',
    roundsCreate: 'Minta létrehozása',

    // Amigurumi
    sectionAmigurumiTitle: 'Amigurumi',
    amigurumiGroupLabel: 'Amigurumi rész létrehozása',
    amigurumiNote:
      'Gömböt, hengert, kúpot és más térbeli formát készít spirálban, a körben mért mintasűrűségből. Több rész egy mintába kerülhet, varrva vagy folytatólagosan; az írott minta jelöli a szemet és a tömést.',
    amigurumiNameLabel: 'A rész neve',
    amigurumiShapeLabel: 'Forma',
    amigurumiMethodLabel: 'A gömb körterve',
    amigurumiDiameterLabel: 'Átmérő (cm)',
    amigurumiHeightLabel: 'Magasság (cm)',
    amigurumiLengthLabel: 'Hossz (cm)',
    amigurumiWidthLabel: 'Szélesség (cm)',
    amigurumiStitchLabel: 'Szem',
    amigurumiIncreasesLabel: 'Szaporítás körönként (tört is, pl. 2,5; üresen a magasságból)',
    amigurumiProfileLabel: 'Profil: soronként sugár és magasság cm-ben',
    amigurumiProfileNote: 'A kezdéstől a végig, pl. „2,5 4”: 2,5 cm sugár 4 cm magasan. A 0 sugarú vég zárt.',
    amigurumiBottomLabel: 'Kezdés',
    amigurumiTopLabel: 'Vége',
    amigurumiStaggerLabel: 'Eltolt szaporítás és fogyasztás',
    amigurumiEyesLabel: 'Ide kerül a figura szeme (biztonsági vagy hímzett)',
    amigurumiUnder3Label: '3 év alatti gyereknek készül',
    amigurumiCreate: 'Új minta ebből',
    amigurumiJoinLegend: 'Hozzáadás a mintához',
    amigurumiJoinLabel: 'Kapcsolás az előző részhez',
    amigurumiDistributeLabel: 'Eltérő szemszámnál egyenletes elosztás',
    amigurumiAdd: 'Hozzáadás részként',

    // Jelölés és jelek
    sectionNotationTitle: 'Jelölés és jelek',
    notationGroupLabel: 'Jelölés és jelek',
    uiLanguageLabel: 'A felület nyelve',
    uiLanguageNote:
      'A felület nyelve független a jelöléstől: angol felületen is dolgozhatsz magyar jelöléssel. A választás a címsorba is bekerül (?lang), így a link megosztható és újratölthető.',
    traditionLabel: 'Előbeállítás',
    traditionCyc: 'Nemzetközi (CYC)',
    traditionJapanese: 'Japán',
    traditionNote:
      'A mintához tartozik. A japán: JIS jelek, × rövidpálca, a fordulólánc a félpálcától felfelé szemnek számít, a félpálca a 4., a pálca az 5. láncszemtől indul.',
    termsLabel: 'Jelölés',
    termsHu: 'Magyar',
    termsEnUs: 'Amerikai angol (US terms)',
    termsEnGb: 'Brit angol (UK terms)',
    chartStyleLabel: 'Jelstílus',
    chartStyleCyc: 'CYC (Craft Yarn Council)',
    chartStyleJis: 'Japán (JIS)',
    scMarkLegend: 'A rövidpálca jele',
    scMarkPlus: '+ (álló kereszt)',
    scMarkCross: '× (ferde kereszt)',
    scMarkJisNote: 'A japán jelstílusban a rövidpálca jele ×.',
    notationNote:
      'A jelölés és a jelstílus a felület nyelvétől független, és a minta adatán nem változtat: a paletta, a vászon, az írott minta és az export is ezt követi.',

    // Minta
    sectionPatternTitle: 'Minta',
    patternNameLabel: 'Minta neve',
    patternAutosaveNote: 'A minta automatikusan mentődik ebbe a böngészőbe.',
    patternExportGridLabel: 'Rács a PNG- és SVG-exportban',

    // Billentyűk
    keysSummary: 'Billentyűk',
    keysPick: 'szem kiválasztása',
    keysTarget: 'célpont a vásznon',
    keysEnter: 'horgolás a célpontba, láncszemnél a megadott számú láncszem',
    keysSame: 'még egy ugyanabba (szaporítás)',
    keysFillRow: 'a sor kitöltése a kiválasztott szemmel',
    keysRowRound: 'sor vége és fordulás / kör zárása, láncszemekből láncgyűrű / kör vége spirálban',
    keysDelete: 'a kijelölt szemek törlése, kijelölés nélkül az utolsó lépésé',
    keysClickPrefix: 'Kattintás, ',
    keysClickSuffix: '+kattintás, sorszám',
    keysClickHint: 'szem nélkül: egy szem, több szem, a teljes sor kijelölése',
    keysArrowsPrefix: 'Nyilak, ',
    keysArrowsHintPrefix: 'szem nélkül: kijelölés a szemek között, ',
    keysArrowsHintSuffix: '-tel tartomány',
    keysSelectAll: 'minden szem kijelölése',
    keysCopyPaste: 'másolás / beillesztés a kurzortól; a teljes sor új sorként kerül be',
    keysDuplicate: 'a kijelölés duplikálása, pl. a következő sorba',
    keysUndoRedo: 'visszavonás, újra',
    keysGrid: 'rács ki és be',
    keysEsc: 'nincs kiválasztott szem: kattintással a jel kijelölése és igazítása',
    keysNudgeSuffix: '+nyilak',
    keysNudge: 'a kijelölt jel eltolása',

    // Kijelölt jel igazítása
    adjustTitle: 'Kijelölt jel igazítása',
    adjustGroupLabel: 'Eltolás',
    adjustUp: 'Fel',
    adjustLeft: 'Balra',
    adjustRight: 'Jobbra',
    adjustDown: 'Le',
    adjustUnpin: 'Számolt helyre',
  },
  en: {
    // The document head: browser tab title and description (PQW-905)
    docTitle: 'Pattern designer — Dragonette Crochet',
    docDescription:
      'The Dragonette Crochet pattern designer: crochet symbol charts from a stitch graph, with live checking, written patterns and generators.',

    // Cookie banner
    consentTitle: 'May I measure visits?',
    consentBody:
      'With Google Analytics cookies I would like to see how many people visit the site and the pattern designer, and which pages they look at. Only if you accept: I do not use it for advertising, and you can change your decision any time with the “Cookie settings” button in the stitch palette.',
    consentDetails: 'Details in the privacy notice.',
    consentGranted: 'Currently: you accepted measurement.',
    consentDenied: 'Currently: you declined measurement.',
    consentAccept: 'Accept',
    consentDecline: 'Decline',
    consentOpen: 'Cookie settings',

    // Toolbar
    homeLabel: 'Back to the dragonettecrochet.com home page',
    homeText: 'Home',
    barTitle: 'Pattern designer',
    errorsRegionLabel: 'Errors and warnings',
    writtenToggle: 'Written pattern',
    panelToggle: 'Stitches and settings',

    // Tool groups
    toolGroupFile: 'File',
    toolGroupEdit: 'Edit',
    toolGroupRow: 'Row and round',
    toolGroupSelect: 'Selection',
    toolGroupView: 'View',

    // File
    toolNewLabel: 'New pattern',
    toolNewTip: 'New pattern',
    toolImportLabel: 'Open JSON',
    toolImportTip: 'Open JSON',
    toolExportJsonLabel: 'Save JSON',
    toolExportJsonTip: 'Save JSON',
    toolExportPngLabel: 'PNG',
    toolExportPngTip: 'Save PNG image',
    toolExportSvgLabel: 'SVG',
    toolExportSvgTip: 'Save SVG image (vector)',

    // Edit
    toolUndoLabel: 'Undo',
    toolUndoTip: 'Undo (Ctrl+Z)',
    toolRedoLabel: 'Redo',
    toolRedoTip: 'Redo (Ctrl+Shift+Z)',

    // Row and round
    toolFillRowLabel: 'Fill row',
    toolFillRowTip: 'Fill the row with the selected stitch (Shift+Alt+F)',

    // The file menu and the one-word labels under the icons (PQW-911)
    toolFileMenuLabel: 'File actions',
    toolFileMenuTip: 'Save, load and image export',
    toolLabelNew: 'New',
    toolLabelFile: 'File',
    toolLabelUndo: 'Undo',
    toolLabelRedo: 'Redo',
    toolLabelFillRow: 'Fill',
    toolLabelEndRow: 'Turn',
    toolLabelCloseRound: 'Join',
    toolLabelSpiral: 'Spiral',
    toolLabelSelectArea: 'Area',
    toolLabelDeleteSelection: 'Delete',
    toolLabelDuplicate: 'Duplicate',
    toolLabelGrid: 'Grid',
    toolLabelZoomOut: 'Smaller',
    toolLabelZoomIn: 'Larger',
    toolLabelFit: 'Fit',

    // The panel toggles in the toolbar (PQW-912)
    toolGroupPanels: 'View and panels',
    toolGroupViews: 'Panels',
    toolTypesLabel: 'Pattern type sidebar',
    toolTypesTip: 'Open and close the pattern type sidebar',
    toolLabelTypes: 'Types',
    toolPanelTip: 'Open and close the right-hand panel',
    toolLabelPanel: 'Stitches',
    toolWrittenTip: 'Open and close the written pattern panel',
    toolLabelWritten: 'Text',
    toolErrorsTip: 'The list of errors and warnings',
    toolEndRowLabel: 'End of row, turn',
    toolEndRowTip: 'End of row, turn (Alt+F)',
    toolCloseRoundLabel: 'Close round',
    toolCloseRoundTip: 'Close the round with a slip stitch; a chain ring from chains (Alt+K)',
    toolSpiralLabel: 'End round in a spiral',
    toolSpiralTip: 'End of round in a spiral, without joining (Alt+S)',

    // Selection
    toolSelectAreaLabel: 'Select area',
    toolSelectAreaTip:
      'Select an area by dragging. With no stitch chosen, click: one stitch, Shift: several, row number: the whole row',
    toolDeleteSelectionLabel: 'Delete selection',
    toolDeleteSelectionTip: 'Delete the selected stitches (Delete)',
    toolDuplicateLabel: 'Duplicate selection',
    toolDuplicateTip: 'Duplicate the selection, e.g. into the next row (Ctrl+D)',

    // View
    toolGridLabel: 'Grid',
    toolGridTip: 'Grid on and off (Alt+R)',
    toolZoomOutLabel: 'Zoom out',
    toolZoomOutTip: 'Zoom out',
    toolZoomInLabel: 'Zoom in',
    toolZoomInTip: 'Zoom in',
    toolFitLabel: 'Whole pattern',
    toolFitTip: 'Fit the whole pattern to the screen',

    // Pattern types and canvas
    typesNavLabel: 'Pattern type',
    typesTitle: 'Pattern type',
    typesIntro: 'The type sets the start and the default for closing rounds.',
    boardLabel: 'Chart: move between targets with the arrow keys, crochet with Enter',

    // Written pattern
    writtenGripLabel: 'Height of the written pattern',
    writtenTitle: 'Written pattern',
    writtenFullView: 'Full view',
    writtenCopy: 'Copy',
    writtenClose: 'Collapse',
    writtenTextLabel: 'Text of the written pattern',
    panelLabel: 'Stitches and settings',

    // Stitches
    sectionStitchesTitle: 'Stitches',
    stitchesChainCountLabel: 'Number of chains',
    stitchesInsertionLegend: 'Insertion',
    stitchesInsertionNote:
      'Seen from the crocheter; on a wrong-side row the chart shows the right side.',
    stitchesPaletteLabel: 'Stitches',

    // Size and yarn
    sectionSizeTitle: 'Size and yarn',
    sizeProfileLabel: 'Profile',
    sizeProfileNote:
      'The measured gauge of one yarn and hook. It is saved with the pattern, and in the JSON export too.',
    sizeAdd: 'New profile',
    sizeRemove: 'Delete profile',
    sizeYarnLegend: 'Yarn',
    sizeYarnNameLabel: 'Name',
    sizeCycLabel: 'Weight category (CYC)',
    sizeMeterageLabel: 'Metres per 100 g',
    sizeBallLabel: 'One ball, g',
    sizeHookLegend: 'Hook',
    sizeHookLabel: 'Size, mm',
    sizeGaugeLegend: 'Gauge per stitch',
    sizeGaugeNote:
      'Stitches and rows counted over 10 cm in the middle of the swatch. Measure rows flat and rounds in the round.',
    sizeGaugeAdd: 'Add stitch',
    sizeBlockedLabel: 'Measured blocked',
    sizeSwatchLegend: 'Swatch',
    sizeSwatchWidthLabel: 'Width, cm',
    sizeSwatchHeightLabel: 'Height, cm',
    sizeSwatchMassLabel: 'Weight, g',
    sizeSwatchNote: 'The yarn estimate comes from its weight.',
    sizeFinishedTitle: 'Finished size',
    sizeRowsLabel: 'Finished size row by row',
    sizeYarnTitle: 'Yarn',
    sizeAspectLabel: 'True proportions',
    sizeAspectNote:
      'The chart cells and the grid follow the real stitch proportions: from the profile, or without one from the estimate.',

    // Shape
    sectionShapeTitle: 'Shape',
    shapeGroupLabel: 'Create a flat shape from cm',
    shapeNote:
      'Makes a rectangle, triangle, trapezoid or rhombus in rows, from the size you give. The new pattern replaces the current one; undo brings the previous one back.',
    shapeKindLabel: 'Shape',
    shapeStitchLabel: 'Stitch',
    shapeWidthLabel: 'Width, cm',
    shapeTopLabel: 'Top edge, cm',
    shapeMeasureLabel: 'Height or the angle of the edge',
    shapeHeightLabel: 'Height, cm',
    shapeAngleLabel: 'Angle of the edge from the vertical, degrees',
    shapeAngleNote: 'On an isosceles triangle the apex angle is twice this.',
    shapeRepeatLabel: 'Stitch repeat: “a multiple of X plus Y”',
    shapeRepeatXLabel: 'X: stitches in one repeat',
    shapeRepeatYLabel: 'Y: edge stitches',
    shapeRoundingLabel: 'Rounding',
    shapeRibbingLabel: 'Ribbed edging along the top edge',
    shapeRibbingNote:
      'Alternating front and back post stitches (FPdc, BPdc) around the posts of the last row: the stitch count stays the same. The row starts with ch 2, because a chain cannot stand in for a post stitch, and a plain stitch goes into the top of the turning chain.',
    shapeRibbingRowsLabel: 'Ribbing rows',
    shapeRibbingWidthLabel: 'Rib width (1×1, 2×2)',
    shapeCreate: 'Create pattern',

    // Shawl
    sectionShawlTitle: 'Shawl',
    shawlGroupLabel: 'Create a shawl from measurements',
    shawlNote:
      'Makes a triangle, crescent, semicircle, circle or Pi shawl, or a stole, from the size you give, with increases to match the gauge. The new pattern replaces the current one; undo brings the previous one back.',
    shawlKindLabel: 'Shawl',
    shawlStitchLabel: 'Stitch',
    shawlSizeLabel: 'Depth at the spine, cm',
    shawlLengthLabel: 'Length, cm',
    shawlRateLabel: 'Increase rate',
    shawlCustomLabel: 'Increases per row, across the whole row',
    shawlRateNote:
      'Published crochet shawls often differ from the theoretical rate, and count on blocking. The preview shows the angle and size of your own rate.',
    shawlWingsLabel: 'With wings: double increases at the edges in the second half',
    shawlEdgingLabel: 'Last row to match the edging repeat',
    shawlEdgingXLabel: 'X: stitches in one repeat',
    shawlEdgingYLabel: 'Y: edge stitches',
    shawlBlockWidthLabel: 'Wider blocked, %',
    shawlBlockHeightLabel: 'Longer blocked, %',
    shawlBlockNote:
      'Blocked wool grows about 5–10% wider, cotton hardly changes; for lace, measure the swatch before and after blocking.',
    shawlPreviewNote: 'Solid line: blocked; dashed: unblocked.',
    shawlCreate: 'Create pattern',

    // Garment
    sectionGarmentTitle: 'Garment',
    garmentGroupLabel: 'Create a garment from body measurements',
    garmentNote:
      'Makes a hat or a drop-shoulder sweater from body measurements, with a size range. The schematic and the rows follow the chosen size; the numbers for the other sizes are in the “Sizes” part of the written pattern. The new pattern replaces the current one; undo brings the previous one back.',
    garmentKindLabel: 'Garment',
    garmentTableLabel: 'Body measurement table',
    garmentSizeLabel: 'Size for the schematic',
    garmentFromLabel: 'First size in the range',
    garmentToLabel: 'Last size in the range',
    garmentStitchLabel: 'Stitch',
    garmentEaseLabel: 'Ease at the bust, cm',
    garmentHemLabel: 'Hem and cuff, cm',
    garmentBelowLabel: 'Length below the waist, cm',
    garmentGrowthLabel: 'Growth from the hung swatch, %',
    garmentGrowthNote:
      'Crochet fabric grows lengthways from its own weight and from washing. Measure a washed, blocked and hung swatch: with the given percentage the generator plans the lengths that much shorter.',
    garmentNecklineLabel: 'Shaped neckline: the two shoulders are worked separately on each side of the neck',
    garmentRepeatLabel: 'Stitch count of the back and front on a pattern repeat',
    garmentRepeatXLabel: 'X: stitches in one repeat',
    garmentRepeatYLabel: 'Y: edge stitches',
    garmentSeriesNote: 'The size range as it goes into the written pattern:',
    garmentRibbingLabel: 'Ribbed hem and cuff',
    garmentRibbingNote:
      'Alternating front and back post stitches (FPdc, BPdc) on the rows of the hem and the cuff, around the posts of the stitches: the stitch count stays the same. The first row stays plain, because a post stitch cannot wrap a chain. A ribbed neckband is not available yet.',
    garmentRibbingRowsLabel: 'Ribbing rows from the hem',
    garmentRibbingWidthLabel: 'Rib width (1×1, 2×2)',
    garmentCreate: 'Create pattern',

    // Grid chart
    sectionGridTitle: 'Grid chart',
    gridGroupLabel: 'Grid chart: filet, C2C, tapestry, graphgan, mosaic',
    gridNote:
      'Filet, corner-to-corner (C2C), tapestry, graphgan or mosaic cell by cell. It is enough to fill in the first 4–5 rows completely and only part of the later rows: the program recognises the repeating unit and extends it over the whole grid. The new pattern replaces the current one; undo brings the previous one back.',
    gridTechniqueLabel: 'Technique',
    gridMosaicLabel: 'Mosaic',
    gridWidthLabel: 'Width, cells',
    gridHeightLabel: 'Height, rows',
    gridImageLabel: 'Load an image into the grid',
    gridImageNote:
      'The image stays in the browser, it is not uploaded. The width of the grid is the cell count you give, the height comes from the ratio of the image and the gauge; in filet a dark area is a filled cell, in a colour grid the nearest colour.',
    gridColorsLegend: 'Colours',
    gridColorAdd: 'Add colour',
    gridBoardLabel: 'Grid editor',
    gridHelp:
      'Move between cells with the arrow keys, paint with the chosen brush using Space or Enter, and clear a cell with Delete. Drag with the mouse to paint several cells.',
    gridUnitManualLabel: 'I mark the repeating unit by hand',
    gridUnitXLabel: 'First cell, from the left',
    gridUnitYLabel: 'First row, from the bottom',
    gridUnitWidthLabel: 'Width of the unit, cells',
    gridUnitHeightLabel: 'Height of the unit, rows',
    gridFill: 'Fill from the repeating unit',
    gridLetteringLabel: 'Lettered motif: warn in mirrored view',
    gridYarnLabel: 'Yarn',
    gridCreate: 'Create pattern',
    gridLoad: 'Grid from the current pattern',

    // Rounds and motifs
    sectionRoundsTitle: 'Round and motif',
    roundsGroupLabel: 'Create a round or motif',
    roundsNote:
      'Makes a flat circle, a polygon or a granny square round by round. The new pattern replaces the current one; undo brings the previous one back.',
    roundsShapeLabel: 'Shape',
    roundsStitchLabel: 'Stitch',
    roundsStartLabel: 'Start',
    roundsCountLabel: 'Number of rounds',
    roundsClosingLabel: 'End of round',
    roundsClosingNote: 'A spiral in amigurumi, a joined round in all other work in the round.',
    roundsStaggerLabel: 'Staggered increases (rounder circle)',
    roundsColorsLabel: 'Change colour after every nth round (0: never)',
    roundsJogLabel: 'Jogless join in a spiral',
    roundsRibbingLabel: 'Ribbed brim after the last round',
    roundsRibbingNote:
      'Alternating front and back post stitches (FPdc, BPdc) around the posts of the last round: the stitch count stays the same. Only with a slip-stitch join, and only if the stitch count is divisible by twice the rib width.',
    roundsRibbingRowsLabel: 'Ribbing rounds',
    roundsRibbingWidthLabel: 'Rib width (1×1, 2×2)',
    roundsCreate: 'Create pattern',

    // Amigurumi
    sectionAmigurumiTitle: 'Amigurumi',
    amigurumiGroupLabel: 'Create an amigurumi piece',
    amigurumiNote:
      'Makes a sphere, cylinder, cone and other three-dimensional shapes in a spiral, from the gauge measured in the round. Several pieces can go into one pattern, sewn or worked on; the written pattern notes the stitch and the stuffing.',
    amigurumiNameLabel: 'Name of the piece',
    amigurumiShapeLabel: 'Shape',
    amigurumiMethodLabel: 'Round plan of the sphere',
    amigurumiDiameterLabel: 'Diameter (cm)',
    amigurumiHeightLabel: 'Height (cm)',
    amigurumiLengthLabel: 'Length (cm)',
    amigurumiWidthLabel: 'Width (cm)',
    amigurumiStitchLabel: 'Stitch',
    amigurumiIncreasesLabel: 'Increases per round (fractions too, e.g. 2.5; empty: from the height)',
    amigurumiProfileLabel: 'Profile: radius and height in cm, one row each',
    amigurumiProfileNote:
      'From the start to the end, e.g. “2.5 4”: a radius of 2.5 cm at a height of 4 cm. An end with a radius of 0 is closed.',
    amigurumiBottomLabel: 'Start',
    amigurumiTopLabel: 'End',
    amigurumiStaggerLabel: 'Staggered increases and decreases',
    amigurumiEyesLabel: 'The eyes of the figure go here (safety or embroidered)',
    amigurumiUnder3Label: 'Made for a child under 3',
    amigurumiCreate: 'New pattern from this',
    amigurumiJoinLegend: 'Add to the pattern',
    amigurumiJoinLabel: 'Join to the previous piece',
    amigurumiDistributeLabel: 'Distribute evenly when the stitch counts differ',
    amigurumiAdd: 'Add as a piece',

    // Notation and symbols
    sectionNotationTitle: 'Notation and symbols',
    notationGroupLabel: 'Notation and symbols',
    uiLanguageLabel: 'Interface language',
    uiLanguageNote:
      'The language of the interface is independent of the notation: you can work with Hungarian notation on an English interface. The choice also goes into the address bar (?lang), so the link can be shared and reloaded.',
    traditionLabel: 'Preset',
    traditionCyc: 'International (CYC)',
    traditionJapanese: 'Japanese',
    traditionNote:
      'It belongs to the pattern. The Japanese one: JIS symbols, × for single crochet, the turning chain counts as a stitch from half double crochet upwards, half double crochet starts in the 4th and double crochet in the 5th chain.',
    termsLabel: 'Notation',
    termsHu: 'Hungarian',
    termsEnUs: 'American English (US terms)',
    termsEnGb: 'British English (UK terms)',
    chartStyleLabel: 'Symbol style',
    chartStyleCyc: 'CYC (Craft Yarn Council)',
    chartStyleJis: 'Japanese (JIS)',
    scMarkLegend: 'The symbol for single crochet',
    scMarkPlus: '+ (upright cross)',
    scMarkCross: '× (diagonal cross)',
    scMarkJisNote: 'In the Japanese symbol style the single crochet symbol is ×.',
    notationNote:
      'The notation and the symbol style are independent of the interface language, and do not change the pattern data: the palette, the canvas, the written pattern and the export all follow them.',

    // Pattern
    sectionPatternTitle: 'Pattern',
    patternNameLabel: 'Pattern name',
    patternAutosaveNote: 'The pattern is saved automatically in this browser.',
    patternExportGridLabel: 'Grid in the PNG and SVG export',

    // Keys
    keysSummary: 'Keys',
    keysPick: 'choose a stitch',
    keysTarget: 'target on the canvas',
    keysEnter: 'crochet into the target; for a chain, the given number of chains',
    keysSame: 'another in the same stitch (increase)',
    keysFillRow: 'fill the row with the selected stitch',
    keysRowRound: 'end of row and turn / close the round, a chain ring from chains / end of round in a spiral',
    keysDelete: 'delete the selected stitches, or the last step with nothing selected',
    keysClickPrefix: 'Click, ',
    keysClickSuffix: '+click, row number',
    keysClickHint: 'with no stitch chosen: select one stitch, several stitches or the whole row',
    keysArrowsPrefix: 'Arrows, ',
    keysArrowsHintPrefix: 'with no stitch chosen: move the selection between stitches, ',
    keysArrowsHintSuffix: ' for a range',
    keysSelectAll: 'select every stitch',
    keysCopyPaste: 'copy / paste from the cursor; a whole row comes in as a new row',
    keysDuplicate: 'duplicate the selection, e.g. into the next row',
    keysUndoRedo: 'undo, redo',
    keysGrid: 'grid on and off',
    keysEsc: 'with no stitch chosen: select and nudge a symbol by clicking',
    keysNudgeSuffix: '+arrows',
    keysNudge: 'nudge the selected symbol',

    // Nudging the selected symbol
    adjustTitle: 'Nudge the selected symbol',
    adjustGroupLabel: 'Nudge',
    adjustUp: 'Up',
    adjustLeft: 'Left',
    adjustRight: 'Right',
    adjustDown: 'Down',
    adjustUnpin: 'Back to the computed place',
  },
} satisfies Dictionary<Record<string, string>>;
