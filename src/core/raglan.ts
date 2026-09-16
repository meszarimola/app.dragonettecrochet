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
import { evenPositions, eventRows, intentOf, roundEven, roundStitches, slopeSchedule } from './garment-math.ts';
import { buildPieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import { ribbedOpening, ribbedTurningChain, ribbingColumnMode, type RibbingOptions } from './ribbing.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, Space, SpaceId, StitchGroup, StitchNode } from './types.ts';
import type { GarmentCheck, GarmentCode } from './garments.ts';

/** Egy raglánkör minden szakaszt 2 szemmel növel: körönként +8 (05 §2.3). */
export const RAGLAN_PER_ROUND = 8;

/** Az ujjak neve az írott mintában, a szétosztás sorrendjében (PQW-908). */
export const SLEEVE_NAMES = ['Első ujj', 'Második ujj'] as const;
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
  /** Az ujj hossza a hónaljtól a mandzsetta aljáig (CYC „karhossz a hónaljtól”, PQW-913). */
  readonly sleeveLengthCm: number;
  /** A mandzsetta körmérete (05 „B” példa aránya a felkarbőségből, PQW-913). */
  readonly cuffCm: number;
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
  /** Az ujj csöve a hónaljtól a mandzsettáig (PQW-913). */
  readonly sleeve: {
    /** Az ujj körei a szétosztás körével együtt; az 1. kör a szétosztásé. */
    readonly rounds: number;
    /** A mandzsetta körei az ujj alján: ezek már nem fogyasztanak. */
    readonly cuffRounds: number;
    readonly cuffStitches: number;
    /** Hány kör fogyaszt; körönként 2 szem, a hónalj két oldalán 1-1 összehorgolás. */
    readonly decreases: number;
    /** A fogyasztó körök az ujj tetejétől, 1-től (az 1. kör a szétosztásé). */
    readonly decreaseRounds: readonly number[];
  };
  readonly finished: {
    readonly chestCm: number;
    readonly easeCm: number;
    readonly lengthCm: number;
    readonly sleeveCm: number | null;
  };
  readonly checks: readonly GarmentCheck[];
  readonly warnings: readonly CoreText<GarmentCode>[];
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

  /** A láncszemek azonosítói: relief szem nem mehet láncszem köré, ezért a bordázatnak tudnia kell róluk. */
  readonly chainIds = new Set<NodeId>();

  chains(count: number): NodeId[] {
    return Array.from({ length: count }, () => {
      const id = this.add('ch');
      this.chainIds.add(id);
      return id;
    });
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

  event(kind: LayerEvent['kind'], resume?: LayerEvent['resume']): void {
    this.events.push({ after: this.previous!, kind, ...(resume ? { resume } : {}) });
    // Elvágott fonal után a következő szem új fonalszakaszt kezd: a fonal útja ott megszakad (06 §5.3 V2).
    if (kind === 'fasten-off') this.cut();
  }

  /** A fonal elvágása: a következő szem `prev` nélkül, új szakaszként indul (06 §5.3 V2). */
  cut(): void {
    this.previous = null;
  }
}

/** A kör zárása kúszószemmel a kör első pozíciójába (04 §2). */
function closeRound(writer: RaglanWriter, first: NodeId): void {
  writer.add('sl-st', [both(first)]);
  writer.event('join-slip');
}

/**
 * A kör zárása, majd a fonal elvágása: a munka a megadott szakaszoknál
 * folytatódik (PQW-908). Egy szem után egy esemény állhat, ezért a záró
 * kúszószem eseménye maga a fonal elvágása, a folytatással együtt.
 */
function closeAndCut(writer: RaglanWriter, first: NodeId, resume: NonNullable<LayerEvent['resume']>): void {
  writer.add('sl-st', [both(first)]);
  writer.event('fasten-off', resume);
}

/**
 * A raglán szemgráfja a tervből (PQW-901): a nyak láncgyűrűjéből az 1. kör
 * láncszemenként egy szemmel, utána a raglánkörök a négy sarokban
 * szaporítva, majd a szétosztás hónaljlánccal és az ujjak szemeinek
 * kihagyásával, végül a törzs körei. Az ujjak a hónaljlánc és a kihagyott
 * szemek mentén külön készülnek: azt a gráf még nem építi meg.
 */
export function raglanPiece(
  pattern: Pattern,
  stitch: string,
  plan: RaglanPlan,
  name: string,
  id = 'p1',
  /** Bordás szegély és mandzsetta: a törzs alsó és az ujj végi körei relief szemmel (PQW-913). */
  ribbing: RibbingOptions | null = null,
): Piece | CoreText<GarmentCode> {
  const def = resolveStitch(stitch);
  if (!def) return text('internal-error', { rule: 'raglan-stitch' });
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
  if (firstRound.length !== plan.neck.stitches) return text('internal-error', { rule: 'raglan-neck-round' });
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
    const section = (positions: readonly NodeId[], target: number, first: boolean): NodeId[] | CoreText<GarmentCode> => {
      const seated = first && counting ? 1 : 0;
      const growth = target - positions.length;
      if (growth < 0 || growth > positions.length) return text('internal-error', { rule: 'raglan-round-plan', round });
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
      if (!Array.isArray(built)) return built;
      made[key] = built;
    }
    const first = counting ? top : made.back[0]!;
    closeRound(writer, first);
    below = { back: counting ? [top, ...made.back] : made.back, sleeveA: made.sleeveA, front: made.front, sleeveB: made.sleeveB };
  }
  // Szétosztás: a hát szemei, hónaljlánc, az egyik ujj kihagyva, az elő szemei, hónaljlánc, a másik ujj kihagyva
  // (05 §2.3). A hónaljlánc a törzsbe és az ujjba is beleszámít; az ujjak a törzs után következnek.
  /** A két hónaljlánc láncszemei, a szétosztás sorrendjében: az `sleeveA`, majd az `sleeveB` ujjé. */
  const underarmChains: NodeId[][] = [];
  const sleeveStitches = { a: [] as NodeId[], b: [] as NodeId[] };
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
      underarmChains.push(chains);
    };
    run(below.back, counting ? 1 : 0);
    underarm();
    writer.skipped.push(...below.sleeveA);
    sleeveStitches.a = [...below.sleeveA];
    run(below.front, 0);
    underarm();
    writer.skipped.push(...below.sleeveB);
    sleeveStitches.b = [...below.sleeveB];
    const first = counting ? top : made[0]!;
    closeRound(writer, first);
    body = counting ? [top, ...made] : made;
  }
  if (body.length !== plan.bodyStitches) return text('internal-error', { rule: 'raglan-divide' });

  /*
   * Bordás kör (PQW-913): a fordulólánc egy láncszemmel rövidebb és nem számít szemnek, ezért nincs ülő
   * pozíció, a kör minden szembe horgol, és a saját első szemébe záródik. A relief mód a célpont oszlopát
   * követi, így a bordák végigfutnak; láncszem köré sima szem megy.
   */
  const ribbedRound = (positions: readonly NodeId[], column: Map<NodeId, number>, width: number): NodeId[] => {
    const opening = writer.events[writer.events.length - 1];
    if (opening) writer.events[writer.events.length - 1] = ribbedOpening(opening);
    if (column.size === 0) positions.forEach((node, k) => column.set(node, k));
    writer.chains(ribbedTurningChain(def));
    const made: NodeId[] = [];
    for (const position of positions) {
      const at = column.get(position) ?? 0;
      const mode = writer.chainIds.has(position) ? 'both-loops' : ribbingColumnMode(at, width);
      const node = writer.add(def.id, [{ into: 'stitch', id: position, mode }]);
      column.set(node, at);
      made.push(node);
    }
    return made;
  };

  // A törzs körei a szétosztástól: alakítás nélkül, a szegéllyel együtt. Az alsó szegély körei bordásak (PQW-913).
  const ribBodyFrom = ribbing !== null && plan.hemRounds > 0 ? plan.bodyRoundsBelow - plan.hemRounds + 1 : Number.POSITIVE_INFINITY;
  const bodyColumn = new Map<NodeId, number>();
  for (let round = 2; round <= plan.bodyRoundsBelow; round += 1) {
    if (ribbing !== null && round >= ribBodyFrom) {
      body = ribbedRound(body, bodyColumn, ribbing.width);
      closeRound(writer, body[0]!);
      continue;
    }
    const chain = writer.chains(def.turningChain);
    const top = chain[chain.length - 1]!;
    const made: NodeId[] = [];
    for (const position of body.slice(counting ? 1 : 0)) made.push(...writer.into(def.id, both(position), 1));
    closeRound(writer, counting ? top : made[0]!);
    body = counting ? [top, ...made] : made;
  }

  /*
   * Az ujjak (05 §2.3, PQW-908): a fonal elvágása után a munka a vállrész utolsó körénél folytatódik. Az ujj
   * első köre a vállrész kihagyott szemeibe és a szétosztás hónaljláncába horgol — két korábbi szakaszba
   * egyszerre —, ezért az esemény mindkét forrást megadja (`resume.layer` és `resume.with`). A hónaljlánc így
   * a törzsbe és az ujjba is beleszámít. Az ujj további köreit a terv még nem írja le, ezért itt egy kör készül.
   */
  const yokeLayer = plan.yokeRounds + 1;
  const splitLayer = plan.yokeRounds + 2;
  const sleeves = [
    { name: SLEEVE_NAMES[0], stitches: sleeveStitches.a, chains: underarmChains[0] ?? [] },
    { name: SLEEVE_NAMES[1], stitches: sleeveStitches.b, chains: underarmChains[1] ?? [] },
  ];
  if (sleeves.some((sleeve) => sleeve.stitches.length === 0 || sleeve.chains.length === 0)) {
    return text('internal-error', { rule: 'raglan-sleeve-split' });
  }
  // A törzs utolsó köre után a fonalat elvágjuk, és a munka az első ujjnál folytatódik; az ujj után a másiknál.
  for (const [i, sleeve] of sleeves.entries()) {
    const resume = { layer: yokeLayer, name: sleeve.name, with: splitLayer };
    const last = writer.stitches[writer.stitches.length - 1]!;
    const closing = writer.events[writer.events.length - 1];
    if (closing?.after === last.id && closing.kind === 'join-slip') {
      // Az előző kör záró kúszószeme viszi a fonal elvágását is: egy szem után egy esemény állhat.
      writer.events[writer.events.length - 1] = { after: last.id, kind: 'fasten-off', resume };
      writer.cut();
    } else if (!(closing?.kind === 'fasten-off' && closing.resume?.name === sleeve.name)) {
      // Az előző ujj zárása már elvágta a fonalat, és megadta ezt a folytatást: akkor nincs új esemény.
      writer.event('fasten-off', resume);
    }
    const chain = writer.chains(def.turningChain);
    const top = chain[chain.length - 1]!;
    const made: NodeId[] = [];
    // A kihagyott szemek a vállrész köréből, utána a hónaljlánc láncszemei: együtt az ujj körmérete.
    const targets = [...sleeve.stitches, ...sleeve.chains];
    for (const position of targets.slice(counting ? 1 : 0)) made.push(...writer.into(def.id, both(position), 1));
    let round = counting ? [top, ...made] : made;
    if (round.length !== plan.sleeveStitches) return text('internal-error', { rule: 'raglan-sleeve-round' });

    /** Az utolsó ujj után a kör zárul; a többi után a fonal elvágása viszi a következő ujj folytatását. */
    const finish = (first: NodeId) => {
      if (i === sleeves.length - 1) closeRound(writer, first);
      else closeAndCut(writer, first, { layer: yokeLayer, name: sleeves[i + 1]!.name, with: splitLayer });
    };
    if (plan.sleeve.rounds <= 1) finish(round[0]!);
    else closeRound(writer, round[0]!);

    // Az ujj csöve: a fogyasztó körökben a hónalj két oldalán 1-1 összehorgolás, a többi kör egyenes (PQW-913).
    const decreaseAt = new Set(plan.sleeve.decreaseRounds);
    // A mandzsetta körei bordásak; a fogyasztás mindig a mandzsetta fölött van, ezért a kettő nem esik egybe.
    const ribCuffFrom =
      ribbing !== null && plan.sleeve.cuffRounds > 0 ? plan.sleeve.rounds - plan.sleeve.cuffRounds + 1 : Number.POSITIVE_INFINITY;
    const cuffColumn = new Map<NodeId, number>();
    for (let r = 2; r <= plan.sleeve.rounds; r += 1) {
      if (ribbing !== null && r >= ribCuffFrom) {
        round = ribbedRound(round, cuffColumn, ribbing.width);
        if (r === plan.sleeve.rounds) finish(round[0]!);
        else closeRound(writer, round[0]!);
        continue;
      }
      const roundChain = writer.chains(def.turningChain);
      const roundTop = roundChain[roundChain.length - 1]!;
      const positions = round.slice(counting ? 1 : 0);
      const built: NodeId[] = [];
      if (decreaseAt.has(r) && positions.length >= 6) {
        built.push(writer.add(`${def.id}2tog`, [both(positions[0]!), both(positions[1]!)]));
        for (const position of positions.slice(2, -2)) built.push(...writer.into(def.id, both(position), 1));
        built.push(writer.add(`${def.id}2tog`, [both(positions[positions.length - 2]!), both(positions[positions.length - 1]!)]));
      } else {
        for (const position of positions) built.push(...writer.into(def.id, both(position), 1));
      }
      round = counting ? [roundTop, ...built] : built;
      if (r === plan.sleeve.rounds) finish(round[0]!);
      else closeRound(writer, round[0]!);
    }
  }

  // A raglán négy vonala mentén a szaporítások szándékosan egymás fölé kerülnek (04 §6.1, 05 §2.3): a darab
  // sarkainak száma 4, ezért az ellenőrző nem jelzi őket. A vállrész kúp: a rajzon a körei körcikket adnak (PQW-908).
  return withStated(pattern, {
    roundShape: { kind: 'cone', throughRound: yokeLayer },
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
 * `rowCm` a körben mért szemméret; hibánál az ok kódja.
 */
export function raglanPlan(m: RaglanMeasures, gauge: { readonly stitchCm: number; readonly rowCm: number }): RaglanPlan | CoreText<GarmentCode> {
  const { stitchCm, rowCm } = gauge;
  const ratio = -m.easeCm / m.bustCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return text('negative-ease-bust', { limit: pct(NEGATIVE_EASE_MAX), actual: pct(ratio) });
  }
  const intent = intentOf(m.easeCm);
  const bodyStitches = roundStitches((m.bustCm + m.easeCm) / stitchCm, intent);
  const underarm = Math.max(0, Math.round(m.underarmCm / stitchCm));
  if (bodyStitches < 4 * underarm + 8) return text('underarm-long');
  // A hónaljlánc mindkét darabba beleszámít (05 §2.3): a törzsön az elő és a hát a láncok nélkül marad.
  const bodyHalf = (bodyStitches - 2 * underarm) / 2;
  const front = Math.floor(bodyHalf);
  const back = bodyStitches - 2 * underarm - front;
  const sleeveStitches = m.upperArmCm === null ? null : roundStitches(m.upperArmCm / stitchCm, 'up');
  const sleeveTarget = (sleeveStitches ?? Math.round(bodyStitches / 3)) - underarm;
  if (sleeveTarget < 4) return text('sleeve-narrow');

  // Nyak: elöl és hátul egyenlő, az ujjak a nyak hatodai (05 §2.3). Az ujj nyakbeli szemszámát a raglánkörök
  // száma is köti: az ujj csak a sarkokból nő, ezért `nyak + 2 · kör = ujj célszemszáma`.
  const neckStitches = Math.max(8, roundStitches(m.neckCm / stitchCm, 'nearest'));
  const wantedSleeve = Math.max(1, Math.round(neckStitches * NECK_SLEEVE_SHARE));

  // A raglánkörök számát az ujj szabja meg: az ujjnak nincs külön szaporítása, ezért a sarkokból kell kijönnie
  // (05 §4 „C” példa 4. pont). A raglán mélysége ehhez a legközelebbi páros körszám.
  const fromDepth = roundEven(m.yokeDepthCm / rowCm);
  if (fromDepth < 2) return text('yoke-min');
  // A körszám a mélységből indul, de az ujj nyakbeli szemszáma nem mehet 1 alá, és nem lehet nagyobb a
  // kívántnál: ezért a körszámot ehhez igazítjuk (05 §4 „C” példa 4–5. pont).
  const yokeRounds = Math.max(2, Math.min(fromDepth, Math.floor((sleeveTarget - 1) / 2)));
  const neckSleeve = sleeveTarget - 2 * yokeRounds;
  if (neckSleeve < 1) return text('yoke-sleeve-many');
  if (neckSleeve > wantedSleeve * 2) {
    return text('yoke-sleeve-few');
  }
  const neckFront = Math.floor((neckStitches - 2 * neckSleeve) / 2);
  const neckBack = neckStitches - 2 * neckSleeve - neckFront;
  if (neckFront < 1 || neckBack < 1) return text('neck-small');

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
    return text('body-short-gauge');
  }
  const shortfall = {
    front: frontTarget - (neckFront + cornerGain),
    back: backTarget - (neckBack + cornerGain),
    sleeve: 0,
  };
  if (shortfall.front < 0 || shortfall.back < 0) {
    return text('yoke-body-many');
  }
  // A törzsszaporítás a szakasz két szélén jön, a raglánvonalak mellett (05 §4 „C” példa „cheat” szemei): egy
  // körben +2. Ennél többhöz mélyebb raglán vagy hosszabb hónaljlánc kell.
  const perRound = 2;
  const extraRounds = Math.max(Math.ceil(shortfall.front / perRound), Math.ceil(shortfall.back / perRound));
  if (extraRounds > yokeRounds) {
    return text('body-short');
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
  if (bodyRoundsBelow < 2) return text('body-length-yoke');

  /*
   * Az ujj csöve a hónaljtól a mandzsettáig (PQW-913, 05 §4.4). A szétosztásnál az ujj körmérete
   * `sleeveStitches`; onnan a mandzsettáig fogyasztunk, körönként 2 szemmel: a hónalj két oldalán egy-egy
   * összehorgolás. A fogyasztások egyenletesen oszlanak el, a mandzsetta körei pedig egyenesek (straightTail).
   * A mandzsetta szemszáma páros, és a különbség is páros, hogy körönként pontosan 2 szem fogyjon.
   */
  const sleeveTotal = sleeveTarget + underarmStitches;
  const sleeveRounds = Math.max(1, roundEven(m.sleeveLengthCm / rowCm));
  const cuffRounds = Math.min(hemRounds, Math.max(0, sleeveRounds - 2));
  let cuffStitches = Math.min(sleeveTotal, Math.max(4, roundEven(m.cuffCm / stitchCm, 'up')));
  if ((sleeveTotal - cuffStitches) % 2 !== 0) cuffStitches = Math.min(sleeveTotal, cuffStitches + 1);
  const sleeveDecreases = (sleeveTotal - cuffStitches) / 2;
  const shapedRounds = sleeveRounds - cuffRounds;
  // A fogyasztás a szétosztás köre után kezdődik, ezért az 1. kör nem fogyaszt: a terv a többi körre oszlik el.
  const sleeveSchedule = shapedRounds >= 1 ? slopeSchedule(shapedRounds - 1, sleeveDecreases, true) : null;
  if (sleeveDecreases > 0 && !sleeveSchedule) return text('sleeve-increases');
  const decreaseRounds = sleeveSchedule ? eventRows(sleeveSchedule).map((round) => round + 1) : [];
  if (decreaseRounds.some((round) => round > sleeveRounds)) return text('sleeve-short');

  const chestCm = bodyStitches * stitchCm;
  const checks: GarmentCheck[] = [
    {
      id: 'raglan-sections',
      label: text('check-raglan-sections'),
      ok: last.front === front && last.back === back && last.sleeve === sleeveTarget,
      suggestion: text('suggest-raglan-sections'),
    },
    {
      id: 'raglan-growth',
      label: text('check-raglan-growth', { max: MAX_SECTION_GROWTH }),
      ok: rounds.every((round, i) => i === 0 || round.front - rounds[i - 1]!.front <= MAX_SECTION_GROWTH),
      suggestion: text('suggest-raglan-growth'),
    },
    {
      id: 'raglan-underarm',
      label: text('check-raglan-underarm'),
      ok: bodyStitches === frontTarget + backTarget + 2 * underarmStitches,
    },
    {
      // Az ujj csöve a szétosztás körméretéből a mandzsettáig fogy, körönként 2 szemmel (PQW-913).
      id: 'raglan-sleeve',
      label: text('check-raglan-sleeve'),
      ok: cuffStitches + 2 * sleeveDecreases === sleeveTotal && decreaseRounds.length === sleeveDecreases,
      suggestion: text('suggest-raglan-sleeve'),
    },
    {
      id: 'raglan-neck',
      label: text('check-raglan-neck'),
      ok: neckFront + neckBack + 2 * neckSleeve === neckStitches,
    },
    { id: 'even-rounds', label: text('check-even-rounds'), ok: yokeRounds % 2 === 0 && bodyRoundsBelow % 2 === 0 },
    {
      id: 'negative-ease',
      label: text('check-negative-ease', { limit: pct(NEGATIVE_EASE_LIMIT) }),
      ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9,
      suggestion: text('suggest-negative-ease-raglan', { cm: Math.floor(NEGATIVE_EASE_LIMIT * m.bustCm) }),
    },
  ];
  const warnings: CoreText<GarmentCode>[] = [];
  if (extraRounds > 0) {
    warnings.push(text('raglan-extra-rounds', { missing: shortfall.front + shortfall.back, rounds: extraRounds }));
  }
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(text('negative-ease-warning', { actual: pct(ratio), limit: pct(NEGATIVE_EASE_LIMIT) }));
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
    sleeve: { rounds: sleeveRounds, cuffRounds, cuffStitches, decreases: sleeveDecreases, decreaseRounds },
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
