# Step 12 — Statistical Area and Other Branch (Approved Plan)

## 1. Objective

Replace the Step 02 placeholders for Statistical Area and Alternative Statistical Area with accessible pages matching the approved PNGs: a graphical first-screen area selector with clickable square regions, and an Other branch page that shows a radio collection of areas with a Statistical sub area field.

## 2. Confirmed decisions

1. The first Step 12 PNGs are authoritative for the primary Statistical Area page: it must be a full graphical interface where the user clicks square areas and the selected area changes colour.
2. The third Step 12 PNG is authoritative for the Other branch: only after selecting Other does the user reach a page with a radio collection of areas and the Statistical sub area control.
3. Alternative Statistical Area remains a separate route `/statistical-area-other`.
4. No accessible-autocomplete dependency is added. The Statistical sub area control remains a plain `govukInput` with safe format validation.

## 3. Existing state found

- The current implementation incorrectly uses a radios list for the first screen and a standalone input page for the Other branch.
- `species-selection` back handling is already correct and must remain unchanged.
- The corrected implementation needs two mock-data sets: graphical nearby map areas for the first screen, and the 30Fxx radio list for the Other route.

## 4. Implementation Plan

1. Extend `src/server/common/data/statistical-areas.js` with `nearbyStatisticalAreas` for the graphical first screen while keeping `statisticalAreas` for the Other-route radios list.
2. Rebuild `statistical-area/controller.js` and `index.njk` so the first screen renders clickable square areas plus an Other button, with selected-state styling restored from journey state.
3. Rebuild `statistical-area-other/controller.js` and `index.njk` so the Other route shows the 30Fxx radio collection, with Other selected by default and the Statistical sub area input shown for the Other state.
4. Add page-specific SCSS for the graphical first screen.
5. Update tests to match the corrected UI and keep branch-aware navigation intact.

## 5. File/Component Impact

- `src/server/common/data/statistical-areas.js`
- `src/server/common/data/get-data.js`
- `src/server/common/data/get-data.test.js`
- `src/server/routes/statistical-area/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/statistical-area-other/{controller.js,index.njk,controller.test.js}`
- `src/client/stylesheets/components/_statistical-area.scss`
- `src/client/stylesheets/components/_index.scss`

## 6. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Full §12 test checklist from the prompt (GET/POST for both pages, branch-aware Species Selection Back regression, security: no arbitrary destinations, mock data untouched).
3. Manual (deferred): keyboard, 320–1440px, 200% zoom, JS-disabled, screen-reader landmark/heading structure.

## 7. Risks, Assumptions and Sources

- The user explicitly corrected the earlier interpretation: the map-style PNGs are authoritative for page 1.
- The graphical first screen will still use real server-rendered form buttons so the flow works without JavaScript.
- Sources: `WhereWasCatchCought.png`, `WhereWasCatchCaught-2.png`, `WhereWasYourCatchCaught-3.png`, and the existing journey-state/back-link implementation.
