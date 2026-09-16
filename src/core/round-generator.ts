/*
 * Kör- és motívumgenerátor (PQW-861): lapos kör, négyzet, hatszög, nyolcszög
 * és nagymama-négyzet szemgráfként. A kész gráfot ugyanaz az ellenőrző, rajz és
 * írott minta dolgozza fel, mint a kézzel horgoltat.
 *
 * - Kezdés (04 §1.1): varázskör; láncgyűrű (4 lsz, kúszószemmel zárva, nagyobb
 *   kezdésnél körönként 4 szemre 1 láncszem); „2 lsz, n szem a 2. láncszembe”
 *   (magasabb szemnél a kezdőlánc hosszával több láncszem).
 * - Kör vége (04 §2): zárt kör kúszószemmel és kezdőlánccal, vagy spirál. A
 *   tulajdonos döntése: amigurumiban spirál, minden más körben haladó munkában
 *   zárt kör; a generátor alapértelmezése ezért a zárt kör.
 * - Lapos kör (04 §3.1, §3.2): a szaporítás a kör-mintasűrűségből (rounds.ts),
 *   a k-adik körben `(k − 2 szem, szap.)`; eltolva a páratlan körben
 *   `(szap., k − 2 szem)`, a páros körben a szaporítások fél ismétléssel
 *   odébb kerülnek.
 * - Sokszög (04 §6.1, §9.5): a sokszög lapos értékét a sarkokban adjuk hozzá,
 *   körönként hibaösszegzéssel kerekítve; a sarok új szeme a sarokcsoport
 *   közepe, így a sarkok egymás fölé kerülnek. Egy körben legfeljebb duplázás.
 * - Nagymama-négyzet (03 §8): erp-hármasok, a sarkokban 2, oldalt 1 láncszemes
 *   ív; a kör a kezdőlánc felé kúszószemekkel jut a sarokívhez.
 *
 * Minden kör után a mintában megadott szemszám a gráf számolása (06 §5.3 V3).
 */

import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { gaugeContextOf } from './pattern-size.ts';
import { appendRibbing, ribbingProblem, type RibbingOptions } from './ribbing.ts';
import { flatIncreases, type FlatIncreases } from './rounds.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, Ring, Space, SpaceId, StitchDef, StitchDefId, StitchGroup, StitchNode } from './types.ts';
import { withGeneratedTitle } from './pattern-title.ts';

export type MotifShape = 'circle' | 'square' | 'hexagon' | 'octagon' | 'granny-square';
export type RoundStart = 'magic-ring' | 'chain-ring' | 'chain';
export type RoundClosing = 'join-slip' | 'spiral';
export type JogFix = NonNullable<LayerEvent['jogFix']>;

export const MOTIF_SHAPES: readonly MotifShape[] = ['circle', 'square', 'hexagon', 'octagon', 'granny-square'];
export const ROUND_STARTS: readonly RoundStart[] = ['magic-ring', 'chain-ring', 'chain'];

/** A sokszög sarkainak száma; a kör `undefined`. */
export const MOTIF_CORNERS: Readonly<Record<MotifShape, number | undefined>> = {
  circle: undefined,
  square: 4,
  hexagon: 6,
  octagon: 8,
  'granny-square': 4,
};

export const MOTIF_NAMES: Readonly<Record<MotifShape, string>> = {
  circle: 'Lapos kör',
  square: 'Négyzet',
  hexagon: 'Hatszög',
  octagon: 'Nyolcszög',
  'granny-square': 'Nagymama-négyzet',
};

/** A generátor alapszemei. A nagymama-négyzet mindig egyráhajtásos pálcás. */
export const ROUND_STITCHES: readonly StitchDefId[] = ['sc', 'hdc', 'dc', 'tr'];
export const MAX_ROUNDS = 30;
/** Egy láncszembe legfeljebb ennyi szem kerülhet egy csoportban (stitch-variants.ts). */
const MAX_INTO_ONE = 12;

export interface MotifOptions {
  readonly shape: MotifShape;
  readonly stitch: StitchDefId;
  readonly rounds: number;
  readonly start: RoundStart;
  readonly closing: RoundClosing;
  /** Eltolt szaporítás; csak a lapos körnél számít. */
  readonly stagger: boolean;
  /** Színváltás minden ennyiedik kör után; 0: nincs. */
  readonly colorEvery: number;
  /** Lépcsőjavítás spirálban a színváltásnál; `null`: nincs. */
  readonly jogFix: JogFix | null;
  /** Bordás perem a kör zárása után, relief szemmel (PQW-909); spirálban nem választható. */
  readonly ribbing?: RibbingOptions | null;
}

export const DEFAULT_MOTIF: MotifOptions = {
  shape: 'circle',
  stitch: 'sc',
  rounds: 6,
  start: 'magic-ring',
  closing: 'join-slip',
  stagger: true,
  colorEvery: 0,
  jogFix: null,
  ribbing: null,
};

export type MotifResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly increases: FlatIncreases }
  | { readonly ok: false; readonly reason: string };

/** A választott forma és szem alapszeme: a nagymama-négyzeté az egyráhajtásos pálca. */
export function motifStitch(options: Pick<MotifOptions, 'shape' | 'stitch'>): StitchDefId {
  return options.shape === 'granny-square' ? 'dc' : options.stitch;
}

/** A körönkénti szaporítás a minta profiljából (vagy becsléssel), a formához. */
export function motifIncreases(pattern: Pattern, options: Pick<MotifOptions, 'shape' | 'stitch'>): FlatIncreases {
  const def = resolveStitch(motifStitch(options)) ?? resolveStitch('sc')!;
  return flatIncreases(def, gaugeContextOf(pattern, libraryFor(pattern)), MOTIF_CORNERS[options.shape]);
}

/** Mi nem választható a formához: a nagymama-négyzet láncszembe nem kezdhető és nem spirál. */
export function motifProblem(options: MotifOptions): string | null {
  if (!Number.isInteger(options.rounds) || options.rounds < 1 || options.rounds > MAX_ROUNDS) {
    return `A körök száma 1 és ${MAX_ROUNDS} között lehet.`;
  }
  if (!Number.isInteger(options.colorEvery) || options.colorEvery < 0) return 'A színváltás köreinek száma nem negatív egész szám.';
  if (!ROUND_STITCHES.includes(options.stitch)) return 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca vagy pálca.';
  if (options.shape === 'granny-square') {
    if (options.start === 'chain') return 'A nagymama-négyzet varázskörrel vagy láncgyűrűvel kezdődik.';
    if (options.closing === 'spiral') return 'A nagymama-négyzet köreit kúszószemmel zárjuk, spirálban nem horgolható.';
  }
  if (options.ribbing) {
    // A bordás perem a kör zárása után kezdődik: a spirálnak nincs zárása, ahonnan indulhatna (PQW-909).
    if (options.closing === 'spiral') return 'A bordás perem a kör zárása után kezdődik: spirálban nem készül, válaszd a kúszószemes zárást.';
    const ribbing = ribbingProblem(options.ribbing);
    if (ribbing !== null) return ribbing;
  }
  return null;
}

/**
 * Új minta a formából. A mintából a címet (ha nem az alapértelmezett), a
 * jelölést, a profilokat és a konvenciókat veszi át; a körzárás a választás.
 */
export function generateMotif(pattern: Pattern, options: MotifOptions): MotifResult {
  const problem = motifProblem(options);
  if (problem) return { ok: false, reason: problem };
  const def = resolveStitch(motifStitch(options))!;
  const increases = motifIncreases(pattern, options);
  const conventions = { ...pattern.conventions, roundEnd: options.closing };
  const base: Pattern = { ...pattern, conventions, pieces: [] };
  const writer = new Writer(base);

  const built =
    options.shape === 'granny-square'
      ? grannySquare(writer, options)
      : options.shape === 'circle'
        ? plainRounds(writer, def, options, circlePlan(increases.count, options.rounds, options.stagger))
        : plainRounds(writer, def, options, polygonPlan(MOTIF_CORNERS[options.shape]!, increases.exact, options.rounds));
  if (built !== null) return { ok: false, reason: built };

  const name = MOTIF_NAMES[options.shape];
  const piece = writer.piece('p1', name, MOTIF_CORNERS[options.shape]);
  const stated = withStatedCounts(base, piece);
  // Bordás perem a kör zárása után, relief szemmel (PQW-909).
  const whole: Pattern = { ...base, pieces: [stated] };
  const ribbed = options.ribbing ? appendRibbing(whole, stated, libraryFor(whole), options.ribbing) : stated;
  if (typeof ribbed === 'string') return { ok: false, reason: ribbed };
  // Az alapértelmezett és a generátor adta címet a forma neve váltja; a saját címet megtartjuk (PQW-896).
  const result = withGeneratedTitle({ ...base, pieces: [ribbed] }, pattern, name, Object.values(MOTIF_NAMES));
  return { ok: true, pattern: result, increases };
}

/**
 * Egy darab egy kész körtervből, a motívum kezdésével és körvégével (PQW-865):
 * a kendő köreit (kör, Pi-kendő) a kendőgenerátor tervezi, a gráfot ez építi.
 * A kész darabon a körvégi szemszám a gráf számolása; hibánál az ok.
 */
export function plannedRounds(pattern: Pattern, options: MotifOptions, plan: RoundPlan, name: string): Piece | string {
  const def = resolveStitch(motifStitch(options))!;
  const base: Pattern = { ...pattern, conventions: { ...pattern.conventions, roundEnd: options.closing }, pieces: [] };
  const writer = new Writer(base);
  const built = plainRounds(writer, def, { ...options, rounds: plan.rounds.length + 1 }, plan);
  if (built !== null) return built;
  return withStatedCounts(base, writer.piece('p1', name));
}

/* ---- Tervek: hány szem megy az előző kör egyes pozícióiba ---- */

export interface RoundPlan {
  /** Az 1. kör szemszáma. */
  readonly first: number;
  /** A 2. körtől körönként: az előző kör pozícióiba horgolt szemek száma, sorrendben. */
  readonly rounds: readonly (readonly number[])[];
}

const ones = (n: number) => Array<number>(n).fill(1);
const repeat = (unit: readonly number[], times: number) => Array.from({ length: times }, () => unit).flat();

/** Lapos kör `s` szaporítással (04 §3.1), eltolva a 04 §3.2 táblázata szerint. */
export function circlePlan(s: number, rounds: number, stagger: boolean): RoundPlan {
  const plan: number[][] = [];
  for (let k = 2; k <= rounds; k += 1) {
    if (k === 2) {
      plan.push(Array<number>(s).fill(2));
      continue;
    }
    const g = k - 2;
    if (!stagger) plan.push(repeat([...ones(g), 2], s));
    else if (k % 2 === 1) plan.push(repeat([2, ...ones(g)], s));
    else {
      const a = Math.floor(g / 2);
      plan.push([...ones(a), ...repeat([2, ...ones(g)], s - 1), 2, ...ones(g - a)]);
    }
  }
  return { first: s, rounds: plan };
}

/**
 * Szabályos sokszög `n` sarokkal, körönként `exact` szaporítással (04 §9.5):
 * az 1. kör `n` egyforma oldal, mindegyik a sarokszemmel végződik; utána a
 * szaporítás a sarkokba kerül, a maradék körönként másik sarkokba.
 */
export function polygonPlan(n: number, exact: number, rounds: number): RoundPlan {
  const first = Math.max(n, n * Math.round(exact / n));
  const plan: number[][] = [];
  let count = first;
  let corners = Array.from({ length: n }, (_, j) => ((j + 1) * first) / n - 1);
  for (let k = 2; k <= rounds; k += 1) {
    const total = Math.min(count, Math.max(0, Math.round(exact * k) - count));
    const each = Math.floor(total / n);
    const rest = total % n;
    const into = ones(count);
    corners.forEach((corner, j) => {
      into[corner] = 1 + each + ((((j - k) % n) + n) % n < rest ? 1 : 0);
    });
    const offsets: number[] = [];
    into.reduce((sum, value, i) => ((offsets[i] = sum), sum + value), 0);
    corners = corners.map((corner) => offsets[corner]! + (into[corner] === 1 ? 0 : Math.floor(into[corner]! / 2)));
    plan.push(into);
    count += total;
  }
  return { first, rounds: plan };
}

/* ---- Gráfépítés ---- */

class Writer {
  readonly stitches: StitchNode[] = [];
  readonly spaces: Space[] = [];
  readonly rings: Ring[] = [];
  readonly groups: StitchGroup[] = [];
  readonly events: LayerEvent[] = [];
  readonly pattern: Pattern;
  private previous: NodeId | null = null;

  constructor(pattern: Pattern) {
    this.pattern = pattern;
  }

  add(def: StitchDefId, anchors: readonly Anchor[] = []): NodeId {
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

  ring(): Anchor {
    const node = this.add('magic-ring');
    const id = `r${this.rings.length + 1}`;
    this.rings.push({ id, node });
    return { into: 'ring', id };
  }

  /** `n` szem egy célpontba; szembe horgolva kettőtől szaporításként, láncívbe és gyűrűbe csoport nélkül. */
  into(def: StitchDefId, anchor: Anchor, n: number): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def, [anchor]));
    if (anchor.into === 'stitch' && n >= 2) this.groups.push({ id: `g${this.groups.length + 1}`, def: `inc-${n}${def}`, members: ids });
    return ids;
  }

  event(kind: LayerEvent['kind'], extra: Partial<LayerEvent> = {}): void {
    this.events.push({ after: this.previous!, kind, ...extra });
  }

  piece(id: string, name: string, corners?: number): Piece {
    return {
      id,
      name,
      stitches: [...this.stitches],
      spaces: [...this.spaces],
      rings: [...this.rings],
      groups: [...this.groups],
      events: [...this.events],
      skipped: [],
      ...(corners === undefined ? {} : { corners }),
    };
  }

  graph(): PieceGraph {
    const piece = this.piece('p1', '');
    const pattern = { ...this.pattern, pieces: [piece] };
    return buildPieceGraph(pattern, piece, libraryFor(pattern));
  }

  countsFor(def: StitchDef): boolean {
    const { conventions } = this.pattern;
    return turningChainCountsFor(conventions.turningChainCounts, def, traditionOf(conventions), 'round');
  }
}

const both = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

/** A kör vége: zárás a kör első pozíciójába, spirálban az esemény; színváltással. */
function endRound(writer: Writer, options: MotifOptions, round: number, first: NodeId): void {
  const last = round === options.rounds;
  const color = options.colorEvery > 0 && !last && round % options.colorEvery === 0;
  const extra: Partial<LayerEvent> = color
    ? { colorChange: true, ...(options.closing === 'spiral' && options.jogFix ? { jogFix: options.jogFix } : {}) }
    : {};
  if (options.closing === 'join-slip') {
    writer.add('sl-st', [both(first)]);
    writer.event('join-slip', extra);
  } else writer.event(last ? 'fasten-off' : 'spiral', extra);
}

/** Az 1. kör célpontja a kezdés szerint; hiba esetén az üzenet. */
function startInto(writer: Writer, options: MotifOptions, def: StitchDef, stitches: number): Anchor | string {
  const chain = def.turningChain;
  switch (options.start) {
    case 'magic-ring': {
      const ring = writer.ring();
      return ring;
    }
    case 'chain-ring': {
      const chains = writer.chains(Math.max(4, Math.ceil(stitches / 4)));
      const space = writer.space(chains);
      writer.event('join-slip');
      writer.add('sl-st', [both(chains[0]!)]);
      return { into: 'space', id: space };
    }
    case 'chain': {
      if (stitches > MAX_INTO_ONE) return `Egy láncszembe legfeljebb ${MAX_INTO_ONE} szem fér: kezdd varázskörrel vagy láncgyűrűvel.`;
      const [base] = writer.chains(1 + chain);
      return both(base!);
    }
  }
}

/** Lapos kör és sokszög: az 1. kör a kezdésbe, utána a terv szerint. */
function plainRounds(writer: Writer, def: StitchDef, options: MotifOptions, plan: RoundPlan): string | null {
  const counts = writer.countsFor(def);
  const spiral = options.closing === 'spiral';

  // 1. kör: a kezdőlánc (számító kezdőláncnál ez az első szem), a többi szem a kezdésbe.
  const firstCounts = counts;
  const produced = plan.first - (firstCounts ? 1 : 0);
  const target = startInto(writer, options, def, produced);
  if (typeof target === 'string') return target;
  // A „2 lsz” kezdésnél a kezdőlánc az alapláncszem utáni láncszemek; máskor most horgoljuk.
  const turning =
    options.start === 'chain'
      ? writer.stitches.slice(writer.stitches.length - def.turningChain).map((node) => node.id)
      : writer.chains(def.turningChain);
  const stitches = writer.into(def.id, target, produced);
  endRound(writer, options, 1, firstCounts ? turning[turning.length - 1]! : stitches[0]!);

  for (let k = 2; k <= options.rounds; k += 1) {
    const below = writer.graph().layers[k - 1]!.positions;
    const into = plan.rounds[k - 2]!;
    if (into.length !== below.length) return `A(z) ${k}. kör terve nem illik az előző körhöz.`;
    const roundCounts = !spiral && counts;
    const chain = spiral ? [] : writer.chains(def.turningChain);
    let first: NodeId | undefined = roundCounts ? chain[chain.length - 1] : undefined;
    for (let i = 0; i < into.length; i += 1) {
      const extra = i === 0 && roundCounts ? into[i]! - 1 : into[i]!;
      if (extra > MAX_INTO_ONE) return `A(z) ${k}. körben egy szembe ${extra} szem kerülne: ennyit nem lehet egy szembe horgolni.`;
      if (extra <= 0) continue;
      const ids = writer.into(def.id, both(below[i]!), extra);
      first ??= ids[0];
    }
    endRound(writer, options, k, first!);
  }
  return null;
}

/** Nagymama-négyzet (03 §8): a 03 §8 kidolgozott példája tetszőleges körszámra. */
function grannySquare(writer: Writer, options: MotifOptions): string | null {
  const dc = resolveStitch('dc')!;
  const counts = writer.countsFor(dc);
  const firstCluster = counts ? 2 : 3;
  const target = startInto(writer, options, dc, 12);
  if (typeof target === 'string') return target;

  // 1. kör: 3 lsz, 2 erp, 2 lsz, (3 erp, 2 lsz) ×3, zárás.
  let turning = writer.chains(3);
  let firstDcs = writer.into('dc', target, firstCluster);
  let corners: SpaceId[] = [writer.space(writer.chains(2))];
  for (let i = 0; i < 3; i += 1) {
    writer.into('dc', target, 3);
    corners.push(writer.space(writer.chains(2)));
  }
  let sides: SpaceId[][] = corners.map(() => []);
  endRound(writer, options, 1, counts ? turning[2]! : firstDcs[0]!);

  for (let k = 2; k <= options.rounds; k += 1) {
    // Kúszószemekkel a kör első sarokívéhez.
    for (const id of firstDcs) writer.add('sl-st', [both(id)]);
    writer.add('sl-st', [{ into: 'space', id: corners[0]! }]);
    turning = writer.chains(3);
    const nextCorners: SpaceId[] = [];
    const nextSides: SpaceId[][] = [];
    corners.forEach((corner, i) => {
      const cornerAnchor: Anchor = { into: 'space', id: corner };
      const before = writer.into('dc', cornerAnchor, i === 0 ? firstCluster : 3);
      if (i === 0) firstDcs = before;
      nextCorners.push(writer.space(writer.chains(2)));
      writer.into('dc', cornerAnchor, 3);
      const after = [writer.space(writer.chains(1))];
      for (const side of sides[i]!) {
        writer.into('dc', { into: 'space', id: side }, 3);
        after.push(writer.space(writer.chains(1)));
      }
      nextSides.push(after);
    });
    corners = nextCorners;
    sides = nextSides;
    endRound(writer, options, k, counts ? turning[2]! : firstDcs[0]!);
  }
  return null;
}

/** A körvégi eseményekbe a gráf szerinti szemszám; a láncgyűrű zárása a 0. réteg vége, oda nem kerül. */
function withStatedCounts(pattern: Pattern, piece: Piece): Piece {
  const graph = buildPieceGraph({ ...pattern, pieces: [piece] }, piece, libraryFor({ ...pattern, pieces: [piece] }));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) if (layer.closing) stated.set(layer.closing.after, layer.stitchCount);
  return {
    ...piece,
    events: piece.events.map((event) => (stated.has(event.after) ? { ...event, statedCount: stated.get(event.after)! } : event)),
  };
}
