/*
 * The interface language (PQW-900, PQW-1100): English by default, Hungarian on
 * request, and the choice is remembered. This is the bilingual sentinel: it
 * asserts product strings in both languages.
 */

import { expect, test } from '@playwright/test';

test('switching to Hungarian translates the interface and is remembered', { tag: '@kiadas' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('hu');
  await expect(page.getByRole('button', { name: 'Új' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mintatervező' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alapszemek' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vissza a dragonettecrochet.com főoldalára' })).toHaveAttribute(
    'href',
    'https://dragonettecrochet.com/hu/',
  );
  await expect(page).toHaveURL(/[?&]lang=hu\b/);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Új' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});

test('?lang=hu opens the interface in Hungarian', async ({ page }) => {
  await page.goto('/?lang=hu');
  await expect(page.getByRole('heading', { name: 'Szemek', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'A felület nyelve' })).toHaveValue('hu');
});
