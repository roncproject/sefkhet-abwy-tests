/**
 * Shared test setup: stubs for everything the app fetches from the network,
 * so the tests are fast, repeatable and never load OpenStreetMap's servers.
 *
 * The ArcGIS SDK's own assets (js.arcgis.com) are not stubbed; they are
 * versioned static files and the map cannot start without them.
 *
 * Protected deployments: when VERCEL_BYPASS is set, the Vercel protection
 * bypass header is added to requests for the app's own address only, so
 * the value never reaches third parties such as Esri.
 */
import { test as base, expect } from '@playwright/test';

const BYPASS = process.env.VERCEL_BYPASS
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS }
  : null;

/** Hotel New York, Rotterdam: the test device position. */
export const DEVICE = { latitude: 51.9054, longitude: 4.4874, accuracy: 20 };

/** What /api/geo answers when the IP lookup works. */
export const IP_GEO = {
  available: true, source: 'ip', latitude: 52.3676, longitude: 4.9041,
  city: 'Amsterdam', region: 'NH', country: 'NL',
};

/**
 * What /api/places answers: two real monuments. The first is Hotel New York
 * itself, moved onto the device position so it sits exactly at the map centre.
 */
export const PLACES = [
  {
    kind: 'monument',
    id: '23281.00', number: 513872, name: 'v.m. Kant. Holland Amerika Lijn', type: 'Kantoorgebouw',
    address: 'Koninginnenhoofd 1', place: 'Rotterdam',
    url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/513872',
    latitude: DEVICE.latitude, longitude: DEVICE.longitude,
  },
  {
    kind: 'monument',
    id: '19826.00', number: 32847, name: null, type: 'Vergadering en vereniging',
    address: 'Veerkade 10', place: 'Rotterdam',
    url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/32847',
    latitude: 51.9079, longitude: 4.4806,
  },
];

/**
 * A public artwork as /api/places returns it (facts from Wikidata, CC0),
 * moved onto the device position so it sits at the map centre.
 */
export const ARTWORK = {
  kind: 'artwork',
  id: 'Q102080942', name: 'Obelisk', artists: 'Herman Makkink', year: 1991, type: 'kunstwerk',
  url: 'https://www.wikidata.org/wiki/Q102080942',
  latitude: DEVICE.latitude, longitude: DEVICE.longitude,
};

/**
 * Protected heritage in Brussels (urban.brussels, CC-BY 4.0) and Antwerp
 * (Onroerend Erfgoed, Free Open Data Licence Flanders) as /api/places returns
 * it, moved onto the device position. Real objects; the facts are unchanged.
 * Brussels is bilingual: `names` holds each language version in display
 * order, French first.
 */
export const BRUSSELS = {
  kind: 'monument', source: 'brussels',
  id: '171', number: null,
  name: 'Ancien atelier et habitation de Clas Grüner Sterner / Voormalig atelier en woning van Clas Grüner Sterner',
  names: [
    { lang: 'fr', name: 'Ancien atelier et habitation de Clas Grüner Sterner', address: 'Rue du Lac 6', place: '1050 Ixelles' },
    { lang: 'nl', name: 'Voormalig atelier en woning van Clas Grüner Sterner', address: 'Meerstraat 6', place: '1050 Elsene' },
  ],
  type: 'Monument', address: 'Rue du Lac 6 / Meerstraat 6', place: '1050 Ixelles / 1050 Elsene',
  status: 'protected', since: '2003-10-23', reference: '2071-0119', country: 'BE',
  url: 'https://doc.patrimoine.brussels/REGISTRE/AG/035_022.pdf',
  wikipedia: {
    fr: 'Atelier du maître-verrier Sterner',
    nl: 'Atelier van meester-glazenier Sterner',
    en: "Sterner's Studio",
  },
  latitude: DEVICE.latitude, longitude: DEVICE.longitude,
};

/**
 * A rijksmonument with a Dutch Wikipedia article (found through Wikidata),
 * moved onto the device position.
 */
export const WITTE_HUIS = {
  kind: 'monument', source: 'rce',
  id: '56779.00', number: 334003, name: 'Witte Huis', type: 'Handel en kantoor',
  address: 'Geldersekade 1', place: 'Rotterdam',
  url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/334003',
  wikipedia: { nl: 'Witte Huis (Rotterdam)', en: 'Witte Huis' },
  latitude: DEVICE.latitude, longitude: DEVICE.longitude,
};

export const ANTWERP = {
  kind: 'monument', source: 'flanders',
  id: '5765', number: null, name: 'Huis Guiette', names: null,
  type: 'Monument', address: 'Populierenlaan 32', place: 'Antwerpen',
  status: 'protected', since: '1978-04-24', reference: '5765', country: 'BE',
  url: 'https://inventaris.onroerenderfgoed.be/aanduidingsobjecten/5765',
  latitude: DEVICE.latitude, longitude: DEVICE.longitude,
};

/**
 * What /api/monument-counts answers: one cell at the device position, so it
 * sits at the map centre, and one a little to the north-east.
 */
export const CELLS = [
  { latitude: DEVICE.latitude, longitude: DEVICE.longitude, count: 1234 },
  { latitude: 51.95, longitude: 4.55, count: 7 },
];

// Any valid PNG will do as a map tile: a single white pixel.
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

export const test = base.extend({
  /** Browser requests to the app itself carry the bypass header, if any. */
  context: async ({ context, baseURL }, use) => {
    if (BYPASS) {
      const origin = new URL(baseURL).origin;
      await context.route((url) => url.origin === origin, (route) =>
        route.fallback({ headers: { ...route.request().headers(), ...BYPASS } }));
    }
    await use(context);
  },

  /** API requests (the `request` fixture) carry the bypass header, if any. */
  request: async ({ playwright, baseURL }, use) => {
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: BYPASS ?? {} });
    await use(api);
    await api.dispose();
  },

  /**
   * Installs the network stubs on the browser context, so requests made by the
   * service worker are stubbed too. Call before page.goto():
   *
   *   const net = await stubNetwork({ geo: IP_GEO });
   *
   * `geo` is the /api/geo answer (default: no IP location).
   * `places` is the /api/places answer (default: PLACES).
   * `tooMany: true` makes /api/places answer that the visible area holds more
   * places than it shows, as in a dense city centre.
   * `cells` is the /api/monument-counts answer (default: CELLS).
   * Returns `placesRequests`, the parsed centre (lat/lon) and visible box of
   * every /api/places call, and `countsRequests`, the parsed box and zoom of
   * every count request.
   */
  stubNetwork: async ({ context }, use) => {
    await use(async ({ geo = { available: false, source: 'ip' }, places = PLACES, cells = CELLS, tooMany = false } = {}) => {
      const placesRequests = [];
      const countsRequests = [];

      await context.route('https://tile.openstreetmap.org/**', (route) =>
        route.fulfill({ contentType: 'image/png', body: TILE }));

      await context.route('**/api/geo', (route) => route.fulfill({ json: geo }));

      await context.route('**/api/places?*', (route) => {
        const url = new URL(route.request().url());
        const read = (k) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : null);
        placesRequests.push({
          lat: read('lat'), lon: read('lon'),
          west: read('west'), south: read('south'), east: read('east'), north: read('north'),
        });
        return route.fulfill({ json: tooMany ? { places: [], tooMany: true } : { places } });
      });

      await context.route('**/api/monument-counts?*', (route) => {
        const url = new URL(route.request().url());
        const read = (k) => Number(url.searchParams.get(k));
        countsRequests.push({
          west: read('west'), south: read('south'), east: read('east'), north: read('north'), zoom: read('zoom'),
        });
        return route.fulfill({ json: { cells } });
      });

      return { placesRequests, countsRequests };
    });
  },
});

/** The map has finished loading when its controls appear. */
export async function waitForMap(page) {
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible({ timeout: 60_000 });
}

export { expect };
