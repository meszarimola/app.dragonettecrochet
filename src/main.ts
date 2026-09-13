/*
 * Belépési pont: a paletta felépítése, a kiválasztás és a lerakás összekötése.
 */

import './styles.css';
import { Board } from './board.js';
import { GA_MEASUREMENT_ID } from './config.js';
import { setupConsentBanner } from './consentBanner.js';
import { STITCHES, type StitchDef, type StitchId } from './stitches.js';

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

let selected: StitchId | null = null;
const buttons = new Map<StitchId, HTMLButtonElement>();

/* ---- Paletta ---- */

/** A gomb előnézete ugyanazzal a rajzoló függvénnyel készül, mint a vászon. */
function drawPreview(stitch: StitchDef, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.setAttribute('aria-hidden', 'true');

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(size / 2, size / 2);
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--c-ink')
      .trim();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    stitch.draw(ctx);
  }

  return canvas;
}

function select(id: StitchId | null): void {
  selected = id;

  for (const [stitchId, button] of buttons) {
    button.setAttribute('aria-pressed', String(stitchId === id));
  }

  const stitch = id ? STITCHES.find((s) => s.id === id) : undefined;
  hint.textContent = stitch
    ? `${stitch.hu} kiválasztva — kattints a vászonra.`
    : 'Válassz egy jelet, aztán kattints a vászonra.';
  document.body.classList.toggle('is-armed', stitch !== undefined);
}

for (const stitch of STITCHES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stitch';
  button.setAttribute('aria-pressed', 'false');

  button.append(drawPreview(stitch, 44));

  const label = document.createElement('span');
  label.className = 'stitch__label';
  label.innerHTML =
    `<span class="stitch__hu">${stitch.hu}</span>` +
    `<span class="stitch__en">${stitch.en} (${stitch.abbrEn})</span>`;
  button.append(label);

  const key = document.createElement('kbd');
  key.className = 'stitch__key';
  key.textContent = stitch.key;
  button.append(key);

  // A kiválasztott jelre újra kattintva megszűnik a kijelölés.
  button.addEventListener('click', () => {
    select(selected === stitch.id ? null : stitch.id);
  });

  buttons.set(stitch.id, button);
  palette.append(button);
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

  const stitch = STITCHES.find((s) => s.key === event.key);
  if (stitch) select(stitch.id);
});

select(null);
setupConsentBanner(GA_MEASUREMENT_ID);
