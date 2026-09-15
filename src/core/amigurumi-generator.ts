/*
 * Amigurumi-generátor (PQW-863): a forma körtervéből (amigurumi.ts) szemgráf
 * spirálban, varázskörrel és jelölésekkel; több rész egy mintában, varrva vagy
 * folytatólagosan. A kész gráfot ugyanaz az ellenőrző, rajz és írott minta
 * dolgozza fel, mint a kézzel horgoltat.
 *
 * - Körzárás: amigurumiban spirál (tulajdonosi döntés, 2026-09-14).
 * - Az 1. kör a varázskörbe megy, egy láncszemes kezdőlánccal, ahogy a
 *   körgenerátorban (round-generator.ts).
 * - Szaporítás: két rövidpálca egy szembe. Fogyasztás: láthatatlan fogyasztás
 *   az első szálakba (04 §3.3); a hátsó szálas körben két rövidpálca
 *   összehorgolása a hátsó szálakba.
 * - Eltolás (04 §3.2, §9.1): az egymás utáni szaporító, illetve fogyasztó
 *   körök közül minden második kör szaporítása vagy fogyasztása a szakasz
 *   közepére kerül. A varázskör köre a szaporító sorozat első köre; így jön ki
 *   a 04 §4.4 példája.
 * - Jelölések (04 §5.6, §5.7, §9.8): zárt végnél a szem és a tömés kezdete az
 *   utolsó olyan kör után, amely még nagyobb a legnagyobb szemszám felénél;
 *   nyitott végnél az utolsó kör után. 3 év alatti gyereknek hímzett szem. A
 *   zárt vég utolsó köre után a nyílás összehúzása.
 * - Varrás (04 §5.4): az új rész szélét (nyitott végnél az utolsó kör, zártnál
 *   a jelölés köre) az előző rész azonos szemszámú körére varrjuk, ha több
 *   ilyen van, a későbbire; ha nincs, a legközelebbire, és akkor elosztás kell.
 * - Folytatólagosan: az új rész 1. köre az előző rész nyitott utolsó körébe
 *   megy; eltérő szemszámnál egyenletes elosztással (legfeljebb duplázás vagy
 *   felezés), különben hiba.
 */

import { SHAPE_NAMES, evenDistribution, roundOps, shapeGaugeOf, shapeSchedule, type Schedule } from './amigurumi.ts';
import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { withGeneratedTitle } from './pattern-title.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  PieceSection,
  Ring,
  RoundMark,
  ShapeSpec,
  StitchDefId,
  StitchGroup,
  StitchInsertion,
  StitchNode,
} from './types.ts';

export interface PartOptions {
  /** A rész neve, pl. „Fej”; üresen a forma neve. */
  readonly name: string;
  readonly shape: ShapeSpec;
  /** Eltolt szaporítás és fogyasztás. */
  readonly stagger: boolean;
  /** Ebbe a részbe kerül a szem (biztonsági, vagy 3 év alatt hímzett). */
  readonly eyes: boolean;
}

export type JoinMethod = 'sewn' | 'continuous';

export interface JoinOptions {
  readonly method: JoinMethod;
  /** Eltérő szemszámnál egyenletes elosztás; enélkül az eltérés hiba. */
  readonly distribute: boolean;
}

export type AmigurumiResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly schedule: Schedule }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): AmigurumiResult => ({ ok: false, reason });

const OPEN_START = 'Nyitott kezdésű rész csak folytatólagosan, egy előző rész nyitott végéhez kapcsolható.';

export function partName(part: PartOptions): string {
  return part.name.trim() || SHAPE_NAMES[part.shape.kind];
}

/**
 * Új minta egyetlen részből. A mintából a címet (ha nem az alapértelmezett),
 * a jelölést és a profilokat veszi át; a körzárás spirál.
 */
export function createAmigurumi(pattern: Pattern, part: PartOptions, under3: boolean): AmigurumiResult {
  const planned = shapeSchedule(part.shape, shapeGaugeOf(pattern, part.shape));
  if (!planned.ok) return planned;
  const { schedule } = planned;
  if (schedule.start === 'open') return fail(OPEN_START);

  const name = partName(part);
  const writer = new PieceWriter();
  const marks = sectionMarks(schedule, part.eyes, under3);
  const problem = writeSection(writer, { schedule, stagger: part.stagger, below: null, marks, firstLayer: 1, conventions: pattern.conventions });
  if (problem) return fail(problem);

  const built: Pattern = {
    formatVersion: pattern.formatVersion,
    title: name,
    ...(pattern.notation ? { notation: pattern.notation } : {}),
    ...(pattern.gauge ? { gauge: pattern.gauge } : {}),
    conventions: { ...pattern.conventions, roundEnd: 'spiral' },
    pieces: [writer.piece('p1', name, [sectionOf(part, name, 1)])],
    toy: { under3 },
  };
  // A saját cím marad, különben a rész neve (PQW-896).
  const result = withGeneratedTitle(built, pattern, name, Object.values(SHAPE_NAMES));
  return { ok: true, pattern: result, schedule };
}

/** Új rész a minta utolsó darabjához kapcsolva, varrva vagy folytatólagosan. */
export function addAmigurumiPart(pattern: Pattern, part: PartOptions, join: JoinOptions, under3: boolean): AmigurumiResult {
  const previous = pattern.pieces.at(-1);
  if (!previous?.sections?.length) {
    return fail('Előbb hozz létre egy részt az „Új minta ebből” gombbal; a következő rész ehhez kapcsolódik.');
  }
  const planned = shapeSchedule(part.shape, shapeGaugeOf(pattern, part.shape));
  if (!planned.ok) return planned;
  const { schedule } = planned;

  let graph: PieceGraph;
  try {
    graph = buildPieceGraph(pattern, previous, libraryFor(pattern));
  } catch {
    return fail('Az előző rész szerkezete hibás, ezért nem kapcsolható hozzá új rész; a hibákat az Ellenőrzés sorolja fel.');
  }
  const lastLayer = graph.layers.length - 1;
  const lastCount = graph.layers[lastLayer]!.stitchCount;
  const closedEnd = previous.events.at(-1)?.marks?.includes('close-opening') === true;
  const name = partName(part);
  const marks = sectionMarks(schedule, part.eyes, under3);
  const conventions = { ...pattern.conventions, roundEnd: 'spiral' as const };

  if (join.method === 'continuous') {
    if (closedEnd) return fail('Folytatólagosan csak nyitott végű részhez lehet kapcsolni, az előző rész vége zárt. Válaszd nála a nyitott véget, vagy varrd a részeket.');
    if (schedule.start !== 'open') return fail('A folytatólagosan kapcsolt rész nyitott kezdésű: válaszd a henger vagy a forgástest nyitott kezdését.');
    const first = schedule.counts[0]!;
    if (first !== lastCount && !join.distribute) {
      return fail(`Az előző rész utolsó köre ${lastCount} szem, az új rész első köre ${first} szem. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.`);
    }
    const writer = new PieceWriter(previous);
    writer.continueFromEnd();
    const problem = writeSection(writer, { schedule, stagger: part.stagger, below: graph.layers[lastLayer]!.positions, marks, firstLayer: lastLayer + 1, conventions });
    if (problem) return fail(problem);
    const piece = writer.piece(previous.id, previous.name, [...previous.sections, sectionOf(part, name, lastLayer + 1)]);
    return { ok: true, pattern: { ...pattern, conventions, pieces: [...pattern.pieces.slice(0, -1), piece], toy: { under3 } }, schedule };
  }

  if (schedule.start === 'open') return fail(OPEN_START);
  const id = `p${1 + Math.max(0, ...pattern.pieces.map((piece) => Number(/\d+$/.exec(piece.id)?.[0] ?? 0)))}`;
  const writer = new PieceWriter();
  const problem = writeSection(writer, { schedule, stagger: part.stagger, below: null, marks, firstLayer: 1, conventions });
  if (problem) return fail(problem);

  const ownLayer = (schedule.end === 'open' ? schedule.counts.length - 1 : markRound(schedule)) + 1;
  const ownCount = schedule.counts[ownLayer - 1]!;
  const target = closedEnd ? closestLayer(graph, ownCount) : lastLayer;
  const targetCount = graph.layers[target]!.stitchCount;
  if (ownCount !== targetCount && !join.distribute) {
    return fail(`Az új rész ${ownLayer}. körén ${ownCount} szem van, az előző rész ${target}. körén ${targetCount}. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.`);
  }
  const joined = {
    a: { piece: id, layer: ownLayer },
    b: { piece: previous.id, layer: target },
    ...(ownCount === targetCount ? {} : { distribution: evenDistribution(ownCount, targetCount) }),
  };
  return {
    ok: true,
    pattern: {
      ...pattern,
      conventions,
      pieces: [...pattern.pieces, writer.piece(id, name, [sectionOf(part, name, 1)])],
      joins: [...(pattern.joins ?? []), joined],
      toy: { under3 },
    },
    schedule,
  };
}

function sectionOf(part: PartOptions, name: string, layer: number): PieceSection {
  return { name, layer, shape: part.shape, stagger: part.stagger };
}

/** Az előző rész köre a varráshoz: az azonos szemszámú, több ilyennél a későbbi; ha nincs, a legközelebbi. */
function closestLayer(graph: PieceGraph, count: number): number {
  let best = graph.layers.length - 1;
  for (let index = 1; index < graph.layers.length; index += 1) {
    if (Math.abs(graph.layers[index]!.stitchCount - count) <= Math.abs(graph.layers[best]!.stitchCount - count)) best = index;
  }
  return best;
}

/* ---- Jelölések ---- */

/**
 * A szem és a tömés köre (0-tól): zárt végnél az utolsó kör a csúcs után,
 * amely még nagyobb a legnagyobb szemszám felénél (04 §4.4, §9.8); nyitott
 * végnél az utolsó kör.
 */
export function markRound(schedule: Schedule): number {
  const { counts } = schedule;
  const last = counts.length - 1;
  if (schedule.end !== 'closed') return last;
  const max = Math.max(...counts);
  const peak = counts.lastIndexOf(max);
  const small = counts.findIndex((count, i) => i > peak && count <= max / 2);
  return small > 0 ? small - 1 : last;
}

/** A rész jelölései körönként (0-tól). */
export function sectionMarks(schedule: Schedule, eyes: boolean, under3: boolean): Map<number, RoundMark[]> {
  const marks = new Map<number, RoundMark[]>();
  const atMark: RoundMark[] = [];
  if (eyes) atMark.push(under3 ? 'embroider-eyes' : 'safety-eyes');
  // A lapos ovális (pl. talp, PQW-890) nem tömött.
  if (schedule.start !== 'chain') atMark.push('stuffing');
  if (atMark.length > 0) marks.set(markRound(schedule), atMark);
  if (schedule.end === 'closed') {
    const last = schedule.counts.length - 1;
    marks.set(last, [...(marks.get(last) ?? []), 'close-opening']);
  }
  return marks;
}

/* ---- Gráfépítés ---- */

const into = (id: NodeId, mode: StitchInsertion): Anchor => ({ into: 'stitch', id, mode });

/** Sűrű a kör, ha a pozíciók ennél nagyobb hányada szaporít vagy fogy. */
const DENSE_SHARE = 0.4;
/** A harmadik egymás fölé kerülés ára: bármennyi második is olcsóbb (rounds.ts `STACK_LIMIT`). */
const STACK_COST = 1000;

interface SectionWrite {
  readonly schedule: Schedule;
  readonly stagger: boolean;
  /** Az előző rész utolsó körének pozíciói; `null`: varázskörrel kezdődik. */
  readonly below: readonly NodeId[] | null;
  readonly marks: ReadonlyMap<number, readonly RoundMark[]>;
  /** A rész első körének sorszáma a darabban, az üzenetekhez. */
  readonly firstLayer: number;
  /** A minta konvenciói: az ovális kezdőláncának számolásához (tradition.ts). */
  readonly conventions: PatternConventions;
}

/** A rész körei spirálban; hiba esetén az üzenet. */
function writeSection(writer: PieceWriter, section: SectionWrite): string | null {
  if (section.schedule.oval && section.below === null) return writeOval(writer, section);
  const { counts, backLoop } = section.schedule;
  let positions: readonly NodeId[] = section.below ?? [];
  // Hány egymás fölötti szaporítás, illetve fogyasztás áll a pozíción (rounds.ts `stackedIncreases`).
  let depth = { inc: positions.map(() => 0), dec: positions.map(() => 0) };
  let direction = 0;
  let run = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const count = counts[i]!;
    const loop: StitchInsertion = backLoop.includes(i) ? 'back-loop' : 'both-loops';
    const produced: NodeId[] = [];
    const next = { inc: [] as number[], dec: [] as number[] };
    if (i === 0 && section.below === null) {
      const ring = writer.ring();
      writer.add('ch');
      produced.push(...writer.into(ring, count));
      next.inc.push(...produced.map(() => 0));
      next.dec.push(...produced.map(() => 0));
      direction = 1;
      run = 0;
    } else {
      const sign = Math.sign(count - positions.length);
      run = sign !== 0 && sign === direction ? run + 1 : 0;
      direction = sign;
      // Ha az előző kör minden szeme szaporítás, onnan nincs hová eltolni, és az ellenőrző sem számol tovább.
      const incDepth = depth.inc.every((d) => d > 0) ? depth.inc.map(() => 0) : depth.inc;
      const deep = sign > 0 ? incDepth : depth.dec;
      // A harmadik egymás fölé kerülés tilos; sűrű körben a másodikat is kerüljük, hogy a következő körnek maradjon hely.
      const dense = Math.abs(count - positions.length) > DENSE_SHARE * positions.length;
      const cost = (position: number) => {
        const d = deep[position] ?? 0;
        return d >= 2 ? STACK_COST : dense && d >= 1 ? 1 : 0;
      };
      const ops = roundOps(positions.length, count, section.stagger && run % 2 === 1, cost);
      if (!ops) {
        return `A ${section.firstLayer + i}. körben ${positions.length} szemből ${count} lenne: egy körben legfeljebb duplázás vagy felezés fér bele.`;
      }
      let p = 0;
      for (const op of ops) {
        if (op === 'sc') {
          produced.push(writer.add('sc', [into(positions[p]!, loop)]));
          next.inc.push(0);
          next.dec.push(0);
          p += 1;
        } else if (op === 'inc') {
          produced.push(...writer.into(into(positions[p]!, loop), 2));
          next.inc.push(incDepth[p]! + 1, incDepth[p]! + 1);
          next.dec.push(0, 0);
          p += 1;
        } else {
          const [def, mode]: [StitchDefId, StitchInsertion] = loop === 'back-loop' ? ['sc2tog', 'back-loop'] : ['invdec', 'front-loop'];
          produced.push(writer.add(def, [into(positions[p]!, mode), into(positions[p + 1]!, mode)]));
          next.inc.push(0);
          next.dec.push(Math.max(depth.dec[p]!, depth.dec[p + 1]!) + 1);
          p += 2;
        }
      }
    }
    positions = produced;
    depth = next;
    const marks = section.marks.get(i);
    writer.event(i === counts.length - 1 ? 'fasten-off' : 'spiral', { statedCount: count, ...(marks?.length ? { marks } : {}) });
  }
  return null;
}

/**
 * Ovális láncalapról (04 §3.4, §9.4, PQW-890, PQW-899). L láncszem; a horoghoz
 * legközelebbi T a kezdőlánc (a szem fordulólánca), a szem a kör szabálya
 * szerint számít vagy nem (tradition.ts). Az 1. kör elöl a horogtól távolodva
 * minden láncszembe, a legtávolabbiba összesen `perEnd` + 1 szem, a láncszemek
 * másik oldalán vissza, a horoghoz legközelebbibe összesen `perEnd` szem; ha a
 * kezdőlánc számít, az ennek a végnek az egyik szeme, és eggyel kevesebb megy a
 * láncszembe. Utána minden körben a két végen végenként `perEnd` szaporítás
 * egyenletesen elosztva, eltolással és a harmadik egymás fölé kerülés
 * elkerülésével; az egyenes oldalakon egy-egy szem.
 */
function writeOval(writer: PieceWriter, section: SectionWrite): string | null {
  const { counts, oval } = section.schedule;
  const { chains: L, perEnd, stitch, turningChain: T } = oval!;
  const { conventions } = section;
  const counted = turningChainCountsFor(conventions.turningChainCounts, resolveStitch(stitch)!, traditionOf(conventions), 'round');
  const chains = Array.from({ length: L }, () => writer.add('ch'));
  // A kezdőlánc a horoghoz legközelebbi T láncszem (fonalsorrendben az utolsók); a többi a munkált láncalap.
  const working = chains.slice(0, L - T);
  const W = working.length;
  const other = (id: NodeId): Anchor => ({ into: 'underside', id });

  // A számító kezdőlánc a kör első pozíciója: a tetejébe megy a következő kör első szeme.
  let positions: NodeId[] = counted ? [chains[L - 1]!] : [];
  for (let k = W - 1; k >= 1; k -= 1) positions.push(writer.add(stitch, [into(working[k]!, 'both-loops')]));
  positions.push(...writer.into(into(working[0]!, 'both-loops'), perEnd + 1, stitch));
  for (let k = 1; k <= W - 2; k += 1) positions.push(writer.add(stitch, [other(working[k]!)]));
  positions.push(...writer.into(other(working[W - 1]!), counted ? perEnd - 1 : perEnd, stitch));

  // A kör felépítése fonalsorrendben: a B vég eleje (c), egyenes (s), A vég (a), egyenes (s), a B vég többi része (a − c).
  const straight = W - 2;
  let end = perEnd + 1;
  let head = counted ? 2 : 1;
  let depth = positions.map(() => 0);
  for (let i = 0; i < counts.length; i += 1) {
    if (i > 0) {
      const P = positions.length;
      const ops = new Map<number, 'sc' | 'inc'>();
      const region = (indices: readonly number[]) => {
        const cost = (j: number) => ((depth[indices[j]!] ?? 0) >= 2 ? STACK_COST : 0);
        const planned = roundOps(indices.length, indices.length + perEnd, section.stagger && i % 2 === 0, cost);
        if (!planned) return false;
        planned.forEach((op, j) => ops.set(indices[j]!, op === 'inc' ? 'inc' : 'sc'));
        return true;
      };
      const endA = Array.from({ length: end }, (_, j) => head + straight + j);
      const endB = [...Array.from({ length: end - head }, (_, j) => P - (end - head) + j), ...Array.from({ length: head }, (_, j) => j)];
      if (!region(endA) || !region(endB)) return `Az ovális ${section.firstLayer + i}. körében a végek szaporítása nem fér el.`;
      const produced: NodeId[] = [];
      const next: number[] = [];
      let nextHead = 0;
      positions.forEach((position, p) => {
        const inc = ops.get(p) === 'inc';
        const ids = inc ? writer.into(into(position, 'both-loops'), 2, stitch) : [writer.add(stitch, [into(position, 'both-loops')])];
        produced.push(...ids);
        for (const _ of ids) next.push(inc ? (depth[p] ?? 0) + 1 : 0);
        if (p < head) nextHead += ids.length;
      });
      positions = produced;
      depth = next;
      head = nextHead;
      end += perEnd;
    }
    if (positions.length !== counts[i]) return `Az ovális ${section.firstLayer + i}. köre ${positions.length} szem lett ${counts[i]} helyett: ez a program hibája, kérlek, jelezd.`;
    const marks = section.marks.get(i);
    writer.event(i === counts.length - 1 ? 'fasten-off' : 'spiral', { statedCount: counts[i]!, ...(marks?.length ? { marks } : {}) });
  }
  return null;
}

class PieceWriter {
  readonly #base: Piece | undefined;
  readonly #stitches: StitchNode[];
  readonly #rings: Ring[];
  readonly #groups: StitchGroup[];
  readonly #events: LayerEvent[];
  #next: number;

  constructor(base?: Piece) {
    this.#base = base;
    this.#stitches = [...(base?.stitches ?? [])];
    this.#rings = [...(base?.rings ?? [])];
    this.#groups = [...(base?.groups ?? [])];
    this.#events = [...(base?.events ?? [])];
    const used = [...this.#stitches, ...this.#rings, ...this.#groups, ...(base?.spaces ?? [])].map((item) => Number(/\d+$/.exec(item.id)?.[0] ?? 0));
    this.#next = Math.max(0, ...used) + 1;
  }

  add(def: StitchDefId, anchors: readonly Anchor[] = []): NodeId {
    const id = `n${this.#next++}`;
    this.#stitches.push({ id, def, prev: this.#stitches.at(-1)?.id ?? null, anchors });
    return id;
  }

  ring(): Anchor {
    const node = this.add('magic-ring');
    const id = `r${this.#next++}`;
    this.#rings.push({ id, node });
    return { into: 'ring', id };
  }

  /** `n` szem (alapértelmezésben rövidpálca) egy célpontba; szembe horgolva kettőtől szaporításként. */
  into(anchor: Anchor, n: number, def: StitchDefId = 'sc'): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def, [anchor]));
    if ((anchor.into === 'stitch' || anchor.into === 'underside') && n >= 2) this.#groups.push({ id: `g${this.#next++}`, def: `inc-${n}${def}`, members: ids });
    return ids;
  }

  event(kind: LayerEvent['kind'], extra: Partial<LayerEvent> = {}): void {
    this.#events.push({ after: this.#stitches.at(-1)!.id, kind, ...extra });
  }

  /** A darab végén a fonal elvágása helyett spirál: a következő rész innen folytatódik. */
  continueFromEnd(): void {
    const last = this.#events.at(-1);
    if (last && last.after === this.#stitches.at(-1)?.id) this.#events[this.#events.length - 1] = { ...last, kind: 'spiral' };
  }

  piece(id: string, name: string, sections: readonly PieceSection[]): Piece {
    return {
      id,
      name,
      stitches: [...this.#stitches],
      spaces: [...(this.#base?.spaces ?? [])],
      rings: [...this.#rings],
      groups: [...this.#groups],
      events: [...this.#events],
      skipped: [...(this.#base?.skipped ?? [])],
      ...(this.#base?.corners === undefined ? {} : { corners: this.#base.corners }),
      sections,
    };
  }
}
