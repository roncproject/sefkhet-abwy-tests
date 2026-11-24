# SEFKHET-ABWY tests

End-to-end tests for [SEFKHET-ABWY](https://www.sefkhet-abwy.dev), a web app in
a private repo on this account. This is a map of the protected heritage around
you: the Dutch national monuments (rijksmonumenten) and other public art, also a
selection of objects in Antwerp, Brussels, Wallonia, Luxembourg and Flanders.

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
| `tests/coverage.spec.js` | A map in the US says what is covered and the button goes there · the notice can be closed and stays closed in the session · no notice in the covered area or just across the border · on a phone the notice fits and leaves the filter free |
| `tests/map.spec.js` | Asks for monuments at the map centre, latitude and longitude in order · asks for the places in the visible area, not a fixed circle · where the visible area holds too many places, shows counts at street level · reloads once when a script chunk is gone after a deploy · a click opens the monument card with a link to the register · a click on a public artwork opens its card with artist, year and a Wikidata link · a click on a Brussels monument shows French and Dutch side by side and equal, with the decree · a click on a Flemish monument links to the Flemish inventory · a Walloon monument shows its municipality and official record, Wikipedia in French · a Luxembourg monument shows Luxembourgish and French side by side, its protection and Wikidata · the map credits OpenStreetMap, linked to its copyright page · a monument with a Wikipedia article links to it · a wall poem from Wikimedia Commons is named after its poet, marked approximate and linked to the photo · below street level, asks for counts instead of monuments · tapping a count zooms in · says to zoom in when no counts are in view · the mouse wheel zooms one whole level per step · quick wheel steps ask only for the final zoom level · zoom buttons move the map · "Centre on my location" returns after panning |
| `tests/hover.spec.js` | With a mouse, resting on a monument shows its name and moving off hides it · with a card open, other markers still get a label · a Brussels label shows the French and Dutch name, equal · an artwork label shows its artist and year · a mural's label names its kind of art · a Flemish label names the municipality · on a touch screen a tap opens the card and no label appears |
| `tests/filter.spec.js` | Every kind shown by default · hiding public art asks for monuments only and closes an artwork card · everything can be turned off, leaving an empty map and no requests · the count circles follow the filter · the kinds of public art open under Public art and filter on their own · an open card closes when its kind of art is hidden |
| `tests/panels.spec.js` | `/about`, `/legal` and `/contact` open directly · the menu opens a panel and Back closes it · Close on a directly opened panel returns to the map · Legal credits every data source with its licence |
| `tests/platform.spec.js` | Pages carry a Content-Security-Policy and the app runs under it without violations · the map loads from the app and the tile server only · the licences of the software used are published · once installed, the app and its map open without a connection · `/api/health` answers · `/api/geo` without location headers, with Vercel's, and preferring Cloudflare's · `/api/monument-counts` refuses missing and oversized boxes · `/api/places` refuses an incomplete or oversized box · both refuse an unknown kind or kind of art · the PWA manifest and service worker |

59 tests in all. The [test plan](docs/test-plan.md) describes the levels,
environments, test data, entry and exit criteria, and known gaps.

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

**Code checks:** `npm run lint` runs ESLint with Playwright's and SonarQube's rules
(`eslint.config.js`). CI reports the findings on every pull request.

**Against a protected deployment**, also set `VERCEL_BYPASS` to the
deployment's protection bypass value. It is sent only to the app's own address.

## Continuous integration

- The app's own repository runs these tests against a fresh build on every
  pull request.
- This repository runs them against the acceptance environment every Monday and
  on demand (Actions → Acceptance tests → Run workflow). Its address and bypass
  value are repository secrets. No reports or traces are uploaded.
