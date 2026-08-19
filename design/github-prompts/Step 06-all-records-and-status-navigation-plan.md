# Step 06 — All Records and Status-Based Navigation (Approved Plan)

## 1. Objective

Replace the All Records placeholder with the detailed "Catch records for James Smith" page from `design/screens/DashboardJamesSmith.png`, driven by Step 03 mock data, with status-based routing kept in the controller/helper (not templates).

## 2. Page order (per PNG)

Shared shell → `govukNotificationBanner` "Important" notice → "Vessel owner" caption → `h1` "Catch records for James Smith" → `govukTable` (Trip end date · Vessel · Status · Created by) → "Showing 1 to 4 of 4" → `govukPagination` → green "Create a new catch record" button → `govukDetails` "How to record a catch" → shared footer.

## 3. Implementation Plan

1. **Mock data (Step 03 extensions to match the design):**
   - `records.js`: reorder to Submitted, Amended, Unsent, Late; update `tripEndDate` to the PNG dates (`2026-07-22`, `2026-07-15`, `2026-07-10`, `2026-07-15`); set `createdBy` display values to `J.Smith` / `A.Jones` per the PNG (canonical `status` and `recordId` unchanged — routing is unaffected). Update `get-data`/records tests.
   - `account.js`: add `role: 'Vessel owner'`.
   - `service.js` (or a small notice value): add the service-availability notice text/title.
2. **Status display mapping** (label + `govukTag` colour: submitted→green, amended→blue, unsent→yellow, late→red) as a tiny constant/helper — display only, kept separate from `resolveRecordDestination` (navigation). Status is always shown as text in the tag (never colour alone).
3. **Pagination + results view model**: a tested helper `buildPagination({ total, page, pageSize })` returning `{ currentPage, pageSize, total, firstItem, lastItem, pageItems }` → "Showing 1 to 4 of 4", one page. Joi-validate/clamp an optional `?page` query. No backend/session.
4. **Controller** (`src/server/routes/records/controller.js`): build rows `{ recordId, status, statusLabel, tagColour, tripEndDate, vesselName, createdBy, href }` from `getData('allRecords')` (href already via `resolveRecordDestination`: unsent→`/draft`, others→`/records/{id}`); pass `account` name + role, notice, pagination, results text. Thin controller, no mutation of source data.
5. **Template** (`src/server/routes/records/index.njk`): `appHeading` (caption "Vessel owner", text "Catch records for James Smith" from data), notification banner, `govukTable` with the date cell as the record link plus a visually-hidden distinguisher (dates repeat — e.g. "22 Jul 2026 — Submitted record") for screen readers, `govukTag` status cells, `govukPagination`, `govukButton` create action → `/draft`, `govukDetails` "How to record a catch". Trip-end date formatted via the existing `format-date` filter.
6. **Tests**: page renders (title/h1 with James Smith, Vessel owner, notice, 4 rows, all 4 statuses, headers in order, results text, no placeholder sentence); navigation (create/unsent→`/draft`; submitted/amended/late→`/records/{id}`; canonical-status-driven; unknown id → safe 404 via existing record-details); pagination helper unit tests (first/last/total/clamp); DOM order (pagination after table+count, before create action); data sourced via accessor and source not mutated; regressions green.

## 4. File/Component Impact

- `src/server/routes/records/controller.js`, `src/server/routes/records/index.njk`, `src/server/routes/records/controller.test.js`
- `src/server/common/data/records.js`, `src/server/common/data/account.js`, `src/server/common/data/service.js` (+ `get-data`/data tests)
- New helper + test for pagination (e.g. `src/server/common/helpers/journey/pagination.js`) and status display map
- Shared partial for the "How to record a catch" guidance block, extracted from Step 04's Guidance page and reused here (Decision A)

## 5. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. `server.inject` assertions above; confirm Sign In → All Records and Your account → Account still work; existing Steps 02–05 suites green (same 2 known pre-existing branch-aware Back-link failures unrelated to this step).
3. Manual (deferred): keyboard, 320/768/1440px, 200% zoom, JS-disabled record links + create action, table reflow.

## 6. Risks, Assumptions and Sources

- Design is source of truth for row order, dates, and `createdBy` display values → mock data updated to match (canonical status/routing untouched).
- Status via `govukTag` colour variants **with text** — standard GDS, a11y-safe.
- Trip-end date is the only per-row link; no JS-only row click target.
- **Decision (Q1 — pagination "Next"):** the PNG shows a Next link but there are only 4 records = one truthful page. Per the prompt's "never imply nonexistent data" rule, render a truthful single page with no Next link (keeping "Showing 1 to 4 of 4"), and record the omission of the PNG's Next control as a documented GDS/design deviation.
- **Decision (Q2 — "How to record a catch" content):** extract the 5 subsections into a shared Nunjucks partial reused by both the Step 04 Guidance page and this page's `govukDetails`, to avoid content drift.
