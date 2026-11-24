/**
 * The parts around the app: the server functions, the security headers and
 * the PWA install files.
 */
import { test, expect, waitForMap } from './fixtures.js';

test('pages carry a Content-Security-Policy that the app runs under without violations', async ({ page, stubNetwork }) => {
  const { placesRequests, countsRequests } = await stubNetwork();
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violations.push(`${e.effectiveDirective} ${e.blockedURI}`);
    });
  });

  const response = await page.goto('/');
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  await waitForMap(page);

  // Without a device position the map opens at city scale and shows counts
  // (drawn as data: images); two levels in it shows individual monuments.
  // On a slow machine a click during the zoom animation can be lost, so zoom
  // in one step at a time until the map asks for places.
  await expect.poll(() => countsRequests.length).toBeGreaterThan(0);
  await expect(async () => {
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(() => placesRequests.length, { timeout: 3_000 }).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const violations = await page.evaluate(() => window.__violations);
  expect(violations).toEqual([]);
});

test('the map loads from the app and the tile server only', async ({ page, baseURL, stubNetwork }) => {
  const { countsRequests } = await stubNetwork();
  const hosts = new Set();
  page.on('request', (r) => { if (/^https?:/.test(r.url())) hosts.add(new URL(r.url()).host); });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => countsRequests.length).toBeGreaterThan(0);
  await expect.poll(() => hosts.has('tile.openstreetmap.org')).toBe(true);
  expect([...hosts].sort()).toEqual([new URL(baseURL).host, 'tile.openstreetmap.org'].sort());
});

test('the licences of the software used are published', async ({ request }) => {
  const res = await request.get('/licenses/third-party.txt');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('text/plain');
  const text = await res.text();
  expect(text).toContain('maplibre-gl@');
  expect(text).toContain('Licence: BSD-3-Clause');
});

test('/api/health answers UP', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: 'UP' });
});

/**
 * On a Vercel deployment, Vercel sets the x-vercel-ip-* headers itself from
 * the caller's real IP address; a test cannot remove or replace them. The
 * tests that depend on them run against a local build only, where
 * /api/health reports the environment as "development".
 */
async function onVercel(request) {
  const { environment } = await (await request.get('/api/health')).json();
  return environment !== 'development';
}
const VERCEL_SETS_IP_HEADERS = "Vercel sets the x-vercel-ip-* headers from the caller's real IP address";

test('/api/geo answers without an IP position when location headers are missing', async ({ request }) => {
  test.skip(await onVercel(request), VERCEL_SETS_IP_HEADERS);
  const res = await request.get('/api/geo');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ available: false, source: 'ip' });
});

test('/api/monument-counts refuses a missing or oversized box without a lookup', async ({ request }) => {
  const missing = await request.get('/api/monument-counts');
  expect(missing.status()).toBe(400);

  // Zoom 3 to 19 is the map's range; 20 is beyond it.
  const badZoom = await request.get('/api/monument-counts?west=4.4&south=51.9&east=4.5&north=51.95&zoom=20');
  expect(badZoom.status()).toBe(400);

  // All of Europe at zoom 13 would be hundreds of thousands of cells.
  const tooLarge = await request.get('/api/monument-counts?west=-10&south=35&east=30&north=70&zoom=13');
  expect(tooLarge.status()).toBe(400);
  expect(await tooLarge.json()).toEqual({ error: 'the box is too large for this zoom level' });
});

test('/api/places refuses an incomplete or oversized box without a lookup', async ({ request }) => {
  const incomplete = await request.get('/api/places?west=4.4&south=51.9&lat=51.92&lon=4.48');
  expect(incomplete.status()).toBe(400);

  // A whole province at once: far beyond the visible area at street level.
  const tooLarge = await request.get('/api/places?west=4&south=51.5&east=5&north=52.5&lat=52&lon=4.5');
  expect(tooLarge.status()).toBe(400);
  expect(await tooLarge.json()).toEqual({ error: 'the box is too large; zoom in' });
});

test('/api/places and /api/monument-counts refuse an unknown kind or kind of art without a lookup', async ({ request }) => {
  const box = 'west=4.47&south=51.90&east=4.49&north=51.91';
  const expected = { error: 'kinds must be one or more of monument, artwork' };
  const places = await request.get(`/api/places?${box}&lat=51.905&lon=4.48&kinds=castle`);
  expect(places.status()).toBe(400);
  expect(await places.json()).toEqual(expected);
  const counts = await request.get(`/api/monument-counts?${box}&zoom=13&kinds=`);
  expect(counts.status()).toBe(400);
  expect(await counts.json()).toEqual(expected);
  const art = await request.get(`/api/places?${box}&lat=51.905&lon=4.48&art=graffiti`);
  expect(art.status()).toBe(400);
  expect(await art.json()).toEqual({ error: 'art must be one or more of sculpture, memorial, relief, mural, poetry, other' });
});

const VERCEL_AMSTERDAM = {
  'x-vercel-ip-latitude': '52.37403',
  'x-vercel-ip-longitude': '4.88969',
  'x-vercel-ip-city': 'Amsterdam',
  'x-vercel-ip-country-region': 'NH',
  'x-vercel-ip-country': 'NL',
};

test('/api/geo uses the Vercel headers when reached directly', async ({ request }) => {
  test.skip(await onVercel(request), VERCEL_SETS_IP_HEADERS);
  const res = await request.get('/api/geo', { headers: VERCEL_AMSTERDAM });
  expect(await res.json()).toEqual({
    available: true, source: 'ip', latitude: 52.37403, longitude: 4.88969,
    city: 'Amsterdam', region: 'NH', country: 'NL',
  });
});

test('/api/geo prefers the Cloudflare headers behind the proxy', async ({ request }) => {
  // Behind Cloudflare, Vercel locates Cloudflare's Amsterdam data centre;
  // only the cf-ip* headers carry the visitor's own position.
  const res = await request.get('/api/geo', {
    headers: {
      ...VERCEL_AMSTERDAM,
      'cf-iplatitude': '51.92250',
      'cf-iplongitude': '4.47917',
      'cf-ipcity': 'Rotterdam',
      'cf-region-code': 'ZH',
      'cf-ipcountry': 'NL',
    },
  });
  expect(await res.json()).toEqual({
    available: true, source: 'ip', latitude: 51.9225, longitude: 4.47917,
    city: 'Rotterdam', region: 'ZH', country: 'NL',
  });
});

test.describe('installable app', () => {
  test.use({ serviceWorkers: 'allow' });

  test('serves the manifest and registers the service worker', async ({ page, request, stubNetwork }) => {
    await stubNetwork();
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'SEFKHET-ABWY Map', short_name: 'SEFKHET', start_url: '/' });

    await page.goto('/');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe(new URL('/', page.url()).href);
  });

  test('once installed, the app and its map open without a connection', async ({ page, context, stubNetwork }) => {
    await stubNetwork();
    await page.goto('/');
    await waitForMap(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await waitForMap(page);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await context.setOffline(false);
  });
});
