/**
 * The filter by kind (issue #21): two buttons at the top right of the map,
 * "Monuments" and "Public art", which also serve as the legend. Each asks the
 * API for its kinds only; the count circles follow the filter too; with
 * everything off, the map is empty and nothing is asked for.
 */
import { test, expect, waitForMap, DEVICE, PLACES, ARTWORK, MURAL, POEM } from './fixtures.js';

test.use({ permissions: ['geolocation'], geolocation: DEVICE });

const filter = (page) => page.getByRole('group', { name: 'Show on the map' });
const kindButton = (page, name) => filter(page).getByRole('button', { name, exact: true });

async function mapCentre(page) {
  const box = await page.getByRole('application', { name: /^Map centred on your location/ }).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('shows every kind by default, without a filter in the requests', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork({ places: [ARTWORK, PLACES[1]] });
  await page.goto('/');
  await waitForMap(page);

  await expect(kindButton(page, 'Monuments')).toHaveAttribute('aria-pressed', 'true');
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);
  expect(placesRequests.every((r) => r.kinds === null)).toBe(true);
});

test('hiding public art asks for monuments only, and closes an open artwork card', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork({ places: [ARTWORK, PLACES[1]] });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  const { x, y } = await mapCentre(page);
  const card = page.getByRole('region', { name: `Artwork: ${ARTWORK.name}` });
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await kindButton(page, 'Public art').click();
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => placesRequests.at(-1)?.kinds).toBe('monument');
  await expect(card).toBeHidden();

  // The artwork's marker is gone: a tap on its place opens nothing.
  await page.waitForTimeout(500);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  await expect(card).toBeHidden();
});

test('everything can be turned off: no requests, an empty map and a hint; on again drops the filter', async ({ page, stubNetwork }) => {
  const { placesRequests, countsRequests } = await stubNetwork({ places: [ARTWORK] });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  await kindButton(page, 'Monuments').click();
  await expect.poll(() => placesRequests.at(-1)?.kinds).toBe('artwork');
  await kindButton(page, 'Public art').click();
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'false');
  await expect(kindButton(page, 'Monuments')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Nothing selected to show')).toBeVisible();

  // Nothing is asked for while everything is off, also after moving the map.
  const asked = placesRequests.length + countsRequests.length;
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.waitForTimeout(1_500);
  expect(placesRequests.length + countsRequests.length).toBe(asked);

  // The artwork's marker is gone: a tap on its place opens nothing.
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(1_000);
  const { x, y } = await mapCentre(page);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  await expect(page.getByRole('region', { name: `Artwork: ${ARTWORK.name}` })).toBeHidden();

  await kindButton(page, 'Monuments').click();
  await kindButton(page, 'Public art').click();
  await expect(page.getByText('Nothing selected to show')).toBeHidden();
  await expect.poll(() => placesRequests.at(-1)?.kinds).toBe(null);
});

test('the count circles follow the filter', async ({ page, stubNetwork }) => {
  const { countsRequests } = await stubNetwork({ tooMany: true });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => countsRequests.length).toBeGreaterThan(0);
  expect(countsRequests.at(-1).kinds).toBe(null);

  await kindButton(page, 'Monuments').click();
  await expect.poll(() => countsRequests.at(-1)?.kinds).toBe('artwork');
});

test('the kinds of public art open under Public art and filter on their own', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork({ places: [MURAL, POEM, PLACES[1]] });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  const more = filter(page).getByRole('button', { name: 'Kinds of public art' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const groups = page.getByRole('group', { name: 'Kinds of public art' });
  await expect(groups.getByRole('button')).toHaveText(['Sculpture', 'Memorials', 'Reliefs', 'Murals', 'Poetry', 'Other art']);

  // Hiding murals: the other five are asked for; Public art is half on.
  await groups.getByRole('button', { name: 'Murals' }).click();
  await expect(groups.getByRole('button', { name: 'Murals' })).toHaveAttribute('aria-pressed', 'false');
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'mixed');
  await expect.poll(() => placesRequests.at(-1)?.art).toBe('memorial,other,poetry,relief,sculpture');
  expect(placesRequests.at(-1).kinds).toBe(null);

  // Public art while half on: all on again, no filter.
  await kindButton(page, 'Public art').click();
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => placesRequests.at(-1)?.art).toBe(null);

  // Public art while all on: all off; only monuments are asked for.
  await kindButton(page, 'Public art').click();
  await expect(kindButton(page, 'Public art')).toHaveAttribute('aria-pressed', 'false');
  await expect(groups.getByRole('button', { name: 'Poetry' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => placesRequests.at(-1)?.kinds).toBe('monument');
});

test('an open card closes when its kind of art is hidden', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork({ places: [POEM] });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  const { x, y } = await mapCentre(page);
  const card = page.getByRole('region', { name: 'Artwork: Wall poem by Jan Prins' });
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await filter(page).getByRole('button', { name: 'Kinds of public art' }).click();
  await page.getByRole('group', { name: 'Kinds of public art' }).getByRole('button', { name: 'Murals' }).click();
  await expect(card).toBeVisible();
  await page.getByRole('group', { name: 'Kinds of public art' }).getByRole('button', { name: 'Poetry' }).click();
  await expect(card).toBeHidden();
  await expect.poll(() => placesRequests.at(-1)?.art).toBe('memorial,other,relief,sculpture');
});
