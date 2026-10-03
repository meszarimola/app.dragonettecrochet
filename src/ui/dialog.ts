// KB: interface.md §89

/**
 * Closes the dialog on a click on its backdrop. A press that starts inside and
 * is let go outside also clicks the dialog element, so only a press and a
 * release both outside its box count.
 */
export function closeOnBackdrop(dialog: HTMLDialogElement): void {
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
}
