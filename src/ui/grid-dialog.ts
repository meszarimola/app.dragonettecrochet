// KB: interface.md §89

import {
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_STITCHES,
  type GridCountCode,
  MAX_GRID_ROWS,
  MAX_GRID_STITCHES,
  MIN_GRID,
  readGridCount,
} from '../core/grid.ts';
import type { SectionTexts } from './i18n/sections.ts';
import { texts } from './i18n.ts';

export function gridCountMessage(code: GridCountCode, max: number, words: SectionTexts['gridCount']): string {
  switch (code) {
    case 'grid-count-empty':
      return words.empty;
    case 'grid-count-not-whole':
      return words.notWhole;
    case 'grid-count-too-small':
      return words.tooSmall(MIN_GRID);
    case 'grid-count-too-large':
      return words.tooLarge(max);
  }
}

export interface GridDialogParts {
  readonly dialog: HTMLDialogElement;
  readonly stitches: HTMLInputElement;
  readonly rows: HTMLInputElement;
  readonly stitchesError: HTMLElement;
  readonly rowsError: HTMLElement;
  readonly create: HTMLButtonElement;
  readonly cancel: HTMLButtonElement;
}

/** Returns what opens the dialog; `done` gets the two counts once both are valid. */
export function bindGridDialog(parts: GridDialogParts, done: (stitches: number, rows: number) => void): () => void {
  const { dialog, stitches, rows, stitchesError, rowsError, create, cancel } = parts;
  const fields = [
    { input: stitches, error: stitchesError, max: MAX_GRID_STITCHES },
    { input: rows, error: rowsError, max: MAX_GRID_ROWS },
  ];

  const check = (field: (typeof fields)[number]): number | null => {
    const count = readGridCount(field.input.value, field.max);
    field.error.textContent = count.ok ? '' : gridCountMessage(count.code, field.max, texts().sections.gridCount);
    field.input.setAttribute('aria-invalid', String(!count.ok));
    return count.ok ? count.value : null;
  };

  // Enter in a field submits the form by clicking this button, so both ways arrive here.
  create.addEventListener('click', (event) => {
    event.preventDefault();
    const [across, up] = fields.map(check);
    if (across == null || up == null) {
      fields.find(({ input }) => input.getAttribute('aria-invalid') === 'true')?.input.focus();
      return;
    }
    dialog.close();
    done(across, up);
  });
  for (const field of fields) {
    field.input.addEventListener('input', () => {
      if (field.input.getAttribute('aria-invalid') === 'true') check(field);
    });
  }
  cancel.addEventListener('click', () => dialog.close());
  // A press that starts in a field and ends outside clicks the dialog too; only a press outside it is the backdrop's.
  let pressedOutside = false;
  const outside = ({ clientX: x, clientY: y }: MouseEvent): boolean => {
    const box = dialog.getBoundingClientRect();
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
  };
  dialog.addEventListener('pointerdown', (event) => {
    pressedOutside = event.target === dialog && outside(event);
  });
  dialog.addEventListener('click', (event) => {
    if (pressedOutside && event.target === dialog && outside(event)) dialog.close();
    pressedOutside = false;
  });

  return () => {
    stitches.value = String(DEFAULT_GRID_STITCHES);
    rows.value = String(DEFAULT_GRID_ROWS);
    for (const { input, error } of fields) {
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    }
    dialog.showModal();
    stitches.select();
  };
}
