# Step 07 — Catch Record Details (populated read-only page)

## 1. Objective

Replace the Step 02 `record-details` placeholder with the populated read-only Catch Record Details page shown in `design/screens/CatchRecordsForVessel.png`, driven by Step 03 `getData('catchRecordDetails')` mock data. Route, dispatch (unsent→`/draft`, unknown→404), and Back link are unchanged. Decision (user-confirmed): build the populated page — the prompt's "empty state" wording is leftover boilerplate; the PNG + the §8 "Download PDF dummy button" scope line + the existing populated mock data all indicate the populated page.

## 2. Visual Source of Truth (PNG-transcribed content)

Caption `A1234520260727150815` · h1 "Catch record for OLGA". Four sections, each a `govukSummaryList`:

- Trips details: Vessel = OLGA · Departure date = 22 July 2026 · Return date = 22 July 2026 · Departure port = Hastings · Return port = Hastings · Statistical sub area = 38E95
- Gear used: Gear type = Pot · Total pots or traps hauled = 7 · Total pots or traps left in water = 5
- Species caught: Species = Atlantic cod · Weight above minimum size retained = 15 kg · Weight below minimum size retained = 10 kg · Weight legally discard = 5 kg
- Species not landed: Not landed = Yes · Species = Atlantic cod (COD) · Weight above minimum size kept onboard or in keep pots (kg) = 5

Actions: green Edit catch record (primary) → `/not-implemented?return=/records/{recordId}`; grey Download PDF (secondary) = inert dummy `<button type="button">` that does nothing (per §8; overrides the Navigation Rules' "Download PDF → Empty Page").

## 3. Implementation Plan

1. Mock data `catch-record-details.js`: update to the PNG's values — reference `A1234520260727150815`, dates `2026-07-22`, statisticalArea `38E95`, gear `Pot`, potsHauled `7`, potsInWater `5`, species `Atlantic cod`, weights `15`/`10`/`5` (kg), `catchNotLanded: true`, plus new not-landed fields (`notLandedSpecies: 'Atlantic cod (COD)'`, `notLandedWeightAboveMinimumKept: 5`).
2. Controller `record-details/controller.js`: keep Joi param validation, `allRecords` lookup, unsent→`/draft` redirect, unknown→404. Pass `getData('catchRecordDetails')` as the record data; set `pageTitle`/`heading` to `Catch record for ${details.vesselName}`; keep `backLink { href: '/records' }`; pass `recordId` for the Edit return path.
3. Template `record-details/index.njk`: replace placeholder with caption-above `<span class="govuk-caption-l">` + `<h1 class="govuk-heading-xl" data-testid="app-heading-title">`, four `govukSummaryList` sections under `govuk-heading-l` `<h2>`s, then `govukButton` Edit (link, `href`) + `govukButton` Download PDF (secondary, inert `type="button"`, no href/action). Dates via `formatDate(value, "d MMMM yyyy")`; weights render `{{ n }} kg`. Two-thirds content column.
4. Tests: update `record-details/controller.test.js` (title now "Catch record for OLGA"; section headings + key values render; Edit → `/not-implemented?return=/records/{id}`; Download PDF is an inert button, not a nav link; keep unsent→`/draft`, unknown→404, submitted/amended/late→200); verify `get-data.test.js` still green.

## 4. File/Component Impact

- `src/server/routes/record-details/controller.js`, `src/server/routes/record-details/index.njk`, `src/server/routes/record-details/controller.test.js`
- `src/server/common/data/catch-record-details.js`
- No change to the shell, the `/records` route, `/not-implemented`, routing/session, or other steps.

## 5. Validation Plan

- `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
- `server.inject` assertions above; existing Steps 02–06 suites green (same 2 known pre-existing branch-aware Back-link failures unrelated to this step).
- Manual (deferred): keyboard, 320/768/1024/1440px, 200%/400% zoom, JS-disabled Back + Edit navigation.

## 6. Risks, Assumptions and Sources

- Prompt/PNG conflict resolved by the user: build the populated page (option 1).
- GDS deviation — Download PDF: an inert button with no action is unusual for accessibility, but explicitly required by §8. Documented.
- GDS note — caption placement: page uses the standard GOV.UK caption-above-heading pattern (hand-rendered) rather than the shared `appHeading` (which renders caption below the h1); chosen for PNG fidelity. The h1 keeps `data-testid="app-heading-title"`.
- All submitted/amended/late records render the same shared `catchRecordDetails` mock (walkthrough scope).
- Sources: `CatchRecordsForVessel.png` (transcribed), Navigation Rules §8, existing `record-details` route + Step 03 `catchRecordDetails` data.
