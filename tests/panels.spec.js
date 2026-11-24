/**
 * The About, Legal and Contact panels: menu, direct links, Close and Back.
 */
import { test, expect } from './fixtures.js';

const panelHeading = (page, name) => page.getByRole('heading', { level: 1, name });

test.beforeEach(async ({ stubNetwork }) => {
  await stubNetwork();
});

for (const [path, title] of [['/about', 'About'], ['/legal', 'Legal'], ['/contact', 'Contact']]) {
  test(`${path} opens the ${title} panel directly`, async ({ page }) => {
    await page.goto(path);
    await expect(panelHeading(page, title)).toBeVisible();
    await expect(page).toHaveTitle(`${title} | SEFKHET-ABWY`);
  });
}

test('the menu opens a panel and Back closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Legal' }).click();

  await expect(page).toHaveURL('/legal');
  await expect(panelHeading(page, 'Legal')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(panelHeading(page, 'Legal')).toBeHidden();
});

test('Close on a directly opened panel returns to the map', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page).toHaveURL('/');
  await expect(panelHeading(page, 'About')).toBeHidden();
  await expect(page).toHaveTitle('SEFKHET-ABWY Map');
});

test('Legal credits every data source with its licence', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1, name: 'Legal' })).toBeVisible();
  const legal = page.locator('body');
  for (const [publisher, licence] of [
    ['OpenStreetMap contributors', 'Open Database License'],
    ['Rijksdienst voor het Cultureel Erfgoed', 'CC BY 4.0'],
    ['Wikidata', 'CC0'],
    ['urban.brussels', 'CC BY 4.0'],
    ['Onroerend Erfgoed', 'Free Open Data Licence Flanders v1.2'],
    ['Agence wallonne du Patrimoine', 'Patrimoine – Biens classés'],
    ['Wikimedia Commons', 'Only the facts are used'],
  ]) {
    await expect(legal.getByRole('link', { name: publisher }).first()).toBeVisible();
    await expect(legal).toContainText(licence);
  }
  // Rights holders and corrections have an address to write to.
  await expect(legal).toContainText('No other descriptions, no poems and no photos are copied');
  // Not presented as official, as the Flemish licence asks; the boundary used for Rotterdam's art is credited.
  await expect(legal).toContainText('It is not affiliated with, or endorsed by');
  await expect(legal.getByRole('link', { name: 'Kadaster' })).toBeVisible();
  // The map software and the list of licences.
  await expect(legal.getByRole('link', { name: 'MapLibre GL JS' })).toBeVisible();
  await expect(legal.getByRole('link', { name: 'this list' })).toHaveAttribute('href', '/licenses/third-party.txt');
  await expect(legal.getByRole('link', { name: 'hello@sefkhet-abwy.dev' })).toBeVisible();
});
