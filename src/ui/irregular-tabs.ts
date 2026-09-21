// The free-form panel's rows, layers and key behind one row of tabs. KB: interface.md §59

export function wireTabs(strip: HTMLElement): void {
  const tabs = ['#tab-rows', '#tab-layers', '#tab-key']
    .map((selector) => strip.querySelector<HTMLButtonElement>(selector))
    .filter((tab): tab is HTMLButtonElement => tab !== null);
  const show = (picked: HTMLButtonElement): void => {
    for (const tab of tabs) {
      const on = tab === picked;
      tab.setAttribute('aria-pressed', String(on));
      const section = strip.ownerDocument.getElementById(tab.getAttribute('aria-controls') ?? '');
      if (!(section instanceof HTMLDetailsElement)) continue;
      section.open = true;
      section.classList.toggle('is-off', !on);
    }
  };
  for (const tab of tabs) tab.addEventListener('click', () => show(tab));
  const first = tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true') ?? tabs[0];
  if (first !== undefined) show(first);
}
