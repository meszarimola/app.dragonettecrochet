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
}

export function bindNewMenu(parts: NewMenuParts, onFreeform: () => void): void {
  const { root, button, menu, freeform, regular, submenu, shapes: sub } = parts;
  const top = [freeform, regular];

  const setSub = (open: boolean): void => {
    submenu.hidden = !open;
    regular.setAttribute('aria-expanded', String(open));
  };
  const setOpen = (open: boolean): void => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (!open) setSub(false);
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
    } else if (event.key === 'Escape' && !menu.hidden) setOpen(false);
    else return;
    event.preventDefault();
    event.stopPropagation();
  });

  freeform.addEventListener('click', () => {
    setOpen(false);
    button.focus();
    onFreeform();
  });
  freeform.addEventListener('pointerenter', () => setSub(false));
  regular.addEventListener('click', openSub);
  regular.addEventListener('pointerenter', () => setSub(true));

  menu.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const inSub = submenu.contains(target);
    const list: readonly HTMLElement[] = inSub ? sub : top;
    const next = stepIndex(list.indexOf(target), list.length, event.key);
    if (next !== null) list[next]?.focus();
    else if (event.key === 'ArrowRight' && target === regular) openSub();
    else if (inSub && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
      setSub(false);
      regular.focus();
    } else if (event.key === 'Escape') {
      setOpen(false);
      button.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !root.contains(event.target as Node)) setOpen(false);
  });
}
