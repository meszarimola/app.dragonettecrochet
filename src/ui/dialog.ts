/*
 * Kis megerősítő párbeszédablak (PQW-879).
 *
 * A vezetett horgolás közben a foglalt vagy a haladási irány elleni célpontnál
 * nem tesz le csendben hibás szemet, hanem megkérdezi a felhasználót. A szöveg
 * a „szem” szóhasználattal, belső fogalom nélkül; a tudásbázis-hivatkozás — ha
 * van — csak lenyitható részletként.
 *
 * A natív `<dialog>` modálisan nyílik, az Esc és a háttérre kattintás a „Mégse”
 * felel meg. Egyszerre csak egy párbeszéd lehet nyitva; ígéretet ad vissza,
 * amely a választással teljesül.
 */

import { texts } from './i18n.js';

export interface ConfirmOptions {
  /** A fő kérdés, a felhasználónak szóló nyelven. */
  readonly message: string;
  /** A megerősítő gomb szövege, pl. „Szaporítás”. */
  readonly confirmLabel: string;
  /** Az elutasító gomb szövege; alapból „Mégse”. */
  readonly cancelLabel?: string;
  /** Lenyitható részlet, pl. tudásbázis-hivatkozás. */
  readonly detail?: string;
}

let open: HTMLDialogElement | null = null;

/** `true`, ha a felhasználó a megerősítő gombot választotta; `false` minden más esetben. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // Ha valamiért már nyitva van egy párbeszéd, azt lezárjuk (Mégse), és újat nyitunk.
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
    // Esc: a natív `cancel` esemény.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    // Kattintás a háttérre (a dialog dobozán kívül).
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}
