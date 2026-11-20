/**
 * The map itself: the nearby-monuments lookup, the monument card and the map
 * controls.
 *
 * Map symbols are drawn in a WebGL canvas and cannot be inspected in the DOM,
 * so these tests observe the /api/places requests the map makes each time it
 * settles. The request carries the map centre, which makes it the place to
 * catch swapped latitude and longitude. The first stubbed monument sits at the
 * device position, which is the centre of the map, so a click there hits it.
 */
import { test, expect, waitForMap, DEVICE, PLACES, ARTWORK } from './fixtures.js';

async function mapCentre(page) {
  const box = await page.getByRole('application', { name: 'Map centred on your location' }).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.use({ permissions: ['geolocation'], geolocation: DEVICE });

test('asks for nearby monuments at the map centre, latitude and longitude in order', async ({ page, stubNetwork }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);

  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);
  const { lat, lon } = placesRequests[0];
  expect(lat).toBeCloseTo(DEVICE.latitude, 4);
  expect(lon).toBeCloseTo(DEVICE.longitude, 4);

  expect(errors.filter((e) => e.includes('nearby monuments'))).toEqual([]);
});

test('recovers by reloading once when an SDK chunk is gone after a deploy', async ({ page, stubNetwork }) => {
  await stubNetwork();
  // A copy of the app kept from before a deploy asks for a chunk that is gone.
  // The chunk stays gone for as long as that page is open; the page loaded by
  // the reload gets it.
  let pageLoads = 0;
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) pageLoads += 1;
  });
  let failed = 0;
  await page.route(/\/assets\/MapView-[^/]+\.js$/, (route) => {
    if (pageLoads > 1) return route.fallback();
    failed += 1;
    return route.fulfill({ status: 404, body: 'Not found' });
  });

  await page.goto('/');
  await waitForMap(page);
  expect(failed).toBeGreaterThan(0);
  expect(pageLoads).toBe(2);
});

test('clicking a monument opens its card with a link to the register', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  const [monument] = PLACES;
  const { x, y } = await mapCentre(page);
  // The symbols draw a moment after the response arrives; retry the click until one is hit.
  const card = page.getByRole('region', { name: `Monument: ${monument.name}` });
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await expect(card).toContainText(`${monument.type} · ${monument.address}`);
  await expect(card).toContainText(monument.place);
  const link = card.getByRole('link', { name: `Rijksmonument ${monument.number}` });
  await expect(link).toHaveAttribute('href', monument.url);
  await expect(link).toHaveAttribute('target', '_blank');

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});

test('clicking a public artwork opens its card with artist, year and a Wikidata link', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork({ places: [ARTWORK] });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  const { x, y } = await mapCentre(page);
  const card = page.getByRole('region', { name: `Artwork: ${ARTWORK.name}` });
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await expect(card).toContainText(`${ARTWORK.artists} · ${ARTWORK.year}`);
  await expect(card).toContainText(ARTWORK.type);
  const link = card.getByRole('link', { name: `Wikidata ${ARTWORK.id}` });
  await expect(link).toHaveAttribute('href', ARTWORK.url);
  await expect(link).toHaveAttribute('target', '_blank');
});

/** The device fix (accuracy 20 m) opens at zoom 17; four steps out is zoom 13, below street level. */
async function zoomOutBelowStreetLevel(page) {
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(400);
  }
}

test('below street level, asks for counts in the visible area instead of monuments', async ({ page, stubNetwork }) => {
  const { placesRequests, countsRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);
  expect(countsRequests).toEqual([]);

  await zoomOutBelowStreetLevel(page);
  await expect.poll(() => countsRequests.at(-1)?.zoom).toBe(13);
  const { west, south, east, north } = countsRequests.at(-1);
  expect(west).toBeLessThan(DEVICE.longitude);
  expect(east).toBeGreaterThan(DEVICE.longitude);
  expect(south).toBeLessThan(DEVICE.latitude);
  expect(north).toBeGreaterThan(DEVICE.latitude);

  const settled = placesRequests.length;
  await page.waitForTimeout(1_500);
  expect(placesRequests.length).toBe(settled);
  // The counts show where monuments are, so the hint stays away.
  await expect(page.getByText('Zoom in to see monuments')).toBeHidden();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(settled);
});

test('tapping a count zooms in on it', async ({ page, stubNetwork }) => {
  const { placesRequests, countsRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await zoomOutBelowStreetLevel(page);
  await expect.poll(() => countsRequests.at(-1)?.zoom).toBe(13);

  // The first count sits at the map centre. Two levels in is zoom 15, street
  // level, so the map asks for the individual monuments again.
  const before = placesRequests.length;
  const { x, y } = await mapCentre(page);
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect.poll(() => placesRequests.length, { timeout: 1_500 }).toBeGreaterThan(before);
  }).toPass({ timeout: 15_000 });
  expect(placesRequests.at(-1).lat).toBeCloseTo(DEVICE.latitude, 3);
});

test('says to zoom in when no counts are in view', async ({ page, stubNetwork }) => {
  const { countsRequests } = await stubNetwork({ cells: [] });
  await page.goto('/');
  await waitForMap(page);
  const hint = page.getByText('Zoom in to see monuments');
  await expect(hint).toBeHidden();

  await zoomOutBelowStreetLevel(page);
  await expect.poll(() => countsRequests.length).toBeGreaterThan(0);
  await expect(hint).toBeVisible();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(hint).toBeHidden();
});

test('zoom in and zoom out move the map', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  // Every time the view settles after a change, the map asks for monuments again.
  let before = placesRequests.length;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);

  before = placesRequests.length;
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
});

test('"Centre on my location" returns to the device position after panning', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  // Drag the map away.
  const { x, y } = await mapCentre(page);
  let before = placesRequests.length;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 300, y - 200, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
  expect(placesRequests.at(-1).lon).not.toBeCloseTo(DEVICE.longitude, 3);

  before = placesRequests.length;
  await page.getByRole('button', { name: 'Centre on my location' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
  await expect.poll(() => placesRequests.at(-1).lon).toBeCloseTo(DEVICE.longitude, 4);
  expect(placesRequests.at(-1).lat).toBeCloseTo(DEVICE.latitude, 4);
});
