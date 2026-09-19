// KB: interface.md §7, §8

import type { PieceGraph } from '../core/graph.js';
import { GAUGE_STITCHES } from '../core/pattern-json.js';
import { activeProfile, estimatedGauge, newProfile, patternSize, withActiveProfile, withProfile, withoutProfile } from '../core/pattern-size.js';
import type { StitchLibrary } from '../core/stitch-library.js';
import type { GaugeEntry, GaugeForm, Pattern, PatternGaugeProfile } from '../core/types.js';
import { CYC_WEIGHTS } from '../core/yarn-weight.js';
import { texts, uiLanguage, type UiLanguage } from './i18n.js';
import {
  cycWeightLabel,
  formLabel,
  formatNumber,
  gaugeEntryNote,
  gaugeStitchName,
  hookSizesText,
  profileLabel,
  profileOrigins,
  sizeView,
  sourceLabel,
  type Origin,
  type SizeView,
  type ValueRow,
} from './size-view.js';

export interface SizePanelHost {
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
  setAspect(on: boolean): void;
}

const FORMS: readonly GaugeForm[] = ['rows', 'rounds'];

type FieldKey = 'meterage' | 'ball' | 'hook' | 'swatchWidth' | 'swatchHeight' | 'swatchMass';

interface NumberField {
  readonly input: HTMLInputElement;
  readonly max: number;
  readonly required: boolean;
  readonly key: FieldKey;
  get(profile: PatternGaugeProfile): number | null;
  set(profile: PatternGaugeProfile, value: number | null): PatternGaugeProfile;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function option(value: string, label: string): HTMLOptionElement {
  const el = element('option', '', label);
  el.value = value;
  return el;
}

function readNumber(input: HTMLInputElement, max = Number.POSITIVE_INFINITY): number | null | undefined {
  const text = input.value.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 && value <= max ? value : undefined;
}

const numberValue = (value: number | null) => (value === null ? '' : formatNumber(value, 3));

function setValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (document.activeElement !== input && input.value !== value) input.value = value;
}

function setOrigin(badge: HTMLElement, value: Origin | null): void {
  badge.hidden = value === null;
  badge.textContent = value?.text ?? '';
  badge.className = value ? `origin origin--${value.source}` : 'origin';
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(uiLanguage()) + text.slice(1);
}

export class SizePanel {
  readonly #host: SizePanelHost;
  readonly #section: HTMLDetailsElement;
  readonly #profile: HTMLSelectElement;
  readonly #remove: HTMLButtonElement;
  readonly #editor: HTMLElement;
  readonly #yarnName: HTMLInputElement;
  readonly #cyc: HTMLSelectElement;
  readonly #hookSizes: HTMLElement;
  readonly #blocked: HTMLInputElement;
  readonly #gauges: HTMLUListElement;
  readonly #addGauge: HTMLButtonElement;
  readonly #notice: HTMLElement;
  readonly #total: HTMLElement;
  readonly #rows: HTMLElement;
  readonly #yarn: HTMLElement;
  readonly #origins: Readonly<Record<'cyc' | 'meterage' | 'ball' | 'hook' | 'swatch', HTMLElement>>;
  readonly #fields: readonly NumberField[];

  #pattern: Pattern | null = null;
  #graph: PieceGraph | null = null;
  #library: StitchLibrary | null = null;
  #shown: Pattern | null = null;
  #shownLanguage: UiLanguage | null = null;
  #gaugeKey = '';

  constructor(section: HTMLDetailsElement, host: SizePanelHost) {
    const find = <T extends Element>(id: string): T => {
      const found = section.querySelector<T>(`#${id}`);
      if (!found) throw new Error(`Hiányzó elem a méret szakaszban: #${id}`);
      return found;
    };
    this.#host = host;
    this.#section = section;
    this.#profile = find('size-profile');
    this.#remove = find('size-remove');
    this.#editor = find('size-editor');
    this.#yarnName = find('size-yarn-name');
    this.#cyc = find('size-cyc');
    this.#hookSizes = find('size-hook-sizes');
    this.#blocked = find('size-blocked');
    this.#gauges = find('size-gauges');
    this.#addGauge = find('size-gauge-add');
    this.#notice = find('size-notice');
    this.#total = find('size-total');
    this.#rows = find('size-rows');
    this.#yarn = find('size-yarn');
    this.#origins = {
      cyc: find('size-origin-cyc'),
      meterage: find('size-origin-meterage'),
      ball: find('size-origin-ball'),
      hook: find('size-origin-hook'),
      swatch: find('size-origin-swatch'),
    };
    this.#cyc.replaceChildren(
      option('', texts().sections.size.profile.noCyc),
      ...CYC_WEIGHTS.map((weight) => option(String(weight.weight), cycWeightLabel(weight.weight))),
    );

    const swatch = (key: keyof PatternGaugeProfile['swatch'], id: string, fieldKey: FieldKey): NumberField => ({
      input: find(id),
      max: Number.POSITIVE_INFINITY,
      required: false,
      key: fieldKey,
      get: (profile) => profile.swatch[key],
      set: (profile, value) => ({ ...profile, swatch: { ...profile.swatch, [key]: value } }),
    });
    this.#fields = [
      {
        input: find('size-meterage'),
        max: Number.POSITIVE_INFINITY,
        required: false,
        key: 'meterage',
        get: (profile) => profile.yarn.metersPer100g,
        set: (profile, value) => ({ ...profile, yarn: { ...profile.yarn, metersPer100g: value } }),
      },
      {
        input: find('size-ball'),
        max: Number.POSITIVE_INFINITY,
        required: false,
        key: 'ball',
        get: (profile) => profile.yarn.ballMassG,
        set: (profile, value) => ({ ...profile, yarn: { ...profile.yarn, ballMassG: value } }),
      },
      {
        input: find('size-hook'),
        max: 30,
        required: true,
        key: 'hook',
        get: (profile) => profile.hookMm,
        set: (profile, value) => ({ ...profile, hookMm: value ?? profile.hookMm }),
      },
      swatch('widthCm', 'size-swatch-width', 'swatchWidth'),
      swatch('heightCm', 'size-swatch-height', 'swatchHeight'),
      swatch('massG', 'size-swatch-mass', 'swatchMass'),
    ];

    this.#profile.addEventListener('change', () => {
      const next = withActiveProfile(this.#current(), this.#profile.value || null);
      const chosen = activeProfile(next);
      const words = texts().sections.size.profile;
      host.commit(next, chosen ? words.chosen(profileLabel(chosen)) : words.cleared);
    });
    find<HTMLButtonElement>('size-add').addEventListener('click', () => {
      const pattern = this.#current();
      host.commit(withProfile(pattern, newProfile(pattern)), texts().sections.size.profile.added);
      this.#yarnName.focus();
    });
    this.#remove.addEventListener('click', () => {
      const pattern = this.#current();
      const profile = activeProfile(pattern);
      if (!profile) return;
      host.commit(withoutProfile(pattern, profile.id), texts().sections.size.profile.removed(profileLabel(profile)));
      this.#profile.focus();
    });

    this.#yarnName.addEventListener('change', () =>
      this.#edit(
        (profile) => ({ ...profile, yarn: { ...profile.yarn, name: this.#yarnName.value.trim() } }),
        texts().sections.size.profile.nameChanged,
      ),
    );
    this.#cyc.addEventListener('change', () => {
      const cycWeight = this.#cyc.value === '' ? null : Number(this.#cyc.value);
      this.#edit((profile) => ({ ...profile, yarn: { ...profile.yarn, cycWeight } }), texts().sections.size.profile.cycChanged);
    });
    this.#blocked.addEventListener('change', () => {
      const blocked = this.#blocked.checked;
      const words = texts().sections.size.profile;
      this.#edit((profile) => ({ ...profile, blocked }), blocked ? words.blockedOn : words.blockedOff);
    });
    for (const field of this.#fields) {
      field.input.addEventListener('change', () => {
        const profile = activeProfile(this.#current());
        if (!profile) return;
        const value = readNumber(field.input, field.max);
        if (value === undefined || (field.required && value === null)) {
          field.input.value = numberValue(field.get(profile));
          host.announce(texts().sections.size.profile.invalid[field.key]);
          return;
        }
        if (value !== field.get(profile)) this.#edit((current) => field.set(current, value), texts().sections.size.profile.changed[field.key]);
      });
    }

    this.#gauges.addEventListener('change', (event) => this.#changeGauge(event.target as HTMLInputElement | HTMLSelectElement));
    this.#gauges.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-remove]');
      if (!button) return;
      const index = Number(button.dataset.remove);
      this.#edit((profile) => ({ ...profile, gauges: profile.gauges.filter((_, i) => i !== index) }), texts().sections.size.gauge.removed);
      this.#addGauge.focus();
    });
    this.#addGauge.addEventListener('click', () => this.#addGaugeEntry());

    find<HTMLInputElement>('size-aspect').addEventListener('change', (event) => host.setAspect((event.target as HTMLInputElement).checked));
    section.addEventListener('toggle', () => {
      if (!section.open) return;
      this.#shown = null;
      this.#render();
    });
  }

  update(pattern: Pattern, graph: PieceGraph | null, library: StitchLibrary): void {
    this.#pattern = pattern;
    this.#graph = graph;
    this.#library = library;
    if (this.#section.open && (pattern !== this.#shown || uiLanguage() !== this.#shownLanguage)) this.#render();
  }

  #current(): Pattern {
    if (!this.#pattern) throw new Error('A méret szakasz még nem kapott mintát.');
    return this.#pattern;
  }

  #edit(change: (profile: PatternGaugeProfile) => PatternGaugeProfile, message: string): void {
    const pattern = this.#current();
    const profile = activeProfile(pattern);
    if (profile) this.#host.commit(withProfile(pattern, change(profile)), message);
  }

  #addGaugeEntry(): void {
    const profile = activeProfile(this.#current());
    if (!profile) return;
    const used = new Set(profile.gauges.map((entry) => `${entry.stitch}/${entry.form}`));
    const free = FORMS.flatMap((form) => GAUGE_STITCHES.map((stitch) => ({ stitch, form }))).find(
      ({ stitch, form }) => !used.has(`${stitch}/${form}`),
    );
    if (!free) {
      this.#host.announce(texts().sections.size.gauge.allUsed);
      return;
    }
    const entry: GaugeEntry = { ...free, stitchesPer10cm: null, rowsPer10cm: null, source: 'measured' };
    this.#edit((current) => ({ ...current, gauges: [...current.gauges, entry] }), texts().sections.size.gauge.added);
    this.#gauges.querySelector<HTMLInputElement>(`li[data-index="${profile.gauges.length}"] [data-field="stitchesPer10cm"]`)?.focus();
  }

  #changeGauge(target: HTMLInputElement | HTMLSelectElement): void {
    const row = target.closest<HTMLLIElement>('li[data-index]');
    const field = target.dataset.field;
    const profile = activeProfile(this.#current());
    const index = Number(row?.dataset.index);
    const entry = profile?.gauges[index];
    if (!profile || !entry || !field) return;
    const library = this.#library;

    let next: GaugeEntry;
    if (field === 'stitchesPer10cm' || field === 'rowsPer10cm') {
      const value = readNumber(target as HTMLInputElement);
      if (value === undefined) {
        target.value = numberValue(entry[field]);
        this.#host.announce(texts().sections.size.gauge.invalidNumber);
        return;
      }
      next = { ...entry, [field]: value };
    } else if (field === 'stitch' || field === 'form') {
      next = { ...entry, [field]: target.value } as GaugeEntry;
      const duplicate = profile.gauges.some((other, i) => i !== index && other.stitch === next.stitch && other.form === next.form);
      if (duplicate) {
        target.value = entry[field];
        const name = library ? gaugeStitchName(library, next.stitch) : next.stitch;
        this.#host.announce(texts().sections.size.gauge.duplicate(capitalize(name), formLabel(next.form)));
        return;
      }
    } else if (field === 'source') {
      next = { ...entry, source: target.value === 'label' ? 'label' : 'measured' };
    } else {
      return;
    }
    this.#edit(
      (current) => ({ ...current, gauges: current.gauges.map((old, i) => (i === index ? next : old)) }),
      texts().sections.size.gauge.changed,
    );
  }

  #render(): void {
    const pattern = this.#pattern;
    const library = this.#library;
    if (!pattern || !library) return;
    this.#shown = pattern;
    this.#shownLanguage = uiLanguage();

    const profile = activeProfile(pattern);
    const profiles = pattern.gauge?.profiles ?? [];
    this.#profile.replaceChildren(
      option('', texts().sections.size.profile.none),
      ...profiles.map((candidate) => option(candidate.id, profileLabel(candidate))),
    );
    this.#profile.value = profile?.id ?? '';
    this.#remove.disabled = profile === null;
    this.#editor.hidden = profile === null;
    if (profile) this.#renderProfile(profile, library);
    this.#renderResult(sizeView(patternSize(pattern, this.#graph, library)));
  }

  #renderProfile(profile: PatternGaugeProfile, library: StitchLibrary): void {
    setValue(this.#yarnName, profile.yarn.name);
    setValue(this.#cyc, profile.yarn.cycWeight === null ? '' : String(profile.yarn.cycWeight));
    for (const field of this.#fields) setValue(field.input, numberValue(field.get(profile)));
    this.#blocked.checked = profile.blocked;

    const origins = profileOrigins(profile);
    setOrigin(this.#origins.cyc, origins.cycWeight);
    setOrigin(this.#origins.meterage, origins.metersPer100g);
    setOrigin(this.#origins.ball, origins.ballMassG);
    setOrigin(this.#origins.hook, origins.hookMm);
    setOrigin(this.#origins.swatch, origins.swatch);
    this.#hookSizes.textContent = hookSizesText(profile.hookMm);

    const key = `${profile.id}:${profile.gauges.length}:${uiLanguage()}`;
    if (key !== this.#gaugeKey) {
      this.#gaugeKey = key;
      this.#gauges.replaceChildren(...profile.gauges.map((_, i) => this.#gaugeRow(i, library)));
    }
    profile.gauges.forEach((entry, i) => {
      const row = this.#gauges.querySelector<HTMLLIElement>(`li[data-index="${i}"]`);
      if (!row) return;
      const control = <T extends HTMLInputElement | HTMLSelectElement>(field: string) => row.querySelector<T>(`[data-field="${field}"]`)!;
      setValue(control('stitch'), entry.stitch);
      setValue(control('form'), entry.form);
      setValue(control('stitchesPer10cm'), numberValue(entry.stitchesPer10cm));
      setValue(control('rowsPer10cm'), numberValue(entry.rowsPer10cm));
      setValue(control('source'), entry.source);
      const gauge = texts().sections.size.gauge;
      row.querySelector('[data-rows-label]')!.textContent = entry.form === 'rows' ? gauge.rows : gauge.rounds;
      const note = row.querySelector<HTMLElement>('.gauge__note')!;
      note.textContent = gaugeEntryNote(entry, estimatedGauge(profile, library, entry.stitch, entry.form));
      note.hidden = note.textContent === '';
      const name = `${capitalize(gaugeStitchName(library, entry.stitch))}, ${formLabel(entry.form)}`;
      row.querySelector('[data-remove]')!.setAttribute('aria-label', gauge.removeLabel(name));
    });
    this.#addGauge.disabled = profile.gauges.length >= GAUGE_STITCHES.length * FORMS.length;
  }

  #gaugeRow(index: number, library: StitchLibrary): HTMLLIElement {
    const row = element('li', 'gauge');
    row.dataset.index = String(index);
    const id = (field: string) => `size-gauge-${index}-${field}`;
    const field = (label: string, control: HTMLInputElement | HTMLSelectElement, name: string) => {
      const wrap = element('p', 'panel__field');
      const labelEl = element('label', '', label);
      labelEl.htmlFor = id(name);
      control.id = id(name);
      control.dataset.field = name;
      wrap.append(labelEl, control);
      return { wrap, labelEl };
    };
    const select = (options: readonly [string, string][]) => {
      const el = element('select');
      el.append(...options.map(([value, label]) => option(value, label)));
      return el;
    };
    const number = () => {
      const el = element('input');
      el.type = 'text';
      el.inputMode = 'decimal';
      el.autocomplete = 'off';
      return el;
    };

    const words = texts().sections.size.gauge;
    const stitch = field(words.stitch, select(GAUGE_STITCHES.map((value) => [value, gaugeStitchName(library, value)])), 'stitch');
    stitch.wrap.classList.add('gauge__stitch');
    const form = field(words.form, select(FORMS.map((value) => [value, formLabel(value)])), 'form');
    const stitches = field(words.stitches, number(), 'stitchesPer10cm');
    const rows = field(words.rows, number(), 'rowsPer10cm');
    rows.labelEl.dataset.rowsLabel = '';
    const source = field(
      words.source,
      select([
        ['measured', sourceLabel('measured')],
        ['label', sourceLabel('label')],
      ]),
      'source',
    );
    const note = element('p', 'gauge__note');
    note.id = id('note');
    note.hidden = true;
    for (const control of [stitches, rows]) control.wrap.querySelector('input')!.setAttribute('aria-describedby', note.id);
    const remove = element('button', 'tool gauge__remove', words.remove);
    remove.type = 'button';
    remove.dataset.remove = String(index);
    row.append(stitch.wrap, form.wrap, stitches.wrap, rows.wrap, source.wrap, note, remove);
    return row;
  }

  #renderResult(view: SizeView): void {
    this.#notice.hidden = view.notice === null;
    this.#notice.textContent = view.notice ?? '';

    this.#total.replaceChildren(
      ...(view.total.length > 0 ? [valueList(view.total)] : []),
      ...(view.totalNote ? [element('p', 'panel__note', view.totalNote)] : []),
    );

    this.#rows.hidden = view.layers.length === 0;
    const table = element('table', 'size__table');
    const head = element('tr');
    head.append(...view.headers.map((header) => Object.assign(element('th', '', header), { scope: 'col' })));
    const body = element('tbody');
    for (const layer of view.layers) {
      const tr = element('tr');
      const th = Object.assign(element('th', '', layer.label), { scope: 'row' });
      th.append(element('span', `size__origin size__origin--${layer.source}`, sourceLabel(layer.source)));
      tr.append(th, element('td', '', layer.width), element('td', '', layer.height), element('td', '', layer.total));
      body.append(tr);
    }
    const thead = element('thead');
    thead.append(head);
    table.append(thead, body);
    this.#rows.replaceChildren(table);

    this.#yarn.replaceChildren(...(view.yarn.length > 0 ? [valueList(view.yarn)] : []), element('p', 'panel__note', view.yarnNote));
  }
}

function valueList(rows: readonly ValueRow[]): HTMLDListElement {
  const list = element('dl', 'size__values');
  for (const row of rows) {
    const item = element('div');
    const value = element('dd');
    value.append(element('span', 'size__value', row.text.value), ' ', element('span', `origin origin--${row.text.source}`, sourceLabel(row.text.source)));
    if (row.text.range) value.append(element('span', 'size__range', texts().sections.size.result.range(row.text.range)));
    item.append(element('dt', '', row.label), value);
    list.append(item);
  }
  return list;
}
