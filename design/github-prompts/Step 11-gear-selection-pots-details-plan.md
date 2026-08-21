# Step 11 — Gear Selection and Pots Details (Approved Plan)

## 1. Objective

Single page `/gear-selection`: `govukCheckboxes` "Select all that apply" (9 gear options with hints), with Pots's checkbox carrying a GOV.UK conditional reveal containing the two pots number fields. One form, one submission. The separate `/pots-details` route is removed (superseded).

## 2. Approved decisions

- **Q1 (architecture):** Inline conditional reveal on Gear Selection — NOT a separate page. The existing `/pots-details` route is removed.
- **Q2 (gear list):** Expand `gear.js` to 9 checkbox options (stable kebab-case IDs, never labels, as values): Beam trawl · Bottom otter trawl (hint: 80mm mesh) · Dredge (hint: 2 dredges) · Handlines and pole lines (hand operated) · Miscellaneous gear (diving) · Pots · Seine nets (not specified) (hint: 100mm mesh) · Trammel net (hint: 80mm mesh) · Traps.
- **Q3:** "Add gear" renders as a link to `/not-implemented?return=/gear-selection`. "Remove gear" is not rendered at all in this step.
- **Q4:** Second pots field label is exactly "Total pots or traps left in the water" (property name in data/journey-state stays `potsInWater`, only the visible label changes).

## 3. Implementation Plan

**Gear data** (`gear.js`, reshaped from the old 2-item single-select set):

```js
{
  ;(id, label, hint, requiresPotsDetails, displayOrder)
}
```

9 items as listed above; only Pots has `requiresPotsDetails: true`.

**Pots fields** (unchanged property names `potsHauled`/`potsInWater` in `pots-details.js`, only visible labels change): "Total pots or traps hauled" and "Total pots or traps left in the water", rendered as `govukInput` with `inputmode="numeric"`, inside the Pots checkbox's `conditional.html`.

**Controller** (`gear-selection/controller.js`):

- GET: restore `selectedGearIds` (checkboxes ticked) and `potsDetails` (fields pre-filled) from journey state via `getJourneyState`.
- POST: Joi validates submitted gear values are a non-empty array/string, each present in the approved 9 ids (unknown → rejected); if `pots` is among the selections, additionally require `potsHauled`/`potsInWater` as whole non-negative numbers (reusing the Step 09 `failAction`-style re-render pattern: same view + `govukErrorSummary`/`fieldErrors`, preserved submitted values, 400).
- On success: `setJourneyState(request, { selectedGearIds, potsDetails: potsSelected ? { potsHauled, potsInWater } : undefined })` — explicit stale-data rule: if Pots is not selected this submission, `potsDetails` is cleared from journey state. Redirect to `/statistical-area` always (no Empty Page branching for "unsupported gear").
- Back → `/return-port` (unchanged).
- Add gear → `/not-implemented?return=/gear-selection` link. Remove gear → not rendered.

**Removed**: `src/server/routes/pots-details/` (controller, index.njk, index.js, test) and its router registration.

## 4. File/Component Impact

- `src/server/common/data/gear.js` (reshaped), `src/server/common/data/pots-details.js` (labels only, via template — data property names unchanged)
- `src/server/routes/gear-selection/{controller.js,index.njk,controller.test.js}`
- `src/server/common/data/get-data.test.js` (update assertions for the new gear shape)
- `src/server/plugins/router.js` (deregister `pots-details`)
- Remove: `src/server/routes/pots-details/**`

## 5. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Tests per the source prompt §21 (data shape/uniqueness; GET renders 9 checkboxes + restores selection + restores pots values when Pots was previously selected; valid submit without Pots → `/statistical-area`, `potsDetails` absent; valid submit with Pots + valid numbers → `/statistical-area`, `potsDetails` saved; missing gear selection → 400 + error summary; unknown gear id → 400; Pots selected but pots fields missing/non-numeric → 400 with field-specific errors; deselecting Pots after previously saving pots data clears it; Back → `/return-port`; unrelated journey state e.g. `departurePort`/`returnPort` untouched; `/pots-details` route no longer exists).
3. Manual (deferred): keyboard, checkbox conditional-reveal behaviour (works without JS — reveal content is always in the DOM per GDS progressive enhancement), 320/768/1024/1440px, 200% zoom, JS-disabled.

## 6. Risks, Assumptions and Sources

- Removing `/pots-details` is a deliberate cleanup since it becomes dead/unreachable once the reveal is inline — approved as part of the Q1 architecture decision.
- Gear-selection routing no longer branches to Empty Page for "unsupported" gear — per the source prompt §10, the only branching rule is pots-required vs not; any valid combination of the 9 gear options proceeds to `/statistical-area`.
- Sources: `WhatGearDidYouUsed.png`, `WhatGearDidYouUse-2.png` (verbatim wording/hints), existing `journey/navigation.js` helpers, the Step 09/10 Joi `failAction` error-summary pattern.
