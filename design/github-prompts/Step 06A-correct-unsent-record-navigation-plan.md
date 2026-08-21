# Step 06A — Correct Unsent Record Navigation (Approved Plan)

## 1. Objective

Correct All Records navigation so clicking an Unsent record's trip-end date opens Catch Record Details (like Submitted/Amended/Late), instead of "What do you want to do with your draft record?". "Create a new catch record" continues to open Create Draft Record.

## 2. Implementation Plan

1. `record-details/controller.js`: remove the `if (record.status === 'unsent') return h.redirect('/draft')` branch so every matched record (any status) falls through to the same generic details render (`getData('catchRecordDetails')`); update the stale doc comment.
2. `records/controller.js`: `toRowViewModel`'s `href` becomes `/records/${record.recordId}` for every record — drop the `resolveRecordDestination(...)` branch and its import.
3. Delete `common/helpers/journey/records.js` (`resolveRecordDestination`) and its test file — fully unused dead code once step 2 lands.
4. Update tests:
   - `record-details/controller.test.js`: replace "Should redirect an unsent record to the draft page" with a test asserting `/records/unsent-1` renders Catch Record Details (200, matching the existing submitted-record assertions).
   - `records/controller.test.js`: "Should link the unsent record to the draft page" → now only the Create button links to `/draft` (1 link); add `unsent-1` to the "links to their details pages" assertion.
5. Update living documentation `design/docs/Navigation Rules.md` (§7 "Unsent record" section, §9's "Both creation entry points" list, §20 checklist line) to the corrected rule. Historical Step 02/06/08 prompt files are left untouched.

## 3. File/Component Impact

- `src/server/routes/record-details/controller.js`
- `src/server/routes/record-details/controller.test.js`
- `src/server/routes/records/controller.js`
- `src/server/routes/records/controller.test.js`
- `design/docs/Navigation Rules.md`
- Deleted: `src/server/common/helpers/journey/records.js`, `src/server/common/helpers/journey/records.test.js`

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Manual browser check: Create action → Create Draft Record; Unsent/Submitted/Amended/Late dates → Catch Record Details; Back → All Records; Edit link regression; JS-disabled navigation; confirm no visual/pagination change to All Records.

## 5. Risks, Assumptions and Sources

- Step 21 (Edit Catch Record) is not yet implemented in this repo, so no regression risk there.
- Catch Record Details already renders one generic mock record regardless of status/recordId, so no Unsent-specific mock-data fields are missing — no data changes required.
- Sources: `src/server/routes/record-details/controller.js`, `src/server/routes/records/controller.js`, `src/server/common/helpers/journey/records.js`, `design/docs/Navigation Rules.md`.
