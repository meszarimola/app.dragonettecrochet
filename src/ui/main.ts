/*
 * Belépési pont: a paletta felépítése, a kiválasztás és a lerakás összekötése.
 */

import './styles.css';
import { Board } from './board.js';
import { GA_MEASUREMENT_ID } from '../config.js';
import { setupConsentBanner } from './consentBanner.js';
import type { StitchDef, StitchDefId } from '../core/types.js';
import { buildPalette, type PaletteItem } from './palette.js';
import { DEFAULT_SYMBOL_OPTIONS, applyInk, drawCentered, readInk, shapeBounds, symbolShapes } from './symbols.js';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Hiányzó elem a dokumentumban: ${selector}`);
  return el;
}

const canvas = must<HTMLCanvasElement>('#board');
const board = new Board(canvas);
const palette = must<HTMLDivElement>('#palette');
const panel = must<HTMLElement>('#panel');
const toggle = must<HTMLButtonElement>('#panel-toggle');
const hint = must<HTMLParagraphElement>('#hint');

const sections = buildPalette();
const items = sections.flatMap((section) => section.items);
const ink = readInk(document.documentElement);

let selected: StitchDefId | null = null;
const buttons = new Map<StitchDefId, HTMLButtonElement>();

/* ---- Paletta ---- */

/** A gomb előnézete ugyanazzal a rajzzal készül, mint a vászon, a gombhoz kicsinyítve. */
function drawPreview(def: StitchDef, size: number): HTMLCanvasElement {
  const preview = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;

  preview.width = Math.round(size * dpr);
  preview.height = Math.round(size * dpr);
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;
  preview.setAttribute('aria-hidden', 'true');

  const ctx = preview.getContext('2d');
  if (ctx) {
    const shapes = symbolShapes(def, DEFAULT_SYMBOL_OPTIONS);
    const { minX, minY, maxX, maxY } = shapeBounds(shapes);
    const fit = Math.min(1, (size - 8) / Math.max(maxX - minX, maxY - minY));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(size / 2, size / 2);
    // A vonal a kicsinyítés után is 2 px vastag marad.
    applyInk(ctx, ink, 2 / fit);
    drawCentered(ctx, shapes, fit);
  }

  return preview;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function stitchButton(item: PaletteItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stitch';
  button.setAttribute('aria-pressed', 'false');

  button.append(drawPreview(item.def, 44));

  const label = span('stitch__label', '');
  label.append(span('stitch__hu', item.name));
  if (item.structure) label.append(span('stitch__detail', item.structure));
  label.append(span('stitch__en', item.english));
  button.append(label);

  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = item.key;
    button.append(key);
  }

  // A kiválasztott jelre újra kattintva megszűnik a kijelölés.
  button.addEventListener('click', () => {
    select(selected === item.def.id ? null : item.def.id);
  });

  return button;
}

function select(id: StitchDefId | null): void {
  selected = id;

  for (const [stitchId, button] of buttons) {
    button.setAttribute('aria-pressed', String(stitchId === id));
  }

  const item = items.find((candidate) => candidate.def.id === id);
  hint.textContent = item
    ? `${item.name} kiválasztva — kattints a vászonra.`
    : 'Válassz egy jelet, aztán kattints a vászonra.';
  document.body.classList.toggle('is-armed', item !== undefined);
}

for (const section of sections) {
  const group = document.createElement('div');
  group.className = 'palette__section';
  group.setAttribute('role', 'group');

  const title = document.createElement('h3');
  title.className = 'palette__title';
  title.id = `palette-${section.id}`;
  title.textContent = section.title;
  group.setAttribute('aria-labelledby', title.id);
  group.append(title);

  for (const item of section.items) {
    const button = stitchButton(item);
    buttons.set(item.def.id, button);
    group.append(button);
  }

  palette.append(group);
}

/* ---- Lerakás ---- */

canvas.addEventListener('click', (event) => {
  if (!selected) return;
  board.place(selected, event.clientX, event.clientY);
});

/* ---- Panel ---- */

toggle.addEventListener('click', () => {
  const open = panel.hasAttribute('hidden');
  panel.toggleAttribute('hidden', !open);
  toggle.setAttribute('aria-expanded', String(open));
});

/* ---- Billentyűk ---- */

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === 'Escape') {
    select(null);
    return;
  }

  const item = items.find((candidate) => candidate.key === event.key);
  if (item) select(item.def.id);
});

select(null);
setupConsentBanner(GA_MEASUREMENT_ID);
