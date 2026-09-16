/*
 * A „Ruhadarab” szakasz (PQW-866): ruhadarab, testméret-táblázat, a rajz
 * mérete és a méretsorozat, szem, bőség, szegély, derék alatti hossz és
 * mintaismétlés; a választott méret terve, az ellenőrzések, a
 * figyelmeztetések és a méretsorozat szövege, és a minta létrehozása.
 *
 * A mezők az index.html-ben vannak. A létrehozás a mintát cseréli, ezért egy
 * lépésben visszavonható; új tárolókulcs nincs, a választás csak a lapon él. A
 * szakasz csak nyitva számol, mert a vászon egérmozgásra is frissít.
 */

import type { BodyTableId } from '../core/body-sizes.js';
import { generateGarment, planGarment, type GarmentOptions } from '../core/garments.js';
import { activeProfile } from '../core/pattern-size.js';
import type { GarmentKind, Pattern } from '../core/types.js';
import {
  KIND_CHOICES,
  STITCH_CHOICES,
  TABLE_CHOICES,
  defaultsFor,
  easeLabel,
  easeNote,
  garmentFieldState,
  garmentText,
  garmentView,
  generatedMessage,
  hemLabel,
  normalizeGarment,
  sizeChoices,
} from './garment-view.js';
import type { Choice } from './shapes-view.js';

export interface GarmentPanelHost {
  /** Az új minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

/** A szám a mezőből; tizedesvesszőt és -pontot is elfogad. Üres vagy érvénytelen mezőre `NaN`: az okot a mag adja. */
function decimal(input: HTMLInputElement): number {
  const text = input.value.trim().replace(',', '.');
  return text === '' ? Number.NaN : Number(text);
}

const decimalText = (value: number) => String(value).replace('.', ',');

export class GarmentPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: GarmentPanelHost;
  readonly #kind: HTMLSelectElement;
  readonly #table: HTMLSelectElement;
  readonly #size: HTMLSelectElement;
  readonly #from: HTMLSelectElement;
  readonly #to: HTMLSelectElement;
  readonly #stitch: HTMLSelectElement;
  readonly #ease: HTMLInputElement;
  readonly #easeLabel: HTMLElement;
  readonly #easeNote: HTMLElement;
  readonly #hem: HTMLInputElement;
  readonly #hemLabel: HTMLElement;
  readonly #below: HTMLInputElement;
  readonly #growth: HTMLInputElement;
  readonly #neckline: HTMLInputElement;
  readonly #repeat: HTMLInputElement;
  readonly #repeatX: HTMLInputElement;
  readonly #repeatY: HTMLInputElement;
  readonly #groups: Readonly<Record<'table' | 'belowWaist' | 'neckline' | 'repeat', HTMLElement>>;
  readonly #result: HTMLElement;
  readonly #details: HTMLElement;
  readonly #checks: HTMLElement;
  readonly #failed: HTMLElement;
  readonly #warnings: HTMLElement;
  readonly #seriesBox: HTMLElement;
  readonly #series: HTMLElement;
  readonly #source: HTMLElement;
  #pattern: Pattern | null = null;
  #shown: string | null = null;

  constructor(section: HTMLDetailsElement, host: GarmentPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends Element>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#kind = fill(field('garment-kind'), KIND_CHOICES);
    this.#table = fill(field('garment-table'), TABLE_CHOICES);
    this.#size = field('garment-size');
    this.#from = field('garment-from');
    this.#to = field('garment-to');
    this.#stitch = fill(field('garment-stitch'), STITCH_CHOICES);
    this.#ease = field('garment-ease');
    this.#easeLabel = field('garment-ease-label');
    this.#easeNote = field('garment-ease-note');
    this.#hem = field('garment-hem');
    this.#hemLabel = field('garment-hem-label');
    this.#below = field('garment-below');
    this.#growth = field('garment-growth');
    this.#neckline = field('garment-neckline');
    this.#repeat = field('garment-repeat');
    this.#repeatX = field('garment-repeat-x');
    this.#repeatY = field('garment-repeat-y');
    this.#groups = {
      table: field('garment-table-field'),
      belowWaist: field('garment-below-field'),
      neckline: field('garment-neckline-field'),
      repeat: field('garment-repeat-field'),
    };
    this.#result = field('garment-result');
    this.#details = field('garment-details');
    this.#checks = field('garment-checks');
    this.#failed = field('garment-failed');
    this.#warnings = field('garment-warnings');
    this.#seriesBox = field('garment-series-box');
    this.#series = field('garment-series');
    this.#source = field('garment-source');

    this.#apply(defaultsFor('drop-shoulder', 'women'));
    section.addEventListener('toggle', () => this.#render());
    // A ruhadarab és a táblázat váltása a méreteket és az alapértékeket is cseréli.
    for (const select of [this.#kind, this.#table]) {
      select.addEventListener('change', () => this.#apply(defaultsFor(this.#kind.value as GarmentKind, this.#table.value as BodyTableId)));
    }
    for (const input of [this.#size, this.#from, this.#to, this.#stitch, this.#neckline, this.#repeat]) {
      input.addEventListener('change', () => this.#render());
    }
    for (const input of [this.#ease, this.#hem, this.#below, this.#growth, this.#repeatX, this.#repeatY]) {
      input.addEventListener('input', () => this.#render());
    }
    field<HTMLButtonElement>('garment-create').addEventListener('click', () => this.#create());
  }

  update(pattern: Pattern): void {
    if (pattern === this.#pattern) return;
    this.#pattern = pattern;
    if (this.#section.open) this.#render();
  }

  /** A mezők a ruhadarab alapértékeivel. */
  #apply(options: GarmentOptions): void {
    this.#kind.value = options.kind;
    this.#table.value = options.table;
    const sizes = sizeChoices(options.kind, options.table);
    for (const select of [this.#size, this.#from, this.#to]) fill(select, sizes);
    this.#size.value = options.size;
    this.#from.value = options.from;
    this.#to.value = options.to;
    this.#stitch.value = options.stitch;
    this.#ease.value = options.easeCm === null ? '' : decimalText(options.easeCm);
    this.#hem.value = decimalText(options.hemCm);
    this.#below.value = decimalText(options.belowWaistCm);
    this.#growth.value = decimalText(options.growthPct);
    this.#neckline.checked = options.neckline === 'shaped';
    this.#repeat.checked = false;
    this.#render();
  }

  #options(): GarmentOptions {
    const kind = this.#kind.value as GarmentKind;
    const easeText = this.#ease.value.trim();
    return normalizeGarment({
      kind,
      table: this.#table.value as BodyTableId,
      size: this.#size.value,
      from: this.#from.value,
      to: this.#to.value,
      stitch: this.#stitch.value,
      // Sapkánál az üres mező a fejmérettől függő bőség.
      easeCm: kind === 'hat' && easeText === '' ? null : decimal(this.#ease),
      hemCm: decimal(this.#hem),
      belowWaistCm: decimal(this.#below),
      repeat: this.#repeat.checked ? { width: decimal(this.#repeatX), edge: decimal(this.#repeatY) } : null,
      neckline: this.#neckline.checked ? 'shaped' : 'boat',
      growthPct: decimal(this.#growth),
    });
  }

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    const options = this.#options();
    this.#from.value = options.from;
    this.#to.value = options.to;
    const state = garmentFieldState(options.kind);
    this.#easeLabel.textContent = easeLabel(options.kind);
    this.#easeNote.textContent = easeNote(options.kind);
    this.#hemLabel.textContent = hemLabel(options.kind);
    for (const [key, group] of Object.entries(this.#groups)) group.hidden = !state[key as keyof typeof state];
    for (const input of [this.#repeatX, this.#repeatY]) input.disabled = !this.#repeat.checked;

    const planned = planGarment(this.#pattern, options);
    const view = planned.ok ? garmentView(planned.plan, activeProfile(this.#pattern) !== null) : null;
    // A mag kódot ad, a mondat a felületé (PQW-904): a kiírt szöveg dönti el, kell-e újrarajzolni.
    const reason = planned.ok ? '' : garmentText(planned.reason);
    const key = JSON.stringify(planned.ok ? view : reason);
    if (key === this.#shown) return;
    this.#shown = key;

    if (!view) {
      this.#result.textContent = reason;
      for (const list of [this.#details, this.#failed, this.#warnings, this.#series]) list.replaceChildren();
      this.#checks.textContent = '';
      this.#source.textContent = '';
      this.#seriesBox.hidden = true;
      return;
    }
    this.#result.textContent = view.size;
    this.#details.replaceChildren(...view.details.map(item));
    this.#checks.textContent = view.checks;
    this.#failed.replaceChildren(...view.failed.map(item));
    this.#warnings.replaceChildren(...view.warnings.map(item));
    this.#series.replaceChildren(...view.series.map(item));
    this.#seriesBox.hidden = view.series.length === 0;
    this.#source.textContent = view.source;
  }

  #create(): void {
    if (!this.#pattern) return;
    const result = generateGarment(this.#pattern, this.#options());
    if (!result.ok) {
      this.#host.announce(garmentText(result.reason));
      return;
    }
    this.#host.commit(result.pattern, generatedMessage(result.plan));
  }
}

function item(text: string): HTMLLIElement {
  const element = document.createElement('li');
  element.textContent = text;
  return element;
}

function fill<T extends string>(select: HTMLSelectElement, choices: readonly Choice<T>[]): HTMLSelectElement {
  select.replaceChildren(
    ...choices.map((choice) => {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label;
      return option;
    }),
  );
  return select;
}
