// The free-form editor's properties panel. KB: interface.md §7, §8

import type {
  AlignMode,
  BackgroundPatch,
  DistributeAxis,
  FlipAxis,
  ItemPatch,
  NotePatch,
  PolarPatch,
} from '../core/irregular-document.ts';
import {
  type AnnotationItem,
  type BackgroundImage,
  type ChainArcGroup,
  type FanGroup,
  type IrregularGuides,
  type IrregularItem,
  isStitch,
  type RowLineShape,
} from '../core/irregular-types.ts';
import { stitchById } from '../core/stitches.ts';
import type { StitchInsertion } from '../core/types.ts';
import { texts } from './i18n.ts';

export interface IrregularPanelHost {
  patch(patch: ItemPatch): void;
  align(mode: AlignMode): void;
  distribute(axis: DistributeAxis): void;
  flip(axis: FlipAxis): void;
  setRectPartial(partial: boolean): void;
  setGridSize(size: number): void;
  setSnap(on: boolean): void;
  setPolar(patch: PolarPatch): void;
  setRadial(on: boolean): void;
  setArcCount(count: number): void;
  setArcShape(shape: ChainArcGroup['shape']): void;
  setArcBulge(bulge: number): void;
  explodeArc(): void;
  setFanCount(count: number): void;
  setFanSpread(angle: number): void;
  setFanLength(length: number): void;
  setFanMode(mode: FanGroup['mode']): void;
  arrange(kind: RowLineShape | 'fan'): void;
  evenOut(): void;
  flipArrangeSide(): void;
  setPerpendicular(on: boolean): void;
  clearRowLine(): void;
  loadBackground(): void;
  removeBackground(): void;
  patchBackground(patch: BackgroundPatch): void;
  setExport(patch: ExportView): void;
  savePdf(): void;
  patchNotes(patch: NotePatch): void;
  numberRows(): void;
  addStartMarker(): void;
}

export interface ExportView {
  readonly scale?: number;
  readonly transparent?: boolean;
  readonly size?: 'a4' | 'letter';
  readonly orientation?: 'auto' | 'portrait' | 'landscape';
  readonly across?: number;
  readonly down?: number;
}

export interface ArrangeView {
  readonly shown: boolean;
  readonly perpendicular: boolean;
  readonly hasRowLine: boolean;
}

const INSERTIONS: readonly StitchInsertion[] = ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post'];
const DEFAULT_COLOR = '#000000';

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing element: ${selector}`);
  return found;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

/** One value when every selected stitch agrees, otherwise nothing to show. */
function shared<T>(items: readonly IrregularItem[], read: (item: IrregularItem) => T): T | null {
  const first = items[0];
  if (first === undefined) return null;
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}

function allowedInsertions(items: readonly IrregularItem[]): StitchInsertion[] {
  return INSERTIONS.filter((mode) =>
    items.every((item) => isStitch(item) && (stitchById(item.keyEntryId)?.insertionModes.includes(mode) ?? false)),
  );
}

export class IrregularPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: IrregularPanelHost;
  readonly #fields: HTMLElement;
  readonly #count: HTMLElement;
  readonly #x: HTMLInputElement;
  readonly #y: HTMLInputElement;
  readonly #width: HTMLInputElement;
  readonly #height: HTMLInputElement;
  readonly #ratio: HTMLInputElement;
  readonly #rotation: HTMLInputElement;
  readonly #insertion: HTMLSelectElement;
  readonly #insertionField: HTMLElement;
  readonly #color: HTMLInputElement;
  readonly #rectMode: HTMLSelectElement;
  readonly #gridSize: HTMLInputElement;
  readonly #snap: HTMLInputElement;
  readonly #polar: HTMLInputElement;
  readonly #polarFields: HTMLElement;
  readonly #rings: HTMLInputElement;
  readonly #spokes: HTMLInputElement;
  readonly #radial: HTMLInputElement;
  readonly #arc: HTMLElement;
  readonly #arcCount: HTMLInputElement;
  readonly #arcShape: HTMLSelectElement;
  readonly #arcBulge: HTMLInputElement;
  readonly #fan: HTMLElement;
  readonly #fanCount: HTMLInputElement;
  readonly #fanSpread: HTMLInputElement;
  readonly #fanLength: HTMLInputElement;
  readonly #fanMode: HTMLSelectElement;
  readonly #arrange: HTMLElement;
  readonly #rowLineRow: HTMLElement;
  readonly #perpendicular: HTMLInputElement;
  readonly #bgFields: HTMLElement;
  readonly #bgOpacity: HTMLInputElement;
  readonly #bgScale: HTMLInputElement;
  readonly #bgRotation: HTMLInputElement;
  readonly #bgInExport: HTMLInputElement;
  readonly #exportScale: HTMLSelectElement;
  readonly #exportTransparent: HTMLInputElement;
  readonly #exportSize: HTMLSelectElement;
  readonly #exportOrientation: HTMLSelectElement;
  readonly #exportAcross: HTMLInputElement;
  readonly #exportDown: HTMLInputElement;
  readonly #note: HTMLElement;
  readonly #noteText: HTMLInputElement;
  readonly #noteSize: HTMLInputElement;
  readonly #noteArrow: HTMLInputElement;
  readonly #noteDotted: HTMLInputElement;
  #bgNaturalWidth = 1;
  #bgRatio = 1;
  #items: readonly IrregularItem[] = [];

  constructor(section: HTMLDetailsElement, host: IrregularPanelHost) {
    this.#section = section;
    this.#host = host;
    // KB: interface.md §57 — the guides, the export options and the annotation
    // commands live in the bar's menus and the export dialog, not in the section.
    const page = section.ownerDocument;
    this.#fields = must<HTMLElement>(section, '#props-fields');
    this.#count = must<HTMLElement>(section, '#props-count');
    this.#x = must<HTMLInputElement>(section, '#prop-x');
    this.#y = must<HTMLInputElement>(section, '#prop-y');
    this.#width = must<HTMLInputElement>(section, '#prop-width');
    this.#height = must<HTMLInputElement>(section, '#prop-height');
    this.#ratio = must<HTMLInputElement>(section, '#prop-ratio');
    this.#rotation = must<HTMLInputElement>(section, '#prop-rotation');
    this.#insertion = must<HTMLSelectElement>(section, '#prop-insertion');
    this.#insertionField = must<HTMLElement>(section, '#prop-insertion').closest('p') ?? this.#fields;
    this.#color = must<HTMLInputElement>(section, '#prop-color');
    this.#rectMode = must<HTMLSelectElement>(page, '#prop-rect-mode');
    this.#gridSize = must<HTMLInputElement>(page, '#guide-grid-size');
    this.#snap = must<HTMLInputElement>(page, '#guide-snap');
    this.#polar = must<HTMLInputElement>(page, '#guide-polar');
    this.#polarFields = must<HTMLElement>(page, '#guide-polar-fields');
    this.#rings = must<HTMLInputElement>(page, '#guide-rings');
    this.#spokes = must<HTMLInputElement>(page, '#guide-spokes');
    this.#radial = must<HTMLInputElement>(page, '#guide-radial');
    this.#arc = must<HTMLElement>(section, '#props-arc');
    this.#arcCount = must<HTMLInputElement>(section, '#arc-count');
    this.#arcShape = must<HTMLSelectElement>(section, '#arc-shape');
    this.#arcBulge = must<HTMLInputElement>(section, '#arc-bulge');
    this.#fan = must<HTMLElement>(section, '#props-fan');
    this.#fanCount = must<HTMLInputElement>(section, '#fan-count');
    this.#fanSpread = must<HTMLInputElement>(section, '#fan-spread');
    this.#fanLength = must<HTMLInputElement>(section, '#fan-length');
    this.#fanMode = must<HTMLSelectElement>(section, '#fan-mode');
    this.#arrange = must<HTMLElement>(section, '#props-arrange');
    this.#rowLineRow = must<HTMLElement>(section, '#rowline-row');
    this.#perpendicular = must<HTMLInputElement>(section, '#arrange-perpendicular');
    this.#bgFields = must<HTMLElement>(page, '#bg-fields');
    this.#bgOpacity = must<HTMLInputElement>(page, '#bg-opacity');
    this.#bgScale = must<HTMLInputElement>(page, '#bg-scale');
    this.#bgRotation = must<HTMLInputElement>(page, '#bg-rotation');
    this.#bgInExport = must<HTMLInputElement>(page, '#bg-in-export');
    this.#exportScale = must<HTMLSelectElement>(page, '#export-scale');
    this.#exportTransparent = must<HTMLInputElement>(page, '#export-transparent');
    this.#exportSize = must<HTMLSelectElement>(page, '#export-page-size');
    this.#exportOrientation = must<HTMLSelectElement>(page, '#export-orientation');
    this.#exportAcross = must<HTMLInputElement>(page, '#export-across');
    this.#exportDown = must<HTMLInputElement>(page, '#export-down');
    this.#note = must<HTMLElement>(section, '#props-note');
    this.#noteText = must<HTMLInputElement>(section, '#note-text');
    this.#noteSize = must<HTMLInputElement>(section, '#note-size');
    this.#noteArrow = must<HTMLInputElement>(section, '#note-arrow');
    this.#noteDotted = must<HTMLInputElement>(section, '#note-dotted');
    this.#listen();
  }

  #listen(): void {
    const page = this.#section.ownerDocument;
    this.#x.addEventListener('change', () => this.#number(this.#x, (value) => this.#host.patch({ x: value })));
    this.#y.addEventListener('change', () => this.#number(this.#y, (value) => this.#host.patch({ y: value })));
    this.#width.addEventListener('change', () => this.#number(this.#width, (value) => this.#resize('width', value)));
    this.#height.addEventListener('change', () => this.#number(this.#height, (value) => this.#resize('height', value)));
    this.#rotation.addEventListener('change', () =>
      this.#number(this.#rotation, (value) => this.#host.patch({ rotation: ((value % 360) + 360) % 360 })),
    );
    this.#insertion.addEventListener('change', () => {
      const mode = INSERTIONS.find((candidate) => candidate === this.#insertion.value);
      if (mode !== undefined) this.#host.patch({ insertion: mode });
    });
    this.#color.addEventListener('change', () => this.#host.patch({ color: this.#color.value }));
    must<HTMLButtonElement>(this.#section, '#prop-color-clear').addEventListener('click', () =>
      this.#host.patch({ color: null }),
    );
    must<HTMLButtonElement>(this.#section, '#prop-flip-h').addEventListener('click', () =>
      this.#host.flip('horizontal'),
    );
    must<HTMLButtonElement>(this.#section, '#prop-flip-v').addEventListener('click', () => this.#host.flip('vertical'));
    this.#section.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-align], [data-distribute]');
      if (target === null) return;
      const align = target.dataset['align'];
      if (align !== undefined) this.#host.align(align as AlignMode);
      const spread = target.dataset['distribute'];
      if (spread !== undefined) this.#host.distribute(spread as DistributeAxis);
    });
    this.#rectMode.addEventListener('change', () => this.#host.setRectPartial(this.#rectMode.value === 'partial'));
    this.#gridSize.addEventListener('change', () =>
      this.#number(this.#gridSize, (value) => this.#host.setGridSize(value)),
    );
    this.#snap.addEventListener('change', () => this.#host.setSnap(this.#snap.checked));
    this.#polar.addEventListener('change', () => this.#host.setPolar({ visible: this.#polar.checked }));
    this.#rings.addEventListener('change', () =>
      this.#number(this.#rings, (value) => this.#host.setPolar({ rings: value })),
    );
    this.#spokes.addEventListener('change', () =>
      this.#number(this.#spokes, (value) => this.#host.setPolar({ spokes: value })),
    );
    this.#radial.addEventListener('change', () => this.#host.setRadial(this.#radial.checked));
    this.#arcCount.addEventListener('change', () =>
      this.#number(this.#arcCount, (value) => this.#host.setArcCount(value)),
    );
    this.#arcBulge.addEventListener('change', () =>
      this.#number(this.#arcBulge, (value) => this.#host.setArcBulge(value)),
    );
    this.#arcShape.addEventListener('change', () => {
      if (this.#arcShape.value === 'arc' || this.#arcShape.value === 'straight') {
        this.#host.setArcShape(this.#arcShape.value);
      }
    });
    must<HTMLButtonElement>(this.#section, '#arc-explode').addEventListener('click', () => this.#host.explodeArc());
    this.#fanCount.addEventListener('change', () =>
      this.#number(this.#fanCount, (value) => this.#host.setFanCount(value)),
    );
    this.#fanSpread.addEventListener('change', () =>
      this.#number(this.#fanSpread, (value) => this.#host.setFanSpread(value)),
    );
    this.#fanLength.addEventListener('change', () =>
      this.#number(this.#fanLength, (value) => this.#host.setFanLength(value)),
    );
    this.#fanMode.addEventListener('change', () => {
      if (this.#fanMode.value === 'spread' || this.#fanMode.value === 'converge') {
        this.#host.setFanMode(this.#fanMode.value);
      }
    });
    must<HTMLButtonElement>(this.#section, '#fan-explode').addEventListener('click', () => this.#host.explodeArc());
    this.#section.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-arrange]');
      const kind = target?.dataset['arrange'];
      if (kind !== undefined) this.#host.arrange(kind as RowLineShape | 'fan');
    });
    must<HTMLButtonElement>(this.#section, '#arrange-even').addEventListener('click', () => this.#host.evenOut());
    must<HTMLButtonElement>(this.#section, '#arrange-flip').addEventListener('click', () =>
      this.#host.flipArrangeSide(),
    );
    must<HTMLButtonElement>(this.#section, '#rowline-clear').addEventListener('click', () => this.#host.clearRowLine());
    this.#perpendicular.addEventListener('change', () => this.#host.setPerpendicular(this.#perpendicular.checked));
    must<HTMLButtonElement>(page, '#bg-load').addEventListener('click', () => this.#host.loadBackground());
    must<HTMLButtonElement>(page, '#bg-remove').addEventListener('click', () => this.#host.removeBackground());
    must<HTMLButtonElement>(page, '#layer-bg-load').addEventListener('click', () => this.#host.loadBackground());
    must<HTMLButtonElement>(page, '#layer-bg-remove').addEventListener('click', () => this.#host.removeBackground());
    this.#bgOpacity.addEventListener('change', () =>
      this.#number(this.#bgOpacity, (value) => this.#host.patchBackground({ opacity: value / 100 })),
    );
    // The picture scales uniformly: both sides follow the one number, or the
    // photo would stop matching the thing being traced.
    this.#bgScale.addEventListener('change', () =>
      this.#number(this.#bgScale, (value) => {
        const width = (this.#bgNaturalWidth * value) / 100;
        this.#host.patchBackground({ width, height: width / this.#bgRatio });
      }),
    );
    this.#bgRotation.addEventListener('change', () =>
      this.#number(this.#bgRotation, (value) => this.#host.patchBackground({ rotation: value })),
    );
    this.#bgInExport.addEventListener('change', () =>
      this.#host.patchBackground({ inExport: this.#bgInExport.checked }),
    );
    this.#exportScale.addEventListener('change', () =>
      this.#host.setExport({ scale: Number(this.#exportScale.value) }),
    );
    this.#exportTransparent.addEventListener('change', () =>
      this.#host.setExport({ transparent: this.#exportTransparent.checked }),
    );
    this.#exportSize.addEventListener('change', () => {
      if (this.#exportSize.value === 'a4' || this.#exportSize.value === 'letter') {
        this.#host.setExport({ size: this.#exportSize.value });
      }
    });
    this.#exportOrientation.addEventListener('change', () => {
      const wanted = this.#exportOrientation.value;
      if (wanted === 'auto' || wanted === 'portrait' || wanted === 'landscape') {
        this.#host.setExport({ orientation: wanted });
      }
    });
    this.#exportAcross.addEventListener('change', () =>
      this.#number(this.#exportAcross, (value) => this.#host.setExport({ across: value })),
    );
    this.#exportDown.addEventListener('change', () =>
      this.#number(this.#exportDown, (value) => this.#host.setExport({ down: value })),
    );
    must<HTMLButtonElement>(page, '#export-pdf').addEventListener('click', () => this.#host.savePdf());
    this.#noteText.addEventListener('change', () => this.#host.patchNotes({ text: this.#noteText.value }));
    this.#noteSize.addEventListener('change', () =>
      this.#number(this.#noteSize, (value) => this.#host.patchNotes({ fontSize: value })),
    );
    this.#noteArrow.addEventListener('change', () => this.#host.patchNotes({ withArrow: this.#noteArrow.checked }));
    this.#noteDotted.addEventListener('change', () => this.#host.patchNotes({ dotted: this.#noteDotted.checked }));
    must<HTMLButtonElement>(page, '#notes-numbers').addEventListener('click', () => this.#host.numberRows());
    must<HTMLButtonElement>(page, '#notes-start').addEventListener('click', () => this.#host.addStartMarker());
  }

  /** A fresh annotation has no words yet, so the field is ready for them. */
  focusNoteText(): void {
    if (this.#note.hidden) return;
    this.#noteText.focus();
    this.#noteText.select();
  }

  updateNotes(notes: readonly AnnotationItem[]): void {
    this.#note.hidden = notes.length === 0;
    const first = notes[0];
    if (first === undefined) return;
    const kinds = new Set(notes.map((note) => note.note));
    // A label writes its own words from the row it follows; the rest are typed.
    // An arrow and a marker draw no words, so a text field would write into nothing.
    const writes = [...kinds].every((kind) => kind === 'text' || kind === 'bracket');
    must<HTMLElement>(this.#section, '#note-text').closest('p')?.toggleAttribute('hidden', !writes);
    must<HTMLElement>(this.#section, '#note-arrow-row').hidden = !kinds.has('label');
    must<HTMLElement>(this.#section, '#note-dotted-row').hidden = !kinds.has('marker');
    if (document.activeElement !== this.#noteText) this.#noteText.value = first.text;
    this.#setNumber(this.#noteSize, Math.round(first.fontSize));
    this.#setToggle(this.#noteArrow, first.withArrow === true);
    this.#setToggle(this.#noteDotted, first.dotted === true);
  }

  updateExport(view: Required<ExportView>): void {
    const words = texts().irregular;
    if (document.activeElement !== this.#exportScale) {
      this.#exportScale.replaceChildren(...[1, 2, 4].map((times) => option(String(times), words.scaleName(times))));
      this.#exportScale.value = String(view.scale);
    }
    if (document.activeElement !== this.#exportSize) {
      this.#exportSize.replaceChildren(option('a4', words.pageA4), option('letter', words.pageLetter));
      this.#exportSize.value = view.size;
    }
    if (document.activeElement !== this.#exportOrientation) {
      this.#exportOrientation.replaceChildren(
        option('auto', words.orientAuto),
        option('portrait', words.orientPortrait),
        option('landscape', words.orientLandscape),
      );
      this.#exportOrientation.value = view.orientation;
    }
    this.#setToggle(this.#exportTransparent, view.transparent);
    this.#setNumber(this.#exportAcross, view.across);
    this.#setNumber(this.#exportDown, view.down);
  }

  updateBackground(background: BackgroundImage | null, naturalWidth: number): void {
    const page = this.#section.ownerDocument;
    this.#bgFields.hidden = background === null;
    must<HTMLElement>(page, '#bg-empty').hidden = background !== null;
    must<HTMLButtonElement>(page, '#bg-remove').disabled = background === null;
    if (background === null) return;
    // Without the picture there is no natural size, and a made-up one would
    // turn the next edit into a collapse the user cannot see happening.
    const known = naturalWidth > 0;
    this.#bgScale.closest('p')?.toggleAttribute('hidden', !known);
    if (known) this.#bgNaturalWidth = naturalWidth;
    this.#bgRatio = background.height > 0 ? background.width / background.height : 1;
    this.#setNumber(this.#bgOpacity, Math.round(background.opacity * 100));
    if (known) this.#setNumber(this.#bgScale, Math.round((background.width / this.#bgNaturalWidth) * 100));
    this.#setNumber(this.#bgRotation, Math.round(background.rotation));
    this.#setToggle(this.#bgInExport, background.inExport);
  }

  updateArrange(view: ArrangeView): void {
    this.#arrange.hidden = !view.shown;
    this.#rowLineRow.hidden = !view.hasRowLine;
    this.#setToggle(this.#perpendicular, view.perpendicular);
  }

  updateFan(fan: FanGroup | null): void {
    this.#fan.hidden = fan === null;
    if (fan === null) return;
    const words = texts().irregular;
    if (document.activeElement !== this.#fanMode) {
      this.#fanMode.replaceChildren(option('spread', words.fanSpread), option('converge', words.fanConverge));
      this.#fanMode.value = fan.mode;
    }
    this.#setNumber(this.#fanCount, fan.count);
    this.#setNumber(this.#fanSpread, Math.round(fan.spreadAngle));
    this.#setNumber(this.#fanLength, Math.round(fan.length));
  }

  updateArc(arc: ChainArcGroup | null): void {
    this.#arc.hidden = arc === null;
    if (arc === null) return;
    const words = texts().irregular;
    if (document.activeElement !== this.#arcShape) {
      this.#arcShape.replaceChildren(option('arc', words.arcShapeArc), option('straight', words.arcShapeStraight));
      this.#arcShape.value = arc.shape;
    }
    this.#setNumber(this.#arcCount, arc.count);
    this.#setNumber(this.#arcBulge, Math.round(arc.bulge));
    this.#arcBulge.disabled = arc.shape === 'straight';
  }

  updateGuides(guides: IrregularGuides, radial: boolean): void {
    this.#setNumber(this.#gridSize, guides.grid.size);
    this.#setToggle(this.#snap, guides.snap);
    this.#setToggle(this.#polar, guides.polar.visible);
    this.#polarFields.hidden = !guides.polar.visible;
    this.#setNumber(this.#rings, guides.polar.rings);
    this.#setNumber(this.#spokes, guides.polar.spokes);
    this.#setToggle(this.#radial, radial);
  }

  #setToggle(input: HTMLInputElement, on: boolean): void {
    if (document.activeElement !== input) input.checked = on;
  }

  #number(input: HTMLInputElement, apply: (value: number) => void): void {
    const value = Number(input.value);
    if (Number.isFinite(value)) apply(value);
  }

  /** With proportions kept, the other side follows the one you typed. */
  #resize(side: 'width' | 'height', value: number): void {
    if (value <= 0) return;
    if (!this.#ratio.checked) {
      this.#host.patch(side === 'width' ? { width: value } : { height: value });
      return;
    }
    const first = this.#items[0];
    if (first === undefined) return;
    const current = side === 'width' ? first.width : first.height;
    if (current <= 0) return;
    const k = value / current;
    this.#host.patch(
      side === 'width' ? { width: value, height: first.height * k } : { height: value, width: first.width * k },
    );
  }

  reveal(): void {
    this.#section.hidden = false;
    this.#section.open = true;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(items: readonly IrregularItem[], rectPartial: boolean, total: number): void {
    this.#items = items;
    const words = texts().irregular;
    if (document.activeElement !== this.#rectMode) {
      this.#rectMode.replaceChildren(option('partial', words.rectPartial), option('full', words.rectFull));
      this.#rectMode.value = rectPartial ? 'partial' : 'full';
    }
    this.#count.textContent = items.length === 0 ? words.selectedNone : words.selected(items.length);
    this.#fields.hidden = items.length === 0;
    // KB: interface.md §64 — with nothing selected there is nothing to edit, so the block goes.
    this.#section.classList.toggle('is-off', items.length === 0);
    if (items.length === 0) {
      this.#count.textContent = total === 0 ? '' : words.selectedNone;
      return;
    }
    this.#setNumber(
      this.#x,
      shared(items, (item) => Math.round(item.x)),
    );
    this.#setNumber(
      this.#y,
      shared(items, (item) => Math.round(item.y)),
    );
    this.#setNumber(
      this.#width,
      shared(items, (item) => Math.round(item.width)),
    );
    this.#setNumber(
      this.#height,
      shared(items, (item) => Math.round(item.height)),
    );
    this.#setNumber(
      this.#rotation,
      shared(items, (item) => Math.round(item.rotation)),
    );
    if (document.activeElement !== this.#color) {
      this.#color.value = shared(items, (item) => item.color) ?? DEFAULT_COLOR;
    }
    this.#updateInsertion(items);
  }

  #updateInsertion(items: readonly IrregularItem[]): void {
    const names = texts().sections.insertion.names;
    const allowed = allowedInsertions(items);
    this.#insertionField.hidden = allowed.length < 2;
    if (allowed.length < 2 || document.activeElement === this.#insertion) return;
    this.#insertion.replaceChildren(...allowed.map((mode) => option(mode, names[mode])));
    const mode = shared(items, (item) => (isStitch(item) ? item.insertion : null));
    this.#insertion.value = mode ?? '';
  }

  #setNumber(input: HTMLInputElement, value: number | null): void {
    // A redraw must not swallow a half-typed number.
    if (document.activeElement === input) return;
    input.value = value === null ? '' : String(value);
    input.placeholder = value === null ? '—' : '';
  }
}
