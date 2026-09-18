/*
 * A minta alkotása nem folytonos (PQW-933).
 *
 * A tulajdonos szava: „abba szaporítson, amelyikbe kattintok, még ha az
 * visszafele haladást is jelentene — de ez mintakészítés, nem aktuális
 * horgolás, tehát szabadon lehet visszafele módosítani”, és „ne csússzon el a
 * pálca eredetileg horgolt helye: maradjon a megfelelő láncszemből kiindulás
 * és az egész ugyanabba a négyzetben/cellában maradjon”.
 *
 * A rajz a vásznon készül, ezért a helyeket a felület böngészős horgából
 * mérjük (`window.mintatervezoRacs`, `window.mintatervezoKijeloles`).
 *
 * A megdőlt szemet a jel BEFOGLALÓ TÉGLALAPJA mutatja meg: az álló pálca
 * jelének szélessége egy jelnyi (21 képpont), a megdőlté a talpától a tetejéig
 * ér. A javítás előtti mérés: a pótolt szem melletti pálca 46,5 képpont széles
 * lett, mert a talpa az egyik láncszemen maradt, a teteje a másikra került.
 */

import { expect, test, type Page } from '@playwright/test';

/** Az álló pálca jele 21 képpont széles; ennél szélesebb jel megdőlt. */
const UPRIGHT = 24;

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

interface Node {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

interface Box {
  readonly id: string;
  readonly layer: number;
  readonly left: number;
  readonly right: number;
}

/** Egy pálca a rajzon: a teteje, és a jel befoglaló téglalapja. */
interface Stitch {
  readonly x: number;
  readonly left: number;
  readonly right: number;
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

const nodes = (page: Page): Promise<Node[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoKijeloles: { nodes(): Node[] } }).mintatervezoKijeloles.nodes());

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { stitchBoxes(): Box[] } }).mintatervezoRacs.stitchBoxes());

/** A célpont saját cellájának közepe az alsó sorban: oda mutat a horgoló. */
async function targetColumn(page: Page, slot: number): Promise<number> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `a(z) ${slot}. célpont cellája az alsó sorban`).toBeTruthy();
  return cell!.x;
}

/** Kattintás a célpont saját cellájára. */
async function clickTarget(page: Page, slot: number): Promise<void> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `a(z) ${slot}. célpont cellája az alsó sorban`).toBeTruthy();
  await page.mouse.click(cell!.x, cell!.y);
}

/** 12 láncszem, fordulás, és a kiválasztott egyráhajtásos pálca. */
async function foundation(page: Page): Promise<void> {
  const palette = page.locator('#palette');
  await palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('12');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();
  await palette.getByRole('button', { name: /Egyráhajtásos pálca \(erp\)/ }).first().click();
}

/** A készülő sor pálcái azonosító szerint. */
async function stitches(page: Page): Promise<Map<string, Stitch>> {
  const layer = await workingLayer(page);
  const box = new Map((await boxes(page)).map((candidate) => [candidate.id, candidate]));
  const found = (await nodes(page)).filter((node) => node.layer === layer && node.def === 'dc');
  return new Map(found.map((node) => [node.id, { x: node.x, left: box.get(node.id)!.left, right: box.get(node.id)!.right }]));
}

test('a kihagyott helyre kattintva oda kerül a szem, a többi marad (PQW-933)', async ({ page }) => {
  await open(page);
  await foundation(page);

  // Három pálca úgy, hogy az 5. célpont üresen marad: ez a „lyukas hely”.
  for (const slot of [3, 4, 6]) await clickTarget(page, slot);
  const before = await stitches(page);
  expect([...before.keys()], 'három pálca a sorban').toHaveLength(3);
  const gap = await targetColumn(page, 5);

  // A rés pótlása: kattintás az üres célpontra, ami a sorban VISSZAFELÉ van.
  await clickTarget(page, 5);

  const after = await stitches(page);
  expect([...after.keys()], 'négy pálca a sorban').toHaveLength(4);
  for (const [id, was] of before) {
    expect(after.get(id)?.x, `a(z) ${id} pálca nem csúszott el`).toBe(was.x);
  }
  const added = [...after].find(([id]) => !before.has(id));
  expect(added?.[1].x, 'az új pálca a megkattintott láncszem fölé került').toBe(gap);
  for (const [id, { left, right }] of after) {
    expect(right - left, `a(z) ${id} pálca nem dőlt meg`).toBeLessThan(UPRIGHT);
  }

  // A pótlás nem hiba: a horgoló azért kattintott oda, mert oda szánta.
  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings'), 'a pótlás nem hiba').not.toContainText('Hiba:');
});

test('a megkattintott szembe szaporít, nem a legutoljára lerakottba (PQW-933)', async ({ page }) => {
  await open(page);
  await foundation(page);

  for (const slot of [3, 4, 5, 6]) await clickTarget(page, slot);
  expect([...(await stitches(page)).keys()], 'négy pálca a sorban').toHaveLength(4);

  // Vissza a 4. célpontra, amelyben MÁR van pálca: ide szaporítunk.
  await clickTarget(page, 4);

  const after = await stitches(page);
  expect([...after.keys()], 'öt pálca a sorban').toHaveLength(5);

  // A szaporítás két szára EGY talpból nyílik, a megkattintott láncszemből:
  // csak ez a kettő dől, és mindkettő jele ráér erre az oszlopra. A javítás
  // előtt három szem dőlt meg, mert a sor fele elcsúszott.
  const column = await targetColumn(page, 4);
  const leaning = [...after].filter(([, { left, right }]) => right - left >= UPRIGHT);
  expect(leaning, 'a szaporítás két szára dől, más semmi').toHaveLength(2);
  for (const [id, { left, right }] of leaning) {
    expect(left - 1 <= column && column <= right + 1, `a(z) ${id} szár a megkattintott láncszemből indul`).toBe(true);
  }

  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings'), 'a visszafelé szaporítás sem hiba').not.toContainText('Hiba:');
});
