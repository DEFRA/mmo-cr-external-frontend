# Step 03 — Mock Data Foundation (Approved Plan)

## 1. Objective

Introduce a small, editable, walkthrough-only mock-data foundation: coherent source data grouped by domain, exposed through one synchronous accessor `getData(pageName)` that returns an independent (cloned) copy so consumers/tests can't mutate shared state. Wire it into the minimum Step 02 routes needed to prove the interface (All Records, Select Vessel, Gear Selection, Statistical Area, Species Selection, Confirmation). No API/DB/persistence, no detailed page designs, navigation logic stays in controllers/helpers.

## 2. Implementation Plan

**Phase A — Source data (`src/server/common/data/`)** — JSON-compatible constant objects in `.js` modules (ESM `type: module`; avoids JSON import-assertion friction; each file carries a one-line "walkthrough-only, fictional" comment). No functions/paths/secrets inside the data. Domain files:
- `service.js` (`Record your catch`), `account.js` (James Smith + fictional email/contact)
- `records.js` (4 records — one each Unsent/Submitted/Amended/Late — each with `recordId`, canonical `status`, `tripEndDate`, `vesselName`, `createdBy`) and `catch-record-details.js` (one coherent detail record: reference, vessel, dates, ports, statistical area, gear, Pots values, species, weights, not-landed)
- `vessels.js` (OLGA / `FIN-126-U`), `trip-dates.js`, `ports.js` (Hastings + a couple of alternatives, with codes), `gear.js` (options with stable id/label + `hasImplementedSublevel: true` only for Pots), `pots-details.js`, `statistical-areas.js` (list + primary selection + Other example, with codes), `species.js` (COD/HAD/SAL with codes) + `species-weights.js` (numeric COD weights + unit metadata), `catch-not-landed.js` (default `No`), `confirmation.js` (mock ref e.g. `A1234520260727150815`).

**Phase B — Accessor (`src/server/common/data/get-data.js`)** — an explicit `const dataByKey = { service, account, allRecords, catchRecordDetails, createDraftRecord, selectVessel, tripDates, ports, gearSelection, potsDetails, statisticalAreas, speciesSelection, speciesWeights, catchNotLanded, checkAnswers, confirmation }` map (fixed keys, never caller-controlled paths). `getData(pageName)` returns `structuredClone(dataByKey[pageName])` (Node ≥24 global) for per-call immutability; unknown key throws a clear dev `Error` with no sensitive detail. Synchronous, no navigation/render/business logic.

**Phase C — Integrate the 6 proof routes** (replace inline placeholder data with `getData`, keep navigation explicit):
- `src/server/routes/records/controller.js` → `getData('allRecords')` for the list; **status→destination decision stays** in the `resolveRecordDestination` helper (record data moves to `data/records.js`; the journey helper keeps only the routing function).
- `src/server/routes/record-details/controller.js` → look up `recordId` against `getData('allRecords')` (behaviour identical: unsent→`/draft`, others→details, unknown→404).
- `src/server/routes/select-vessel/controller.js` → `getData('selectVessel')` (OLGA/FIN-126-U); render the vessel name.
- `src/server/routes/gear-selection/controller.js` → `getData('gearSelection')` (remove inline `gearOptions`; Pots stays the only implemented sublevel).
- `src/server/routes/statistical-area/controller.js` → `getData('statisticalAreas')` (remove inline options; keep the Other branch).
- `src/server/routes/species-selection/controller.js` + its `index.njk` → `getData('speciesSelection')` and render COD/HAD/SAL (currently no options are shown).
- `src/server/routes/confirmation/controller.js` → `getData('confirmation')` mock reference, displayed on the page.

**Phase D — Docs & validation** — add a concise "Mock-data layer (walkthrough-only)" section to `src/server/common/README.md` (purpose, location, `getData` usage, supported keys, unknown-key behaviour, immutability, how to edit, no real PII/secrets). Then run the full gate.

## 3. File/Component Impact

- **New:** `src/server/common/data/get-data.js` (+ `get-data.test.js`); domain data files listed in Phase A (+ a focused `data.test.js` or colocated tests for content contracts).
- **Modified:** the 6 controllers above (+ their tests); `src/server/routes/species-selection/index.njk` to render species; `src/server/common/helpers/journey/records.js` journey helper (record array removed, `resolveRecordDestination` retained); `src/server/common/README.md`.
- **Untouched:** Step 01 shell, all other Step 02 routes/branches, router registration, sessions plugin, config, security headers, SCSS. No new dependencies.

## 4. Validation Plan

- **Accessor tests:** every supported key returns the expected top-level shape; unknown key throws; a returned object mutated by a caller does **not** change the source constant nor a later `getData` call (immutability proof).
- **Data-contract tests:** James Smith present; OLGA + `FIN-126-U`; Hastings in ports; Pots is the only gear with an implemented sublevel; statistical-area primary + Other examples; COD/HAD/SAL with stable codes; COD weights are numeric; Catch Not Landed default `No`; confirmation reference returned; the four canonical statuses each present exactly once.
- **Integration (`server.inject` + cheerio):** All Records renders 4 status examples from shared data and status routing still reaches Step 02 destinations; Select Vessel shows OLGA; Gear Selection shows Pots; Statistical Area shows areas; Species Selection shows COD/HAD/SAL; Confirmation shows the mock ref. All existing Step 02 navigation tests still pass (no regressions).
- **Commands:** `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`. Optional JS-disabled smoke-test of the six pages, then stop the dev server.

## 5. Risks, Assumptions and Sources

- **Assumption:** source data as JSON-compatible `.js` constants (not `.json`) best fits the ESM repo and lets each file carry a "walkthrough-only, fictional" comment; the accessor still treats them as pure data.
- **Assumption:** `structuredClone` (Node ≥24 global) is the immutability mechanism — no third-party clone dependency.
- **Assumption:** record **status→destination routing stays in the controller/journey helper**, not in data (per prompt §8 "do not put route destinations into source data"); only the record *content* moves to the data layer.
- **Risk:** moving the record array out of `records.js` touches both `records` and `record-details` — mitigated by keeping `resolveRecordDestination` and identical status behaviour, covered by the existing Step 02 tests.
- **Risk:** Species Selection currently renders no options — adding them is a minimal template change to prove integration, not a detailed page design.
- **Sources:** Happy Path Journey Map, Navigation Rules, the Implementation Plan, and the approved Step 02 plan plus the delivered Step 02 code (functional source of truth); repo ESM/testing/security instructions. No conflicts found among them.
