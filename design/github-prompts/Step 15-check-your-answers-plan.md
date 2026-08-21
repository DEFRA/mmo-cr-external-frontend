# Step 15 — Check Your Answers (Approved Plan)

## 1. Objective

Replace the placeholder `/check-answers` page with a real GOV.UK Check Your Answers page matching `CheckYourCatchRecord.png`: four summary-list sections (Trips details, Gear used, Species caught, Species not landed), a declaration checkbox, and a handoff to the existing `/confirmation` route. Add a minimal, shared `return`-query mechanism so each "Change" link can send the user back to Check Your Answers after a successful edit.

## 2. Key findings

- `/check-answers` (`controller.js`/`index.njk`) is currently a placeholder (`appPlaceholderPage` + bare "Submit" button).
- Journey state (`journey/navigation.js`, `@hapi/yar`-backed) already stores `tripSameDate`, `departurePort`, `returnPort`, `selectedGearIds`, `potsDetails`, `statAreaBranch`, `selectedStatisticalArea`, `selectedAlternativeAreaOption`, `alternativeStatisticalArea`, `selectedSpeciesIds`, `codWeights`, `weightFieldsVisible`.
- Gaps confirmed with the user: vessel choice, departure/return date and the catch-not-landed answer are validated but never persisted; a same-day trip never asks for a date at all; no gear/pots reference data has a mesh-size field; the catch-not-landed "Yes" capture flow is out of scope/not-implemented, so a live draft reaching this page always has `catchNotLanded = false`.
- `safeReturnPath`/`SAFE_RETURN_PATHS` already exists (already includes `/check-answers`) and is already used by `not-implemented/controller.js` via a `?return=` query param. No route defines `validate.query`, so `?return=` already passes through untouched on GET, and — since every form has no `action` attribute — is preserved into the POST too.
- `record-details/index.njk` + `common/data/catch-record-details.js` is the closest analogue: same section names/order and the same example values as the PNG, but it also has no mesh-size field.
- `species.js`: only `cod` can complete species-selection (other species redirect to `/not-implemented`). "Species caught" needs the plain name; "Species not landed" needs the full `text` (with code), per the PNG.
- `formatDate` Nunjucks filter already renders ISO dates as `"d MMMM yyyy"` (used by `record-details/index.njk`) — reused in the template only.

## 3. Decisions (confirmed with the user)

1. Add the missing `setJourneyState` calls: `trip-departure-date`/`trip-return-date` persist `departureDate`/`returnDate`; `catch-not-landed` persists `catchNotLanded`. No visual/behavioural change to those pages. Vessel needs no journey state — there is only one possible vessel (`getData('selectVessel')`).
2. Same-day trip dates: no page ever asks for a date when `tripSameDate === true`. Falls back to a new mock default (`checkAnswersDefaults.sameDayDate`, the PNG's own `2026-07-22`) for both date rows in that branch.
3. Mesh size: no field exists anywhere in gear/pots reference data. Use a selected gear's existing `hint` text when it contains "mm mesh"; `pots` has no hint, so fall back to a new mock default `checkAnswersDefaults.potsMeshSize` ('50mm') when `pots` is selected; omit the row otherwise.
4. Species not landed: the "Not landed" row always reflects the real (now-persisted) `catchNotLanded` value (today always `false`). The Species/Weight sub-rows are implemented conditionally on `catchNotLanded === true` and sourced from new mock defaults, matching the PNG — unreachable today (dead-but-ready) since the "Yes" capture flow doesn't exist yet. Never fabricate "Yes" when the real answer is "No".
5. The duplicate "Trips details" heading above the submit button is reproduced literally, per the PNG.
6. No new capture pages, no redesign of prior pages' visible content/validation beyond the additive redirect wiring, no backend/API, no final confirmation-page changes.
7. Orchestrator not required — single contained frontend journey capability.

## 4. Section → row → source mapping

### Trips details (one `govukSummaryList`)

| Row                  | Source                                                                                            | Change href                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Vessel               | `getData('selectVessel').name`                                                                    | `/select-vessel?return=/check-answers`                            |
| Departure date       | `journeyState.departureDate` if `tripSameDate === false`, else `checkAnswersDefaults.sameDayDate` | `/trip-departure-date` or `/trip-date` + `?return=/check-answers` |
| Return date          | `journeyState.returnDate` if `tripSameDate === false`, else `checkAnswersDefaults.sameDayDate`    | `/trip-return-date` or `/trip-date` + `?return=/check-answers`    |
| Departure port       | `ports.find(code).name`                                                                           | `/departure-port?return=/check-answers`                           |
| Return port          | `ports.find(code).name`                                                                           | `/return-port?return=/check-answers`                              |
| Statistical sub area | branch-aware (`direct`/`other`+listed/`other`+typed)                                              | `/statistical-area(-other)?return=/check-answers`                 |

### Gear used (rendered when gear is selected)

Gear type (joined labels) · Total pots or traps hauled (if `pots`) · Total pots or traps left in water (if `pots`) · Mesh size (gear hint, or pots mock default, or omitted). Change href: `/gear-selection?return=/check-answers`.

### Species caught (rendered when `cod` selected)

Species (plain name) · Weight above minimum size retained · Weight below minimum size retained (if visible) · Weight legally discard (if visible). Change href: `/species-selection?return=/check-answers`.

### Species not landed

Not landed (Yes/No) · Species (if Yes) · Weight above minimum size kept onboard or in keep pots (kg) (if Yes). Change href: `/catch-not-landed?return=/check-answers`.

### Declaration

`govukWarningText` + confirming body/bullets + single `govukCheckboxes` item ("I confirm the information is complete and accurate", required) + literal `<h2>Trips details</h2>` + `govukButton` "Accept and submit trip details".

## 5. New mock data

`src/server/common/data/check-answers.js` → `checkAnswersDefaults = { sameDayDate: '2026-07-22', potsMeshSize: '50mm', notLandedSpecies: 'Atlantic cod (COD)', notLandedWeightAboveMinimumKept: 5 }`, registered in `get-data.js`.

## 6. Shared return-navigation helper

`resolveNextPath(request, defaultPath)` added to `journey/navigation.js`: returns `request.query.return` when it's in `SAFE_RETURN_PATHS`, else `defaultPath`.

## 7. Implementation steps

1. `journey/navigation.js` + test: add `resolveNextPath`.
2. Minimal parity fixes + `resolveNextPath` wiring in: `select-vessel`, `trip-date`, `trip-departure-date`, `trip-return-date`, `departure-port`, `return-port`, `gear-selection`, `statistical-area`, `statistical-area-other`, `species-selection`, `catch-not-landed` controllers (+ their tests) — success-redirect only, no default-behaviour change.
3. `common/data/check-answers.js` (new) + `get-data.js` registration.
4. `check-answers/view-model.js` (new) + `view-model.test.js` — all section/row mapping, formatting, joining logic.
5. `check-answers/controller.js` — GET builds the view-model; POST validates the declaration checkbox, `failAction` re-renders with an accessible error, success redirects to `/confirmation` (unchanged).
6. `check-answers/index.njk` — four `govukSummaryList` sections, `govukWarningText`, declaration body/bullets/checkbox, literal duplicate heading, submit button; `formatDate` filter for the two date rows only.
7. `check-answers/controller.test.js` — GET/POST coverage; representative Change-loop integration tests on 2–3 destinations; accessibility checks.
8. `npm run lint`, `npm run format:check`, `npm test`, `npm run build:frontend`; manual PNG/responsive/keyboard/zoom pass.

## 8. Files

- New: `src/server/routes/check-answers/view-model.js` (+ test), `src/server/common/data/check-answers.js`
- Rewritten: `src/server/routes/check-answers/{controller.js,index.njk,controller.test.js}`
- Modified: `src/server/common/helpers/journey/navigation.js` (+ test), `src/server/common/data/get-data.js`
- Minimal redirect/state additions (+ tests): `src/server/routes/{select-vessel,trip-date,trip-departure-date,trip-return-date,departure-port,return-port,gear-selection,statistical-area,statistical-area-other,species-selection,catch-not-landed}/controller.js`

## 9. Out of scope

New capture pages/fields, redesigning prior pages beyond the additive redirect wiring, the final confirmation page, backend/API/persistence.

## 10. Risks / assumptions

- Gear-type/mesh-size joining for multiple simultaneously-selected gear types is inferred (checkboxes allow multi-select) rather than PNG-confirmed (PNG only shows the single "Pot" example).
- Mock defaults for same-day date, mesh size and not-landed species/weight are placeholders explicitly requested by the user pending later capture flows — documented in code comments as such.
