# SEFKHET-ABWY tests

End-to-end tests for [SEFKHET-ABWY](https://www.sefkhet-abwy.dev), a map of the
Dutch national monuments (rijksmonumenten) around you.

The tests drive a running copy of the app in Chromium and over HTTP, with
[Playwright](https://playwright.dev). They are black-box tests: they need only
the address where the app runs, not its source. Every call the map makes to
the monument database, the IP lookup and the map tiles is answered by a stub,
so the tests are fast, repeatable and never read real data.

They run against a local build or the acceptance environment. The live site
is refused.

## What is tested

| File | Tests |
|---|---|
| `tests/location.spec.js` | Opens on the device position · uses the IP position when location is refused · falls back to Rotterdam when there is none |
| `tests/map.spec.js` | Asks for monuments at the map centre, latitude and longitude in order · reloads once when a script chunk is gone after a deploy · a click opens the monument card with a link to the register · below street level, asks for counts instead of monuments · tapping a count zooms in · says to zoom in when no counts are in view · zoom buttons move the map · "Centre on my location" returns after panning |
| `tests/panels.spec.js` | `/about`, `/legal` and `/contact` open directly · the menu opens a panel and Back closes it · Close on a directly opened panel returns to the map |
| `tests/platform.spec.js` | `/api/health` answers · `/api/geo` without location headers, with Vercel's, and preferring Cloudflare's · `/api/monument-counts` refuses missing and oversized boxes · the PWA manifest and service worker |

22 tests in all.

## Running them

Node.js 24 (see `.nvmrc`).

```bash
npm ci
npx playwright install chromium
```

**Against a local build of the app**, which serves on port 4173 by default:

```bash
BASE_URL=http://localhost:4173 npm test
```

In PowerShell: `$env:BASE_URL = "http://localhost:4173"; npm test`

`BASE_URL` defaults to `http://localhost:4173`.

**Against a protected deployment**, also set `VERCEL_BYPASS` to the
deployment's protection bypass value. It is sent only to the app's own address.

## Continuous integration

- The app's own repository runs these tests against a fresh build on every
  pull request.
- This repository runs them against the acceptance environment every Monday and
  on demand (Actions → Acceptance tests → Run workflow). Its address and bypass
  value are repository secrets. No reports or traces are uploaded.
