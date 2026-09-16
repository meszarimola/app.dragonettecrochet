/*
 * Felülről horgolt raglán (PQW-901, 05 §2.3, §4 „C” példa, §9.5).
 *
 * A nyakból indulunk: a kezdőlánc körbe zárva adja az 1. kört, és a négy
 * raglánvonal sarkaiban szaporítunk. Egy raglánkör minden szakaszt (elöl,
 * hátul, két ujj) 2 szemmel növel, vagyis körönként +8 szem.
 *
 * - A „C” példa fő tanulsága (05 §4): pálcával a sarkok szaporítása nem elég
 *   az elejének és a hátának. A raglánkörök száma a karöltő mélységéből jön,
 *   és annyi szemet ad, amennyit ad; ami az elejéből és a hátából hiányzik,
 *   azt külön törzsszaporítás pótolja, egyenletesen elosztva a körök között
 *   (05 §4.4 Bresenham). Az ujjaknál ilyen ritkán kell.
 * - A hónaljlánc mindkettőbe beleszámít (05 §2.3): a törzs a hónaljláncokkal
 *   együtt adja ki a mellbőséget, az ujj körmérete a saját szemeivel és
 *   ugyanazzal a lánccal.
 * - Szétosztáskor a hát és az elő szemei maradnak a törzsön, az ujjak szemeit
 *   kihagyjuk, és a helyükre hónaljlánc kerül.
 *
 * A számolás csak számokat ad; a szemgráfot a garments.ts építi ebből.
 */

import { NEGATIVE_EASE_LIMIT, NEGATIVE_EASE_MAX } from './body-sizes.ts';
import { evenPositions, intentOf, roundEven, roundStitches } from './garment-math.ts';
import { buildPieceGraph } from './graph.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, Space, SpaceId, StitchGroup, StitchNode } from './types.ts';
import type { GarmentCheck } from './garments.ts';

/** Egy raglánkör minden szakaszt 2 szemmel növel: körönként +8 (05 §2.3). */
export const RAGLAN_PER_ROUND = 8;
/** Egy szakasz egy körben legfeljebb ennyivel nőhet pálcánál, hogy ne torzuljon (05 §4.4). */
export const MAX_SECTION_GROWTH = 4;
/** A nyak szemeinek megoszlása: elöl és hátul egyenlő, az ujjak keskenyebbek (05 §2.3). */
export const NECK_SLEEVE_SHARE = 1 / 6;
/** A hónaljlánc legfeljebb a törzs ennyied része: ennél hosszabb lánc már nem hónalj (05 §2.3). */
export const MAX_UNDERARM_SHARE = 0.06;

export interface RaglanMeasures {
  readonly bustCm: number;
  readonly easeCm: number;
  /** Felkarbőség bőséggel együtt; `null`, ha a táblázatból hiányzik. */
  readonly upperArmCm: number | null;
  /** A nyak körmérete. */
  readonly neckCm: number;
  /** A raglán mélysége a nyaktól a hónaljig. */
  readonly yokeDepthCm: number;
  /** A hónaljlánc hossza. */
  readonly underarmCm: number;
  /** A teljes hossz a vállvarrástól, a szegéllyel. */
  readonly bodyLengthCm: number;
  readonly hemCm: number;
}

/** A négy szakasz szemszáma egy körben: elöl, hátul és a két ujj. */
export interface RaglanSections {
  readonly front: number;
  readonly back: number;
  readonly sleeve: number;
}

export interface RaglanPlan {
  readonly kind: 'raglan';
  readonly measures: RaglanMeasures;
  /** A nyak szemszáma és megoszlása. */
  readonly neck: RaglanSections & { readonly stitches: number };
  /** A szétosztásnál elvárt szemszám szakaszonként, a hónaljlánc nélkül. */
  readonly target: RaglanSections;
  readonly yokeRounds: number;
  /** Körönként a szakaszok szemszáma az 1. körtől a szétosztásig. */
  readonly rounds: readonly RaglanSections[];
  /** Azok a körök (1-től), ahol az elején és a hátán külön törzsszaporítás is van. */
  readonly bodyRounds: readonly number[];
  /** A hónaljlánc szemszáma. */
  readonly underarm: number;
  /** A törzs szemszáma a szétosztás után, a hónaljláncokkal. */
  readonly bodyStitches: number;
  /** Egy ujj szemszáma a szétosztás után, a hónaljlánccal. */
  readonly sleeveStitches: number;
  /** A törzs körei a szétosztástól, a szegéllyel együtt. */
  readonly bodyRoundsBelow: number;
  readonly hemRounds: number;
  readonly finished: {
    readonly chestCm: number;
    readonly easeCm: number;
    readonly lengthCm: number;
    readonly sleeveCm: number | null;
  };
  readonly checks: readonly GarmentCheck[];
  readonly warnings: readonly string[];
}

const pct = (ratio: number) => Math.round(ratio * 100);

/* ---- Gráfépítés ---- */

const both = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

/** A raglán darabja: a nyaktól a szétosztásig, majd a törzs körben. Az ujjak külön jegyben készülnek. */
class RaglanWriter {
  readonly stitches: StitchNode[] = [];
  readonly spaces: Space[] = [];
  readonly groups: StitchGroup[] = [];
  readonly events: LayerEvent[] = [];
  readonly skipped: NodeId[] = [];
  private previous: NodeId | null = null;

  add(def: string, anchors: readonly Anchor[] = []): NodeId {
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({ id, def, prev: this.previous, anchors });
    this.previous = id;
    return id;
  }

  chains(count: number): NodeId[] {
    return Array.from({ length: count }, () => this.add('ch'));
  }

  space(chains: readonly NodeId[]): SpaceId {
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return id;
  }

  /** `n` szem egy célpontba; kettőtől jelölt szaporításként. */
  into(def: string, anchor: Anchor, n: number): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def, [anchor]));
    if (anchor.into === 'stitch' && n >= 2) this.groups.push({ id: `g${this.groups.length + 1}`, def: `inc-${n}${def}`, members: ids });
    return ids;
  }

  event(kind: LayerEvent['kind']): void {
    this.events.push({ after: this.previous!, kind });
  }
}

/** A kör zárása kúszószemmel a kör első pozíciójába (04 §2). */
function closeRound(writer: RaglanWriter, first: NodeId): void {
  writer.add('sl-st', [both(first)]);
  writer.event('join-slip');
}

/**
 * A raglán szemgráfja a tervből (PQW-901): a nyak láncgyűrűjéből az 1. kör
 * láncszemenként egy szemmel, utána a raglánkörök a négy sarokban
 * szaporítva, majd a szétosztás hónaljlánccal és az ujjak szemeinek
 * kihagyásával, végül a törzs körei. Az ujjak a hónaljlánc és a kihagyott
 * szemek mentén külön készülnek: azt a gráf még nem építi meg.
 */
export function raglanPiece(pattern: Pattern, stitch: string, plan: RaglanPlan, name: string, id = 'p1'): Piece | string {
  const def = resolveStitch(stitch);
  if (!def) return 'Ismeretlen szem a raglánhoz: ez a program hibája, kérlek, jelezd.';
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, traditionOf(pattern.conventions), 'round');
  const writer = new RaglanWriter();

  // Nyak: láncgyűrű, a kört kúszószem zárja; az 1. kör minden láncszembe egy szemet tesz.
  const neckChains = writer.chains(plan.neck.stitches);
  writer.event('join-slip');
  writer.add('sl-st', [both(neckChains[0]!)]);
  const turning = writer.chains(def.turningChain);
  // A számító kezdőlánc maga az első szem, ezért eggyel kevesebb szemet horgolunk.
  const firstRound: NodeId[] = counting ? [turning[turning.length - 1]!] : [];
  for (const chain of neckChains.slice(counting ? 1 : 0)) firstRound.push(...writer.into(def.id, both(chain), 1));
  if (firstRound.length !== plan.neck.stitches) return 'A nyak köre nem a terv szerinti: ez a program hibája, kérlek, jelezd.';
  closeRound(writer, firstRound[0]!);

  /** A kör pozíciói szakaszonként, a fonal sorrendjében: hát, ujj, elő, ujj. */
  let below = { back: firstRound.slice(0, plan.neck.back), sleeveA: [] as NodeId[], front: [] as NodeId[], sleeveB: [] as NodeId[] };
  {
    let at = plan.neck.back;
    below.sleeveA = firstRound.slice(at, at + plan.neck.sleeve);
    at += plan.neck.sleeve;
    below.front = firstRound.slice(at, at + plan.neck.front);
    at += plan.neck.front;
    below.sleeveB = firstRound.slice(at);
  }

  for (let round = 2; round <= plan.yokeRounds + 1; round += 1) {
    const want = plan.rounds[round - 1]!;
    const chain = writer.chains(def.turningChain);
    const top = chain[chain.length - 1]!;
    /**
     * Egy szakasz a terv szerinti szemszámra: a szaporítások a szakasz két
     * végén (a raglánvonalak mellett) állnak, a törzs külön szaporítása pedig
     * a szakasz közepén, hogy ne a raglánvonalra kerüljön (05 §4 „C” példa).
     * A számító kezdőlánc a kör első szeme, ezért ott eggyel kevesebbet
     * horgolunk.
     */
    const section = (positions: readonly NodeId[], target: number, first: boolean): NodeId[] | string => {
      const seated = first && counting ? 1 : 0;
      const growth = target - positions.length;
      if (growth < 0 || growth > positions.length) return `A(z) ${round}. kör terve nem illik az előző körhöz: ez a program hibája, kérlek, jelezd.`;
      // A növekedés helyei: elöl, hátul, és ami marad, a szakasz közepén.
      const at = new Set<number>();
      if (growth >= 1) at.add(0);
      if (growth >= 2) at.add(positions.length - 1);
      for (let extra = 0; at.size < growth; extra += 1) at.add(Math.floor(positions.length / 2) + extra);
      const out: NodeId[] = [];
      positions.forEach((position, i) => {
        const count = (at.has(i) ? 2 : 1) - (i === 0 ? seated : 0);
        if (count > 0) out.push(...writer.into(def.id, both(position), count));
      });
      return out;
    };
    const made: Record<'back' | 'sleeveA' | 'front' | 'sleeveB', NodeId[]> = { back: [], sleeveA: [], front: [], sleeveB: [] };
    for (const [key, target] of [
      ['back', want.back],
      ['sleeveA', want.sleeve],
      ['front', want.front],
      ['sleeveB', want.sleeve],
    ] as const) {
      const built = section(below[key], target, key === 'back');
      if (typeof built === 'string') return built;
      made[key] = built;
    }
    const first = counting ? top : made.back[0]!;
    closeRound(writer, first);
    below = { back: counting ? [top, ...made.back] : made.back, sleeveA: made.sleeveA, front: made.front, sleeveB: made.sleeveB };
  }
  // Szétosztás: a hát szemei, hónaljlánc, az egyik ujj kihagyva, az elő szemei, hónaljlánc, a másik ujj kihagyva
  // (05 §2.3). A hónaljlánc a törzsbe és az ujjba is beleszámít; az ujjak külön készülnek.
  let body: NodeId[];
  {
    const chain = writer.chains(def.turningChain);
    const top = chain[chain.length - 1]!;
    const made: NodeId[] = [];
    const run = (positions: readonly NodeId[], skipFirst: number) => {
      for (const position of positions.slice(skipFirst)) made.push(...writer.into(def.id, both(position), 1));
    };
    // A hónaljlánc a kör pozíciója lesz: a következő kör egyenként horgol bele (03 §5.2).
    const underarm = () => {
      const chains = writer.chains(plan.underarm);
      writer.space(chains);
      made.push(...chains);
    };
    run(below.back, counting ? 1 : 0);
    underarm();
    writer.skipped.push(...below.sleeveA);
    run(below.front, 0);
    underarm();
    writer.skipped.push(...below.sleeveB);
    const first = counting ? top : made[0]!;
    closeRound(writer, first);
    body = counting ? [top, ...made] : made;
  }
  if (body.length !== plan.bodyStitches) return 'A szétosztás köre nem a terv szerinti: ez a program hibája, kérlek, jelezd.';

  // A törzs körei a szétosztástól: alakítás nélkül, a szegéllyel együtt.
  for (let round = 2; round <= plan.bodyRoundsBelow; round += 1) {
    const chain = writer.chains(def.turningChain);
    const top = chain[chain.length - 1]!;
    const made: NodeId[] = [];
    for (const position of body.slice(counting ? 1 : 0)) made.push(...writer.into(def.id, both(position), 1));
    closeRound(writer, counting ? top : made[0]!);
    body = counting ? [top, ...made] : made;
  }

  // A raglán négy vonala mentén a szaporítások szándékosan egymás fölé kerülnek (04 §6.1, 05 §2.3): a darab
  // sarkainak száma 4, ezért az ellenőrző nem jelzi őket.
  return withStated(pattern, {
    id,
    name,
    stitches: writer.stitches,
    spaces: writer.spaces,
    rings: [],
    groups: writer.groups,
    events: writer.events,
    skipped: writer.skipped,
    corners: 4,
  });
}

/** A körvégi szemszám a gráf számolása szerint (06 §5.3 V3). */
function withStated(pattern: Pattern, piece: Piece): Piece {
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) if (layer.closing) stated.set(layer.closing.after, layer.stitchCount);
  return { ...piece, events: piece.events.map((event) => (stated.has(event.after) ? { ...event, statedCount: stated.get(event.after)! } : event)) };
}

/**
 * A raglán terve egy méretre (05 §4 „C” példa, §9.5). A `stitchCm` és a
 * `rowCm` a körben mért szemméret; hibánál az ok.
 */
export function raglanPlan(m: RaglanMeasures, gauge: { readonly stitchCm: number; readonly rowCm: number }): RaglanPlan | string {
  const { stitchCm, rowCm } = gauge;
  const ratio = -m.easeCm / m.bustCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return `A negatív bőség legfeljebb a mellbőség ${pct(NEGATIVE_EASE_MAX)}%-a lehet (most ${pct(ratio)}%): a horgolt anyag kevéssé nyúlik.`;
  }
  const intent = intentOf(m.easeCm);
  const bodyStitches = roundStitches((m.bustCm + m.easeCm) / stitchCm, intent);
  const underarm = Math.max(0, Math.round(m.underarmCm / stitchCm));
  if (bodyStitches < 4 * underarm + 8) return 'A hónaljlánc túl hosszú ehhez a mellbőséghez: adj meg rövidebb hónaljláncot.';
  // A hónaljlánc mindkét darabba beleszámít (05 §2.3): a törzsön az elő és a hát a láncok nélkül marad.
  const bodyHalf = (bodyStitches - 2 * underarm) / 2;
  const front = Math.floor(bodyHalf);
  const back = bodyStitches - 2 * underarm - front;
  const sleeveStitches = m.upperArmCm === null ? null : roundStitches(m.upperArmCm / stitchCm, 'up');
  const sleeveTarget = (sleeveStitches ?? Math.round(bodyStitches / 3)) - underarm;
  if (sleeveTarget < 4) return 'Az ujj túl keskeny ehhez a hónaljlánchoz: adj meg rövidebb hónaljláncot.';

  // Nyak: elöl és hátul egyenlő, az ujjak a nyak hatodai (05 §2.3). Az ujj nyakbeli szemszámát a raglánkörök
  // száma is köti: az ujj csak a sarkokból nő, ezért `nyak + 2 · kör = ujj célszemszáma`.
  const neckStitches = Math.max(8, roundStitches(m.neckCm / stitchCm, 'nearest'));
  const wantedSleeve = Math.max(1, Math.round(neckStitches * NECK_SLEEVE_SHARE));

  // A raglánkörök számát az ujj szabja meg: az ujjnak nincs külön szaporítása, ezért a sarkokból kell kijönnie
  // (05 §4 „C” példa 4. pont). A raglán mélysége ehhez a legközelebbi páros körszám.
  const fromDepth = roundEven(m.yokeDepthCm / rowCm);
  if (fromDepth < 2) return 'A raglán mélysége legalább két kör legyen: adj meg nagyobb raglánmélységet.';
  // A körszám a mélységből indul, de az ujj nyakbeli szemszáma nem mehet 1 alá, és nem lehet nagyobb a
  // kívántnál: ezért a körszámot ehhez igazítjuk (05 §4 „C” példa 4–5. pont).
  const yokeRounds = Math.max(2, Math.min(fromDepth, Math.floor((sleeveTarget - 1) / 2)));
  const neckSleeve = sleeveTarget - 2 * yokeRounds;
  if (neckSleeve < 1) return 'A raglán mélysége ennél a méretnél túl sok szemet ad az ujjnak: adj meg sekélyebb raglánt vagy bővebb ujjat.';
  if (neckSleeve > wantedSleeve * 2) {
    return 'A raglán mélysége ennél a méretnél túl kevés szemet ad az ujjnak: adj meg mélyebb raglánt vagy szűkebb ujjat.';
  }
  const neckFront = Math.floor((neckStitches - 2 * neckSleeve) / 2);
  const neckBack = neckStitches - 2 * neckSleeve - neckFront;
  if (neckFront < 1 || neckBack < 1) return 'A nyak szemszáma túl kicsi a négy szakaszhoz: adj meg nagyobb nyakbőséget.';

  // A sarkok szaporítása szakaszonként +2 körönként; ami az elejéből és a hátából hiányzik, az külön törzsszaporítás.
  const cornerGain = 2 * yokeRounds;
  // A törzs hiányzó szemeit körönként +2 pótolja; ami így sem fér el, azt a hónaljlánc veszi át (05 §2.3,
  // §4 „C” példa 5/b pont): a lánc mindkét darabba beleszámít, ezért az elő és a hát célja csökken.
  let underarmStitches = underarm;
  let frontTarget = front;
  let backTarget = back;
  const fits = (f: number, b: number) => Math.max(Math.ceil((f - (neckFront + cornerGain)) / 2), Math.ceil((b - (neckBack + cornerGain)) / 2)) <= yokeRounds;
  // A hónaljlánc legfeljebb ekkora: ennél hosszabb lánc már nem hónalj, hanem a darab része (05 §2.3).
  const maxUnderarm = Math.max(underarm, Math.round(MAX_UNDERARM_SHARE * bodyStitches));
  while (!fits(frontTarget, backTarget) && underarmStitches < maxUnderarm) {
    underarmStitches += 1;
    const half = (bodyStitches - 2 * underarmStitches) / 2;
    frontTarget = Math.floor(half);
    backTarget = bodyStitches - 2 * underarmStitches - frontTarget;
  }
  if (!fits(frontTarget, backTarget)) {
    return (
      'A törzs hiányzó szemei nem férnek el a raglánkörökben: adj meg mélyebb raglánt, vagy mérd meg a ' +
      'körben horgolt mintasűrűséget a Méret és fonal szakaszban, mert a becsült sormagasságból kevés kör jön ki.'
    );
  }
  const shortfall = {
    front: frontTarget - (neckFront + cornerGain),
    back: backTarget - (neckBack + cornerGain),
    sleeve: 0,
  };
  if (shortfall.front < 0 || shortfall.back < 0) {
    return 'A raglán mélysége ennél a méretnél túl sok szemet ad a törzsnek: adj meg sekélyebb raglánt vagy kisebb bőséget.';
  }
  // A törzsszaporítás a szakasz két szélén jön, a raglánvonalak mellett (05 §4 „C” példa „cheat” szemei): egy
  // körben +2. Ennél többhöz mélyebb raglán vagy hosszabb hónaljlánc kell.
  const perRound = 2;
  const extraRounds = Math.max(Math.ceil(shortfall.front / perRound), Math.ceil(shortfall.back / perRound));
  if (extraRounds > yokeRounds) {
    return 'A törzs hiányzó szemei nem férnek el a raglánkörökben: adj meg mélyebb raglánt vagy kisebb bőséget.';
  }
  const bodyRounds = evenPositions(yokeRounds, extraRounds).map((at) => at + 1);

  const rounds: RaglanSections[] = [];
  let current: RaglanSections = { front: neckFront, back: neckBack, sleeve: neckSleeve };
  rounds.push(current);
  let leftFront = shortfall.front;
  let leftBack = shortfall.back;
  for (let round = 2; round <= yokeRounds + 1; round += 1) {
    const extra = bodyRounds.includes(round - 1);
    const addFront = 2 + (extra && leftFront > 0 ? Math.min(perRound, leftFront) : 0);
    const addBack = 2 + (extra && leftBack > 0 ? Math.min(perRound, leftBack) : 0);
    if (extra) {
      leftFront -= addFront - 2;
      leftBack -= addBack - 2;
    }
    current = { front: current.front + addFront, back: current.back + addBack, sleeve: current.sleeve + 2 };
    rounds.push(current);
  }
  const last = rounds[rounds.length - 1]!;

  const hemRounds = roundEven(Math.max(0, m.hemCm) / rowCm);
  const bodyRoundsBelow = roundEven((m.bodyLengthCm - m.yokeDepthCm) / rowCm);
  if (bodyRoundsBelow < 2) return 'A pulóver hossza legyen nagyobb a raglán mélységénél.';

  const chestCm = bodyStitches * stitchCm;
  const checks: GarmentCheck[] = [
    {
      id: 'raglan-sections',
      label: 'Az elő, a hát és az ujjak egyszerre érik el a célszemszámot a szétosztásnál',
      ok: last.front === front && last.back === back && last.sleeve === sleeveTarget,
      suggestion: 'Állíts a raglán mélységén vagy a nyak bőségén: a szakaszok nem ugyanannyi kör alatt telnek be.',
    },
    {
      id: 'raglan-growth',
      label: `Egy szakasz körönként legfeljebb ${MAX_SECTION_GROWTH} szemmel nő`,
      ok: rounds.every((round, i) => i === 0 || round.front - rounds[i - 1]!.front <= MAX_SECTION_GROWTH),
      suggestion: 'Adj mélyebb raglánt: így kevesebb külön törzsszaporítás kell körönként.',
    },
    {
      id: 'raglan-underarm',
      label: 'A hónaljlánc a törzsbe és az ujjba is beleszámít',
      ok: bodyStitches === frontTarget + backTarget + 2 * underarmStitches,
    },
    {
      id: 'raglan-neck',
      label: 'A nyak négy szakasza kiadja a nyak szemszámát',
      ok: neckFront + neckBack + 2 * neckSleeve === neckStitches,
    },
    { id: 'even-rounds', label: 'A raglán és a törzs körszáma páros', ok: yokeRounds % 2 === 0 && bodyRoundsBelow % 2 === 0 },
    {
      id: 'negative-ease',
      label: `A negatív bőség legfeljebb ${pct(NEGATIVE_EASE_LIMIT)}%`,
      ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9,
      suggestion: `A negatív bőség legfeljebb ${Math.floor(NEGATIVE_EASE_LIMIT * m.bustCm)} cm lehet ekkora mellbőségnél.`,
    },
  ];
  const warnings: string[] = [];
  if (extraRounds > 0) {
    warnings.push(
      `A sarkok szaporítása ${shortfall.front + shortfall.back} szemmel kevesebbet ad a törzsnek, mint kell: ${extraRounds} körben külön törzsszaporítás is van (05 §4 „C” példa).`,
    );
  }
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(`A negatív bőség ${pct(ratio)}%: horgolt anyagnál ${pct(NEGATIVE_EASE_LIMIT)}% fölött csak nyúlós, bordás szemmel működik (05 §3.5, §7.2).`);
  }

  return {
    kind: 'raglan',
    measures: m,
    neck: { stitches: neckStitches, front: neckFront, back: neckBack, sleeve: neckSleeve },
    target: { front: frontTarget, back: backTarget, sleeve: sleeveTarget },
    yokeRounds,
    rounds,
    bodyRounds,
    underarm: underarmStitches,
    bodyStitches,
    sleeveStitches: sleeveTarget + underarmStitches,
    bodyRoundsBelow,
    hemRounds,
    finished: {
      chestCm,
      easeCm: chestCm - m.bustCm,
      lengthCm: (yokeRounds + bodyRoundsBelow) * rowCm,
      sleeveCm: m.upperArmCm === null ? null : (sleeveTarget + underarm) * stitchCm,
    },
    checks,
    warnings,
  };
}
