/*
 * A „Méret és fonal” szakasz (PQW-859): profil-szerkesztő, váltás a profilok
 * között, kész méret és fonalbecslés, az arányhelyes nézet kapcsolója.
 *
 * Gépelés közben semmi nem épül újra: a mezők az index.html-ben vannak, és
 * frissítéskor csak az értékük változik (a fókuszban lévőé nem). A szemenkénti
 * gauge sorai csak akkor épülnek újra, ha a profil vagy a sorok száma változik.
 * Minden módosítás a mintát változtatja, ezért visszavonható, és a mintával
 * mentődik (a böngészőben és a JSON-ben is); új tárolókulcs nincs.
 *
 * A szakasz csak nyitva számol, mert a vászon egérmozgásra is frissít.
 */

import type { PieceGraph } from '../core/graph.js';
import { GAUGE_STITCHES } from '../core/pattern-json.js';
import { activeProfile, estimatedGauge, newProfile, patternSize, withActiveProfile, withProfile, withoutProfile } from '../core/pattern-size.js';
import type { StitchLibrary } from '../core/stitch-library.js';
import type { GaugeEntry, GaugeForm, Pattern, PatternGaugeProfile } from '../core/types.js';
import { CYC_WEIGHTS } from '../core/yarn-weight.js';
import {
  FORM_LABELS,
  SOURCE_LABELS,
  cycWeightLabel,
  formatNumber,
  gaugeEntryNote,
  gaugeStitchName,
  hookSizesText,
  profileLabel,
  profileOrigins,
  sizeView,
  type Origin,
  type SizeView,
  type ValueRow,
} from './size-view.js';

export interface SizePanelHost {
  /** A módosított minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
  setAspect(on: boolean): void;
}

const FORMS: readonly GaugeForm[] = ['rows', 'rounds'];

interface NumberField {
  readonly input: HTMLInputElement;
  readonly max: number;
  readonly required: boolean;
  readonly invalid: string;
  readonly message: string;
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

/** Üres mezőre `null`, érvénytelenre `undefined`. Tizedesvesszőt és -pontot is elfogad. */
function readNumber(input: HTMLInputElement, max = Number.POSITIVE_INFINITY): number | null | undefined {
  const text = input.value.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 && value <= max ? value : undefined;
}

const numberValue = (value: number | null) => (value === null ? '' : formatNumber(value, 3));

/** A mező értéke, kivéve ha épp abban gépel valaki. */
function setValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (document.activeElement !== input && input.value !== value) input.value = value;
}

function setOrigin(badge: HTMLElement, value: Origin | null): void {
  badge.hidden = value === null;
  badge.textContent = value?.text ?? '';
  badge.className = value ? `origin origin--${value.source}` : 'origin';
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);
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
  /** A legutóbb kiírt minta; ugyanarra nem számolunk újra. */
  #shown: Pattern | null = null;
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
      option('', 'Nincs a címkén'),
      ...CYC_WEIGHTS.map((weight) => option(String(weight.weight), cycWeightLabel(weight.weight))),
    );

    const swatch = (key: keyof PatternGaugeProfile['swatch'], id: string, invalid: string, message: string): NumberField => ({
      input: find(id),
      max: Number.POSITIVE_INFINITY,
      required: false,
      invalid,
      message,
      get: (profile) => profile.swatch[key],
      set: (profile, value) => ({ ...profile, swatch: { ...profile.swatch, [key]: value } }),
    });
    this.#fields = [
      {
        input: find('size-meterage'),
        max: Number.POSITIVE_INFINITY,
        required: false,
        invalid: 'A méter/100 g pozitív szám, vagy maradjon üresen.',
        message: 'A fonal m/100 g értéke módosult.',
        get: (profile) => profile.yarn.metersPer100g,
        set: (profile, value) => ({ ...profile, yarn: { ...profile.yarn, metersPer100g: value } }),
      },
      {
        input: find('size-ball'),
        max: Number.POSITIVE_INFINITY,
        required: false,
        invalid: 'A gombolyag tömege pozitív szám, vagy maradjon üresen.',
        message: 'A gombolyag tömege módosult.',
        get: (profile) => profile.yarn.ballMassG,
        set: (profile, value) => ({ ...profile, yarn: { ...profile.yarn, ballMassG: value } }),
      },
      {
        input: find('size-hook'),
        max: 30,
        required: true,
        invalid: 'A tű mérete kötelező: 30 mm-nél nem nagyobb pozitív szám.',
        message: 'A tű mérete módosult.',
        get: (profile) => profile.hookMm,
        set: (profile, value) => ({ ...profile, hookMm: value ?? profile.hookMm }),
      },
      swatch('widthCm', 'size-swatch-width', 'A próbadarab szélessége pozitív szám, vagy maradjon üresen.', 'A próbadarab szélessége módosult.'),
      swatch('heightCm', 'size-swatch-height', 'A próbadarab magassága pozitív szám, vagy maradjon üresen.', 'A próbadarab magassága módosult.'),
      swatch('massG', 'size-swatch-mass', 'A próbadarab tömege pozitív szám, vagy maradjon üresen.', 'A próbadarab tömege módosult.'),
    ];

    this.#profile.addEventListener('change', () => {
      const next = withActiveProfile(this.#current(), this.#profile.value || null);
      const chosen = activeProfile(next);
      host.commit(next, chosen ? `Profil: ${profileLabel(chosen)}.` : 'Profil nélkül: a méret becslés, tartománnyal.');
    });
    find<HTMLButtonElement>('size-add').addEventListener('click', () => {
      const pattern = this.#current();
      host.commit(withProfile(pattern, newProfile(pattern)), 'Új profil: add meg a fonalat, a tűt és a mért értékeket.');
      this.#yarnName.focus();
    });
    this.#remove.addEventListener('click', () => {
      const pattern = this.#current();
      const profile = activeProfile(pattern);
      if (!profile) return;
      host.commit(withoutProfile(pattern, profile.id), `Profil törölve: ${profileLabel(profile)}. Visszavonással visszajön.`);
      this.#profile.focus();
    });

    this.#yarnName.addEventListener('change', () =>
      this.#edit((profile) => ({ ...profile, yarn: { ...profile.yarn, name: this.#yarnName.value.trim() } }), 'A fonal neve módosult.'),
    );
    this.#cyc.addEventListener('change', () => {
      const cycWeight = this.#cyc.value === '' ? null : Number(this.#cyc.value);
      this.#edit((profile) => ({ ...profile, yarn: { ...profile.yarn, cycWeight } }), 'A fonal vastagsági kategóriája módosult.');
    });
    this.#blocked.addEventListener('change', () => {
      const blocked = this.#blocked.checked;
      this.#edit((profile) => ({ ...profile, blocked }), blocked ? 'A profil blokkolva mért.' : 'A profil blokkolás nélkül mért.');
    });
    for (const field of this.#fields) {
      field.input.addEventListener('change', () => {
        const profile = activeProfile(this.#current());
        if (!profile) return;
        const value = readNumber(field.input, field.max);
        if (value === undefined || (field.required && value === null)) {
          field.input.value = numberValue(field.get(profile));
          host.announce(field.invalid);
          return;
        }
        if (value !== field.get(profile)) this.#edit((current) => field.set(current, value), field.message);
      });
    }

    this.#gauges.addEventListener('change', (event) => this.#changeGauge(event.target as HTMLInputElement | HTMLSelectElement));
    this.#gauges.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-remove]');
      if (!button) return;
      const index = Number(button.dataset.remove);
      this.#edit((profile) => ({ ...profile, gauges: profile.gauges.filter((_, i) => i !== index) }), 'A mintasűrűség sora törölve.');
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

  /** A minta változott (vagy csak a nézet): nyitott szakaszban újraszámol. */
  update(pattern: Pattern, graph: PieceGraph | null, library: StitchLibrary): void {
    this.#pattern = pattern;
    this.#graph = graph;
    this.#library = library;
    if (this.#section.open && pattern !== this.#shown) this.#render();
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
      this.#host.announce('Minden szem mindkét formában szerepel már.');
      return;
    }
    const entry: GaugeEntry = { ...free, stitchesPer10cm: null, rowsPer10cm: null, source: 'measured' };
    this.#edit(
      (current) => ({ ...current, gauges: [...current.gauges, entry] }),
      'Új sor a mintasűrűséghez.',
    );
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
        this.#host.announce('A 10 cm-en számolt szem és sor pozitív szám, vagy maradjon üresen.');
        return;
      }
      next = { ...entry, [field]: value };
    } else if (field === 'stitch' || field === 'form') {
      next = { ...entry, [field]: target.value } as GaugeEntry;
      const duplicate = profile.gauges.some((other, i) => i !== index && other.stitch === next.stitch && other.form === next.form);
      if (duplicate) {
        target.value = entry[field];
        const name = library ? gaugeStitchName(library, next.stitch) : next.stitch;
        this.#host.announce(`${capitalize(name)}, ${FORM_LABELS[next.form]}: ilyen sor már van.`);
        return;
      }
    } else if (field === 'source') {
      next = { ...entry, source: target.value === 'label' ? 'label' : 'measured' };
    } else {
      return;
    }
    this.#edit((current) => ({ ...current, gauges: current.gauges.map((old, i) => (i === index ? next : old)) }), 'A mintasűrűség módosult.');
  }

  #render(): void {
    const pattern = this.#pattern;
    const library = this.#library;
    if (!pattern || !library) return;
    this.#shown = pattern;

    const profile = activeProfile(pattern);
    const profiles = pattern.gauge?.profiles ?? [];
    this.#profile.replaceChildren(option('', 'Profil nélkül (becslés)'), ...profiles.map((candidate) => option(candidate.id, profileLabel(candidate))));
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

    const key = `${profile.id}:${profile.gauges.length}`;
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
      row.querySelector('[data-rows-label]')!.textContent = entry.form === 'rows' ? 'Sor 10 cm-en' : 'Kör 10 cm-en';
      const note = row.querySelector<HTMLElement>('.gauge__note')!;
      note.textContent = gaugeEntryNote(entry, estimatedGauge(profile, library, entry.stitch, entry.form));
      note.hidden = note.textContent === '';
      const name = `${capitalize(gaugeStitchName(library, entry.stitch))}, ${FORM_LABELS[entry.form]}`;
      row.querySelector('[data-remove]')!.setAttribute('aria-label', `${name}: a sor törlése`);
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

    const stitch = field('Szem', select(GAUGE_STITCHES.map((value) => [value, gaugeStitchName(library, value)])), 'stitch');
    stitch.wrap.classList.add('gauge__stitch');
    const form = field('Mérve', select(FORMS.map((value) => [value, FORM_LABELS[value]])), 'form');
    const stitches = field('Szem 10 cm-en', number(), 'stitchesPer10cm');
    const rows = field('Sor 10 cm-en', number(), 'rowsPer10cm');
    rows.labelEl.dataset.rowsLabel = '';
    const source = field(
      'Eredet',
      select([
        ['measured', SOURCE_LABELS.measured],
        ['label', SOURCE_LABELS.label],
      ]),
      'source',
    );
    const note = element('p', 'gauge__note');
    note.id = id('note');
    note.hidden = true;
    for (const control of [stitches, rows]) control.wrap.querySelector('input')!.setAttribute('aria-describedby', note.id);
    const remove = element('button', 'tool gauge__remove', 'Sor törlése');
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
      // Az eredet a sor fejlécében, hogy a keskeny panelben ne kelljen oldalra görgetni.
      const th = Object.assign(element('th', '', layer.label), { scope: 'row' });
      th.append(element('span', `size__origin size__origin--${layer.source}`, SOURCE_LABELS[layer.source]));
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

/** Érték, eredet és tartomány soronként. */
function valueList(rows: readonly ValueRow[]): HTMLDListElement {
  const list = element('dl', 'size__values');
  for (const row of rows) {
    const item = element('div');
    const value = element('dd');
    value.append(element('span', 'size__value', row.text.value), ' ', element('span', `origin origin--${row.text.source}`, SOURCE_LABELS[row.text.source]));
    if (row.text.range) value.append(element('span', 'size__range', `tartomány: ${row.text.range}`));
    item.append(element('dt', '', row.label), value);
    list.append(item);
  }
  return list;
}
