# Step 08 — Create Draft Record and Select Vessel (Approved Plan)

## 1. Objective

Replace both Step 02 placeholders with radio-based GOV.UK forms matching `WhatToDoWithDraftRecord.png` and `SelectYourVessel.png`, keeping navigation as fixed server-side destinations with no persistence.

## 2. Implementation Plan

**Create Draft Record** (`draft/`): caption "New catch record" + `h1`/legend "What do you want to do with your draft record?" (`govukRadios` as the fieldset+legend+h1, per the design), options `complete`/`delete`, `govukButton` "Save and continue" (was "Complete catch record"/"Continue" split — unify into one radio+button form). Back → `/records` (unchanged). POST: allowlist `complete`→`/select-vessel`, `delete`→`/not-implemented?return=/draft`; missing/unknown selection → `Boom.badRequest()` (same pattern already used on `/trip-date`, `/catch-not-landed`, `/gear-selection`, `/statistical-area` — no error-summary UI added, consistent with those existing radio pages).

**Select Vessel** (`select-vessel/`): caption "New catch record" + `h1`/legend "Select your vessel", `govukRadios` with one item (value = stable vessel `id`, text = "OLGA") sourced from `getData('selectVessel')`, `govukButton` "Save and continue". Back → `/draft` (unchanged). POST: validate submitted `vesselId` against the mock assigned-vessel id; valid → `/trip-date`; invalid/missing → `Boom.badRequest()` (same pattern as above).

**Mock data**: `vessels.js`'s `selectVessel` export gains a stable `id` field (e.g. `id: 'olga'`) alongside `name`/`registration`, since the radio value must be an ID not the display name.

## 3. File/Component Impact

- `src/server/routes/draft/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/select-vessel/{controller.js,index.njk,controller.test.js}`
- `src/server/common/data/vessels.js` (+ `get-data.test.js` if it asserts the old shape)

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Tests per the source prompt's §11 (both pages' GET/POST + regression: All Records→Draft, Unsent→Draft, Empty Page reachable, Trip Date reachable, no mutation of mock data, unknown action/vessel → safe 400, no arbitrary redirect).
3. Manual (deferred): keyboard, radio behaviour, 320/768/1440px, 200% zoom, JS-disabled POST.

## 5. Risks, Assumptions and Sources

- Validation: no GOV.UK error-summary UI for a missing selection — a bad/missing submission returns a safe `400` via the existing `catchAll`/Boom pattern, consistent with how the other Step 02 radio pages (gear-selection, statistical-area, trip-date, catch-not-landed) currently behave.
- Single-vessel `govukRadios` (not a plain confirm button) — matches the PNG exactly and the prompt's explicit instruction to use radios "even when the walkthrough currently has one vessel."
- Delete still routes to `/not-implemented?return=/draft` (Empty Page, already implemented in Step 02); no Step 07 dependency since Step 07 was Catch Record Details, not Empty Page mechanics.
