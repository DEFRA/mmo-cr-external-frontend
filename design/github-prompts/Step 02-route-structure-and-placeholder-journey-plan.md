# Step 02 — Route Structure and Placeholder Journey (Approved Plan)

## 1. Objective

Create the full route structure and one minimal, accessible placeholder page for all 23 agreed Catch Record destinations inside the existing Step 01 shell, and wire the complete journey (Guidance → Confirmation) including the record-status, trip-date and statistical-area branches, branch-aware Back links, and a safe Empty Page. Structure and navigation only — no Figma page designs, no mock-data service (Step 03), no validation/persistence/auth.

## 2. Implementation Plan

**Phase A — Journey scaffolding (shared, minimal, no over-abstraction)**

- Add a small placeholder view partial (e.g. `templates/partials/placeholder-page.njk`) that renders inside the Step 01 shell: one `<h1>` (destination name), a short "detailed page implemented in a later step" sentence, and a block for the page's outgoing controls. Each page's `index.njk` extends the shell and calls it — this avoids a generic route factory while keeping pages tiny.
- Add two small named helpers under `common/helpers/journey/`:
  - `records.js` — a constrained local list of 4 sample records `{ recordId, status }` (Unsent/Submitted/Amended/Late) + `resolveRecordDestination(status)`; explicitly marked as replaceable by the Step 03 mock-data layer.
  - `navigation.js` — `getJourney(request)`/`setJourney(request, patch)` thin wrappers over `request.yar` storing only non-sensitive branch flags (`tripSameDate`, `statAreaBranch`); `backFor(page, journey)` to compute branch-aware Back targets; `safeReturnPath(candidate)` validating a return path against the known internal route allowlist.

**Phase B — Routes & controllers (one folder per page)** — create 23 route folders following the existing `controller.js`/`controller.test.js`/`index.js`/`index.njk` convention, registered in `src/server/plugins/router.js`. Thin controllers build view context (`pageTitle`, `heading`, `backLink`, outgoing links); branch decisions use POST handlers that set `yar` state and 303-redirect (works with JS disabled). Route map:

| Path                      | Page                            | Method(s) | Onward / rule                                                                                                                           |
| ------------------------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                       | Guidance                        | GET       | Privacy notice→`/privacy-notice`; Start now→`/sign-in`                                                                                  |
| `/privacy-notice`         | Privacy Notice                  | GET       | Back→`/`                                                                                                                                |
| `/sign-in`                | Sign In                         | GET, POST | continue→`/records`; forgotten/create→`/not-implemented`                                                                                |
| `/records`                | All Records                     | GET       | Create new→`/draft`; 4 record links→`/records/{recordId}`                                                                               |
| `/records/{recordId}`     | Catch Record Details (dispatch) | GET       | Joi param; Unsent→redirect `/draft`, Submitted/Amended/Late→render details, else 404; Back→`/records`; Edit/Download→`/not-implemented` |
| `/draft`                  | Create Draft Record             | GET, POST | Complete→`/select-vessel`; Delete→`/not-implemented`; Back→`/records`                                                                   |
| `/select-vessel`          | Select Vessel                   | GET, POST | OLGA→`/trip-date`; Back→`/draft`                                                                                                        |
| `/trip-date`              | Same-date question              | GET, POST | Yes→`/departure-port`, No→`/trip-departure-date` (sets `tripSameDate`); Back→`/select-vessel`                                           |
| `/trip-departure-date`    | When did you leave?             | GET, POST | →`/trip-return-date`; Back→`/trip-date`                                                                                                 |
| `/trip-return-date`       | When did you return?            | GET, POST | →`/departure-port`; Back→`/trip-departure-date`                                                                                         |
| `/departure-port`         | Departure Port                  | GET, POST | →`/return-port`; **Back = branch-aware** (`/trip-date` if Yes, `/trip-return-date` if No)                                               |
| `/return-port`            | Return Port                     | GET, POST | →`/gear-selection`; Back→`/departure-port`                                                                                              |
| `/gear-selection`         | Gear Selection                  | GET, POST | Pots→`/pots-details`, other→`/not-implemented`; Back→`/return-port`                                                                     |
| `/pots-details`           | Pots Details                    | GET, POST | →`/statistical-area`; Back→`/gear-selection`                                                                                            |
| `/statistical-area`       | Statistical Area                | GET, POST | area→`/species-selection`, Other→`/statistical-area-other` (sets `statAreaBranch`); Back→`/pots-details`                                |
| `/statistical-area-other` | Alternative Statistical Area    | GET, POST | →`/species-selection`; Back→`/statistical-area`                                                                                         |
| `/species-selection`      | Species Selection               | GET, POST | COD→`/species-weight`; Add/Remove→`/not-implemented`; **Back = branch-aware** (`/statistical-area` or `/statistical-area-other`)        |
| `/species-weight`         | Species Weight                  | GET, POST | →`/catch-not-landed`; Back→`/species-selection`                                                                                         |
| `/catch-not-landed`       | Catch Not Landed                | GET, POST | No→`/check-answers`, Yes→`/not-implemented`; Back→`/species-weight`                                                                     |
| `/check-answers`          | Check Your Answers              | GET, POST | Submit→`/confirmation`; Back→`/catch-not-landed`                                                                                        |
| `/confirmation`           | Confirmation                    | GET       | View records→`/records`                                                                                                                 |
| `/account`                | Account                         | GET       | unsupported→`/not-implemented`                                                                                                          |
| `/not-implemented`        | Empty Page                      | GET       | validated safe return link (Joi query + allowlist), default `/records`                                                                  |

**Phase C — Reconcile Step 01 example routes** — repurpose `/` from the Step 01 example `home` to Guidance: remove the `home` route/folder and its registration, and relocate its still-valuable shared-shell regression assertions into the Guidance route test (fixing the two currently-failing assertions by selecting `head > title` instead of the bare `title` that also matches the logo SVG's inner `<title>`). Keep `/about` untouched (harmless example that already exercises the Back link). Update `buildNavigation` header targets to the journey (Home→`/`, Your account→`/account`, Sign out→`/sign-in`) per the Navigation Rules.

**Phase D — Validation & cleanup** — tests, lint, format, build, security-audit, browser walkthrough, stop dev server.

## 3. File/Component Impact

- **New (per page ×23):** `src/server/routes/<page>/{controller.js,controller.test.js,index.js,index.njk}` for the routes in the table (guidance, privacy-notice, sign-in, records, record-details, draft, select-vessel, trip-date, trip-departure-date, trip-return-date, departure-port, return-port, gear-selection, pots-details, statistical-area, statistical-area-other, species-selection, species-weight, catch-not-landed, check-answers, confirmation, account, not-implemented).
- **New (shared):** `src/server/common/templates/partials/placeholder-page.njk`; `src/server/common/helpers/journey/records.js` (+ test); `src/server/common/helpers/journey/navigation.js` (+ test).
- **Modified:** `src/server/plugins/router.js` (register the new routes, drop `home`); `src/config/nunjucks/context/build-navigation.js` (+ test) for header targets.
- **Removed:** `src/server/routes/home/` (example at `/`, replaced by Guidance); its shell tests relocated to the Guidance test.
- **Untouched:** the Step 01 shell (`layouts/page.njk`, `page-navigation`, header/footer SCSS), `/about`, `/health`, config, sessions plugin, security headers/CSP.

## 4. Validation Plan

- **Unit/route tests (`server.inject` + cheerio):** every route returns 200 (or the documented redirect/404) and its expected `h1`; Guidance→Privacy/Sign In; Privacy Back→`/`; Sign In→`/records`; Create-new & Unsent→`/draft`; Submitted/Amended/Late→details; unknown/invalid `recordId`→404; Catch Record Details unsupported actions→`/not-implemented`; Draft choices; vessel→trip-date; Trip Date Yes vs No; both date transitions; branch-aware Departure Port Back (Yes vs No); Gear Pots vs unsupported fallback; statistical-area direct vs Other; branch-aware Species Selection Back; Catch Not Landed No vs Yes; Check Answers→Confirmation; Confirmation→`/records`; Account; Empty Page safe-return (valid path kept, invalid/external rejected to default); Joi param/query rejection.
- **Commands:** `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
- **Browser (JS-enabled and JS-disabled) + keyboard, narrow/wide:** full primary journey, both trip-date branches, both statistical-area branches, all four record statuses, Empty Page returns, Account. Confirm the Step 01 shell is intact. Stop the dev server after.

## 5. Risks, Assumptions and Sources

- **Assumption:** repurposing `/` from the Step 01 example `home` to Guidance is intended (Navigation Rules make `/`→Guidance). Home is a removable example; `/about` and `/health` are preserved.
- **Assumption:** branch-aware Back uses the existing `@hapi/yar` session (already registered) storing only non-sensitive branch flags — no new session/cache architecture.
- **Assumption:** the 4 sample records are a tiny local constant now, explicitly replaceable by the Step 03 mock-data layer (not the final `getData(pageName)` service).
- **Risk:** POST branch handlers must 303-redirect so navigation works without JS (progressive enhancement) — covered by tests.
- **Risk:** Empty Page `return` must never allow open redirect — mitigated by Joi + internal-route allowlist; it renders a link, not an automatic redirect.
- **Pre-existing issue folded in:** two Step 01 home-shell test assertions fail because `$('title')` also matches the GOV.UK logo SVG's inner `<title>`; fixed by using `head > title` when the tests move to Guidance.
- **Sources:** the Happy Path Journey Map, Navigation Rules, and Implementation Plan (functional source of truth); existing repo conventions in `router.js` and the `about` route; DEFRA/GDS progressive-enhancement and Joi-at-boundary guidance from the repo instructions. The three documents do not conflict on any rule used above.
