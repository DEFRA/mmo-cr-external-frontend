# Step 16 — Confirmation (Approved Plan)

## 1. Objective

Replace the Step 02 Confirmation placeholder with the approved GOV.UK confirmation page: a `govukPanel` (title + reference), "What happens next" heading and approved explanatory content, and a "View your catch records" action — sourced from the existing Step 03 `confirmation` mock-data key, reached only as a safe GET after the Check Your Answers submission.

## 2. Implementation Plan

1. `confirmation/controller.js`: keep the handler thin — `pageTitle`/`heading` = "Catch record submitted", `reference` from `getData('confirmation')` (unchanged, deterministic, not mutated), add `backLink: { href: '/records', text: 'Back' }` (matches the PNG's shell Back link; points to `/records` rather than `/check-answers` so it can never resubmit or loop back into the form).
2. `confirmation/index.njk`: remove `appPlaceholderPage`. Render `govukPanel({ titleText: "Catch record submitted", html: 'Your reference number<br><strong>' + reference + '</strong>' })`, then `<h2 class="govuk-heading-m">What happens next</h2>` with the approved explanatory body copy, then `govukButton({ text: "View your catch records", href: "/records" })`. No Edit/second-submit action; no browser-history navigation.
3. `confirmation/controller.test.js`: update the page-title/heading assertions to the panel wording; replace the existing "Should NOT render a Back link" test with one asserting the Back link renders and points to `/records` (matches the PNG); keep/extend the reference-rendering assertion (sourced from `getData('confirmation')`, not hard-coded) and the "View your catch records" destination test; add a check that no Step 02 placeholder text remains.

## 3. File/Component Impact

- `src/server/routes/confirmation/controller.js`
- `src/server/routes/confirmation/index.njk`
- `src/server/routes/confirmation/controller.test.js`

No changes to `records`, `check-answers`, the shared shell, or mock-data files (the existing `confirmation.js` reference/key is reused as-is).

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. Manual browser pass: reach `/confirmation` via the Check Your Answers submit and directly by GET; panel width/colour/padding/typography, reference wrapping, spacing before "What happens next", button destination (`/records`), Back link destination (`/records`); 320/768/1024/1440px; 200% zoom; keyboard focus/order; JavaScript-disabled.
3. Confirm repeated GET requests to `/confirmation` produce no side effects (no API/DB/session/cache mutation — none exist today).

## 5. Risks, Assumptions and Sources

- **User-approved assumption**: the PNG's Back link is reproduced and points to `/records` (same destination as the primary action), not `/check-answers`, to avoid any appearance of re-submission.
- No GDS deviation anticipated — `govukPanel` and `govukButton` used as designed.
- Sources: `design/screens/YourCatchRecordSubmitted.png`, existing `common/data/confirmation.js` (Step 03), existing `records` route as the fixed destination.
