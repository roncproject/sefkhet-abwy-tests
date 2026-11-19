/**
 * The parts around the app: the server functions and the PWA install files.
 */
import { test, expect } from './fixtures.js';

test('/api/health answers UP', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: 'UP' });
});

test('/api/geo answers without an IP position when location headers are missing', async ({ request }) => {
  const res = await request.get('/api/geo');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ available: false, source: 'ip' });
});

test('/api/monument-counts refuses a missing or oversized box without a lookup', async ({ request }) => {
  const missing = await request.get('/api/monument-counts');
  expect(missing.status()).toBe(400);

  const badZoom = await request.get('/api/monument-counts?west=4&south=51&east=5&north=52&zoom=15');
  expect(badZoom.status()).toBe(400);

  // All of Europe at zoom 13 would be hundreds of thousands of cells.
  const tooLarge = await request.get('/api/monument-counts?west=-10&south=35&east=30&north=70&zoom=13');
  expect(tooLarge.status()).toBe(400);
  expect(await tooLarge.json()).toEqual({ error: 'the box is too large for this zoom level' });
});

const VERCEL_AMSTERDAM = {
  'x-vercel-ip-latitude': '52.37403',
  'x-vercel-ip-longitude': '4.88969',
  'x-vercel-ip-city': 'Amsterdam',
  'x-vercel-ip-country-region': 'NH',
  'x-vercel-ip-country': 'NL',
};

test('/api/geo uses the Vercel headers when reached directly', async ({ request }) => {
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
});
