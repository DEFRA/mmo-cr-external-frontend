# Step 21 — Edit Catch Record Journey (Approved Plan)

## 1. Objective

Wire "Edit catch record" on Catch Record Details into a two-page amendment journey — an edit-reason page, then an amendment-mode variant of Check Your Answers ("Editing catch record") — reusing Check Your Answers' summary components rather than duplicating them. Frontend walkthrough only, no real persistence.

## 2. Implementation Plan

1. Extract the summary-sections loop from `check-answers/index.njk` into a shared macro `common/components/catch-record-summary-sections/macro.njk`, and the declaration block (warning text/bullets/checkbox) into `common/components/catch-record-declaration/macro.njk`. Both Check Your Answers and the new review page import these.
2. Refactor `check-answers/view-model.js`'s `buildCheckAnswersViewModel(request, options)` to accept an optional `buildChangeHref(wizardPath)` callback (default = current `?return=/check-answers` behaviour, unchanged for create mode). Amendment mode passes an override that always returns `/not-implemented?return=/records` (a fixed, already-safe destination).
3. New `common/helpers/journey/amendment.js`: `getAmendmentState`/`setAmendmentState`/`clearAmendmentState`, reusing the existing yar session under a new `amendment` key.
4. New route `edit-catch-record-reason` (`GET/POST /records/{recordId}/edit-reason`): validates `recordId` (404 if unknown); `govukTextarea` "Why are you editing this catch record?" (page-heading label) with "Include:" hint bullets; `govukWarningText`; `govukNotificationBanner` ("Important" / derived from `catchRecordDetails.returnDate`); required-reason validation with accessible error + preserved value; POST stores `{recordId, reason}` in the amendment session and redirects (303) to `/records/{recordId}/edit-review`.
5. New route `edit-catch-record-review` (`GET/POST /records/{recordId}/edit-review`): GET verifies the amendment session's `recordId` matches the URL (redirects back to the reason page if missing/mismatched); heading `Catch record for ${vessel}`; new notification ("Catch record submitted: â€¦" / "Submitted by: â€¦"); same 4 summary sections + declaration as Check Your Answers via the shared macros. POST validates the same checkbox, clears the amendment session, redirects (303) to `/confirmation`.
6. `record-details/controller.js`/`index.njk`: "Edit catch record" href changes from `/not-implemented?return=/records/{recordId}` to `/records/{recordId}/edit-reason`. Download PDF and other actions unchanged.
7. Extend `common/data/catch-record-details.js` with `submittedDate: '2026-07-22'`, `submittedTime: '01:35'`, `submittedBy: 'John Smith'`.

## 3. File/Component Impact

- New: `src/server/routes/edit-catch-record-reason/{controller.js,index.js,index.njk,controller.test.js}`
- New: `src/server/routes/edit-catch-record-review/{controller.js,index.js,index.njk,controller.test.js}`
- New: `src/server/common/helpers/journey/amendment.js` (+ test)
- New: `src/server/common/components/catch-record-summary-sections/macro.njk`, `src/server/common/components/catch-record-declaration/macro.njk`
- Modified: `src/server/routes/check-answers/{view-model.js,index.njk}` (+ view-model.test.js), `src/server/routes/record-details/{controller.js,index.njk,controller.test.js}`, `src/server/common/data/catch-record-details.js`, `src/server/plugins/router.js`

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Manual: Details → Edit → reason error/valid states → review notification/sections/Change links → submit → Confirmation; confirm create-mode Check Your Answers unchanged; 320–1440px, 200% zoom, keyboard, JS-disabled.

## 5. Risks, Assumptions and Sources

- Amendment Change links go to `/not-implemented?return=/records` rather than back into the live wizard — full return-to-review for every Change link is explicitly out of scope; avoids extending the shared return-path allowlist to dynamic segments.
- The stray duplicate phase-banner block visible in the review PNG is treated as an export artifact and not reproduced.
- `submittedDate`/`submittedTime`/`submittedBy` are new, independent mock fields with no existing matching data source.
- Sources: `design/screens/WhyAreYouEndingThisCatchRecord.png`, `design/screens/CatchRecordForVessel - edit.png`, `design/screens/CatchRecordsForVessel.png`, existing `check-answers` (Step 15) and `confirmation` (Step 16) implementations.
