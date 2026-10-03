// KB: interface.md §90

import { closeOnBackdrop } from './dialog.ts';

export interface ReplaceDialogParts {
  readonly dialog: HTMLDialogElement;
  readonly proceed: HTMLButtonElement;
  readonly cancel: HTMLButtonElement;
}

/**
 * Returns what asks before a new chart replaces the current one: `then` runs
 * at once when nothing would be lost, or once the user goes on.
 */
export function bindReplaceDialog(parts: ReplaceDialogParts, wouldLose: () => boolean): (then: () => void) => void {
  const { dialog, proceed, cancel } = parts;
  let pending: (() => void) | null = null;
  proceed.addEventListener('click', (event) => {
    event.preventDefault();
    const then = pending;
    pending = null;
    dialog.close();
    then?.();
  });
  cancel.addEventListener('click', () => dialog.close());
  closeOnBackdrop(dialog);

  return (then) => {
    if (!wouldLose()) {
      then();
      return;
    }
    pending = then;
    dialog.showModal();
    cancel.focus();
  };
}
