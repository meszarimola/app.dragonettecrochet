/*
 * A vászon: a számolt elrendezés kirajzolása, a nézet (nagyítás, eltolás) és
 * a találatkeresés.
 *
 * A diagram koordinátái a src/core/layout.ts egységében vannak; a képernyőre
 * a nézet léptéke és eltolása viszi, a HiDPI-felbontást a kontextus
 * léptékezése intézi. A vászon nem tud a mintáról, csak a jelenetről, amelyet a
 * main.ts ad át.
 *
 * A rács (PQW-874) a jelek alatt rajzolódik, és a nézettel együtt
 * skálázódik; a vonalai a képernyőn állandó vastagságúak. A sorszám a sor
 * színével teli címkén áll, és önálló, kattintható célterület. A feliratok a
 * minta hagyományát követik (src/ui/chart-labels.ts, PQW-876).
 */

import { aimAt, chartBounds, gridHit, type ChartGrid } from '../core/grid.js';
import type { ChartLayout, Point } from '../core/layout.js';
import type { StitchLibrary } from '../core/stitch-library.js';
import type { Finding, NodeId, StitchInsertion, Tradition } from '../core/types.js';
import { chartLabels } from './chart-labels.js';
import { gridPaths, LINE_WIDTH, type GridPaths } from './grid-paths.js';
import { applyInk, drawShapes, placedShapes, type SymbolOptions } from './symbols.js';

export interface Target {
  readonly point: Point;
  readonly used: boolean;
}

/** A most horgolt sor haladási irányát és elejét mutató nyíl (PQW-879). */
export interface DirectionArrow {
  /** A sor eleje: innen indul a nyíl. */
  readonly from: Point;
  /** A haladási irányt kijelölő pont; a nyíl efelé mutat. */
  readonly to: Point;
}

export interface Scene {
  readonly layout: ChartLayout;
  readonly library: StitchLibrary;
  readonly targets: readonly Target[];
  readonly cursor: number | null;
  readonly hover: number | null;
  readonly selected: NodeId | null;
  /** A kijelölt szemek (PQW-875); a `selected` ezek közül a fókusz. */
  readonly selection?: readonly NodeId[];
  /** Törlés előtt a törlendőkbe horgolt, érintett szemek. */
  readonly affected?: readonly NodeId[];
  /** A húzott kijelölő téglalap két sarka diagram-koordinátában. */
  readonly marquee?: { readonly from: Point; readonly to: Point } | null;
  readonly findings: readonly Finding[];
  /** A most horgolt sor iránynyila, vagy `null`. */
  readonly direction: DirectionArrow | null;
  /** A jelek stílusa és a rövidpálca jele (PQW-868). */
  readonly symbols: SymbolOptions;
  /** A szemek tárolt, színoldali beszúrási módja a talp jelöléséhez (PQW-869); hiányában a szem alapértelmezése. */
  readonly insertions?: ReadonlyMap<NodeId, StitchInsertion>;
  /** A rács (PQW-874), vagy `null`, ha ki van kapcsolva. */
  readonly grid: ChartGrid | null;
  /** A minta hagyománya a sorszám és a szemszám feliratához (PQW-876); hiányában CYC. */
  readonly tradition?: Tradition;
  /** A rácsminta ismétlő egységének keretei diagram-koordinátában (PQW-864); C2C-ben csempénként (PQW-894). */
  readonly unitFrames?: readonly { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }[];
  /** A lejjebb horgolt hosszú szemek: a talpuknál pötty jelöli őket (mozaik, PQW-894). */
  readonly spikes?: ReadonlySet<NodeId>;
}

/** A vászon egy téglalapja vászon-koordinátában (a takarás nélküli rész). */
export interface Area {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

/** A sorszám címkéje diagram-koordinátában. */
interface Label {
  readonly layer: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
/** Az „Egész minta” ennél kisebbre nem kicsinyít, hogy a rajz ne vesszen el. */
const MIN_FIT_SCALE = 0.05;
/** Ennyi képernyőpixelen belül talál a kattintás célpontot vagy jelet. */
const HIT = 16;
const LABEL_HEIGHT = 16;
/** A sorszám célterülete a képernyőn legalább ekkora (WCAG 2.5.8). */
const MIN_TARGET = 24;

function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

export class Board {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #view: View = { scale: 1.5, x: 40, y: 200 };
  #scene: Scene | null = null;
  #labels: Label[] = [];
  /** A rács útvonalai; csak új rácsnál számoljuk újra, eltoláskor nem. */
  #paths: { readonly grid: ChartGrid; readonly paths: GridPaths } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D vászon-kontextus nem érhető el.');
    this.#canvas = canvas;
    this.#ctx = ctx;
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  get scale(): number {
    return this.#view.scale;
  }

  setScene(scene: Scene): void {
    this.#scene = scene;
    this.render();
  }

  /** Ablak-koordinátából diagram-koordináta. */
  toChart(clientX: number, clientY: number): Point {
    const rect = this.#canvas.getBoundingClientRect();
    const { scale, x, y } = this.#view;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  /** Diagram-koordinátából ablak-koordináta. */
  toClient(p: Point): Point {
    const rect = this.#canvas.getBoundingClientRect();
    const s = this.#toScreen(p);
    return { x: s.x + rect.left, y: s.y + rect.top };
  }

  #toScreen(p: Point): Point {
    const { scale, x, y } = this.#view;
    return { x: p.x * scale + x, y: p.y * scale + y };
  }

  /** A legközelebbi célpont indexe a mutató alatt. */
  targetAt(clientX: number, clientY: number): number | null {
    const targets = this.#scene?.targets ?? [];
    return this.#nearest(clientX, clientY, targets.map((target) => target.point));
  }

  /**
   * A mutató alatti célpont. Bekapcsolt rácson a cella dönt (PQW-874): ahol
   * nincs mibe horgolni, az üzenet jön vissza. A rácson kívül és rács nélkül
   * a legközelebbi célpont.
   */
  aimUnder(clientX: number, clientY: number): number | string | null {
    const grid = this.#scene?.grid;
    if (grid) {
      const hit = gridHit(grid, this.toChart(clientX, clientY));
      if (hit) {
        const aim = aimAt(grid, hit);
        return aim.kind === 'target' ? aim.slot : aim.message;
      }
    }
    return this.targetAt(clientX, clientY);
  }

  /** A sorszám a mutató alatt: a sor vagy kör száma, vagy `null`. */
  labelAt(clientX: number, clientY: number): number | null {
    const p = this.toChart(clientX, clientY);
    const pad = (size: number) => Math.max(0, (MIN_TARGET / this.#view.scale - size) / 2);
    const label = this.#labels.find((l) => {
      const [px, py] = [pad(l.x1 - l.x0), pad(l.y1 - l.y0)];
      return p.x >= l.x0 - px && p.x <= l.x1 + px && p.y >= l.y0 - py && p.y <= l.y1 + py;
    });
    return label?.layer ?? null;
  }

  /** A sorszámok közepe ablak-koordinátában (böngészős tesztekhez). */
  labels(): { layer: number; x: number; y: number }[] {
    return this.#labels.map((l) => ({ layer: l.layer, ...this.toClient({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2 }) }));
  }

  /** A rács cellái ablak-koordinátában (böngészős tesztekhez). */
  gridCells(): { layer: number; index: number; slot: number | null; x: number; y: number }[] {
    const cells = this.#scene?.grid?.cells ?? [];
    return cells.map((cell) => ({ layer: cell.layer, index: cell.index, slot: cell.slot, ...this.toClient(cell.center) }));
  }

  /** A legközelebbi jel a mutató alatt (a teteje vagy a középpontja). */
  nodeAt(clientX: number, clientY: number): NodeId | null {
    const nodes = [...(this.#scene?.layout.nodes.values() ?? [])];
    const index = this.#nearest(clientX, clientY, nodes.map((node) => node.top));
    return index === null ? null : nodes[index]!.id;
  }

  #nearest(clientX: number, clientY: number, points: readonly Point[]): number | null {
    const p = this.toChart(clientX, clientY);
    let best: number | null = null;
    let bestDistance = HIT / this.#view.scale;
    points.forEach((point, i) => {
      const distance = Math.hypot(point.x - p.x, point.y - p.y);
      if (distance <= bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    return best;
  }

  zoom(factor: number): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    // Az illesztés a legkisebb lépcső alá is mehet; onnan kicsinyítve a nézet nem ugrik vissza nagyobbra.
    const scale = Math.min(MAX_SCALE, Math.max(Math.min(MIN_SCALE, this.#view.scale), this.#view.scale * factor));
    const k = scale / this.#view.scale;
    this.#view.x = width / 2 - (width / 2 - this.#view.x) * k;
    this.#view.y = height / 2 - (height / 2 - this.#view.y) * k;
    this.#view.scale = scale;
    this.render();
  }

  /** A rács befoglaló téglalapja ablak-koordinátában, rács nélkül `null` (böngészős tesztekhez, PQW-887). */
  gridBounds(): { left: number; top: number; right: number; bottom: number } | null {
    const grid = this.#scene?.grid;
    if (!grid || grid.bands.length === 0) return null;
    const a = this.toClient({ x: grid.bounds.minX, y: grid.bounds.minY });
    const b = this.toClient({ x: grid.bounds.maxX, y: grid.bounds.maxY });
    return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) };
  }

  /**
   * Az egész minta a látható részbe. Az `inset…` értékek a vászon fölött nyitott
   * panelek mérete: oldalt a szélességük, alul (az írott minta) a magasságuk.
   * Bekapcsolt rácsnál a rács széle is belefér (PQW-887).
   */
  fit(insetRight = 0, insetLeft = 0, insetBottom = 0): void {
    const layout = this.#scene?.layout;
    const { width, height } = this.#canvas.getBoundingClientRect();
    const roomY = height - insetBottom;
    // A teljes vásznat elfedő panel mögé nincs mit illeszteni (PQW-885).
    if (roomY < 1) return;
    if (!layout || layout.nodes.size === 0) {
      Object.assign(this.#view, { scale: 1.5, x: insetLeft + 60, y: roomY * 0.7 });
      this.render();
      return;
    }
    const { minX, minY, maxX, maxY } = chartBounds(layout, this.#scene?.grid);
    const room = Math.max(width - insetRight - insetLeft, 120);
    // Alacsony látható sávban a margó is kisebb, hogy a minta ne kerüljön a takarásba.
    const marginY = Math.min(72, roomY / 2);
    // Az egész minta akkor is kifér, ha ehhez a nagyítás legkisebb lépcsőjénél kisebb lépték kell (PQW-887).
    const scale = Math.min(2, Math.max(MIN_FIT_SCALE, Math.min((room - 48) / (maxX - minX), (roomY - marginY) / (maxY - minY))));
    this.#view.scale = scale;
    this.#view.x = insetLeft + (room - (maxX - minX) * scale) / 2 - minX * scale;
    this.#view.y = (roomY - (maxY - minY) * scale) / 2 - minY * scale;
    this.render();
  }

  /** Csak akkor tol a nézeten, ha a pont kilóg a látható részből; így szerkesztés közben a diagram nem ugrál. */
  ensureVisible(point: Point, insetRight = 0, insetLeft = 0, insetBottom = 0): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const roomY = height - insetBottom;
    if (roomY < 1) return;
    const s = this.#toScreen(point);
    // A margó legfeljebb a látható sáv fele, különben keskeny sávban a pont a két szél között ugrálna (PQW-885).
    const padX = Math.min(48, Math.max(0, (width - insetRight - insetLeft) / 2));
    const padY = Math.min(48, roomY / 2);
    let dx = 0;
    let dy = 0;
    if (s.x < insetLeft + padX) dx = insetLeft + padX - s.x;
    else if (s.x > width - insetRight - padX) dx = width - insetRight - padX - s.x;
    if (s.y < padY) dy = padY - s.y;
    else if (s.y > roomY - padY) dy = roomY - padY - s.y;
    if (dx === 0 && dy === 0) return;
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
  }

  /** Az egész minta (bekapcsolt rácsnál a rács is) a megadott részen belül van-e (vászon-koordinátában); üres mintánál nem. */
  patternWithin(area: Area): boolean {
    const layout = this.#scene?.layout;
    if (!layout || layout.nodes.size === 0) return false;
    const { minX, minY, maxX, maxY } = chartBounds(layout, this.#scene?.grid);
    const a = this.#toScreen({ x: minX, y: minY });
    const b = this.#toScreen({ x: maxX, y: maxY });
    return (
      Math.min(a.x, b.x) >= area.left && Math.max(a.x, b.x) <= area.right && Math.min(a.y, b.y) >= area.top && Math.max(a.y, b.y) <= area.bottom
    );
  }

  pan(dx: number, dy: number): void {
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
  }

  render(): void {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scene = this.#scene;
    if (!scene) return;

    const { scale, x, y } = this.#view;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
    const colors = {
      right: token(canvas, '--c-ink'),
      wrong: token(canvas, '--c-ink-wrong'),
      accent: token(canvas, '--c-accent'),
      error: token(canvas, '--c-error'),
      warning: token(canvas, '--c-warning'),
      muted: token(canvas, '--c-muted'),
      text: token(canvas, '--c-text'),
      background: token(canvas, '--c-bg'),
    };
    const line = Math.max(1.5, 1 / scale);

    if (scene.grid) this.#drawGrid(scene.grid, scale);
    // Az ismétlő egység: halvány kitöltés és szaggatott keret a jelek alatt (PQW-864).
    for (const { x0, y0, x1, y1 } of scene.unitFrames ?? []) {
      applyInk(ctx, colors.accent, Math.max(2, 2 / scale));
      ctx.globalAlpha = 0.08;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }

    for (const node of scene.layout.nodes.values()) {
      const def = scene.library.get(node.def);
      if (!def) continue;
      applyInk(ctx, colors[node.side], line);
      const insertion = scene.insertions?.get(node.id);
      drawShapes(ctx, placedShapes(def, node, insertion ? { ...scene.symbols, insertion } : scene.symbols));
      // A lejjebb horgolt szem talpa: teli pötty ott, ahová a korábbi sorba horgolták (PQW-894).
      const foot = scene.spikes?.has(node.id) ? node.feet[0] : undefined;
      if (foot) {
        ctx.beginPath();
        ctx.arc(foot.x, foot.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A sorszám a sor színével teli címkén, világos betűvel: a jelek mellett is kiugrik.
    ctx.font = `700 12px Karla, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    this.#labels = [];
    const captions = chartLabels(scene.tradition ?? 'cyc');
    for (const layer of scene.layout.layers) {
      if (layer.index === 0) continue;
      const rightwards = layer.start.x <= layer.end.x;
      const text = captions.layer(layer.index);
      const labelWidth = ctx.measureText(text).width + 10;
      const x0 = rightwards ? layer.start.x + 4 - labelWidth : layer.start.x - 4;
      const label: Label = {
        layer: layer.index,
        x0,
        x1: x0 + labelWidth,
        y0: layer.start.y - LABEL_HEIGHT / 2,
        y1: layer.start.y + LABEL_HEIGHT / 2,
      };
      this.#labels.push(label);
      applyInk(ctx, colors[layer.side], line);
      ctx.beginPath();
      ctx.roundRect(label.x0, label.y0, labelWidth, LABEL_HEIGHT, 4);
      ctx.fill();
      applyInk(ctx, colors.background, line);
      ctx.textAlign = 'center';
      ctx.fillText(text, (label.x0 + label.x1) / 2, layer.start.y);
      applyInk(ctx, colors.text, line);
      ctx.textAlign = rightwards ? 'left' : 'right';
      ctx.fillText(captions.count(layer.stitchCount), layer.end.x, layer.end.y);
    }

    // A most horgolt sor iránynyila: a sor elejéről a haladási irányba mutat (PQW-879), a sorszám mellől.
    if (scene.direction) this.#drawDirection(this.#besideLabel(scene.direction), colors.accent, scale);

    // Hibák és figyelmeztetések a jelen: a hiba teli, a figyelmeztetés szaggatott karika, nem csak színben tér el.
    for (const finding of scene.findings) {
      const error = finding.severity === 'error';
      applyInk(ctx, error ? colors.error : colors.warning, Math.max(2, 1.5 / scale));
      ctx.setLineDash(error ? [] : [4, 3]);
      for (const id of finding.nodes) {
        const node = scene.layout.nodes.get(id);
        if (!node) continue;
        ctx.beginPath();
        ctx.arc(node.top.x, node.top.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // A kijelölés folytonos, a törlésnél érintett szemek szaggatott keretben: nem csak színben térnek el (PQW-875).
    applyInk(ctx, colors.accent, Math.max(1.5, 1 / scale));
    for (const id of scene.selection ?? []) {
      const node = scene.layout.nodes.get(id);
      if (node) ctx.strokeRect(node.top.x - 11, node.top.y - 11, 22, 22);
    }
    applyInk(ctx, colors.error, Math.max(2, 1.5 / scale));
    ctx.setLineDash([4, 3]);
    for (const id of scene.affected ?? []) {
      const node = scene.layout.nodes.get(id);
      if (node) ctx.strokeRect(node.top.x - 13, node.top.y - 13, 26, 26);
    }
    ctx.setLineDash([]);

    if (scene.selected) {
      const node = scene.layout.nodes.get(scene.selected);
      if (node) {
        applyInk(ctx, colors.accent, Math.max(2, 1.5 / scale));
        ctx.strokeRect(node.top.x - 14, node.top.y - 14, 28, 28);
      }
    }

    if (scene.marquee) {
      const { from, to } = scene.marquee;
      applyInk(ctx, colors.accent, Math.max(1.5, 1.5 / scale));
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      ctx.setLineDash([]);
    }

    scene.targets.forEach((target, i) => {
      if (target.used && i !== scene.cursor && i !== scene.hover) return;
      ctx.beginPath();
      if (i === scene.cursor) {
        applyInk(ctx, colors.accent, Math.max(2.5, 2 / scale));
        ctx.globalAlpha = 0.25;
        ctx.arc(target.point.x, target.point.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else if (i === scene.hover) {
        applyInk(ctx, colors.accent, Math.max(1.5, 1 / scale));
        ctx.arc(target.point.x, target.point.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        applyInk(ctx, colors.accent, line);
        ctx.arc(target.point.x, target.point.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /** A rács: váltakozó színű sávok, halvány cellavonalak, erősebb sorhatár, hangsúlyos 5. és 10. vonal. */
  #drawGrid(grid: ChartGrid, scale: number): void {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (this.#paths?.grid !== grid) this.#paths = { grid, paths: gridPaths(grid) };
    const { bands, lines } = this.#paths.paths;
    const tones = [token(canvas, '--c-row-a'), token(canvas, '--c-row-b')];
    for (const band of bands) {
      applyInk(ctx, tones[band.tone]!, 1);
      ctx.fill(new Path2D(band.d), band.evenOdd ? 'evenodd' : 'nonzero');
    }
    const strong = token(canvas, '--c-grid-strong');
    const stroke = { cell: token(canvas, '--c-grid'), row: token(canvas, '--c-grid-row'), five: strong, ten: strong };
    for (const path of lines) {
      applyInk(ctx, stroke[path.weight], LINE_WIDTH[path.weight] / scale);
      ctx.setLineDash(path.dashed ? [4 / scale, 3 / scale] : []);
      ctx.stroke(new Path2D(path.d));
    }
    ctx.setLineDash([]);
  }

  /** A nyíl a sorszám címkéjének belső széléről indul, hogy ne takarja a számot. */
  #besideLabel(arrow: DirectionArrow): DirectionArrow {
    const { from, to } = arrow;
    const label = this.#labels.find((l) => from.x >= l.x0 && from.x <= l.x1 && from.y >= l.y0 && from.y <= l.y1);
    if (!label) return arrow;
    return { from: { x: to.x >= from.x ? label.x1 : label.x0, y: from.y }, to };
  }

  /** A sor elejét jelölő pötty, és onnan egy rövid nyíl a haladási irányba. */
  #drawDirection(arrow: DirectionArrow, color: string, scale: number): void {
    const ctx = this.#ctx;
    const dx = arrow.to.x - arrow.from.x;
    const dy = arrow.to.y - arrow.from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return;
    const ux = dx / length;
    const uy = dy / length;
    // A nyíl rövid, a sor szélességétől függetlenül, hogy csak az irányt jelezze.
    const shaft = Math.min(46, length);
    const tip = { x: arrow.from.x + ux * shaft, y: arrow.from.y + uy * shaft };
    const head = 8;

    applyInk(ctx, color, Math.max(2, 2 / scale));
    ctx.beginPath();
    ctx.moveTo(arrow.from.x, arrow.from.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    // Nyílhegy: két rövid vonal a csúcsból visszafelé.
    for (const sign of [1, -1]) {
      const angle = Math.atan2(uy, ux) + sign * 2.5;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + Math.cos(angle) * head, tip.y + Math.sin(angle) * head);
      ctx.stroke();
    }
    // A sor eleje: kis teli pötty.
    ctx.beginPath();
    ctx.arc(arrow.from.x, arrow.from.y, Math.max(3, 3 / scale), 0, Math.PI * 2);
    ctx.fill();
  }

  #resize(): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.render();
  }
}
