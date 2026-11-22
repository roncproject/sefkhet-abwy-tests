# Test plan — SEFKHET-ABWY

| | |
|---|---|
| **Applies to** | The SEFKHET-ABWY map app, as deployed at [www.sefkhet-abwy.dev](https://www.sefkhet-abwy.dev) from November 2026 |
| **Related** | [README](../README.md) · [`playwright.config.js`](../playwright.config.js) · [`tests/`](../tests) |

This document describes how the app is tested: what is covered, where the
tests run, which data they use, and what is not covered yet. The app's source
is private; these tests are public because they need only the address of a
running copy.

## 1. Scope

**In scope**

- The map: device and IP position, monuments and public artworks near the map
  centre, counts when zoomed out, the cards for Dutch, Brussels, Flemish, Walloon and Luxembourg
  monuments and for artworks, map controls.
- The panels: About, Legal and Contact, by menu and by direct address.
- The server functions: `/api/health`, `/api/geo`, `/api/places` (through the
  map) and `/api/monument-counts`.
- The platform around the app: Content-Security-Policy, recovery after a
  deploy, the installable app (manifest and service worker).
- Dependencies: known vulnerabilities in the packages the app uses.

**Out of scope for now** (see §8)

- The contents of the monument database, and the import that fills it.
- Browsers other than Chromium, and real mobile devices.
- Visual appearance, accessibility audits and load.

## 2. Test levels

| Level | Tool | Where | Runs | Notes |
|---|---|---|---|---|
| Browser end-to-end | Playwright, Chromium | `tests/*.spec.js` | Local, app CI, acceptance | Drives the running app; network calls are stubbed (§4) |
| API | Playwright request context | `tests/platform.spec.js` | Local, app CI, acceptance | Plain HTTP calls to `/api/*` |
| Security headers | Playwright | `tests/platform.spec.js` | Local, app CI, acceptance | The page must carry a CSP, and the app must run under it without violations |
| Dependency audit | `npm audit` | App repository, `audit.yml` | Every push and pull request, and every Monday | Runtime packages fail at any severity; build tools at high and critical |
| Unit | — | — | — | None yet (§8) |

The expectation is that **all** suites are green before a change is merged.

## 3. Environments

| Environment | Address | Data | Used for |
|---|---|---|---|
| **Local** | `http://localhost:4173` (`npm run build` and `npm run preview` in the app) | Stubs; the app's own server functions run locally | Development |
| **App CI** | `localhost` on a GitHub runner | Stubs | Every pull request in the app repository |
| **Acceptance** | A protected Vercel preview of the app's `acceptance` branch | Stubs, plus its own copy of the monument register for manual checks | Before a change goes live; this repository runs the suite every Monday and on demand |
| **Production** | `www.sefkhet-abwy.dev` | Live | **Never tested.** `playwright.config.js` refuses the live address |

The local preview sends the same security headers as production, read from the
app's Vercel configuration, so the CSP is tested everywhere.

The acceptance address and its protection bypass value are repository secrets.
The bypass value is only sent to the app's own address, never to third
parties. With it set, no traces are recorded, and the workflow uploads no
reports, because artifacts of a public repository can be downloaded by anyone.

## 4. Test data

Every test stubs the network calls it depends on (`tests/fixtures.js`), so
results do not depend on the database, the visitor's IP address or outside
servers:

| Stub | Answers | Content |
|---|---|---|
| Device position | The browser's geolocation | Hotel New York, Rotterdam (51.9054 N, 4.4874 E), accuracy 20 m |
| `/api/geo` | IP position | None by default; Amsterdam in the IP-fallback test |
| `/api/places` | Monuments and artworks near the centre, only the kinds in `kinds=` and groups in `art=` when given; also a mural (Melly Shum) and a wall poem found through Wikimedia Commons | Two real Rotterdam monuments, the first moved onto the device position; one real Rotterdam artwork (Wikidata), one real Brussels monument (urban.brussels) and one real Antwerp monument (Onroerend Erfgoed), and the Witte Huis in Rotterdam with its Wikipedia article, each likewise at the device position, for the card tests |
| `/api/monument-counts` | Counts per grid cell | Two cells; the first at the device position |
| OpenStreetMap tiles | Map tiles | A one-pixel PNG |

The ArcGIS SDK's own files are not stubbed; the map cannot start without them.

## 5. Test inventory

48 tests.

| File | Test | Proves |
|---|---|---|
| `location.spec.js` | Opens on the device position | A granted position centres the map |
| | Uses the IP position when location is refused | The fallback order: device, then IP |
| | Falls back to Rotterdam when there is no position | The app still opens with no position at all |
| `map.spec.js` | Asks for monuments at the map centre, latitude and longitude in order | The places request carries the right coordinates, not swapped |
| | Recovers by reloading once when a chunk is gone after a deploy | An old copy of the app recovers instead of showing an error |
| | Asks for the places in the visible area, not a fixed circle | The request carries the visible box around the centre |
| | Where the visible area holds too many places, shows counts at street level | A dense area shows counts instead of a cut-off set |
| | Clicking a monument opens its card with a link to the register | Hit testing, the card's content and its link; Escape closes it |
| | Clicking a public artwork opens its card with artist, year and a Wikidata link | The artwork card and its source link |
| | Clicking a Brussels monument shows French and Dutch side by side and equal, with the decree | Bilingual Brussels: both names and addresses in full, the same style, French on the left; protection and decree link |
| | A monument with a Wikipedia article links to it, in Dutch | The Wikipedia link (found through Wikidata) and its address; none where no article is known; Brussels shows French and Dutch side by side |
| | Clicking a Flemish monument opens its card with a link to the Flemish inventory | The Flemish card and its source link |
| | A Walloon monument shows its description, municipality and official record, Wikipedia in French | The Walloon card: no address, the municipality, the record link, French article first |
| | A Luxembourg monument shows Luxembourgish and French side by side, its protection and Wikidata | The Luxembourg card: both languages, Luxembourgish first, the official protection term, Wikidata link and credit |
| | Below street level, asks for counts instead of monuments | The zoomed-out mode requests counts for the visible area |
| | Tapping a count zooms in on it | Counts lead to the individual monuments |
| | Says to zoom in when no counts are in view | The hint appears only when nothing is shown |
| | Zoom in and zoom out move the map | The controls work and each change reloads monuments |
| | "Centre on my location" returns after panning | The re-centre control |
| | A wall poem from Wikimedia Commons: named after its poet, approximate, linked to the photo | The card of a work without a title, an approximate position and the Commons credit |
| `hover.spec.js` | Resting the mouse on a monument shows its name; moving off hides it | The label appears after a short rest and hides on leaving |
| | With a card open, other markers still get a label, the open one does not | Exploring continues while a card is open |
| | A Brussels label shows the French and Dutch name, equal | Bilingual labels: both names, the same size and weight |
| | An artwork label shows its artist and year | The label's second line per kind |
| | A mural's label names its kind of art | The group of public art on the label |
| | A Flemish label names the municipality | The place from the source, not a fixed city |
| | On a touch screen, a tap opens the card and no label appears | Hover is for mice only |
| `filter.spec.js` | Shows every kind by default, without a filter in the requests | Both kinds on at first |
| | Hiding public art asks for monuments only, and closes an open artwork card | The filter reaches the API; no card of a hidden kind stays open |
| | Everything can be turned off: no requests, an empty map and a hint | Deselecting all is allowed and costs no lookups |
| | The count circles follow the filter | Counts and markers show the same kinds |
| | The kinds of public art open under Public art and filter on their own | The six groups, `art=`, and Public art half on, all on and all off |
| | An open card closes when its kind of art is hidden | No card of a hidden group stays open |
| `panels.spec.js` | `/about`, `/legal` and `/contact` open directly (3 tests) | Every panel has a working address |
| | The menu opens a panel and Back closes it | Menu navigation and browser history |
| | Close on a directly opened panel returns to the map | Closing works without history |
| | Legal credits every data source with its licence | Each source's publisher and licence, the no-copying statement and the contact address are in Legal |
| `platform.spec.js` | Pages carry a CSP that the app runs under without violations | The policy is present and does not block the app |
| | `/api/health` answers UP | The server functions run |
| | `/api/geo` without location headers | No position is invented. *Skipped on Vercel* (§6) |
| | `/api/monument-counts` refuses a missing or oversized box | Input checks run before any database lookup |
| | `/api/places` refuses an incomplete or oversized box | Input checks run before any database lookup |
| | `/api/places` and `/api/monument-counts` refuse an unknown kind or kind of art | The filter is checked before any lookup |
| | `/api/geo` uses the Vercel headers when reached directly | Header parsing. *Skipped on Vercel* (§6) |
| | `/api/geo` prefers the Cloudflare headers behind the proxy | Behind Cloudflare, the visitor's own position wins |
| | Serves the manifest and registers the service worker | The app is installable |

## 6. Entry, exit and known deviations

- **Before merging** to the app's `main`: app CI green (end-to-end and audit).
- **Before release**, for larger changes: the app's `main` merged into
  `acceptance`, the acceptance run green, and a manual check of the acceptance
  address in a browser.
- **Known skips:** the two `/api/geo` tests that set `x-vercel-ip-*` headers skip
  on a Vercel deployment. There, Vercel sets those headers itself from the
  caller's real IP address, and a test cannot replace them. They run locally
  and in app CI.
- **Retries:** one retry in CI. A test that needs it is fixed, not tolerated.
  For example, the chunk-recovery test was rewritten when a newer browser
  exposed a timing assumption, and the CSP test now zooms in one step at a
  time, since a click during a zoom animation can be lost on a slow machine.

## 7. Process

- **App and tests change together.** When this repository has a branch with the
  same name as an app branch, the app's CI uses it, so a change to the app and
  its tests are reviewed together.
- **New behaviour gets a test** before it is merged. Each test states in its name
  what it proves.
- **Stubs follow the real API.** When a server function's answer changes, the
  stub in `tests/fixtures.js` changes in the same pair of pull requests.

## 8. Known gaps and next steps

| Gap | Risk | Next step |
|---|---|---|
| No unit tests | Small pure functions (input checks, zoom levels, count labels) are only tested through the browser | Vitest in the app repository for those functions |
| Database functions untested | A wrong SQL change is caught only by hand | Run the SQL functions against the acceptance database in CI |
| Import script untested | A change in the source register's format could import bad data | Tests for the field mapping with recorded source responses |
| Chromium only | Safari and Firefox users could see problems first | Add WebKit and Firefox once headless WebGL is reliable enough |
| No real mobile devices | Touch and small screens are only covered by desktop Chromium | A mobile viewport project, then a device cloud for releases |
| No accessibility audit | Contrast or labelling problems go unnoticed | `@axe-core/playwright` on the map and every panel |
| No visual checks | Layout regressions go unnoticed | Screenshot comparison for the map and panels |
