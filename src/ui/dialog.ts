// KB: decisions.md §3, §4

import { texts } from './i18n.js';

export interface ConfirmOptions {
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly detail?: string;
}

let open: HTMLDialogElement | null = null;

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // Only one dialog may be open: an earlier one is cancelled, not stacked.
  open?.close();

  const dialog = document.createElement('dialog');
  dialog.className = 'ask';

  const message = document.createElement('p');
  message.className = 'ask__message';
  message.textContent = options.message;
  dialog.append(message);

  if (options.detail) {
    const details = document.createElement('details');
    details.className = 'ask__details';
    const summary = document.createElement('summary');
    summary.textContent = texts().sections.dialog.details;
    const body = document.createElement('p');
    body.className = 'ask__detail';
    body.textContent = options.detail;
    details.append(summary, body);
    dialog.append(details);
  }

  const actions = document.createElement('div');
  actions.className = 'ask__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'tool';
  cancel.textContent = options.cancelLabel ?? texts().sections.dialog.cancel;
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'tool tool--primary';
  confirm.textContent = options.confirmLabel;
  actions.append(cancel, confirm);
  dialog.append(actions);

  document.body.append(dialog);
  open = dialog;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (open === dialog) open = null;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}
