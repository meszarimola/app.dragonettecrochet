/*
 * A szem és a szemgráf felülete.
 *
 * Erre épül a szemkönyvtár (PQW-867) és a szemgráf az ellenőrzővel
 * (PQW-856). A fájlban csak típus van, futásidejű kód nincs.
 *
 * Alapelvek (tudásbázis: README §1–2, 06 §5.1):
 * - A minta szemgráf: minden szem tudja, melyik után következik, és mibe
 *   horgolták. A sor, a kör, a szemszám, a színe/visszája, a jel helye és az
 *   írott minta ebből számolódik, ezért nincs eltárolva.
 * - A topológia független a gauge-től, ezért itt nincs milliméter. A valós
 *   méret a gauge-profilból jön (PQW-859).
 * - Minden adat sima JSON (nincs Map, Date vagy osztály), így a minta
 *   verziózott JSON-ként menthető és betölthető.
 *
 * A hivatkozások a docs/knowledge-base/ jelentéseire mutatnak, pl. `01 §8.3`;
 * a „szókészlet” a jóváhagyott docs/stitch-vocabulary-proposal.md döntéseire
 * (D1–D8, K1–K3).
 */

/* ---- Közös ---- */

/** Kimeneti és értelmezési nyelv. A brit név az amerikaihoz képest egy fokkal eltolt (01 §8.5). */
export type Locale = 'hu' | 'en-US' | 'en-GB';

/** Honnan származik egy mérhető érték (README §2, „Calibration”). */
export type ValueSource = 'measured' | 'label' | 'estimated';

export interface Sourced<T> {
  readonly value: T;
  readonly source: ValueSource;
}

/* ---- Szem: a könyvtár egy eleme (PQW-867) ---- */

/** Nyelvfüggetlen könyvtári azonosító, pl. `sc`, `dc`, `sc2tog`, `shell-5dc`. A mentés ezt tárolja. */
export type StitchDefId = string;

export interface StitchTerm {
  /** Kiírt név, pl. „rövidpálca”. */
  readonly name: string;
  /**
   * Kiírt rövidítés, pl. `rp`. `null`, ha nincs jóváhagyott rövidítés, és a
   * név kiírva szerepel (szókészlet D4, D8).
   */
  readonly abbr: string | null;
  /**
   * Értelmezéskor elfogadott további nevek és rövidítések, pl. „kispálca”.
   * Kimenetben soha nem jelennek meg (01 §8.5 szabály 25).
   */
  readonly aliases: readonly string[];
}

/** Beszúrás egy szembe (01 §4.3). */
export type StitchInsertion = 'both-loops' | 'front-loop' | 'back-loop' | 'front-post' | 'back-post';

/** Minden beszúrási mód: szembe, láncívbe vagy gyűrűbe (06 §5.2). */
export type InsertionMode = StitchInsertion | 'space' | 'ring';

/**
 * A szem fajtája. Ettől függ, hány csomópont lesz belőle a gráfban, és
 * hogyan ellenőrizzük.
 *
 * - `chain`: láncszem. Pozíció; a szemszámba a `PatternConventions.chainCounts` szerint számít.
 * - `slip`: kúszószem.
 * - `basic`: egy beszúrás, egy tető: rövidpálca, félpálca, pálcák, rákhurok.
 * - `joined`: több részszem egy tetővel: fogyasztás, fürt, bogyó, puff, popcorn.
 * - `group`: egy alapba horgolt önálló szemek: szaporítás, kagyló, V-szem.
 * - `picot`: díszítés, alapból nem számít szemnek (README §4.8).
 * - `space`: láncív. Lerakva láncszemeket és egy `Space` célpontot ad.
 * - `ring`: varázskör. Lerakva egy csomópontot és egy `Ring` célpontot ad.
 */
export type StitchKind = 'chain' | 'slip' | 'basic' | 'joined' | 'group' | 'picot' | 'space' | 'ring';

interface StitchDefBase {
  readonly id: StitchDefId;
  readonly terms: Readonly<Record<Locale, StitchTerm>>;
  /**
   * Ráhajtások száma. A jel ferde vonalainak száma is ez, kivéve a félpálcát:
   * annak egy ráhajtása van, a jele mégis sima T (01 §8.1 szabály 1–2).
   */
  readonly yarnOvers: number;
  /**
   * Láncszem-magasság: kúszószem 0, rövidpálca 1, félpálca 2, egyráhajtásos
   * pálca 3, kétráhajtásos 4. Konvenció a fordulólánchoz és a jel szárához,
   * nem fizikai arány (README §4.1, 01 §8.1 szabály 1).
   */
  readonly chainHeight: number;
  /** Alapértelmezett fordulólánc, ha a sor ezzel a szemmel kezdődik (01 §8.3 szabály 12). */
  readonly turningChain: number;
  /**
   * Számít-e szemnek a kör kezdőlánca, ha a kör ezzel a szemmel kezdődik:
   * rövidpálca és félpálca nem, egyráhajtásos pálcától igen (szókészlet K1,
   * 01 §8.3 szabály 13). Sorban a fordulólánc minden szemnél számít (PQW-891,
   * tradition.ts).
   */
  readonly turningChainCounts: boolean;
  /** Körökben a zárás alapértelmezése: zárt kör; amigurumiban a mintatípus ad spirált (szókészlet K2, PQW-892). */
  readonly roundEnd: 'join-slip' | 'spiral';
  /**
   * Valós magasság a rövidpálcához képest. Amíg nincs mérés, becsült érték;
   * a gauge-profil felülírja (README §4.1).
   */
  readonly heightFactor: Sourced<number>;
  /** Az előző sor hány pozícióját használja fel (01 §4.1, §8.2). */
  readonly consumes: number;
  /** Hány új szemet ad a következő sornak (01 §4.1, §8.2). */
  readonly produces: number;
  /** Hány láncívet ad, pl. a V-szem egyet (01 §8.2 szabály 7). */
  readonly producesSpaces: number;
  /** Lehet-e a tetejébe horgolni. A rákhurokba nem (01 §8.2 szabály 10). */
  readonly workableTop: boolean;
  /** Megengedett beszúrási módok; az első az alapértelmezett. */
  readonly insertionModes: readonly InsertionMode[];
}

export interface SimpleStitchDef extends StitchDefBase {
  readonly kind: Exclude<StitchKind, 'joined' | 'group'>;
}

export interface JoinedStitchDef extends StitchDefBase {
  readonly kind: 'joined';
  /**
   * Egy szembe megy (`same`, pl. bogyó: 1 → 1), vagy `consumes` szemen át
   * (`spread`, pl. két rövidpálca összehorgolása: 2 → 1). A „fürt” név
   * mindkettőt jelentheti, ezért kötelező (README §4.8, 01 §8.2 szabály 8).
   */
  readonly base: 'same' | 'spread';
  /** A részszem, pl. pálcás fürtnél `dc`. */
  readonly part: StitchDefId;
  /** Hány részszem záródik egy tetőbe. */
  readonly parts: number;
  /**
   * Hogyan készülnek a részszemek a zárás előtt (01 §4.4). Ettől függ a jel
   * és az írott utasítás, mert a bogyó és a popcorn szerkezete egyébként azonos.
   * - `partial`: az utolsó lépés előtt abbahagyva, pl. fogyasztás, fürt, bogyó;
   * - `complete`: teljes szemek, utólag összezárva, pl. popcorn;
   * - `loops`: csak felhúzott hurkok, pl. puff.
   * Hiányában `partial`.
   */
  readonly closure?: 'partial' | 'complete' | 'loops';
}

export interface GroupStitchDef extends StitchDefBase {
  readonly kind: 'group';
  /** Az egy alapba horgolt szemek sorrendben, pl. V-szem: `dc`, `ch`, `dc`. */
  readonly members: readonly StitchDefId[];
}

export type StitchDef = SimpleStitchDef | JoinedStitchDef | GroupStitchDef;

/* ---- Szemgráf (PQW-856) ---- */

export type NodeId = string;
export type SpaceId = string;
export type RingId = string;
export type GroupId = string;
export type PieceId = string;

/**
 * Mibe van horgolva egy szem. A célpont dönti el, milyen beszúrás
 * lehetséges: láncívbe például nem lehet hátsó szálra szúrni.
 */
export type Anchor =
  | { readonly into: 'stitch'; readonly id: NodeId; readonly mode: StitchInsertion }
  | { readonly into: 'space'; readonly id: SpaceId }
  | { readonly into: 'ring'; readonly id: RingId };

/**
 * Szándékos eltérés, amit az ellenőrző nem jelez hibának.
 * - `crossed`: keresztezett szem, a haladási irány ellen is horgolhat (03 §10 C13);
 * - `spike`: hosszú szem, korábbi sorba horgol (03 §10 C17).
 */
export type StitchFlag = 'crossed' | 'spike';

export interface StitchNode {
  readonly id: NodeId;
  readonly def: StitchDefId;
  /** Az előző szem a fonal útján; csak a fonalszakasz első szeménél `null` (06 §5.3 V2). */
  readonly prev: NodeId | null;
  /**
   * „Ebbe horgolva”, beszúrási sorrendben. Láncszemnél és a darab első
   * szeménél üres, fogyasztásnál több elemű (06 §4.3).
   */
  readonly anchors: readonly Anchor[];
  readonly flags?: readonly StitchFlag[];
  /**
   * Kézzel igazított hely a diagramon: eltolás a számolt helyhez képest, a
   * jobbkezes nézet egységében (a `rotation` még nem használt, 0). Csak a
   * rajzot szépíti, a topológián nem változtat (README §2).
   */
  readonly pinned?: { readonly x: number; readonly y: number; readonly rotation: number };
  /**
   * A szem színe: index a darab rácsának színlistájában (`PieceGrid.colors`,
   * PQW-864). Hiányában az első szín; az írott minta a színváltást az előző
   * szem utolsó ráhajtásánál írja (03 §6, §10 G35).
   */
  readonly color?: number;
}

/** Láncív: láncszemek, amelyeket a következő sor egyetlen célpontként kezel (01 §8.2 szabály 11). */
export interface Space {
  readonly id: SpaceId;
  readonly chains: readonly NodeId[];
}

/** Varázskör: a `ring` fajtájú szem csomópontja mint célpont. */
export interface Ring {
  readonly id: RingId;
  readonly node: NodeId;
}

/**
 * Egy alapba horgolt szemek, amelyek együtt egy `group` fajtájú szemet adnak,
 * pl. szaporítás vagy kagyló. Enélkül több szem egy célpontban hiba (03 §10 C14).
 */
export interface StitchGroup {
  readonly id: GroupId;
  readonly def: StitchDefId;
  readonly members: readonly NodeId[];
}

/** Soronként felülírható konvenciók (README §4.3). */
export interface RowConventions {
  /**
   * Számít-e a fordulólánc szemnek. N szemhez a láncalap `N + T`: ha
   * számít, a fordulólánc egy alapláncszemen áll (PQW-891); ettől függ az is,
   * hová megy a sor utolsó szeme (01 §8.3 szabály 13–15). `stitch-default`:
   * sorban mindig számít, körben a kört kezdő szem
   * `StitchDef.turningChainCounts` értéke dönt (szókészlet K1); japán
   * hagyományban a félpálcától felfelé számít (tradition.ts).
   */
  readonly turningChainCounts: 'stitch-default' | boolean;
}

/**
 * A minta számolási hagyománya (PQW-876). `cyc`: a Craft Yarn Council szerinti
 * alapértelmezés. `japanese`: a japán diagramoké; a fordulólánc a félpálcától
 * felfelé szemnek számít, és számító fordulóláncnál az 1. sor egy láncszemmel
 * később kezd (01 §2.2, §3.3, §8.3 szabály 13, 15).
 */
export type Tradition = 'cyc' | 'japanese';

/** „X többszöröse + Y” (README §4.4, 03 §4.1). */
export interface RepeatSpec {
  readonly repeatWidth: number;
  readonly edgeStitches: number;
  /** Benne van-e a fordulólánc az Y-ban. */
  readonly turningChainIncluded: boolean;
}

export interface PatternConventions extends RowConventions {
  /**
   * A körök zárása. `stitch-default`: a mintatípus dönt, amigurumiban spirál,
   * minden más körben zárt kör (szókészlet K2, tulajdonosi döntés, PQW-892,
   * `roundEndFor` a rounds.ts-ben; 06 §5.3 V4).
   */
  readonly roundEnd: 'stitch-default' | 'join-slip' | 'spiral';
  /** Számít-e a pikó szemnek (szókészlet D7, README §4.8). */
  readonly picotCounts: boolean;
  /** Számít-e szemnek az illesztő vagy továbbvezető kúszószem (szókészlet D7). */
  readonly joinSlipStitchCounts: boolean;
  /**
   * Számítanak-e a láncszemek a szemszámba; a fordulóláncra a
   * `turningChainCounts` vonatkozik (03 §4.3, §10 B10).
   * - `worked-into`: akkor, ha egy későbbi sor vagy kör beléjük horgol,
   *   egyenként vagy láncívként, egészben. A díszlánc, amibe semmi nem
   *   horgol, nem számít (tulajdonosi döntés, PQW-870).
   * - `true`: minden láncszem számít; `false`: egyik sem.
   */
  readonly chainCounts: 'worked-into' | boolean;
  /** A számolási hagyomány; hiányában `cyc` (a PQW-876 előtti mentés). */
  readonly tradition?: Tradition;
  readonly repeat?: RepeatSpec;
}

/**
 * Sor- vagy körvégi esemény: mi történik az `after` szem után.
 * - `turn`: fordulás, a következő sor a másik oldalról halad;
 * - `join-slip`: a kör zárása kúszószemmel, amely maga is szem a gráfban;
 * - `spiral`: a következő kör zárás nélkül folytatódik;
 * - `fasten-off`: a fonal elvágása, a fonalszakasz vége.
 */
export interface LayerEvent {
  readonly after: NodeId;
  readonly kind: 'turn' | 'join-slip' | 'spiral' | 'fasten-off';
  /** A mintában megadott szemszám a sor végén, pl. „(18)”; az ellenőrző összeveti a számolttal (06 §5.3 V3). */
  readonly statedCount?: number;
  /** A következő sor eltérései a minta konvencióitól. */
  readonly conventions?: Partial<RowConventions>;
  /** A következő kör új színnel kezdődik (PQW-861). */
  readonly colorChange?: boolean;
  /**
   * Spirálban a színváltás lépcsőjének javítása a következő kör elején (04 §2):
   * `slip-stitch`: az első szem helyett kúszószem; `back-loop`: az új szín az
   * első szem hátsó szálába kapcsolva. Csak utasítás, a gráfon nem változtat.
   */
  readonly jogFix?: 'slip-stitch' | 'back-loop';
  /** Jelölések a kör után az írott mintában: szem, tömés, a nyílás összehúzása (PQW-863). */
  readonly marks?: readonly RoundMark[];
}

export interface Piece {
  readonly id: PieceId;
  readonly name: string;
  /** A szemek készítési sorrendben (06 §5.3 V1). */
  readonly stitches: readonly StitchNode[];
  readonly spaces: readonly Space[];
  readonly rings: readonly Ring[];
  readonly groups: readonly StitchGroup[];
  readonly events: readonly LayerEvent[];
  /** Szándékosan kihagyott szemek. Ha egy szem nincs felhasználva és itt sincs, az hiba (03 §10 B8). */
  readonly skipped: readonly NodeId[];
  /**
   * Körökben horgolt sokszög sarkainak száma, pl. négyzetnél 4 (PQW-861). A
   * sarkok szaporításai szándékosan egymás fölé kerülnek, és a lapos érték a
   * sokszögé (04 §6.1). Hiányában a körökben horgolt darab kör.
   */
  readonly corners?: number;
  /**
   * A darab részei 3D formából (PQW-863), a készítés sorrendjében. Ha van, a
   * darab térbeli forma: a kunkorodás szándékos, az ellenőrző nem jelzi.
   */
  readonly sections?: readonly PieceSection[];
  /**
   * Szegély a darab körül (PQW-862). Csak a választás tárolódik: a szemszámot
   * az írott minta a sorokból számolja (border.ts). A gráfban még nincs
   * csomópontja, mert a sorvégbe horgolt szem célpontját a gráf nem ismeri.
   */
  readonly border?: PieceBorder;
  /**
   * A rácsminta, amelyből a darab készült (PQW-864). A gráf ebből generálódik;
   * a rács a darabbal mentődik, így a technika szabályai (C2C, tapestry) és az
   * ismétlő egység jelölése a mentés után is megvannak.
   */
  readonly grid?: PieceGrid;
}

/* ---- Rácsos technikák (PQW-864) ---- */

/** Filé, sarokból sarokba (C2C), tapestry, graphgan, mozaik (03 §5). */
export type GridTechnique = 'filet' | 'c2c' | 'tapestry' | 'graphgan' | 'mosaic';

/** A darab egy színe; az írott minta betűvel jelöli (A, B, C…). */
export interface PatternColor {
  readonly name: string;
  /** `#rrggbb`. */
  readonly hex: string;
}

/** Az ismétlő egység a rácson: a bal alsó cellája és a mérete, cellában. */
export interface GridUnit {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PieceGrid {
  readonly technique: GridTechnique;
  /**
   * A kiterjesztett rács: sorok alulról felfelé, cellák balról jobbra, a
   * színoldal nézetében. Filében 1 teli, 0 nyitott, −1 nincs cella; színes
   * rácsban a szín indexe a `colors` listában.
   */
  readonly cells: readonly (readonly number[])[];
  readonly colors: readonly PatternColor[];
  /** Az ismétlő egység, ha van; az írott minta ismétlésként írja, a rajz kiemeli. */
  readonly unit: GridUnit | null;
  /** Feliratos motívum: tükrözött nézetben figyelmeztetés. */
  readonly lettering: boolean;
}

/** A szegély választásai (PQW-862, 03 §7.1). */
export interface PieceBorder {
  /** A szegély szeme; most csak rövidpálca. */
  readonly stitch: StitchDefId;
  /** Félpálcás sorvégre 1 vagy 2 szem: a források vitatják (03 §7.1, §10 H38). */
  readonly hdcRowEnd: 1 | 2;
}

/** A jelek stílusa: a Craft Yarn Council vagy a japán (JIS) jelkulcs (01 §6). */
export type ChartStyle = 'cyc' | 'jis';

/**
 * Milyen jelöléssel készült a minta (PQW-868). Csak megjelenítés: a gráf
 * ettől nem változik, a szerkesztő mentéskor és exportkor írja bele.
 */
export interface PatternNotation {
  readonly terms: Locale;
  readonly chartStyle: ChartStyle;
  /** A rövidpálca jele (szókészlet K3). */
  readonly singleCrochet: 'plus' | 'cross';
}

/** Síkban (sorokban) vagy körben mérve (PQW-859). */
export type GaugeForm = 'rows' | 'rounds';

/**
 * Egy szem mintasűrűsége a profilban: szem/10 cm és sor (kör)/10 cm. A még
 * ki nem töltött érték `null`; ilyen sor a méretbe nem számít.
 */
export interface GaugeEntry {
  /** Alapszem: `sc`, `hdc`, `dc`, `tr`. */
  readonly stitch: StitchDefId;
  readonly form: GaugeForm;
  readonly stitchesPer10cm: number | null;
  readonly rowsPer10cm: number | null;
  /** Saját próbadarabon mérve, vagy a fonal címkéjéről. */
  readonly source: Extract<ValueSource, 'measured' | 'label'>;
}

/**
 * A horgoló egy fonallal és tűvel mért profilja, ahogy a felületen megadja
 * (PQW-859). Ismeretlen érték `null`, sosem becslés: a becslést a mag számolja.
 */
export interface PatternGaugeProfile {
  readonly id: string;
  readonly yarn: {
    readonly name: string;
    /** CYC fonalvastagság 0–7, a címkéről. */
    readonly cycWeight: number | null;
    readonly metersPer100g: number | null;
    /** Egy gombolyag tömege, g; ebből kerekítünk gombolyagra. */
    readonly ballMassG: number | null;
  };
  readonly hookMm: number;
  readonly blocked: boolean;
  readonly gauges: readonly GaugeEntry[];
  /** A lemért próbadarab mérete és tömege. */
  readonly swatch: { readonly widthCm: number | null; readonly heightCm: number | null; readonly massG: number | null };
}

/** A mintával mentett profilok és a kiválasztott (PQW-859). */
export interface PatternGauge {
  /** A kiválasztott profil azonosítója; `null`: profil nélkül, becsléssel. */
  readonly active: string | null;
  readonly profiles: readonly PatternGaugeProfile[];
}

/** A mentett minta. A formátum verziója minden nem visszafelé kompatibilis változásnál nő. */
export interface Pattern {
  readonly formatVersion: 1;
  readonly title: string;
  /** Hiányában a minta jelölése nincs rögzítve (a PQW-868 előtti mentés). */
  readonly notation?: PatternNotation;
  /** Hiányában a mintához nincs profil (a PQW-859 előtti mentés); a méret becslés. */
  readonly gauge?: PatternGauge;
  readonly conventions: PatternConventions;
  readonly pieces: readonly Piece[];
  /** Összevarrt darabok (PQW-863); hiányában nincs kapcsolás. */
  readonly joins?: readonly PieceJoin[];
  /** Játék: 3 év alatti gyereknek készül-e (04 §5.7). Hiányában nincs megadva. */
  readonly toy?: { readonly under3: boolean };
}

/* ---- Amigurumi és 3D formák (PQW-863) ---- */

/** A darab vége: nyitott szél (varráshoz, folytatáshoz) vagy zárt (összehúzva, lapos tetővel). */
export type PieceEnd = 'open' | 'closed';

/** A gömb körterve: 6n (6-tal szaporítva, egyenes körök, 6-tal fogyasztva) vagy szinuszos (04 §4.3). */
export type SphereMethod = '6n' | 'sine';

/** A forgástest profiljának pontja: sugár és magasság cm-ben, a kezdéstől a végig (04 §9.3). */
export interface ProfilePoint {
  readonly radiusCm: number;
  readonly heightCm: number;
}

/**
 * Egy 3D forma, ahogy a felhasználó megadta, cm-ben; a körtervet a mag
 * számolja a mintasűrűségből (amigurumi.ts).
 * - `bottom`: a kezdés; `open` csak folytatólagosan kapcsolt résznél lehet.
 * - `top`: a darab vége.
 * A gömb és a tojás mindkét vége zárt; a félgömb a pólusról, a kúp a csúcsról indul.
 */
export type ShapeSpec =
  | { readonly kind: 'sphere'; readonly diameterCm: number; readonly method: SphereMethod }
  | { readonly kind: 'hemisphere'; readonly diameterCm: number; readonly method: SphereMethod; readonly top: PieceEnd }
  | { readonly kind: 'egg'; readonly diameterCm: number; readonly heightCm: number }
  | {
      readonly kind: 'cylinder';
      readonly diameterCm: number;
      readonly heightCm: number;
      readonly bottom: PieceEnd;
      readonly top: PieceEnd;
    }
  | {
      readonly kind: 'cone';
      /** Az alap átmérője. */
      readonly diameterCm: number;
      /** A csúcstól az alapig; ha a szaporítás meg van adva, nem számít. */
      readonly heightCm: number;
      /** Körönkénti szaporítás, tört is (pl. 2,5); `null`: a magasságból. */
      readonly increases: number | null;
      readonly top: PieceEnd;
    }
  | { readonly kind: 'revolution'; readonly profile: readonly ProfilePoint[]; readonly bottom: PieceEnd; readonly top: PieceEnd };

/** Egy rész (pl. fej, test) a darabban: a neve, az első köre és a formája (PQW-863). */
export interface PieceSection {
  readonly name: string;
  /** A rész első köre a darabban, 1-től; a folytatólagosan kapcsolt rész az előző után kezdődik. */
  readonly layer: number;
  readonly shape: ShapeSpec;
  /** Eltolt szaporítás és fogyasztás. */
  readonly stagger: boolean;
}

/**
 * Jelölés az írott mintában egy kör után (04 §5.6, §5.7, §9.8): biztonsági
 * szem, hímzett szem (3 év alatti gyereknek), a tömés kezdete, és a zárt
 * darab összehúzása a fonal elvágása után.
 */
export type RoundMark = 'safety-eyes' | 'embroider-eyes' | 'stuffing' | 'close-opening';

/** Egy darab egy köre mint összekapcsolt szél. */
export interface JoinEdge {
  readonly piece: PieceId;
  /** A kör sorszáma a darabban, 1-től. */
  readonly layer: number;
}

/**
 * Két darab összevarrása (04 §5.4). Ha a két szél szemszáma eltér, a
 * `distribution` mondja meg, a kisebb szél egyes szemeihez hány szem jut a
 * nagyobbikból; enélkül az eltérés hiba. A folytatólagos kapcsolás nem itt
 * áll: az egy darab több résszel (`Piece.sections`).
 */
export interface PieceJoin {
  readonly a: JoinEdge;
  readonly b: JoinEdge;
  readonly distribution?: readonly number[];
}

/* ---- Számolt adatok ---- */

/** Egy sor vagy kör a gráfból számolva. */
export interface Layer {
  readonly piece: PieceId;
  /** A láncalap vagy a varázskör a 0., utána 1-től számozva. */
  readonly index: number;
  readonly shape: 'row' | 'round';
  readonly stitches: readonly NodeId[];
  /** Szemszám: a láncszemek a `chainCounts`, a fordulólánc a `turningChainCounts` szerint. */
  readonly stitchCount: number;
  /** Pozíciószám, láncszemmel együtt. */
  readonly positionCount: number;
  /** A színe (`right`) vagy a visszája (`wrong`) néz a horgoló felé (01 §8.4 szabály 19). */
  readonly side: 'right' | 'wrong';
}

/** Az ellenőrző egy találata. */
export interface Finding {
  /**
   * `error`: megcsinálhatatlan vagy ellentmondásos; `warning`: megcsinálható,
   * de valószínűleg nem szándékos (README §5).
   */
  readonly severity: 'error' | 'warning';
  /** A szabály azonosítója. */
  readonly rule: string;
  /** Tudásbázis-hivatkozás, pl. `03 §10 B8`. */
  readonly reference: string;
  readonly piece: PieceId;
  /** Az érintett szemek; a szerkesztő ezeket jelöli ki. */
  readonly nodes: readonly NodeId[];
}
