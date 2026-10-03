// KB: interface.md §88

/** The index a menu key moves the focus to, wrapping at both ends; `null` for any other key. */
export function stepIndex(current: number, count: number, key: string): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export interface NewMenuParts {
  readonly root: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;
  readonly freeform: HTMLButtonElement;
  readonly regular: HTMLButtonElement;
  readonly submenu: HTMLElement;
  readonly shapes: readonly HTMLButtonElement[];
  readonly rectangular: HTMLButtonElement;
}

export interface NewMenuChoices {
  readonly freeform: () => void;
  readonly rectangular: () => void;
}

export function bindNewMenu(parts: NewMenuParts, choose: NewMenuChoices): void {
  const { root, button, menu, freeform, regular, submenu, shapes: sub, rectangular } = parts;
  const top = [freeform, regular];
  const folded = window.matchMedia('(width < 40rem)');
  let swallowClick = false;

  const setSub = (open: boolean): void => {
    if (!open && submenu.contains(document.activeElement)) regular.focus();
    submenu.hidden = !open;
    regular.setAttribute('aria-expanded', String(open));
  };
  const setOpen = (open: boolean): void => {
    if (!open) setSub(false);
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const openSub = (): void => {
    setSub(true);
    sub[0]?.focus();
  };

  button.addEventListener('click', () => {
    setOpen(menu.hidden);
    if (!menu.hidden) freeform.focus();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      setOpen(true);
      freeform.focus();
      event.preventDefault();
    } else if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      event.preventDefault();
    } else if (event.key !== ' ') return;
    event.stopPropagation();
  });

  // „New” takes the focus first, so a dialog the choice opens gives it back there and not to a hidden item.
  for (const [item, chosen] of [
    [freeform, choose.freeform],
    [rectangular, choose.rectangular],
  ] as const) {
    item.addEventListener('click', () => {
      setOpen(false);
      button.focus();
      chosen();
    });
  }
  freeform.addEventListener('pointerenter', () => setSub(false));
  regular.addEventListener('click', () => {
    if (folded.matches && !submenu.hidden) setSub(false);
    else openSub();
  });
  // The pointerenter of a touch, or of any press where the submenu folds, comes just before its click and would undo it.
  regular.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse' && !folded.matches) setSub(true);
  });

  menu.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const inSub = submenu.contains(target);
    const list: readonly HTMLElement[] = inSub ? sub : top;
    const next = stepIndex(list.indexOf(target), list.length, event.key);
    if (next !== null) {
      if (!inSub) setSub(false);
      list[next]?.focus();
    } else if (event.key === 'ArrowRight' && target === regular) openSub();
    else if (inSub && (event.key === 'ArrowLeft' || event.key === 'Escape')) setSub(false);
    else if (event.key === 'Escape') {
      setOpen(false);
      button.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else {
      if (event.key === ' ') event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  root.addEventListener('focusout', (event) => {
    const to = event.relatedTarget;
    if (to instanceof Node && !root.contains(to)) setOpen(false);
  });

  // The press that closes the menu is spent on closing it, so the drawing below never gets a stitch from it.
  document.addEventListener(
    'pointerdown',
    (event) => {
      swallowClick = false;
      if (menu.hidden || root.contains(event.target as Node)) return;
      setOpen(false);
      swallowClick = true;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  // A press that never became a click must not eat the next keyboard click.
  document.addEventListener(
    'pointerup',
    () =>
      setTimeout(() => {
        swallowClick = false;
      }),
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
