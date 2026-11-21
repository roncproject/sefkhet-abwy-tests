/**
 * Hover labels: with a mouse, resting on a marker shows a small label with
 * its name; touch screens have no hover, so a tap goes straight to the card.
 *
 * The label is an HTML element over the map (the markers themselves are in a
 * WebGL canvas), marked aria-hidden as a visual aid, so it is found by class.
 */
import { test, expect, waitForMap, DEVICE, PLACES, BRUSSELS, ARTWORK } from './fixtures.js';

test.use({ permissions: ['geolocation'], geolocation: DEVICE });

async function mapCentre(page) {
  const box = await page.getByRole('application', { name: /^Map centred on your location/ }).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function openMap(page, stubNetwork, places) {
  const { placesRequests } = await stubNetwork({ places });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);
  return mapCentre(page);
}

test('resting the mouse on a monument shows its name; moving off hides it', async ({ page, stubNetwork }) => {
  const { x, y } = await openMap(page, stubNetwork, PLACES);
  const label = page.locator('.map-label');

  await expect(async () => {
    await page.mouse.move(x + 60, y + 60);
    await page.mouse.move(x, y);
    await expect(label).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await expect(label).toContainText(PLACES[0].name);
  await expect(label).toContainText(`Rijksmonument · ${PLACES[0].type}`);
  await expect(label).toHaveAttribute('aria-hidden', 'true');

  await page.mouse.move(x + 120, y + 120);
  await expect(label).toBeHidden();

  // Clicking opens the card, and no label shows while it is open.
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await expect(page.getByRole('region', { name: /^Monument:/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(label).toBeHidden();
});

test('a Brussels label shows the French and Dutch name, equal; an artwork its artist and year', async ({ page, stubNetwork }) => {
  const { x, y } = await openMap(page, stubNetwork, [BRUSSELS]);
  const label = page.locator('.map-label');
  await expect(async () => {
    await page.mouse.move(x + 60, y + 60);
    await page.mouse.move(x, y);
    await expect(label).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  const names = label.locator('.map-label-name');
  await expect(names).toHaveText([BRUSSELS.names[0].name, BRUSSELS.names[1].name]);
  await expect(label.locator('.map-label-kind')).toHaveText('Monument · Brussels');
  const [fr, nl] = await names.evaluateAll((els) => els.map((e) => {
    const s = getComputedStyle(e);
    return `${s.fontSize} ${s.fontWeight}`;
  }));
  expect(fr).toBe(nl);
});

test('an artwork label shows its artist and year', async ({ page, stubNetwork }) => {
  const { x, y } = await openMap(page, stubNetwork, [ARTWORK]);
  const label = page.locator('.map-label');
  await expect(async () => {
    await page.mouse.move(x + 60, y + 60);
    await page.mouse.move(x, y);
    await expect(label).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await expect(label).toContainText(ARTWORK.name);
  await expect(label).toContainText(`Artwork · ${ARTWORK.artists}, ${ARTWORK.year}`);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });

  test('a tap opens the card and no hover label appears', async ({ page, stubNetwork }) => {
    const { x, y } = await openMap(page, stubNetwork, PLACES);
    const card = page.getByRole('region', { name: /^Monument:/ });
    await expect(async () => {
      await page.touchscreen.tap(x, y);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(page.locator('.map-label')).toHaveCount(0);
  });
});
