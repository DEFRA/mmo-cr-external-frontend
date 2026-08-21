# Step 13 — Species Single-Page Views (Approved Plan)

## 1. Objective

Replace the Step 02 Species placeholder implementation with **one canonical Species page** at `/species-selection` matching the three approved PNGs, which are three server-rendered states of the same page/form — not separate journey steps. The legacy `/species-weight` journey page is removed; the single Species page absorbs its behaviour and continues directly to `/catch-not-landed`.

## 2. Confirmed decisions

1. The three Step 13 PNGs (`WhatSpeciesDidYouCatchUsingGear.png`, `WhatSpeciesDidYouCatch-2.png`, `WhatSpeciesDidYouCatchUsingGear-3.png`) are three views of one page: default, Atlantic-cod-selected, and expanded-weights.
2. `/species-weight` is removed entirely (not kept as a redirect-only compatibility route) — `/species-selection` becomes the single canonical species journey step.
3. Unsupported species-only selection (Haddock/Salmon without Atlantic cod) on Continue redirects to the reusable Empty Page (`/not-implemented?return=/species-selection`).
4. Weight validation rule: positive decimals only, greater than 0, up to 1 decimal place, maximum `9999.9`.
5. Add species and Remove species remain visible links to the Empty Page, matching the PNGs.

## 3. Existing state found

- `species-selection/controller.js` is a placeholder: static list, no checkboxes, POST unconditionally redirects to `/species-weight`.
- `species-weight/controller.js` is a placeholder: static view, POST unconditionally redirects to `/catch-not-landed`.
- `catch-not-landed/controller.js` currently backs to `/species-weight`.
- `backForSpeciesSelection(request)` in `navigation.js` already correctly branches Back between `/statistical-area` and `/statistical-area-other` — reused unchanged.
- Mock data: `species.js` exports `speciesSelection` (COD/HAD/SAL with `code`/`text`); `species-weights.js` exports `speciesWeights.COD` with `weightAboveMinimum`/`weightBelowMinimum`/`weightDiscarded`/`unit`.
- `SAFE_RETURN_PATHS` in `navigation.js` currently includes `/species-weight`, which must be removed once the route is deleted.

## 4. Implementation Plan

1. Reshape `species.js` if needed to add stable internal `id`s (e.g. `cod`, `had`, `sal`) alongside `code`/`text`, used as checkbox values (not display text).
2. Rewrite `species-selection/controller.js`: single controller flow with a `speciesAction` allowlist (`continue`, `show-selected-species`, `add-below-minimum`, `remove-below-minimum`, `add-legally-discarded`, `remove-legally-discarded`). View-context helper derives page state (default / species-selected / weights-expanded, with independent below-minimum/legally-discarded visibility booleans) from validated payload plus minimal per-request state — no new production session/cache architecture.
3. Rewrite `species-selection/index.njk`: one form, `govukCheckboxes` for the three species, COD-only nested weight controls (primary weight always shown once COD is checked; below-minimum/legally-discarded shown independently via Add/Remove). No `govukErrorSummary` import — the shared layout already renders it.
4. Behaviour: selecting COD and submitting re-renders the same page with the primary weight field and both Add links. Add/Remove actions re-render preserving all other state. Only `continue` with valid supported data proceeds to `/catch-not-landed`. Haddock/Salmon-only + continue → Empty Page.
5. Validation: primary weight required once COD is selected and action is `continue`; visible optional fields required on `continue`; format `> 0`, ≤ 1 decimal place, ≤ `9999.9`; unknown `speciesAction` values rejected via Joi `failAction`.
6. Remove `species-weight` route folder entirely (`controller.js`, `index.njk`, `index.js`, `controller.test.js`), deregister from `router.js`, remove `/species-weight` from `SAFE_RETURN_PATHS`.
7. Update `catch-not-landed/controller.js` Back link to `/species-selection`; update its test.
8. Add minimal page-specific SCSS only for COD weight-group grouping/spacing if GOV.UK components can't reproduce it unaided.
9. Rewrite/expand `species-selection/controller.test.js` covering all states, actions, validation, unsupported-species redirect, branch-aware Back regression, and mock-data non-mutation.

## 5. File/Component Impact

- `src/server/common/data/species.js` (add stable ids if needed)
- `src/server/routes/species-selection/{controller.js,index.njk,controller.test.js}`
- `src/server/routes/species-weight/**` — removed
- `src/server/routes/catch-not-landed/{controller.js,controller.test.js}`
- `src/server/plugins/router.js` — deregister `speciesWeight`
- `src/server/common/helpers/journey/navigation.js` — remove `/species-weight` from `SAFE_RETURN_PATHS`
- possibly one new SCSS partial under `src/client/stylesheets/components/`

## 6. Validation Plan

1. Focused route tests for `species-selection` and `catch-not-landed` first.
2. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
3. Manual (deferred): default/selected/below-minimum-only/legally-discarded-only/expanded states, both statistical-area branches, keyboard, JS-disabled, 200% zoom.

## 7. Risks, Assumptions and Sources

- Removing `/species-weight` is a deliberate architecture correction per the prompt's mandatory single-page requirement.
- Add/Remove weight controls are implemented as same-form submit actions (links/buttons posting a fixed `speciesAction` value), not JS-only reveals, so the flow works without JavaScript.
- Sources: the three Step 13 PNGs, existing `species-selection`/`species-weight`/`catch-not-landed` routes, the Step 12 branch-aware Back implementation, existing Step 03 species/weight mock data.
