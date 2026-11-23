/**
 * A map outside the Netherlands, Belgium and Luxembourg says what the app
 * covers and offers the way there, instead of staying empty. It goes by the
 * map area, not the visitor's country.
 */
import { test, expect, waitForMap } from './fixtures.js';

const at = (city, country, latitude, longitude) => ({
  available: true, source: 'ip', latitude, longitude, city, region: null, country,
});
const CHICAGO = at('Chicago', 'US', 41.8781, -87.6298);
const MUNICH = at('Munich', 'DE', 48.1351, 11.582);
const MAASTRICHT = at('Maastricht', 'DE', 50.8514, 5.691);
const VAALS_BORDER = at('Aachen', 'DE', 50.7753, 6.0839);

const notice = (page) => page.getByRole('region', { name: 'Coverage' });

test.use({ permissions: [] });

test('a map in the US says what is covered, and the button goes there', async ({ page, stubNetwork }) => {
  const net = await stubNetwork({ geo: CHICAGO });
  await page.goto('/');
  await waitForMap(page);

  await expect(notice(page)).toContainText('covers the Netherlands, Belgium and Luxembourg for now');
  await notice(page).getByRole('button', { name: 'Show the map of the Benelux' }).click();

  await expect(notice(page)).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => {
    const last = net.countsRequests.at(-1);
    return last && last.west < 5.2 && last.east > 5.2 && last.south < 51.3 && last.north > 51.3;
  }, { timeout: 15_000 }).toBe(true);
});

test('the notice can be closed and stays closed in this session', async ({ page, stubNetwork }) => {
  await stubNetwork({ geo: MUNICH });
  await page.goto('/');
  await waitForMap(page);

  await notice(page).getByRole('button', { name: 'Close' }).click();
  await expect(notice(page)).toBeHidden();

  const net = page.waitForRequest('**/api/monument-counts?*');
  await page.reload();
  await waitForMap(page);
  await net;
  await expect(notice(page)).toBeHidden();
});

for (const [name, geo] of [['in the covered area, for a visitor from elsewhere', MAASTRICHT], ['just across the border', VAALS_BORDER]]) {
  test(`no notice ${name}`, async ({ page, stubNetwork }) => {
    const net = await stubNetwork({ geo, cells: [] });
    await page.goto('/');
    await waitForMap(page);

    await expect.poll(() => net.countsRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(notice(page)).toBeHidden();
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the notice fits and leaves the filter free', async ({ page, stubNetwork }) => {
    await stubNetwork({ geo: CHICAGO });
    await page.goto('/');
    await waitForMap(page);

    const box = await notice(page).boundingBox();
    const filter = await page.locator('.kind-filter').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y).toBeGreaterThanOrEqual(filter.y + filter.height);
  });
});
