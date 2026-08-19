# Step 09 — Trip Date Branching (Approved Plan)

## 1. Objective

Replace the three Step 02 placeholders (Trip Date, Trip Departure Date, Trip Return Date) with detailed GOV.UK pages matching `DidYourTripStartAndFinishToday.png`, `WhenDidYouLeave.png`, `WhenDidYouReturn.png`. Branching (Yes→Departure Port, No→departure/return date pages→Departure Port) and branch-aware Back navigation already exist via the Step 02 `@hapi/yar` journey-state helpers (`setJourneyState`/`backForDeparturePort`) — reused as-is.

**Approved wording/scope decisions (user-confirmed, PNG overrides the prompt body wherever they conflict):**
- **Q1:** Page question is exactly **"Did your trip start and finish today?"** (verbatim PNG wording — not "on the same date").
- **Q2:** **Structural date validation only** (missing/non-numeric/invalid-day-for-month/leap-year). No cross-field chronological ("return ≥ departure") rule, no new journey-state handling beyond what already exists.

## 2. Implementation Plan

1. **Trip Date** (`trip-date/`): caption "New catch record" + `h1`/legend "Did your trip start and finish today?", `govukRadios` Yes/No, `govukButton` "Save and continue". Back → `/select-vessel` (unchanged). POST already sets `tripSameDate` in session and redirects Yes→`/departure-port`, No→`/trip-departure-date` (keep exactly as-is). Add `govukErrorSummary` + radio error when nothing selected (accessible validation, per prompt §5.3/§13 — currently a bare 400).
2. **Trip Departure Date** (`trip-departure-date/`): caption + `h1`/legend "When did you leave for your trip?", hint with the PNG's example date format, `govukDateInput` (Day/Month/Year), button. Back → `/trip-date`. POST: structural date validation via a new tested helper; valid → `/trip-return-date`; invalid → re-render with `govukErrorSummary` + field errors + preserved submitted values.
3. **Trip Return Date** (`trip-return-date/`): caption + `h1`/legend "When did you return from your trip?", hint with the PNG's example date format, `govukDateInput`, button. Back → `/trip-departure-date`. POST: same structural validation only (no chronological comparison, per Q2); valid → `/departure-port`.
4. **Date-validation helper** (new, tested): `src/server/common/helpers/journey/date-input.js` — parses Day/Month/Year, handles all-missing / each-part-missing / non-numeric / invalid-day-for-month / leap-year, using plain calendar semantics (no UTC/timezone shift). Returns a shape usable to build `govukErrorSummary` + per-field errors and to repopulate the date-input on re-render.
5. **Fix the branch-Back tests**: `departure-port/controller.test.js` (and the analogous `species-selection/controller.test.js`) currently fail because they pass the raw `set-cookie` response header array directly back as the request's `Cookie` header. Fix the test wiring (not app code) so the yar session cookie is carried correctly, making the existing branch-aware Back assertions pass.

## 3. File/Component Impact

- `src/server/routes/trip-date/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/trip-departure-date/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/trip-return-date/{controller.js,index.njk,controller.test.js}`
- New `src/server/common/helpers/journey/date-input.js` (+ test)
- `src/server/routes/departure-port/controller.test.js` and `src/server/routes/species-selection/controller.test.js` — fix cookie-passing in the branch-aware Back tests only

## 4. Validation Plan

- `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
- Tests per the source prompt §15 (all three pages' GET/POST, every date-error case incl. leap year, submitted-value preservation, branch-aware Departure Port Back after Yes vs No, no arbitrary redirect, regressions green).
- Manual (deferred): keyboard, date-input grouping, error-summary focus, 320/768/1440px, 200% zoom, JS-disabled.

## 5. Risks, Assumptions and Sources

- **Wording conflict resolved by the user**: PNG wins over the prompt body's journey-map wording ("on the same date") — page question is the literal PNG text "Did your trip start and finish today?".
- **Scope decision by the user**: structural-only date validation; no chronological rule, no new session/state beyond the existing `tripSameDate` journey flag.
- The branch-aware Back mechanism (yar session + `backForDeparturePort`) already exists from Step 02 and needs no new architecture — only the test's cookie handling needs correcting.
- Sources: `DidYourTripStartAndFinishToday.png`, `WhenDidYouLeave.png`, `WhenDidYouReturn.png` (verbatim wording), existing `journey/navigation.js` helpers, Navigation Rules/Journey Map (superseded by PNG on this specific wording point per user instruction).
