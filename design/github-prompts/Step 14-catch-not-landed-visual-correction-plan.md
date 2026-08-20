# Step 14 — Catch Not Landed Visual Correction (Approved Plan)

## 1. Objective

Correct the existing, already-functioning Catch Not Landed page so it visually and textually matches the approved Figma/target PNG, without changing any routing, controller redirect logic, or destinations.

## 2. Implementation Plan

1. Update `catch-not-landed/controller.js`: change `pageTitle`/`heading` to `'Is there any catch you won't be landing straight away?'`, add `caption: 'New catch record'` to the GET view context. Add a `failAction` to the POST route validation for the missing-selection accessible error state (error summary + radio group error), matching the established `return-port`/`statistical-area` pattern. POST redirect logic (`no` → `/check-answers`, `yes` → `/not-implemented?return=/catch-not-landed`) and Back link (`/species-selection`) stay unchanged.
2. Rewrite `catch-not-landed/index.njk`: remove the `appPlaceholderPage` import/call (removes placeholder paragraph + duplicate heading), use `govukRadios` with the fieldset legend as the single `h1` (caption + heading), add the hint text, rename the button to "Save and continue". No `govukErrorSummary` import (shell renders it).
3. Update `catch-not-landed/controller.test.js`: update title/heading assertions, add assertions that the old heading and placeholder text are absent, hint text renders, button says "Save and continue", add a missing-selection error-state test. Existing Yes/No/Back destination tests remain unchanged.

## 3. File/Component Impact

- `src/server/routes/catch-not-landed/controller.js`
- `src/server/routes/catch-not-landed/index.njk`
- `src/server/routes/catch-not-landed/controller.test.js`

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`.
2. Browser check: default view matches target PNG, missing-selection error state, Yes/No/Back destinations unchanged, keyboard/200% zoom/JS-disabled.

## 5. Risks, Assumptions and Sources

- Figma and target PNG agree exactly with the prompt's specified copy — no conflict.
- Adding `failAction` is a small, spec-required addition mirroring the established pattern used by every other form page in this app (e.g. `return-port`, `statistical-area`), not a new architecture.
- Sources: `design/screens/IsThereACatchNoLanding.png`, `design/screens/CatchNoLandedCurrent.png` (defect evidence), existing `return-port/controller.js` pattern.
