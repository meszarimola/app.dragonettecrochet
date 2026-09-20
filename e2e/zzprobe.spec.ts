import { type Page, test } from '@playwright/test';
async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}
test('probe 768 detail', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 700 });
  await open(page);
  await page.locator('#written-toggle').click();
  await page.locator('#file-toggle').click();
  await page.locator('#setup-toggle').click();
  const out = await page.evaluate(() => {
    const w = document.querySelector('#written') as HTMLElement;
    const btn = w.querySelector('.written__actions button') as HTMLElement;
    const head = w.querySelector('#written-title') as HTMLElement;
    const g = (e: HTMLElement | null) => e && { x: e.getBoundingClientRect().x, w: e.getBoundingClientRect().width, right: e.getBoundingClientRect().right };
    return { written: g(w), scrollW: w.scrollWidth, clientW: w.clientWidth, btn: g(btn), head: g(head), docScroll: document.documentElement.scrollWidth, vw: window.innerWidth };
  });
  console.log(JSON.stringify(out, null, 1));
});
