# Step 10 — Departure and Return Ports (Approved Plan)

## 1. Objective

Replace both Step 02 placeholders with GOV.UK radio pages matching `WhichPortDidYouLeaveFrom.png` and `WhichPortDidYouReturnTo.png`, backed by the existing `ports.js` data and yar journey state. The routing/Back links already exist and are correct.

## 2. Implementation Plan

**Departure Port** (`departure-port/`): caption "New catch record" + `h1`/legend "Which port did you leave from?", `govukRadios` built from `getData('ports')` (Hastings/Newhaven/Rye), `govukButton` "Save and continue". Back → `backForDeparturePort(request)` (branch-aware, unchanged). GET restores the saved `departurePort` (marks matching radio `checked`). POST: validate the submitted code is in the ports list; valid → `setJourneyState(request, { departurePort })` then redirect `/return-port`; invalid/missing → re-render (400) with error summary + inline error + preserved selection.

**Return Port** (`return-port/`): same pattern — caption + `h1`/legend "Which port did you return to?", same `govukRadios` from `ports.js`, restores saved `returnPort`, Back → `/departure-port` (unchanged). Valid POST → `setJourneyState(request, { returnPort })` then redirect `/gear-selection`; leaves `departurePort` untouched.

**Validation/error-summary pattern**: reuse exactly what Step 09 established (Joi `.valid(...portCodes)` with a `failAction` that re-renders the GET view with `errorSummary`/`fieldErrors`, and the shared shell auto-rendering `govukErrorSummary`). Status 400 for invalid input. No "ports must differ" rule.

**Data**: reuse the existing `src/server/common/data/ports.js` (`{ code, name }`). No new data file.

## 3. File/Component Impact

- `src/server/routes/departure-port/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/return-port/{controller.js,index.njk,controller.test.js}`
- No changes to `ports.js`, `navigation.js`, the shell, or other routes.

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Tests per the source prompt §21 (both pages: GET renders options, GET restores saved selection, valid POST saves + redirects, blank/unknown POST → 400 with error, return-port leaves departurePort unchanged, Back destinations, PNG wording, one Continue button, ports-data shape).
3. Manual (deferred): keyboard, 320/768/1024/1440px, 200% zoom, JS-disabled, error-summary focus.

## 5. Risks, Assumptions and Sources

- PNG shows one "Hastings" radio, but all three ports from `ports.js` are rendered — §11/§14 point to the JSON data source as the option list; the PNG's single radio is an example, and the control type (radios) matches.
- Error wording (PNGs show no error text, so per §16.8 repo convention is used): "Select the port you left from" / "Select the port you returned to".
- Journey-state keys: `departurePort` / `returnPort` via the existing `setJourneyState`/`getJourneyState` helpers — no new state architecture.
